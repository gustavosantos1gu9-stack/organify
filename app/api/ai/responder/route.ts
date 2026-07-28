import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvailableSlots, getAvailableSlotsMultipleDays, createEvent, findEvents, deleteEvent } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Simular digitação antes de enviar (mostra "digitando..." no WhatsApp do lead)
async function enviarComDigitacao(evoUrl: string, evoKey: string, instancia: string, destino: string, texto: string) {
  // 1. Enviar presença "composing" (digitando...)
  try {
    await fetch(`${evoUrl}/chat/sendPresence/${instancia}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({ number: destino, presence: "composing", delay: Math.min(Math.max(texto.length * 10, 800), 1500) }),
    });
  } catch {}

  // 2. Delay curto para simular digitação (não bloquear resposta)
  const chars = texto.length;
  const delay = Math.min(Math.max(chars * 10, 800), 1500); // 0.8s mínimo, 1.5s máximo
  await new Promise(resolve => setTimeout(resolve, delay));

  // 3. Enviar mensagem
  const res = await fetch(`${evoUrl}/message/sendText/${instancia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: evoKey },
    body: JSON.stringify({ number: destino, text: texto }),
  });
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id, mensagem_lead, skip_delay } = await req.json();
    if (!agencia_id || !conversa_id || !mensagem_lead) {
      return NextResponse.json({ ok: false, motivo: "Dados incompletos" });
    }

    // 1. Buscar config da agência
    const { data: ag } = await supabase.from("agencias").select(
      "openai_key, openai_ativo, openai_modelo, openai_prompt_sistema, openai_max_tokens, openai_temperatura, openai_contexto_mensagens, openai_horario_inicio, openai_horario_fim, evolution_url, evolution_key, whatsapp_instancia, parent_id, google_calendar_refresh_token, google_calendar_ativo, agendamento_ativo, reuniao_tipo, reuniao_link_customizado, reuniao_duracao_minutos, reuniao_horario_inicio, reuniao_horario_fim, reuniao_dias_semana, reuniao_intervalo_minutos, servicos_agenda, zoom_refresh_token, zoom_ativo, nome, ia_debounce_segundos, ia_delay_resposta_segundos, ia_delay_conversa_ativa_segundos, openai_whisper_key"
    ).eq("id", agencia_id).single();

    if (!ag) return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });
    if (!ag.openai_ativo || !ag.openai_key) return NextResponse.json({ ok: false, motivo: "IA não ativa" });
    if (!ag.openai_prompt_sistema) return NextResponse.json({ ok: false, motivo: "Prompt não configurado" });

    // 1a. Anti-duplicate: verificar ANTES do debounce se já existe resposta da IA
    // após a mensagem atual do lead — evita chamadas concorrentes (webhook + poll-lid)
    const { data: msgLeadAtual } = await supabase.from("mensagens")
      .select("id, created_at")
      .eq("conversa_id", conversa_id)
      .eq("de_mim", false)
      .eq("conteudo", mensagem_lead)
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (msgLeadAtual) {
      const { data: respostaExistente } = await supabase.from("mensagens")
        .select("id")
        .eq("conversa_id", conversa_id)
        .eq("enviada_por_ia", true)
        .gt("created_at", msgLeadAtual.created_at)
        .limit(1);
      if (respostaExistente?.length) {
        return NextResponse.json({ ok: false, motivo: "Já existe resposta IA para esta mensagem" });
      }
    }

    // 1b. Debounce: esperar X segundos pra agrupar mensagens consecutivas do lead
    // skip_delay=true pula o debounce (chamadas manuais, poll-lid, ia-retomar)
    // Limite de 120s (maxDuration=300 dá margem suficiente pra OpenAI + envio)
    const debounceRaw = skip_delay ? 0 : ((ag as any).ia_debounce_segundos || 8);
    const debounceMs = Math.min(debounceRaw, 120) * 1000;
    if (debounceMs > 0) await new Promise(r => setTimeout(r, debounceMs));

    // Verificar se chegaram mensagens mais recentes do lead (outra chamada responde)
    const { data: msgMaisRecente } = await supabase.from("mensagens")
      .select("conteudo").eq("conversa_id", conversa_id).eq("de_mim", false)
      .order("created_at", { ascending: false }).limit(1).single();
    if (msgMaisRecente && msgMaisRecente.conteudo !== mensagem_lead) {
      return NextResponse.json({ ok: false, motivo: "Mensagem mais recente detectada, abortando" });
    }

    // Re-verificar após debounce: outra chamada concorrente pode ter respondido durante a espera
    if (msgLeadAtual) {
      const { data: respostaAposDebounce } = await supabase.from("mensagens")
        .select("id")
        .eq("conversa_id", conversa_id)
        .eq("enviada_por_ia", true)
        .gt("created_at", msgLeadAtual.created_at)
        .limit(1);
      if (respostaAposDebounce?.length) {
        return NextResponse.json({ ok: false, motivo: "Resposta enviada durante debounce" });
      }
    }

    // 1c. ia_delay_conversa_ativa removido: causa timeout sem benefício real
    // O debounce (acima) já agrupa mensagens consecutivas do lead adequadamente.

    // 2. Verificar horário de funcionamento (horário de Brasília)
    if (ag.openai_horario_inicio && ag.openai_horario_fim) {
      const agora = new Date();
      const brTime = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const hhmm = `${String(brTime.getHours()).padStart(2, "0")}:${String(brTime.getMinutes()).padStart(2, "0")}`;
      if (hhmm < ag.openai_horario_inicio || hhmm > ag.openai_horario_fim) {
        return NextResponse.json({ ok: false, motivo: "Fora do horário" });
      }
    }

    // 3. Verificar se humano já respondeu recentemente (últimos 5 min)
    const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: respostasRecentes } = await supabase.from("mensagens")
      .select("id").eq("conversa_id", conversa_id).eq("de_mim", true).eq("enviada_por_ia", false)
      .gt("created_at", cincoMinAtras).limit(1);
    if (respostasRecentes?.length) {
      return NextResponse.json({ ok: false, motivo: "Humano respondeu recentemente" });
    }

    // 3b. Transcrever áudios pendentes no histórico recente
    try {
      const { data: audiosPendentes } = await supabase.from("mensagens")
        .select("id, mensagem_id, conteudo, tipo")
        .eq("conversa_id", conversa_id).eq("tipo", "audio").eq("de_mim", false)
        .in("conteudo", ["🎵 Áudio", "[Áudio]"])
        .order("created_at", { ascending: false }).limit(3);

      if (audiosPendentes?.length) {
        // Buscar chave Whisper
        let whisperKey = (ag as any).openai_whisper_key || "";
        if (!whisperKey && ag.parent_id) {
          const { data: parentW } = await supabase.from("agencias")
            .select("openai_whisper_key").eq("id", ag.parent_id).single();
          whisperKey = parentW?.openai_whisper_key || "";
        }
        if (!whisperKey) {
          const k = ag.openai_key || "";
          if (k && !k.startsWith("sk-ant-")) whisperKey = k;
        }

        if (whisperKey) {
          // Buscar Evolution URL
          let evoUrlT = ag.evolution_url || "";
          let evoKeyT = ag.evolution_key || "";
          if (!evoUrlT && ag.parent_id) {
            const { data: parentE } = await supabase.from("agencias")
              .select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
            if (parentE) { evoUrlT = parentE.evolution_url || ""; evoKeyT = parentE.evolution_key || ""; }
          }

          // Buscar contato_jid da conversa para passar na chamada Evolution
          const { data: convJid } = await supabase.from("conversas")
            .select("contato_jid, contato_numero").eq("id", conversa_id).single();
          const remoteJidAudio = convJid?.contato_jid || (convJid?.contato_numero ? `${convJid.contato_numero}@s.whatsapp.net` : "");

          for (const audio of audiosPendentes) {
            try {
              // Passar key completa com remoteJid e fromMe para a Evolution conseguir localizar a mídia
              const convertRes = await fetch(`${evoUrlT}/chat/getBase64FromMediaMessage/${ag.whatsapp_instancia}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoKeyT },
                body: JSON.stringify({
                  message: {
                    key: { id: audio.mensagem_id, remoteJid: remoteJidAudio, fromMe: false },
                    messageType: "audioMessage",
                  },
                }),
              });
              if (!convertRes.ok) {
                const errText = await convertRes.text();
                console.error(`[IA] getBase64 falhou ${convertRes.status}:`, errText);
                continue;
              }
              const b64Data = await convertRes.json();
              const base64Audio = b64Data.base64 || b64Data.data;
              if (!base64Audio) {
                console.error("[IA] getBase64 sem dados de áudio:", JSON.stringify(b64Data).slice(0, 200));
                continue;
              }

              const audioBuffer = Buffer.from(base64Audio, "base64");
              const formData = new FormData();
              formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "audio.ogg");
              formData.append("model", "whisper-1");
              formData.append("language", "pt");
              const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: { Authorization: `Bearer ${whisperKey}` },
                body: formData,
              });
              const whisperData = await whisperRes.json();
              if (whisperData.text) {
                const transcrito = `[Áudio transcrito]: ${whisperData.text}`;
                await supabase.from("mensagens").update({ conteudo: transcrito }).eq("id", audio.id);
                console.log(`[IA] Áudio transcrito: ${whisperData.text.slice(0, 80)}`);
              }
            } catch (ae: any) {
              console.error(`[IA] Erro transcrição áudio ${audio.id}:`, ae.message);
            }
          }
        }
      }
    } catch (audioErr: any) {
      console.error("[IA] Erro geral transcrição:", audioErr.message);
    }

    // 4. Buscar histórico de mensagens e dados do lead
    const limite = ag.openai_contexto_mensagens || 10;
    const { data: historico } = await supabase.from("mensagens")
      .select("conteudo, de_mim, enviada_por_ia")
      .eq("conversa_id", conversa_id)
      .order("created_at", { ascending: false })
      .limit(limite);

    const { data: convDados } = await supabase.from("conversas")
      .select("contato_nome, contato_numero, ia_ativada").eq("id", conversa_id).single();
    const nomeWhatsApp = convDados?.contato_nome || "";

    // 5. Montar mensagens — injetar contexto de agendamento se ativo
    const temRespostaAnterior = historico?.some(m => m.de_mim && m.enviada_por_ia);
    const iaJaAtivada = !!convDados?.ia_ativada;

    // Se já há respostas anteriores da IA, sobrescrever regra de ativação ANTES do prompt
    // Se ia_ativada=true mas sem respostas anteriores, adicionar prefix de primeira ativação
    let systemPromptFinal: string;
    if (temRespostaAnterior) {
      systemPromptFinal = `CONVERSA JÁ ATIVA — REGRA ABSOLUTA: Esta conversa já foi iniciada e você já respondeu antes. A seção "GATILHO DE ATIVAÇÃO" NÃO se aplica aqui. Não use [SINALIZAR] nem fique em silêncio. Responda a mensagem atual continuando o fluxo de atendimento normalmente.\n\n---\n\n${ag.openai_prompt_sistema}`;
    } else if (iaJaAtivada) {
      systemPromptFinal = `ATIVAÇÃO CONFIRMADA — REGRA ABSOLUTA: A cliente já enviou a mensagem de ativação e esta conversa foi ativada. Inicie o atendimento com a MENSAGEM INICIAL e responda normalmente. NÃO use [SINALIZAR] nem fique em silêncio. Ignore qualquer regra da seção "GATILHO DE ATIVAÇÃO" — a ativação já ocorreu e você DEVE iniciar o fluxo.\n\n---\n\n${ag.openai_prompt_sistema}`;
    } else {
      systemPromptFinal = ag.openai_prompt_sistema;
    }

    // Injetar nome do lead no contexto
    systemPromptFinal += `\n\nINFORMAÇÕES DO LEAD:
- Nome do WhatsApp: ${nomeWhatsApp || "não identificado"}
- Se o nome do WhatsApp parecer genérico, incompleto ou não for um nome de pessoa (ex: emojis, nome de empresa), pergunte o nome da pessoa logo no início da conversa.
- IMPORTANTE: Quando for agendar, SEMPRE pergunte o nome completo da pessoa antes de confirmar. Use o nome completo que a pessoa informar no agendamento, NÃO o nome do WhatsApp.`;

    if (ag.agendamento_ativo && ag.google_calendar_ativo && ag.google_calendar_refresh_token) {
      const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const diasSemana = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

      // Carregar tipos de serviço configurados
      let servicosAgenda: { nome: string; duracao_minutos: number }[] = [];
      try {
        const raw = (ag as any).servicos_agenda;
        if (raw) servicosAgenda = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {}
      servicosAgenda = servicosAgenda.filter(s => s.nome?.trim());

      const baseConfig = {
        horario_inicio: ag.reuniao_horario_inicio || "09:00",
        horario_fim: ag.reuniao_horario_fim || "18:00",
        dias_semana: ag.reuniao_dias_semana || [1,2,3,4,5],
        intervalo_minutos: ag.reuniao_intervalo_minutos || 0,
      };

      // Datas dos próximos 14 dias (para garantir opções no próximo mês)
      const dates: string[] = [];
      const dateLabels: Record<string, string> = {};
      for (let i = 1; i <= 14; i++) {
        const d = new Date(Date.now() + i * 86400000);
        const dataStr = fmtDate(d);
        const brDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        dates.push(dataStr);
        dateLabels[dataStr] = diasSemana[brDate.getDay()];
      }

      const tipoMap: Record<string,string> = { zoom: "Zoom", google_meet: "Google Meet", presencial: "presencial", link_customizado: "link" };
      const tipoLabel = tipoMap[ag.reuniao_tipo || "google_meet"] || "online";
      const isPresencial = ag.reuniao_tipo === "presencial";
      const nomeEvento = isPresencial ? "procedimentos" : "agendamentos";

      try {
        if (servicosAgenda.length > 0) {
          // MODO MULTI-SERVIÇO: calcular slots por duração única (agrupa serviços de mesma duração)
          const duracoesUnicas = [...new Set(servicosAgenda.map(s => s.duracao_minutos))];

          let blocoServicos = "";
          for (const dur of duracoesUnicas) {
            const servicesComEssaDuracao = servicosAgenda.filter(s => s.duracao_minutos === dur);
            const config = { ...baseConfig, duracao_minutos: dur };
            const resultados = await getAvailableSlotsMultipleDays(ag.google_calendar_refresh_token, dates, config);
            const diasComSlots = resultados.filter(r => r.slots.length > 0).map(r => ({ ...r, diaSemana: dateLabels[r.data] }));
            const nomes = servicesComEssaDuracao.map(s => s.nome).join(", ");
            const slotsTexto = diasComSlots.length === 0
              ? "Sem disponibilidade nos próximos 7 dias."
              : diasComSlots.map(d => `  ${d.diaSemana} (${d.data}): ${d.slots.join(", ")}`).join("\n");
            blocoServicos += `\n▸ ${nomes} (${dur}min):\n${slotsTexto}\n`;
          }

          const nomesList = servicosAgenda.map(s => `"${s.nome}" (${s.duracao_minutos}min)`).join(", ");
          systemPromptFinal += `\n\nAGENDAMENTO AUTOMÁTICO:
Você pode agendar ${nomeEvento} (${tipoLabel}).
Os serviços disponíveis são: ${nomesList}.

Quando o lead confirmar um horário E já tiver informado o nome completo, responda EXATAMENTE neste formato (em uma linha separada no final):
[AGENDAR:YYYY-MM-DD HH:MM NOME:Nome Completo Da Pessoa DURACAO:XX]

Exemplo: [AGENDAR:2026-05-15 14:00 NOME:Maria Santos DURACAO:90]

Horários disponíveis por serviço:
${blocoServicos}
REGRAS:
- SÓ sugira horários EXATAMENTE como aparecem na lista do serviço que a cliente escolheu. NUNCA invente horários.
- Sugira apenas 2 opções (manhã e tarde) do próximo dia disponível para o serviço escolhido.
- ANTES de confirmar, SEMPRE pergunte o nome completo da pessoa.
- No comando [AGENDAR:...], use DURACAO com o número de minutos do serviço escolhido.
- Use EXATAMENTE o horário que a pessoa confirmou. Nunca troque.
- CRÍTICO: Se o lead disser que não pode neste mês (ex: "esse mês não consigo", "esse mês não dá", "mês que vem"), ignore TODOS os horários do mês atual e ofereça apenas horários do próximo mês.`;
        } else {
          // MODO SIMPLES: duração única para todos
          const config = { ...baseConfig, duracao_minutos: ag.reuniao_duracao_minutos || 60 };
          const resultados = await getAvailableSlotsMultipleDays(ag.google_calendar_refresh_token, dates, config);
          const diasComSlots = resultados.filter(r => r.slots.length > 0).map(r => ({ ...r, diaSemana: dateLabels[r.data] }));
          const slotsTexto = diasComSlots.length === 0
            ? "Nenhum horário disponível nos próximos 7 dias."
            : diasComSlots.map(d => `${d.diaSemana} (${d.data}): ${d.slots.join(", ")}`).join("\n");

          systemPromptFinal += `\n\nAGENDAMENTO AUTOMÁTICO:
Você pode agendar ${nomeEvento} (${tipoLabel}, ${ag.reuniao_duracao_minutos || 60}min).
Quando o lead confirmar um horário E já tiver informado o nome completo, responda EXATAMENTE neste formato (em uma linha separada no final):
[AGENDAR:YYYY-MM-DD HH:MM NOME:Nome Completo Da Pessoa]

Exemplo: [AGENDAR:2026-05-15 14:00 NOME:Maria Santos]

Horários disponíveis:
${slotsTexto}

REGRAS DE SUGESTÃO DE HORÁRIOS:
- CRÍTICO: Você SÓ pode sugerir horários que estão EXATAMENTE na lista acima. NUNCA invente horários.
- Sugira apenas 2 opções: um horário pela manhã e um pela tarde, do PRÓXIMO dia disponível.
- NÃO liste todos os horários. Mantenha simples e direto.
- Se não há horários na lista, diga que a agenda está cheia.
- ANTES de confirmar, SEMPRE pergunte o nome completo da pessoa.
- Só envie o comando [AGENDAR:...] DEPOIS que a pessoa confirmar o horário E informar o nome completo.
- Use EXATAMENTE o horário que a pessoa escolheu. Nunca troque.
- CRÍTICO: Se o lead disser que não pode neste mês (ex: "esse mês não consigo", "esse mês não dá", "mês que vem"), ignore TODOS os horários do mês atual e ofereça apenas horários do próximo mês.`;
        }
      } catch (e) {
        console.error("[IA] Erro ao buscar slots:", e);
      }
    }

    // Injetar funis disponíveis no contexto da IA
    const { data: funisAtivos } = await supabase.from("funis")
      .select("id, nome, descricao").eq("agencia_id", agencia_id).eq("ativo", true);
    if (funisAtivos?.length) {
      systemPromptFinal += `\n\nFUNIS DISPONÍVEIS:
Você pode disparar um funil de imagens/mensagens para o lead quando achar apropriado.
Para disparar, inclua na sua resposta (em uma linha separada):
[FUNIL:nome-exato-do-funil]

O texto ANTES do [FUNIL:...] será enviado primeiro. O texto DEPOIS do [FUNIL:...] será enviado APÓS as imagens do funil.

REGRAS DO FUNIL:
- O texto antes do funil deve ser breve e direto (ex: "Vou te mostrar alguns resultados de clientes que passaram por uma situação parecida com a sua.")
- NÃO diga "assim que receber", "quando ver as imagens", "dá uma olhada" ou qualquer coisa que sugira espera. As imagens vão junto na conversa.
- O texto depois do funil deve perguntar diretamente sobre o resultado, como se as imagens já tivessem sido vistas. Ex: "É um resultado parecido com esse que você espera alcançar?"

Funis disponíveis:
${funisAtivos.map(f => `- "${f.nome}"${f.descricao ? `: ${f.descricao}` : ""}`).join("\n")}`;
    }

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPromptFinal },
    ];

    // Histórico em ordem cronológica
    const historicoOrdenado = (historico || []).reverse();
    for (const msg of historicoOrdenado) {
      if (!msg.conteudo) continue;
      // Usar enviada_por_ia como fallback — webhook pode sobrescrever de_mim pra false
      const role = (msg.de_mim || msg.enviada_por_ia) ? "assistant" : "user";
      // Evitar roles consecutivos iguais (Anthropic rejeita)
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === role) {
        lastMsg.content += "\n" + msg.conteudo;
      } else {
        messages.push({ role, content: msg.conteudo });
      }
    }

    // Garantir que a mensagem atual do lead está no array (pode não ter sido salva ainda no banco)
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== mensagem_lead) {
      if (lastMsg && lastMsg.role === "user") {
        // Já tem uma mensagem user no final — verificar se a mensagem_lead já está incluída
        if (!lastMsg.content.includes(mensagem_lead)) {
          lastMsg.content += "\n" + mensagem_lead;
        }
      } else {
        messages.push({ role: "user", content: mensagem_lead });
      }
    }

    // 6. Chamar IA (detectar provider pela key)
    const isAnthropic = ag.openai_key.startsWith("sk-ant-");
    let resposta = "";

    if (isAnthropic) {
      // Claude API (Anthropic)
      const modelo = ag.openai_modelo || "claude-haiku-4-5-20251001";
      const systemPrompt = messages.find(m => m.role === "system")?.content || "";
      const chatMessages = messages.filter(m => m.role !== "system").map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ag.openai_key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelo,
          system: systemPrompt,
          messages: chatMessages,
          max_tokens: ag.openai_max_tokens || 500,
          temperature: Number(ag.openai_temperatura) || 0.7,
        }),
      });

      const anthropicData = await anthropicRes.json();
      if (anthropicData.error) {
        console.error("[IA] Erro Anthropic:", anthropicData.error);
        return NextResponse.json({ ok: false, motivo: anthropicData.error.message });
      }

      resposta = anthropicData.content?.[0]?.text?.trim() || "";
    } else {
      // OpenAI
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ag.openai_key}`,
        },
        body: JSON.stringify({
          model: ag.openai_modelo || "gpt-4o-mini",
          messages,
          max_tokens: ag.openai_max_tokens || 500,
          temperature: Number(ag.openai_temperatura) || 0.7,
        }),
      });

      const openaiData = await openaiRes.json();
      if (openaiData.error) {
        console.error("[IA] Erro OpenAI:", openaiData.error);
        return NextResponse.json({ ok: false, motivo: openaiData.error.message });
      }

      resposta = openaiData.choices?.[0]?.message?.content?.trim() || "";
    }

    if (!resposta) return NextResponse.json({ ok: false, motivo: "Sem resposta da IA" });

    // 6a. Se a IA decidiu não responder ou sinalizou comando interno, abortar silenciosamente
    const respostaTrim = resposta.trim().toUpperCase();
    if (
      respostaTrim === "NAO_RESPONDER" ||
      respostaTrim === "NÃO_RESPONDER" ||
      respostaTrim.startsWith("[SINALIZAR") ||
      respostaTrim.startsWith("[TRANSFERIR") ||
      respostaTrim.startsWith("[ENCAMINHAR")
    ) {
      console.log(`[IA] Comando interno detectado, não enviando: ${resposta.slice(0, 80)}`);
      return NextResponse.json({ ok: false, motivo: "IA sinalizou comando interno" });
    }

    // 6a2. Detectar HANDOFF HUMANO: enviar mensagem ao lead e desativar IA
    const handoffMatch = resposta.match(/\[HANDOFF HUMANO[^\]]*\]/i);
    if (handoffMatch) {
      // Remover a tag da mensagem e enviar o texto humano ao lead
      resposta = resposta.replace(/\[HANDOFF HUMANO[^\]]*\]/gi, "").trim();
      // Desativar IA para esta conversa (humano assume)
      await supabase.from("conversas").update({ ia_ativada: false }).eq("id", conversa_id);
      console.log(`[IA] HANDOFF HUMANO detectado — IA desativada para conversa ${conversa_id}`);
      // Se não sobrou texto, só desativa sem enviar
      if (!resposta) return NextResponse.json({ ok: false, motivo: "HANDOFF sem texto" });
    }

    // Remover labels de instrução do prompt que a IA pode incluir erroneamente
    // Ex: "Mensagem antes da mídia:\n\"texto\"" → "texto"
    // Ex: "Mensagem após a mídia:\n\"texto\"" → "texto"
    resposta = resposta
      .replace(/^(?:Mensagem\s+)?(?:antes|após|depois)\s+da\s+mídia\s*:\s*\n?/gi, "")
      .replace(/^Mensagem\s+(?:antes|após|depois|inicial|de\s+\w+)\s*:\s*\n?/gi, "")
      .replace(/^["""'']/g, "").replace(/["""'']$/g, "")
      .trim();
    // Remover qualquer tag de comando residual que não deveria ir pro lead
    resposta = resposta.replace(/\[SINALIZAR[^\]]*\]/gi, "").replace(/\[TRANSFERIR[^\]]*\]/gi, "").replace(/\[ENCAMINHAR[^\]]*\]/gi, "").trim();
    if (!resposta) return NextResponse.json({ ok: false, motivo: "Resposta ficou vazia após limpar comandos" });

    // 6b. Detectar comando de agendamento na resposta da IA
    console.log(`[IA] Resposta bruta (100chars): ${resposta.slice(-100)}`);
    const agendarMatch = resposta.match(/\[AGENDAR:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+NOME:\s*(.+?))?(?:\s+TIPO:\s*(.+?))?(?:\s+DURACAO:\s*(\d+))?\s*\]/);
    if (agendarMatch && ag.agendamento_ativo && ag.google_calendar_refresh_token) {
      const [, dataAgendar, horarioAgendar, nomeDoComando, tipoDoComando, duracaoDoComando] = agendarMatch;
      try {
        const { data: convInfo } = await supabase.from("conversas")
          .select("contato_nome, contato_numero").eq("id", conversa_id).single();

        // Usar nome do comando [AGENDAR:... NOME:xxx], senão fallback pro WhatsApp
        const nomeAgendamento = nomeDoComando?.trim() || convInfo?.contato_nome || "Lead";

        const duracaoMinutos = duracaoDoComando ? Number(duracaoDoComando) : (ag.reuniao_duracao_minutos || 60);
        const startDt = new Date(`${dataAgendar}T${horarioAgendar}:00-03:00`);
        const endDt = new Date(startDt.getTime() + duracaoMinutos * 60000);
        const tipoReuniao = ag.reuniao_tipo || "google_meet";
        // Usar TIPO do comando se fornecido, senão fallback padrão
        const eventoTipo = tipoDoComando?.trim() || (tipoReuniao === "presencial" ? "Procedimento" : "Reunião");
        const summary = `${eventoTipo} - ${nomeAgendamento}`;
        const description = `Agendado via Secretária IA\nNome: ${nomeAgendamento}\nTipo: ${eventoTipo}\nTelefone: ${convInfo?.contato_numero || "N/A"}`;

        let meetingLink = "";
        const tipo = tipoReuniao;

        if (tipo === "google_meet") {
          const event = await createEvent(ag.google_calendar_refresh_token, {
            summary, description, startDateTime: startDt.toISOString(), endDateTime: endDt.toISOString(), addGoogleMeet: true,
          });
          meetingLink = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || "";
        } else if (tipo === "presencial") {
          await createEvent(ag.google_calendar_refresh_token, {
            summary, description, startDateTime: startDt.toISOString(), endDateTime: endDt.toISOString(),
          });
        } else if (tipo === "link_customizado") {
          await createEvent(ag.google_calendar_refresh_token, {
            summary, description, startDateTime: startDt.toISOString(), endDateTime: endDt.toISOString(),
          });
          meetingLink = ag.reuniao_link_customizado || "";
        } else if (tipo === "zoom" && ag.zoom_refresh_token) {
          const zoomRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
            method: "POST",
            headers: { Authorization: `Bearer ${ag.zoom_refresh_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ topic: summary, type: 2, start_time: startDt.toISOString(), duration: ag.reuniao_duracao_minutos || 60, timezone: "America/Sao_Paulo" }),
          });
          const zoomData = await zoomRes.json();
          meetingLink = zoomData.join_url || "";
          await createEvent(ag.google_calendar_refresh_token, {
            summary, description: `${description}\n\nZoom: ${meetingLink}`, startDateTime: startDt.toISOString(), endDateTime: endDt.toISOString(),
          });
        }

        // Remover o comando da resposta e adicionar link se existir
        resposta = resposta.replace(/\[AGENDAR:[^\]]+\]/, "").trim();
        if (meetingLink) resposta += `\n\nLink da reunião: ${meetingLink}`;

        // Marcar agendou_at + evento_data na conversa
        await supabase.from("conversas").update({
          agendou_at: new Date().toISOString(),
          evento_data: startDt.toISOString(),
          evento_tipo: eventoTipo,
          evento_nome: nomeAgendamento,
        }).eq("id", conversa_id);

        // Atualizar etapa da jornada para "Agendou" (ou etapa com evento_conversao="Lead")
        try {
          const { data: etapaAgendou } = await supabase.from("jornada_etapas")
            .select("nome")
            .eq("agencia_id", agencia_id)
            .or('nome.ilike.%agendou%,nome.ilike.%agendamento%,evento_conversao.eq.Lead')
            .not("eh_primeiro_contato", "is", true)
            .limit(1).single();
          if (etapaAgendou) {
            const { data: convAtual } = await supabase.from("conversas")
              .select("etapa_jornada").eq("id", conversa_id).single();
            await supabase.from("conversas").update({
              etapa_jornada: etapaAgendou.nome,
              etapa_alterada_at: new Date().toISOString(),
            }).eq("id", conversa_id);
            await supabase.from("etapas_historico").insert({
              conversa_id, agencia_id,
              etapa_anterior: convAtual?.etapa_jornada || null,
              etapa_nova: etapaAgendou.nome,
              alterado_por: "ia",
            });
            console.log(`[IA] Etapa jornada atualizada para: ${etapaAgendou.nome}`);
          }
        } catch {}

        console.log(`[IA] Agendamento criado: ${dataAgendar} ${horarioAgendar} (${tipo})`);
      } catch (e) {
        console.error("[IA] Erro ao criar agendamento:", e);
        resposta = resposta.replace(/\[AGENDAR:[^\]]+\]/, "").trim();
      }
    }

    // 6b2. Detectar cancelamento de agendamento
    const cancelarMatch = resposta.match(/\[CANCELAR_AGENDAMENTO\]/i);
    if (cancelarMatch && ag.google_calendar_refresh_token) {
      try {
        // Buscar evento_data e evento_nome da conversa
        const { data: convCancel } = await supabase.from("conversas")
          .select("evento_data, evento_nome, contato_nome").eq("id", conversa_id).single();

        if (convCancel?.evento_data) {
          const nomeEvento = convCancel.evento_nome || convCancel.contato_nome || "";
          const eventoDate = new Date(convCancel.evento_data);
          const timeMin = new Date(eventoDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
          const timeMax = new Date(eventoDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

          // Buscar evento no Google Calendar pelo nome
          const eventos = await findEvents(ag.google_calendar_refresh_token, nomeEvento, timeMin, timeMax);
          for (const ev of eventos) {
            await deleteEvent(ag.google_calendar_refresh_token, ev.id);
            console.log(`[IA] Evento cancelado: ${ev.summary}`);
          }

          // Limpar dados do agendamento na conversa (permite reagendar)
          await supabase.from("conversas").update({
            agendou_at: null, evento_data: null, evento_tipo: null, evento_nome: null,
          }).eq("id", conversa_id);

          // Limpar confirmações de agendamento
          await supabase.from("confirmacoes_agendamento").delete().eq("conversa_id", conversa_id);
        }

        resposta = resposta.replace(/\[CANCELAR_AGENDAMENTO\]/gi, "").trim();
        console.log(`[IA] Agendamento cancelado para conversa ${conversa_id}`);
      } catch (e) {
        console.error("[IA] Erro ao cancelar agendamento:", e);
        resposta = resposta.replace(/\[CANCELAR_AGENDAMENTO\]/gi, "").trim();
      }
    }

    // 6c. Detectar comando de funil na resposta da IA
    const funilMatch = resposta.match(/\[(?:FUNIL|DISPARAR FUNIL|DISPARAR_FUNIL)[:\s]+(.+?)\]/i);
    let posTextoFunil = ""; // Texto que deve ser enviado DEPOIS do funil
    let funilDelayMs = 13000; // delay padrão
    if (funilMatch) {
      const nomeFunil = funilMatch[1].trim();
      // Separar texto antes e depois do comando de funil
      const funilTag = funilMatch[0];
      const partes = resposta.split(funilTag);
      const textoAntes = partes[0].replace(/\[(?:FUNIL|DISPARAR FUNIL|DISPARAR_FUNIL)[:\s]+[^\]]+\]/gi, "").trim();
      const textoDepoisRaw = (partes[1] || "").replace(/\[(?:FUNIL|DISPARAR FUNIL|DISPARAR_FUNIL)[:\s]+[^\]]+\]/gi, "").trim();
      if (textoDepoisRaw) {
        // Limpar labels de instrução no pos_texto (mesmo tratamento do resposta principal)
        posTextoFunil = textoDepoisRaw
          .replace(/^(?:Mensagem\s+)?(?:antes|após|depois)\s+da\s+mídia\s*:\s*\n?/gi, "")
          .replace(/^Mensagem\s+(?:antes|após|depois|inicial|de\s+\w+)\s*:\s*\n?/gi, "")
          .replace(/^["""'']/g, "").replace(/["""'']$/g, "")
          .trim();
      }
      resposta = textoAntes; // Enviar só o texto antes do funil como resposta principal

      const { data: funil } = await supabase.from("funis")
        .select("id").eq("agencia_id", agencia_id).ilike("nome", nomeFunil).eq("ativo", true).single();
      if (funil) {
        // Contar etapas do funil pra calcular delay do pós-texto
        const { data: etapasFunil } = await supabase.from("funil_etapas")
          .select("delay_minutos").eq("funil_id", funil.id).eq("ativo", true);
        const totalEtapas = etapasFunil?.length || 1;
        const totalDelayMin = etapasFunil?.reduce((acc, e) => acc + (e.delay_minutos || 0), 0) || 0;
        // 5s por etapa (envio + digitação) + delays configurados + 3s margem
        const delayFunilMs = (totalEtapas * 5000) + (totalDelayMin * 60000) + 3000;
        funilDelayMs = delayFunilMs;

        const { data: convFunil } = await supabase.from("conversas")
          .select("contato_numero, contato_jid").eq("id", conversa_id).single();
        if (convFunil) {
          const APP_URL_F = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";
          // Disparar funil (fire-and-forget) — pós-texto vai junto pro funil enviar no final
          fetch(`${APP_URL_F}/api/funis/disparar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id, funil_id: funil.id, conversa_id,
              contato_numero: convFunil.contato_numero, contato_jid: convFunil.contato_jid,
              disparado_por: "ia",
              pos_texto: posTextoFunil || undefined,
            }),
          }).catch(() => {});
          console.log(`[IA] Funil disparado: ${nomeFunil} (pos_texto: ${posTextoFunil ? 'sim' : 'não'})`);
        }
      }
    }

    // Se o funil foi disparado e não sobrou texto para enviar, atualizar ultima_mensagem e sair
    if (funilMatch && !resposta) {
      const msgFunil = posTextoFunil || "[funil enviado]";
      await supabase.from("conversas").update({
        ultima_mensagem: msgFunil,
        ultima_mensagem_at: new Date().toISOString(),
      }).eq("id", conversa_id);
      return NextResponse.json({ ok: true, motivo: "Funil disparado sem texto adicional" });
    }

    // 7. Enviar via Evolution API
    let evoUrl = ag.evolution_url || "";
    let evoKey = ag.evolution_key || "";
    if (!evoUrl && ag.parent_id) {
      const { data: parent } = await supabase.from("agencias").select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
      if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
    }

    if (!evoUrl || !evoKey || !ag.whatsapp_instancia) {
      return NextResponse.json({ ok: false, motivo: "WhatsApp não configurado" });
    }

    // Buscar número do lead
    const { data: conv } = await supabase.from("conversas")
      .select("contato_numero, contato_jid").eq("id", conversa_id).single();
    if (!conv) return NextResponse.json({ ok: false, motivo: "Conversa não encontrada" });

    const destino = conv.contato_jid || conv.contato_numero;

    // 8. Anti-duplicata: verificar se IA já respondeu nos últimos 5s (evita race condition de webhooks simultâneos)
    const cincoSegAtras = new Date(Date.now() - 5 * 1000).toISOString();
    const { data: jaRespondeu } = await supabase.from("mensagens")
      .select("id").eq("conversa_id", conversa_id).eq("enviada_por_ia", true)
      .gt("created_at", cincoSegAtras).limit(1);
    if (jaRespondeu?.length) {
      console.log(`[IA] Já respondeu nos últimos 5s, abortando duplicata`);
      return NextResponse.json({ ok: false, motivo: "Já respondeu recentemente" });
    }

    // 9. Quebrar resposta em múltiplas mensagens (por parágrafo / \n\n)
    // Delay limitado a 2s para não estourar maxDuration=60 com múltiplas mensagens
    const delayEntreRespostas = Math.min(((ag as any).ia_delay_resposta_segundos || 2), 2) * 1000;
    const partes = resposta.split(/\n\n+/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    // Se só tem 1 parte ou é curta, enviar tudo junto
    const mensagens = partes.length > 1 ? partes : [resposta];

    let ultimaMsgConteudo = mensagens[mensagens.length - 1];
    let envioOk = true;

    for (let i = 0; i < mensagens.length; i++) {
      const parte = mensagens[i];
      const msgIdPre = `ia_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Salvar no banco
      await supabase.from("mensagens").insert({
        conversa_id, agencia_id, mensagem_id: msgIdPre,
        de_mim: true, tipo: "text", conteudo: parte,
        status: "pending", enviada_por_ia: true, created_at: new Date().toISOString(),
      });

      // Enviar via Evolution API (com simulação de digitação)
      const evoRes = await enviarComDigitacao(evoUrl, evoKey, ag.whatsapp_instancia, destino, parte);

      if (!evoRes.ok) {
        const errText = await evoRes.text();
        console.error(`[IA] Erro Evolution msg ${i + 1}:`, errText);
        await supabase.from("mensagens").delete().eq("mensagem_id", msgIdPre);
        envioOk = false;
        break;
      }

      await supabase.from("mensagens").update({ status: "sent" }).eq("mensagem_id", msgIdPre);

      // Delay entre mensagens (exceto a última)
      if (i < mensagens.length - 1) {
        await new Promise(r => setTimeout(r, delayEntreRespostas));
      }
    }

    if (!envioOk) {
      return NextResponse.json({ ok: false, motivo: "Erro ao enviar WhatsApp" });
    }

    // Atualizar conversa com última mensagem
    await supabase.from("conversas").update({
      ultima_mensagem: ultimaMsgConteudo,
      ultima_mensagem_at: new Date().toISOString(),
    }).eq("id", conversa_id);

    // Pós-texto do funil agora é enviado pelo próprio /api/funis/disparar

    // Detectar e atualizar fase de atendimento
    {
      const ordemFases: Record<string, number> = {
        qualificacao: 1, viu_funil: 2, recebeu_preco: 3, recebeu_horarios: 4, agendou: 5,
      };

      const { data: convFaseAtual } = await supabase.from("conversas")
        .select("fase_atendimento").eq("id", conversa_id).single();
      const faseAtual = convFaseAtual?.fase_atendimento as string | null;

      let novaFase: string | null = null;

      // Prioridade: agendou > recebeu_horarios > viu_funil > recebeu_preco > qualificacao
      if (agendarMatch && ag.agendamento_ativo && ag.google_calendar_refresh_token) {
        novaFase = "agendou";
      } else if (agendarMatch) {
        novaFase = "recebeu_horarios";
      } else if (funilMatch) {
        novaFase = "viu_funil";
      } else if (/\b69[,.]90\b|699[,.]00|R\$\s*69|\bR\$\s*699/i.test(resposta)) {
        novaFase = "recebeu_preco";
      } else if (!faseAtual) {
        novaFase = "qualificacao"; // primeira resposta da IA
      }

      if (novaFase && novaFase !== faseAtual) {
        const podeAtualizar =
          novaFase === "agendou" ||
          !faseAtual ||
          faseAtual === "adiou" ||
          (ordemFases[novaFase] || 0) > (ordemFases[faseAtual] || 0);

        if (podeAtualizar) {
          const updateFase: any = {
            fase_atendimento: novaFase,
            fase_atualizada_em: new Date().toISOString(),
          };
          if (novaFase !== "agendou") {
            updateFase.followup_count = 0; // resetar contador ao avançar fase
          }
          await supabase.from("conversas").update(updateFase).eq("id", conversa_id);
        }
      }
    }

    return NextResponse.json({ ok: true, resposta });
  } catch (e: any) {
    console.error("[IA] Exceção:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
