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
  let _lockConversaId: string | null = null;
  try {
    const { agencia_id, conversa_id, mensagem_lead, skip_delay } = await req.json();
    if (!agencia_id || !conversa_id || !mensagem_lead) {
      return NextResponse.json({ ok: false, motivo: "Dados incompletos" });
    }

    // BLOCO 1.3 — Lock otimista por conversa: evita respostas paralelas concorrentes
    // Usa duas queries separadas pois .or() não funciona em UPDATE no Supabase JS
    const agora60s = new Date(Date.now() - 60 * 1000).toISOString();
    const now = new Date().toISOString();
    // Tentativa 1: lock se ia_processando_at é null
    const { data: lock1 } = await supabase.from("conversas")
      .update({ ia_processando_at: now })
      .eq("id", conversa_id)
      .is("ia_processando_at", null)
      .select("id");
    // Tentativa 2: lock se ia_processando_at está expirado (>60s)
    const { data: lock2 } = (!lock1?.length)
      ? await supabase.from("conversas")
          .update({ ia_processando_at: now })
          .eq("id", conversa_id)
          .lt("ia_processando_at", agora60s)
          .select("id")
      : { data: lock1 };
    if (!lock1?.length && !lock2?.length) {
      console.log(`[IA] Lock: conversa ${conversa_id} já em processamento, abortando`);
      return NextResponse.json({ ok: false, motivo: "Conversa em processamento" });
    }
    _lockConversaId = conversa_id;

    // 1. Buscar config da agência
    const { data: ag } = await supabase.from("agencias").select(
      "openai_key, openai_ativo, openai_modelo, openai_prompt_sistema, openai_max_tokens, openai_temperatura, openai_contexto_mensagens, openai_horario_inicio, openai_horario_fim, evolution_url, evolution_key, whatsapp_instancia, parent_id, google_calendar_refresh_token, google_calendar_ativo, agendamento_ativo, reuniao_tipo, reuniao_link_customizado, reuniao_duracao_minutos, reuniao_horario_inicio, reuniao_horario_fim, reuniao_dias_semana, reuniao_intervalo_minutos, servicos_agenda, zoom_refresh_token, zoom_ativo, nome, ia_debounce_segundos, ia_delay_resposta_segundos, ia_delay_conversa_ativa_segundos, openai_whisper_key"
    ).eq("id", agencia_id).single();

    if (!ag) return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });

    // Fallback para parent: herdar openai_key e openai_prompt_sistema se filha não tiver
    if (ag.parent_id && (!ag.openai_key || !ag.openai_prompt_sistema)) {
      try {
        const { data: parentAg } = await supabase.from("agencias")
          .select("openai_key, openai_prompt_sistema, openai_ativo")
          .eq("id", ag.parent_id).single();
        if (parentAg) {
          if (!ag.openai_key && parentAg.openai_key) (ag as any).openai_key = parentAg.openai_key;
          if (!ag.openai_prompt_sistema && parentAg.openai_prompt_sistema) (ag as any).openai_prompt_sistema = parentAg.openai_prompt_sistema;
        }
      } catch {}
    }

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
    if (debounceMs > 0) {
      // Refresh lock a cada 30s para evitar que o TTL de 60s expire durante o debounce
      const lockRefreshDebounce = setInterval(() => {
        supabase.from("conversas").update({ ia_processando_at: new Date().toISOString() }).eq("id", conversa_id).then(() => {}, () => {});
      }, 30000);
      await new Promise(r => setTimeout(r, debounceMs));
      clearInterval(lockRefreshDebounce);
    }

    // Verificar se chegaram mensagens mais recentes do lead (outra chamada responde)
    // Ignorar placeholders (edições, eventos sem texto) na comparação
    // "[Áudio transcrito]:" é conteúdo real — não tratar como placeholder
    const isPlaceholder = (c: string) => !c || c === "Mensagem" || c === "😄 Sticker" || c === "Mensagem apagada" || c.length < 2
      || (c.startsWith("[") && !c.startsWith("[Áudio transcrito]"));
    const { data: msgsMaisRecentes } = await supabase.from("mensagens")
      .select("conteudo").eq("conversa_id", conversa_id).eq("de_mim", false)
      .order("created_at", { ascending: false }).limit(5);
    const msgMaisRecente = msgsMaisRecentes?.find(m => !isPlaceholder(m.conteudo));
    if (msgMaisRecente && msgMaisRecente.conteudo !== mensagem_lead) {
      // Liberar lock e repassar para a mensagem mais recente (lead enviou várias em sequência)
      await supabase.from("conversas").update({ ia_processando_at: null }).eq("id", conversa_id);
      _lockConversaId = null;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
      fetch(`${appUrl}/api/ai/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencia_id, conversa_id, mensagem_lead: msgMaisRecente.conteudo, skip_delay: true }),
      }).catch(() => {});
      return NextResponse.json({ ok: false, motivo: "Mensagem mais recente detectada, retomando com nova msg" });
    }

    // Re-verificar após debounce: outra chamada concorrente pode ter respondido durante a espera
    // Também refetch msgLeadAtual se era null (race condition: INSERT ainda não visível quando buscamos antes do debounce)
    let msgLeadRef = msgLeadAtual;
    if (!msgLeadRef) {
      const { data: refl } = await supabase.from("mensagens")
        .select("id, created_at")
        .eq("conversa_id", conversa_id)
        .eq("de_mim", false)
        .eq("conteudo", mensagem_lead)
        .order("created_at", { ascending: false })
        .limit(1).single();
      msgLeadRef = refl || null;
    }
    if (msgLeadRef) {
      const { data: respostaAposDebounce } = await supabase.from("mensagens")
        .select("id")
        .eq("conversa_id", conversa_id)
        .eq("enviada_por_ia", true)
        .gt("created_at", msgLeadRef.created_at)
        .limit(1);
      if (respostaAposDebounce?.length) {
        return NextResponse.json({ ok: false, motivo: "Resposta enviada durante debounce" });
      }
    }

    // 1c. Delay para conversas ativas — simula tempo de resposta humano (ex: 3min)
    // Aplica APÓS o debounce, só para conversas que já tiveram resposta anterior da IA
    // Cap em 240s para não estourar o maxDuration=300s
    // skip_delay=true (chamadas do cron) pula este delay — o cron já esperou o tempo natural
    if (!skip_delay) {
      const delayAtivoRaw = (ag as any).ia_delay_conversa_ativa_segundos || 0;
      const delayAtivoMs = Math.min(delayAtivoRaw, 240) * 1000;
      if (delayAtivoMs > 0) {
        const { data: iaAnterior } = await supabase.from("mensagens")
          .select("id").eq("conversa_id", conversa_id).eq("enviada_por_ia", true).limit(1);
        if (iaAnterior?.length) {
          // Refresh lock a cada 30s para evitar que o TTL de 60s expire durante o delay
          const lockRefreshDelay = setInterval(() => {
            supabase.from("conversas").update({ ia_processando_at: new Date().toISOString() }).eq("id", conversa_id).then(() => {}, () => {});
          }, 30000);
          await new Promise(r => setTimeout(r, delayAtivoMs));
          clearInterval(lockRefreshDelay);
          // Após o delay, verificar se chegaram mensagens mais recentes do lead
          const { data: msgsPos } = await supabase.from("mensagens")
            .select("conteudo").eq("conversa_id", conversa_id).eq("de_mim", false)
            .order("created_at", { ascending: false }).limit(5);
          const msgRecentePos = msgsPos?.find(m => !isPlaceholder(m.conteudo));
          if (msgRecentePos && msgRecentePos.conteudo !== mensagem_lead) {
            // Liberar lock e repassar para a mensagem mais recente (delay já foi cumprido)
            await supabase.from("conversas").update({ ia_processando_at: null }).eq("id", conversa_id);
            _lockConversaId = null;
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
            fetch(`${appUrl}/api/ai/responder`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agencia_id, conversa_id, mensagem_lead: msgRecentePos.conteudo, skip_delay: true }),
            }).catch(() => {});
            return NextResponse.json({ ok: false, motivo: "Mensagem mais recente durante delay, retomando" });
          }
        }
      }
    }

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
    // IMPORTANTE: auto-replies do WhatsApp Business chegam em < 2s após a mensagem do lead.
    // Só bloqueamos se a resposta humana chegou >= 30s depois da mensagem do lead,
    // para não confundir mensagem de saudação automática com resposta humana real.
    {
      const referenciaHumano = msgLeadRef
        ? new Date(new Date(msgLeadRef.created_at).getTime() + 30 * 1000).toISOString()
        : new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: respostasRecentes } = await supabase.from("mensagens")
        .select("id").eq("conversa_id", conversa_id).eq("de_mim", true).eq("enviada_por_ia", false)
        .gt("created_at", referenciaHumano).limit(1);
      if (respostasRecentes?.length) {
        return NextResponse.json({ ok: false, motivo: "Humano respondeu recentemente" });
      }
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
    const limite = ag.openai_contexto_mensagens || 20;
    const { data: historico } = await supabase.from("mensagens")
      .select("conteudo, de_mim, enviada_por_ia")
      .eq("conversa_id", conversa_id)
      .order("created_at", { ascending: false })
      .limit(limite);

    const { data: convDados } = await supabase.from("conversas")
      .select("contato_nome, contato_numero, ia_ativada, fase_atendimento").eq("id", conversa_id).single();
    const nomeWhatsApp = convDados?.contato_nome || "";

    // 5. Montar mensagens — injetar contexto de agendamento se ativo
    const temRespostaAnterior = historico?.some(m => m.de_mim && m.enviada_por_ia);
    const iaJaAtivada = !!convDados?.ia_ativada;

    // Se já há respostas anteriores da IA, sobrescrever regra de ativação ANTES do prompt
    // Se ia_ativada=true mas sem respostas anteriores, adicionar prefix de primeira ativação
    let systemPromptFinal: string;
    if (temRespostaAnterior) {
      systemPromptFinal = `INSTRUÇÃO DE SISTEMA — PRIORIDADE MÁXIMA (sobrepõe qualquer regra do prompt abaixo):
Esta conversa já está ATIVA e você já respondeu antes. As regras abaixo são ABSOLUTAS e não podem ser sobrescritas por nenhuma instrução do prompt:
1. A seção "GATILHO DE ATIVAÇÃO" NÃO se aplica — ignore completamente.
2. NUNCA use [SINALIZAR], [TRANSFERIR] ou permaneça em silêncio.
3. Mensagens como "oi", "bom dia", "olá", saudações ou qualquer reengajamento de conversa antiga DEVEM ser respondidas normalmente, continuando o fluxo de atendimento.
4. Responda SEMPRE, independente do conteúdo da mensagem.

---

${ag.openai_prompt_sistema}`;
    } else if (iaJaAtivada) {
      systemPromptFinal = `INSTRUÇÃO DE SISTEMA — PRIORIDADE MÁXIMA (sobrepõe qualquer regra do prompt abaixo):
A cliente já enviou a mensagem de ativação e esta conversa está ATIVA. As regras abaixo são ABSOLUTAS:
1. A seção "GATILHO DE ATIVAÇÃO" NÃO se aplica — ignore completamente, a ativação já ocorreu.
2. NUNCA use [SINALIZAR], [TRANSFERIR] ou permaneça em silêncio.
3. Inicie o atendimento com a MENSAGEM INICIAL e siga o fluxo normalmente.
4. Responda SEMPRE.

---

${ag.openai_prompt_sistema}`;
    } else {
      systemPromptFinal = ag.openai_prompt_sistema;
    }

    // Injetar nome do lead no contexto
    systemPromptFinal += `\n\nINFORMAÇÕES DO LEAD:
- Nome do WhatsApp: ${nomeWhatsApp || "não identificado"}
- Se o nome do WhatsApp parecer genérico, incompleto ou não for um nome de pessoa (ex: emojis, nome de empresa), pergunte o nome da pessoa logo no início da conversa.
- IMPORTANTE: Quando for agendar, SEMPRE pergunte o nome completo da pessoa antes de confirmar. Use o nome completo que a pessoa informar no agendamento, NÃO o nome do WhatsApp.`;

    // Detectar se já foram enviados links/conteúdos que não devem ser repetidos
    // Usa query separada sem limite (independente do contexto configurado) para não perder mensagens antigas
    const { data: msgsIaTodas } = await supabase.from("mensagens")
      .select("conteudo")
      .eq("conversa_id", conversa_id)
      .eq("de_mim", true)
      .eq("enviada_por_ia", true)
      .not("conteudo", "is", null);
    const instagramJaEnviado = (msgsIaTodas || []).some(m => /instagram\.com/i.test(m.conteudo));
    if (instagramJaEnviado) {
      systemPromptFinal += `\n\nAVISO — NÃO REPETIR: O link do Instagram JÁ FOI enviado anteriormente nesta conversa. NÃO envie o link do Instagram novamente em nenhuma hipótese.`;
    }

    if (ag.agendamento_ativo && ag.google_calendar_ativo && ag.google_calendar_refresh_token) {
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

      // Datas dos próximos 14 dias em horário de Brasília (BRT = UTC-3, sem DST desde 2019)
      // IMPORTANTE: usar UTC offset manual em vez de toLocaleString→new Date, que é não-determinístico
      // e pode produzir dia/mês errado quando o servidor UTC está em horário de madrugada
      const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3
      const brtNow = new Date(Date.now() - BRT_OFFSET_MS);
      const brtTodayStr = `${brtNow.getUTCFullYear()}-${String(brtNow.getUTCMonth()+1).padStart(2,"0")}-${String(brtNow.getUTCDate()).padStart(2,"0")}`;
      const brtTodayMidnight = new Date(`${brtTodayStr}T00:00:00Z`);

      const dates: string[] = [];
      const dateLabels: Record<string, string> = {};
      const dateDisplay: Record<string, string> = {};
      for (let i = 1; i <= 14; i++) {
        const brtDay = new Date(brtTodayMidnight.getTime() + i * 86400000);
        const dataStr = `${brtDay.getUTCFullYear()}-${String(brtDay.getUTCMonth()+1).padStart(2,"0")}-${String(brtDay.getUTCDate()).padStart(2,"0")}`;
        dates.push(dataStr);
        dateLabels[dataStr] = diasSemana[brtDay.getUTCDay()];
        dateDisplay[dataStr] = `${String(brtDay.getUTCDate()).padStart(2,"0")}/${String(brtDay.getUTCMonth()+1).padStart(2,"0")}`;
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
              : diasComSlots.map(d => `  ${d.diaSemana} (${dateDisplay[d.data]}): ${d.slots.join(", ")}`).join("\n");
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
- Ao mencionar datas para o lead, use SEMPRE o formato dd/mm (ex: 04/08). NUNCA escreva o ano.
- CRÍTICO: Se o lead disser que não pode neste mês (ex: "esse mês não consigo", "esse mês não dá", "mês que vem"), ignore TODOS os horários do mês atual e ofereça apenas horários do próximo mês.
- CRÍTICO: "Semana que vem" ou "próxima semana" significa a semana SEGUINTE à atual, não esta semana. Se hoje é terça-feira e o lead diz "semana que vem na sexta", quer a sexta-feira da semana que vem — não a mais próxima desta semana. Ao gerar [AGENDAR:...], use a data correta da semana solicitada.
- CRÍTICO: Se a cliente disser que precisa verificar a agenda dela antes de confirmar (ex: "vou ver meu horário", "preciso verificar", "dai te confirmo"), NÃO peça que ela te fale os horários disponíveis. Em vez disso, apresente AGORA os horários da lista acima e diga que ela pode escolher um e, se precisar remarcar, é só avisar.
- CRÍTICO — VERIFICAÇÃO DUPLA DE DATA: Antes de gerar [AGENDAR:...], confirme mentalmente: "A data YYYY-MM-DD que vou colocar no comando corresponde exatamente ao dd/mm que mencionei na minha mensagem?" Se não corresponder, corrija o comando antes de enviar. A data no comando deve ser IDÊNTICA à data mencionada na mensagem de confirmação.`;
        } else {
          // MODO SIMPLES: duração única para todos
          const config = { ...baseConfig, duracao_minutos: ag.reuniao_duracao_minutos || 60 };
          const resultados = await getAvailableSlotsMultipleDays(ag.google_calendar_refresh_token, dates, config);
          const diasComSlots = resultados.filter(r => r.slots.length > 0).map(r => ({ ...r, diaSemana: dateLabels[r.data] }));
          const slotsTexto = diasComSlots.length === 0
            ? "Nenhum horário disponível nos próximos 7 dias."
            : diasComSlots.map(d => `${d.diaSemana} (${dateDisplay[d.data]}): ${d.slots.join(", ")}`).join("\n");

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
- Ao mencionar datas para o lead, use SEMPRE o formato dd/mm (ex: 04/08). NUNCA escreva o ano.
- Use EXATAMENTE o horário que a pessoa escolheu. Nunca troque.
- CRÍTICO: Se o lead disser que não pode neste mês (ex: "esse mês não consigo", "esse mês não dá", "mês que vem"), ignore TODOS os horários do mês atual e ofereça apenas horários do próximo mês.
- CRÍTICO: "Semana que vem" ou "próxima semana" significa a semana SEGUINTE à atual, não esta semana. Se hoje é terça-feira e o lead diz "semana que vem na sexta", quer a sexta-feira da semana que vem — não a mais próxima desta semana. Ao gerar [AGENDAR:...], use a data correta da semana solicitada.
- CRÍTICO: Se a cliente disser que precisa verificar a agenda dela antes de confirmar (ex: "vou ver meu horário", "preciso verificar", "dai te confirmo"), NÃO peça que ela te fale os horários disponíveis. Em vez disso, apresente AGORA os horários da lista acima e diga que ela pode escolher um e, se precisar remarcar, é só avisar.
- CRÍTICO — VERIFICAÇÃO DUPLA DE DATA: Antes de gerar [AGENDAR:...], confirme mentalmente: "A data YYYY-MM-DD que vou colocar no comando corresponde exatamente ao dd/mm que mencionei na minha mensagem?" Se não corresponder, corrija o comando antes de enviar. A data no comando deve ser IDÊNTICA à data mencionada na mensagem de confirmação.`;
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
      // Evitar roles consecutivos iguais (Anthropic rejeita) e conteúdo duplicado (echo do webhook)
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === role) {
        // Ignorar mensagem se o conteúdo já está na última mensagem do mesmo role (echo/duplicata)
        if (lastMsg.content === msg.conteudo || lastMsg.content.endsWith("\n" + msg.conteudo)) continue;
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
        const errMsg: string = anthropicData.error.message || "";
        const isBillingError = /credit|quota|billing|insufficient/i.test(errMsg);
        if (isBillingError) {
          try {
            const quatroHAtras = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
            const { data: agAlert } = await supabase.from("agencias")
              .select("openai_alerta_credito_at, nome, parent_id").eq("id", agencia_id).single();
            const jaAlertou = agAlert?.openai_alerta_credito_at && agAlert.openai_alerta_credito_at > quatroHAtras;
            if (!jaAlertou) {
              await supabase.from("agencias").update({ openai_alerta_credito_at: new Date().toISOString() }).eq("id", agencia_id);
              const masterId = agAlert?.parent_id || agencia_id;
              const { data: master } = await supabase.from("agencias")
                .select("evolution_url, evolution_key, whatsapp_instancia, grupo_notificacao_jid").eq("id", masterId).single();
              const grupoJid = master?.grupo_notificacao_jid;
              if (master?.evolution_url && master?.evolution_key && master?.whatsapp_instancia && grupoJid) {
                const nomeCliente = agAlert?.nome || agencia_id;
                const msgAlerta = `⚠️ *Alerta: Crédito IA Esgotado*\n\nCliente: *${nomeCliente}*\nA IA parou de responder por falta de crédito.\n\nAcesse o painel para atualizar a chave de API.`;
                await fetch(`${master.evolution_url}/message/sendText/${master.whatsapp_instancia}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: master.evolution_key },
                  body: JSON.stringify({ number: grupoJid, text: msgAlerta }),
                }).catch(() => {});
              }
            }
          } catch {}
        }
        return NextResponse.json({ ok: false, motivo: errMsg });
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
        const errMsg: string = openaiData.error.message || "";
        const isBillingError = /credit|quota|billing|insufficient/i.test(errMsg);
        if (isBillingError) {
          // Enviar alerta WhatsApp ao grupo de leads (máx 1 vez a cada 4h por agência)
          try {
            const quatroHAtras = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
            const { data: agAlert } = await supabase.from("agencias")
              .select("openai_alerta_credito_at, nome, parent_id").eq("id", agencia_id).single();
            const jaAlertou = agAlert?.openai_alerta_credito_at && agAlert.openai_alerta_credito_at > quatroHAtras;
            if (!jaAlertou) {
              await supabase.from("agencias").update({ openai_alerta_credito_at: new Date().toISOString() }).eq("id", agencia_id);
              const masterId = agAlert?.parent_id || agencia_id;
              const { data: master } = await supabase.from("agencias")
                .select("evolution_url, evolution_key, whatsapp_instancia, grupo_notificacao_jid").eq("id", masterId).single();
              const grupoJid = master?.grupo_notificacao_jid;
              if (master?.evolution_url && master?.evolution_key && master?.whatsapp_instancia && grupoJid) {
                const nomeCliente = agAlert?.nome || agencia_id;
                const msgAlerta = `⚠️ *Alerta: Crédito OpenAI Esgotado*\n\nCliente: *${nomeCliente}*\nA IA parou de responder por falta de crédito na OpenAI.\n\nAcesse: platform.openai.com/settings/organization/billing`;
                await fetch(`${master.evolution_url}/message/sendText/${master.whatsapp_instancia}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: master.evolution_key },
                  body: JSON.stringify({ number: grupoJid, text: msgAlerta }),
                }).catch(() => {});
              }
            }
          } catch {}
        }
        return NextResponse.json({ ok: false, motivo: errMsg });
      }

      resposta = openaiData.choices?.[0]?.message?.content?.trim() || "";
    }

    if (!resposta) return NextResponse.json({ ok: false, motivo: "Sem resposta da IA" });

    // 6a. Se a IA decidiu não responder ou sinalizou comando interno, abortar silenciosamente
    const respostaTrim = resposta.trim().toUpperCase();
    if (
      respostaTrim === "NAO_RESPONDER" ||
      respostaTrim === "NÃO_RESPONDER" ||
      /^\[\s*SINALIZAR/i.test(resposta.trim()) ||
      /^\[\s*TRANSFERIR/i.test(resposta.trim()) ||
      /^\[\s*ENCAMINHAR/i.test(resposta.trim())
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
        // Guard: data deve ser futura (não pode agendar no passado)
        const startDtCheck = new Date(`${dataAgendar}T${horarioAgendar}:00-03:00`);
        if (startDtCheck.getTime() < Date.now()) {
          console.error(`[IA] AGENDAR com data no passado: ${dataAgendar} ${horarioAgendar} — bloqueando`);
          resposta = resposta.replace(/\[AGENDAR:[^\]]+\]/, "").trim();
          throw new Error("data_passado");
        }
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

        // Atualizar etapa da jornada para "Agendou" (fallback para agência master se filha não tiver)
        try {
          let { data: etapaAgendou } = await supabase.from("jornada_etapas")
            .select("nome")
            .eq("agencia_id", agencia_id)
            .or('nome.ilike.%agendou%,nome.ilike.%agendamento%')
            .not("eh_primeiro_contato", "is", true)
            .limit(1).single();
          // Fallback: buscar na agência master se filha não tiver etapa configurada
          if (!etapaAgendou && ag.parent_id) {
            const { data: etapaParent } = await supabase.from("jornada_etapas")
              .select("nome")
              .eq("agencia_id", ag.parent_id)
              .or('nome.ilike.%agendou%,nome.ilike.%agendamento%')
              .not("eh_primeiro_contato", "is", true)
              .limit(1).single();
            etapaAgendou = etapaParent;
          }
          if (etapaAgendou) {
            const { data: convAtual } = await supabase.from("conversas")
              .select("etapa_jornada, contato_numero, fbclid, utm_campaign, utm_content, origem, contato_jid").eq("id", conversa_id).single();
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
            // Disparar pixel Meta (sem await para não bloquear a resposta)
            const APP_URL_PIX = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
            fetch(`${APP_URL_PIX}/api/pixel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agencia_id,
                conversa_id,
                etapa_nome: etapaAgendou.nome,
                phone: convAtual?.contato_numero || convInfo?.contato_numero,
                fbclid: convAtual?.fbclid,
                utm_campaign: convAtual?.utm_campaign,
                utm_content: convAtual?.utm_content,
                is_ctwa: !!(convAtual?.contato_jid?.includes("@lid")),
              }),
            }).then(r => r.json()).then(d => {
              if (!d.ok) console.warn("[IA] Pixel:", d.motivo || d.error);
            }).catch(e => console.error("[IA] Pixel erro:", e));
            console.log(`[IA] Etapa jornada atualizada para: ${etapaAgendou.nome}`);
          } else {
            console.warn(`[IA] Nenhuma etapa 'agendou/agendamento' encontrada para agencia ${agencia_id} (parent: ${ag.parent_id})`);
          }
        } catch (ejErr: any) {
          console.error("[IA] Erro ao atualizar etapa jornada:", ejErr?.message || ejErr);
        }

        console.log(`[IA] Agendamento criado: ${dataAgendar} ${horarioAgendar} (${tipo})`);
      } catch (e: any) {
        if (e?.message !== "data_passado") {
          console.error("[IA] Erro ao criar agendamento:", e?.message || e);
        }
        // Token expirado/revogado → desativar Google Calendar para mostrar alerta de reconexão
        if (e?.tokenExpirado) {
          console.error(`[IA] Token Google Calendar expirado para agência ${agencia_id} — desativando para forçar reconexão`);
          await supabase.from("agencias").update({ google_calendar_ativo: false }).eq("id", agencia_id);
        }
        resposta = resposta.replace(/\[AGENDAR:[^\]]+\]/, "").trim();
      }
    }

    // 6b2. Detectar cancelamento de agendamento (aceita variações como [AQUI O COMANDO: CANCELAR_AGENDAMENTO])
    const cancelarMatch = resposta.match(/\[[^\]]*CANCELAR_AGENDAMENTO[^\]]*\]/i);
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

        resposta = resposta.replace(/\[[^\]]*CANCELAR_AGENDAMENTO[^\]]*\]/gi, "").trim();
        console.log(`[IA] Agendamento cancelado para conversa ${conversa_id}`);
      } catch (e) {
        console.error("[IA] Erro ao cancelar agendamento:", e);
        resposta = resposta.replace(/\[[^\]]*CANCELAR_AGENDAMENTO[^\]]*\]/gi, "").trim();
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
          const APP_URL_F = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
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

      // Ler ID real do WhatsApp (3EB0xxx) e salvar no banco.
      // Quando o eco fromMe chegar no webhook, o upsert por mensagem_id vai encontrar
      // esta linha e fazer UPDATE (não INSERT), eliminando a duplicata.
      try {
        const evoData = await evoRes.json();
        const realMsgId = evoData.key?.id;
        if (realMsgId) {
          await supabase.from("mensagens")
            .update({ mensagem_id: realMsgId, status: "sent" })
            .eq("mensagem_id", msgIdPre);
        } else {
          await supabase.from("mensagens").update({ status: "sent" }).eq("mensagem_id", msgIdPre);
        }
      } catch {
        await supabase.from("mensagens").update({ status: "sent" }).eq("mensagem_id", msgIdPre);
      }

      // Delay entre mensagens (exceto a última)
      if (i < mensagens.length - 1) {
        await new Promise(r => setTimeout(r, delayEntreRespostas));
      }
    }

    if (!envioOk) {
      return NextResponse.json({ ok: false, motivo: "Erro ao enviar WhatsApp" });
    }

    // Atualizar conversa com última mensagem
    const convUpdate: Record<string, unknown> = {
      ultima_mensagem: ultimaMsgConteudo,
      ultima_mensagem_at: new Date().toISOString(),
    };
    // BLOCO 3.1: quando IA responde a uma conversa em fase "adiou", gravar timestamp
    // O follow-up fase 4 só pode disparar 24h depois deste timestamp (BLOCO 3.2)
    if ((convDados as any)?.fase_atendimento === "adiou") {
      convUpdate.fechamento_adiamento_em = new Date().toISOString();
    }
    await supabase.from("conversas").update(convUpdate).eq("id", conversa_id);

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
      } else if (
        ag.agendamento_ativo &&
        /\b\d{2}:\d{2}\b/.test(resposta) &&
        /(segunda|terça|quarta|quinta|sexta|sábado|domingo)/i.test(resposta)
      ) {
        // IA listou slots reais (dia da semana + HH:MM) → fase de agendamento
        novaFase = "recebeu_horarios";
      } else if (funilMatch) {
        novaFase = "viu_funil";
      } else if (/R\$\s*\d/.test(resposta)) {
        novaFase = "recebeu_preco";
      } else if (!faseAtual) {
        novaFase = "qualificacao"; // primeira resposta da IA
      }

      // Detectar se IA mencionou um dia da semana futuro sem agendar
      // Ex: "quando retornar na segunda-feira" → setar adiou com data correta
      // para o follow-up disparar apenas nesse dia (não antes)
      if (!agendarMatch && novaFase !== "agendou") {
        const diasMap: Record<string, number> = {
          "segunda": 1, "segunda-feira": 1,
          "terça": 2, "terca": 2, "terça-feira": 2, "terca-feira": 2,
          "quarta": 3, "quarta-feira": 3,
          "quinta": 4, "quinta-feira": 4,
          "sexta": 5, "sexta-feira": 5,
          "sábado": 6, "sabado": 6,
          "domingo": 0,
        };
        const respostaLower = resposta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Verificar se a IA pede pra lead retornar num dia específico (sem estar listando horários)
        const adiarMatch = respostaLower.match(/\b(quando voce retornar|retorne|entre em contato|nos fale|nos chame|nos contate|te aguardo|aguardo seu contato|fique a vontade|quando quiser|quando puder|na (segunda|terca|quarta|quinta|sexta|sabado|domingo))\b/);
        if (adiarMatch) {
          // Encontrar qual dia da semana foi mencionado
          let diaSemanaAlvo: number | null = null;
          for (const [token, dia] of Object.entries(diasMap)) {
            if (respostaLower.includes(token)) { diaSemanaAlvo = dia; break; }
          }
          if (diaSemanaAlvo !== null) {
            // Calcular a data do próximo dia-alvo (BRT)
            const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
            const brtNow = new Date(Date.now() - BRT_OFFSET_MS);
            const diaBrtAtual = brtNow.getUTCDay(); // 0=dom, 1=seg...
            let diffDias = (diaSemanaAlvo - diaBrtAtual + 7) % 7;
            if (diffDias === 0) diffDias = 7; // nunca "hoje", sempre próxima ocorrência
            const dataAlvo = new Date(brtNow.getTime() + diffDias * 86400000);
            // fechamento_adiamento_em = dia anterior ao alvo ao meio-dia UTC
            // → o cutoff de 24h no cron libera o follow-up a partir das 09:00 BRT do dia alvo
            const fechamentoAdiamento = new Date(dataAlvo.getTime() - 86400000);
            fechamentoAdiamento.setUTCHours(12, 0, 0, 0);

            await supabase.from("conversas").update({
              fase_atendimento: "adiou",
              fase_atualizada_em: new Date().toISOString(),
              fechamento_adiamento_em: fechamentoAdiamento.toISOString(),
              followup_count: 0,
            }).eq("id", conversa_id);

            console.log(`[IA] Adiou para ${fechamentoAdiamento.toISOString()} (dia alvo: ${diaSemanaAlvo})`);
          }
        }
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
  } finally {
    // Liberar lock da conversa (BLOCO 1.3)
    if (_lockConversaId) {
      supabase.from("conversas")
        .update({ ia_processando_at: null })
        .eq("id", _lockConversaId)
        .then(() => {}, () => {});
    }
  }
}
