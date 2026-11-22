import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvailableSlotsMultipleDays } from "@/lib/google-calendar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const faseDescricoes: Record<string, string> = {
  qualificacao:    "O lead iniciou contato e está na etapa de qualificação (ainda não recebeu o funil ou o preço).",
  viu_funil:       "O lead recebeu o funil com imagens/resultados mas não avançou.",
  recebeu_preco:   "O lead recebeu o preço mas parou de responder.",
  adiou:           "O lead sinalizou adiamento (\"vou pensar\", \"mês que vem\", \"vou ver com o marido\", etc.).",
  recebeu_horarios:"O lead recebeu os horários disponíveis mas não confirmou.",
  agendou:         "O lead agendou. (follow-up não deveria ter chegado aqui)",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { followup_fila_id, tentativa } = body;
    if (!followup_fila_id) return NextResponse.json({ ok: false, motivo: "ID obrigatório" });

    // 1. Buscar item da fila + etapa + agência
    const { data: fila } = await supabase.from("followup_fila")
      .select("*, etapa:followup_etapas(*)")
      .eq("id", followup_fila_id).single();

    if (!fila) return NextResponse.json({ ok: false, motivo: "Item não encontrado" });
    if (fila.status !== "pendente" && fila.status !== "processando") return NextResponse.json({ ok: false, motivo: "Já processado" });

    const etapa = fila.etapa;
    if (!etapa) return NextResponse.json({ ok: false, motivo: "Etapa não encontrada" });

    // 2. Buscar config da agência
    const { data: ag } = await supabase.from("agencias").select(
      "openai_key, openai_ativo, openai_modelo, openai_prompt_sistema, openai_max_tokens, openai_temperatura, openai_contexto_mensagens, openai_horario_inicio, openai_horario_fim, evolution_url, evolution_key, whatsapp_instancia, parent_id, nome, google_calendar_refresh_token, google_calendar_ativo, agendamento_ativo, reuniao_horario_inicio, reuniao_horario_fim, reuniao_dias_semana, reuniao_duracao_minutos, reuniao_intervalo_minutos"
    ).eq("id", fila.agencia_id).single();

    if (!ag) {
      await marcarErro(followup_fila_id, "Agência não encontrada");
      return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });
    }

    // Verificar se IA está ativa na agência
    if (!ag.openai_ativo) {
      await supabase.from("followup_fila").update({ status: "cancelado" }).eq("id", followup_fila_id);
      return NextResponse.json({ ok: false, motivo: "IA desativada, follow-up cancelado" });
    }

    // 3. Verificar horário de funcionamento
    if (ag.openai_horario_inicio && ag.openai_horario_fim) {
      const agora = new Date();
      const brTime = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const hhmm = `${String(brTime.getHours()).padStart(2, "0")}:${String(brTime.getMinutes()).padStart(2, "0")}`;
      if (hhmm < ag.openai_horario_inicio || hhmm > ag.openai_horario_fim) {
        // Reverter para pendente para o cron tentar novamente no próximo horário
        await supabase.from("followup_fila").update({ status: "pendente" }).eq("id", followup_fila_id);
        return NextResponse.json({ ok: false, motivo: "Fora do horário" });
      }
    }

    // 3b. Verificar se conversa já tem agendamento — não precisa de follow-up
    // Também: teto máximo de 2 follow-ups por lead (BLOCO 2.3)
    const { data: convCheck } = await supabase.from("conversas")
      .select("agendou_at, followup_count").eq("id", fila.conversa_id).single();
    if (convCheck?.agendou_at) {
      await supabase.from("followup_fila").update({ status: "cancelado" }).eq("id", followup_fila_id);
      return NextResponse.json({ ok: false, motivo: "Conversa já agendou, cancelado" });
    }
    if ((convCheck?.followup_count ?? 0) > 2) {
      await supabase.from("followup_fila").update({ status: "cancelado" }).eq("id", followup_fila_id);
      return NextResponse.json({ ok: false, motivo: "Teto de 2 follow-ups atingido" });
    }

    // 4. Verificar se lead respondeu desde que o follow-up foi agendado
    const { data: respostas } = await supabase.from("mensagens")
      .select("id").eq("conversa_id", fila.conversa_id).eq("de_mim", false)
      .gt("created_at", fila.created_at).limit(1);

    if (respostas?.length) {
      // Cancelar TODOS os follow-ups pendentes dessa conversa
      await supabase.from("followup_fila").update({ status: "cancelado" })
        .eq("conversa_id", fila.conversa_id).in("status", ["pendente", "processando"]);
      return NextResponse.json({ ok: false, motivo: "Lead respondeu, todos cancelados" });
    }

    // 5. Verificar se humano respondeu manualmente
    const { data: humanas } = await supabase.from("mensagens")
      .select("id").eq("conversa_id", fila.conversa_id).eq("de_mim", true).eq("enviada_por_ia", false)
      .gt("created_at", fila.created_at).limit(1);

    if (humanas?.length) {
      await supabase.from("followup_fila").update({ status: "cancelado" }).eq("id", followup_fila_id);
      return NextResponse.json({ ok: false, motivo: "Humano assumiu, cancelado" });
    }

    // 6. Gerar mensagem
    let texto = "";
    if (etapa.tipo_mensagem === "ia" && ag.openai_key && ag.openai_ativo) {
      // Gerar via IA
      const limite = ag.openai_contexto_mensagens || 10;
      const { data: historico } = await supabase.from("mensagens")
        .select("conteudo, de_mim").eq("conversa_id", fila.conversa_id)
        .order("created_at", { ascending: false }).limit(limite);

      const { data: conv } = await supabase.from("conversas")
        .select("contato_nome").eq("id", fila.conversa_id).single();

      // Mapear fase para o número/nome que o prompt espera
      const faseNumeros: Record<string, string> = {
        qualificacao:     "FASE 1 — PAROU NA QUALIFICAÇÃO",
        viu_funil:        "FASE 2 — VIU O FUNIL E SUMIU",
        recebeu_preco:    "FASE 3 — RECEBEU O PREÇO DA MICRO E SUMIU",
        adiou:            "FASE 4 — ADIOU",
        recebeu_horarios: "FASE 5 — RECEBEU HORÁRIOS E NÃO CONFIRMOU",
      };
      const numTentativa = tentativa || etapa.ordem;
      const faseLabel = fila.fase_jornada ? (faseNumeros[fila.fase_jornada] || fila.fase_jornada) : "NÃO IDENTIFICADA";

      // Injetar horários reais do Google Calendar quando fase = recebeu_horarios
      let slotsCtx = "";
      if (fila.fase_jornada === "recebeu_horarios" && ag.google_calendar_ativo && ag.google_calendar_refresh_token && ag.agendamento_ativo) {
        try {
          const diasSemana = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
          const baseConfig = {
            horario_inicio: ag.reuniao_horario_inicio || "09:00",
            horario_fim: ag.reuniao_horario_fim || "18:00",
            dias_semana: ag.reuniao_dias_semana || [1,2,3,4,5],
            intervalo_minutos: ag.reuniao_intervalo_minutos || 0,
            duracao_minutos: ag.reuniao_duracao_minutos || 60,
          };
          // BRT = UTC-3, sem DST (Brasil não observa horário de verão desde 2019)
          const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
          const brtNow = new Date(Date.now() - BRT_OFFSET_MS);
          const brtTodayStr = `${brtNow.getUTCFullYear()}-${String(brtNow.getUTCMonth()+1).padStart(2,"0")}-${String(brtNow.getUTCDate()).padStart(2,"0")}`;
          const brtTodayMidnight = new Date(`${brtTodayStr}T00:00:00Z`);
          const dates: string[] = [];
          const dateDisplay: Record<string, string> = {};
          const dateLabels: Record<string, string> = {};
          for (let i = 1; i <= 7; i++) {
            const brtDay = new Date(brtTodayMidnight.getTime() + i * 86400000);
            const dataStr = `${brtDay.getUTCFullYear()}-${String(brtDay.getUTCMonth()+1).padStart(2,"0")}-${String(brtDay.getUTCDate()).padStart(2,"0")}`;
            dates.push(dataStr);
            dateLabels[dataStr] = diasSemana[brtDay.getUTCDay()];
            dateDisplay[dataStr] = `${String(brtDay.getUTCDate()).padStart(2,"0")}/${String(brtDay.getUTCMonth()+1).padStart(2,"0")}`;
          }
          const resultados = await getAvailableSlotsMultipleDays(ag.google_calendar_refresh_token, dates, baseConfig);
          const diasComSlots = resultados.filter(r => r.slots.length > 0);
          if (diasComSlots.length > 0) {
            const slotsTexto = diasComSlots.map(d => `${dateLabels[d.data]} (${dateDisplay[d.data]}): ${d.slots.join(", ")}`).join("\n");
            slotsCtx = `\nHORÁRIOS DISPONÍVEIS AGORA:\n${slotsTexto}\nUse esses horários ao sugerir opções — sugira apenas 2 (manhã e tarde do próximo dia disponível). NUNCA invente horários. Ao mencionar datas use formato dd/mm (ex: 04/08), nunca o ano.`;
          }
        } catch (e) {
          console.error("[followup/enviar] Erro ao buscar slots:", e);
        }
      }

      // BLOCO 3.3 — Detectar desconto já mencionado no histórico para evitar repetição
      const { data: historicoCompleto } = await supabase.from("mensagens")
        .select("conteudo, de_mim, enviada_por_ia")
        .eq("conversa_id", fila.conversa_id)
        .order("created_at", { ascending: false })
        .limit(30);

      const temDescontoNoHistorico = (historicoCompleto || []).some(m => {
        const c = (m.conteudo || "").toLowerCase();
        return (m.de_mim || m.enviada_por_ia) && (
          /r\$\s*\d/.test(c) ||
          /desconto/.test(c) ||
          /valor especial/.test(c) ||
          /condição especial/.test(c) ||
          /promoção/.test(c)
        );
      });

      // Instrução de diferenciação para tentativas subsequentes (BLOCO 2.5)
      let diferenciacaoInstrucao = "";
      if (numTentativa > 1) {
        // Buscar textos dos follow-ups anteriores para proibir repetição explícita
        const { data: followupsAnteriores } = await supabase.from("mensagens")
          .select("conteudo")
          .eq("conversa_id", fila.conversa_id)
          .eq("enviada_por_ia", true)
          .eq("de_mim", true)
          .order("created_at", { ascending: false })
          .limit(3);

        const textosAnteriores = (followupsAnteriores || [])
          .map(m => m.conteudo)
          .filter(Boolean)
          .map((t, i) => `[Mensagem ${i + 1} já enviada]: "${t}"`)
          .join("\n");

        diferenciacaoInstrucao = `\n\nATENÇÃO OBRIGATÓRIA — ${numTentativa}ª TENTATIVA DE FOLLOW-UP:
Você já enviou follow-ups anteriores para este lead. As mensagens abaixo JÁ FORAM ENVIADAS e NÃO DEVEM ser repetidas ou parafraseadas de nenhuma forma:
${textosAnteriores}

REGRAS ABSOLUTAS:
1. NUNCA repita ou parafraseie qualquer frase das mensagens acima.
2. Use um ângulo completamente diferente: se antes falou de resultados, fale agora de urgência, benefício único, dor do problema ou depoimento.
3. A mensagem deve ser claramente distinta em estrutura, abertura e conteúdo.
4. Seja breve (1-2 frases no máximo).`;
      }

      // BLOCO 3.3 — Injetar instrução anti-desconto se já foi mencionado
      const antiDescontoInstrucao = temDescontoNoHistorico
        ? `\n\nINSTRUÇÃO ANTI-REPETIÇÃO (BLOCO 3.3):
O desconto ou condição especial já foi mencionado anteriormente nesta conversa.
NÃO mencione desconto, valor especial, promoção ou condição de preço de forma alguma.
Mude o ângulo completamente: pergunte se ficou alguma dúvida, explore o desejo da cliente, ou pergunte para qual mês ela está pensando em fazer.`
        : "";

      // Bloco de contexto injetado antes do histórico
      const ctxBlock = `---\nFASE: ${faseLabel}\nTENTATIVA: ${numTentativa}ª tentativa${diferenciacaoInstrucao}${antiDescontoInstrucao}${slotsCtx}\n---`;

      const promptBase = etapa.prompt_ia
        || `Envie uma mensagem de follow-up amigável. ${ctxBlock} Seja breve e natural. Nome do lead: ${conv?.contato_nome || "cliente"}.`;

      // Se o prompt_ia é autocontido (tem identidade própria), não usar openai_prompt_sistema
      const isAutocontido = etapa.prompt_ia && (
        etapa.prompt_ia.includes("Você é") ||
        etapa.prompt_ia.includes("REGRAS ABSOLUTAS") ||
        etapa.prompt_ia.includes("PROMPT DE FOLLOW-UP")
      );

      const messages: { role: string; content: string }[] = [];
      if (!isAutocontido) {
        messages.push({ role: "system", content: ag.openai_prompt_sistema || "Você é uma assistente virtual." });
      }
      messages.push({ role: "system", content: promptBase });
      // Injetar contexto de fase/tentativa como bloco separado
      messages.push({ role: "system", content: ctxBlock });
      for (const msg of (historico || []).reverse()) {
        if (!msg.conteudo) continue;
        messages.push({ role: msg.de_mim ? "assistant" : "user", content: msg.conteudo });
      }

      const isAnthropic = ag.openai_key.startsWith("sk-ant-");

      if (isAnthropic) {
        const systemMsgs = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
        const chatMsgs = messages.filter(m => m.role !== "system").map(m => ({
          role: m.role as "user" | "assistant", content: m.content,
        }));

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ag.openai_key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: ag.openai_modelo || "claude-haiku-4-5-20251001",
            system: systemMsgs,
            messages: chatMsgs,
            max_tokens: ag.openai_max_tokens || 300,
            temperature: Number(ag.openai_temperatura) || 0.7,
          }),
        });
        const anthropicData = await anthropicRes.json();
        texto = anthropicData.content?.[0]?.text?.trim() || "";
      } else {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ag.openai_key}` },
          body: JSON.stringify({
            model: ag.openai_modelo || "gpt-4o-mini",
            messages,
            max_tokens: ag.openai_max_tokens || 300,
            temperature: Number(ag.openai_temperatura) || 0.7,
          }),
        });
        const openaiData = await openaiRes.json();
        texto = openaiData.choices?.[0]?.message?.content?.trim() || "";
      }

      if (!texto) {
        await marcarErro(followup_fila_id, "IA não gerou resposta");
        return NextResponse.json({ ok: false, motivo: "IA sem resposta" });
      }
    } else {
      // Template fixo com substituições
      const { data: conv } = await supabase.from("conversas")
        .select("contato_nome").eq("id", fila.conversa_id).single();

      const nomeCompleto = conv?.contato_nome || "";
      const primeiroNome = nomeCompleto.split(" ")[0] || nomeCompleto;
      texto = (etapa.texto_template || "")
        .replace(/\{nome\}/g, primeiroNome)
        .replace(/\{nome_completo\}/g, nomeCompleto)
        .replace(/\{empresa\}/g, ag.nome || "");
    }

    if (!texto && !etapa.midia_url) {
      await marcarErro(followup_fila_id, "Sem conteúdo para enviar");
      return NextResponse.json({ ok: false, motivo: "Sem conteúdo" });
    }

    // 7. Enviar via Evolution API
    let evoUrl = ag.evolution_url || "";
    let evoKey = ag.evolution_key || "";
    if (!evoUrl && ag.parent_id) {
      const { data: parent } = await supabase.from("agencias").select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
      if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
    }

    if (!evoUrl || !evoKey || !ag.whatsapp_instancia) {
      await marcarErro(followup_fila_id, "WhatsApp não configurado");
      return NextResponse.json({ ok: false, motivo: "WhatsApp não configurado" });
    }

    const destino = fila.contato_jid || fila.contato_numero;
    let evoRes: Response;

    if (etapa.midia_url) {
      // Enviar com mídia
      evoRes = await fetch(`${evoUrl}/message/sendMedia/${ag.whatsapp_instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          number: destino,
          mediatype: etapa.midia_tipo || "image",
          media: etapa.midia_url,
          caption: texto || "",
        }),
      });
    } else {
      // Enviar só texto
      evoRes = await fetch(`${evoUrl}/message/sendText/${ag.whatsapp_instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: destino, text: texto }),
      });
    }

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      console.error("[followup] Erro Evolution:", errText);
      await marcarErro(followup_fila_id, `Evolution ${evoRes.status}`);
      return NextResponse.json({ ok: false, motivo: "Erro ao enviar" });
    }

    // 8. Salvar mensagem no banco
    const evoData = await evoRes.json();
    const msgId = evoData.key?.id || `followup_${Date.now()}`;

    await supabase.from("mensagens").insert({
      conversa_id: fila.conversa_id,
      agencia_id: fila.agencia_id,
      mensagem_id: msgId,
      de_mim: true,
      tipo: etapa.midia_url ? (etapa.midia_tipo || "image") : "text",
      conteudo: texto || `[${etapa.midia_tipo || "mídia"}]`,
      midia_url: etapa.midia_url || null,
      status: "sent",
      enviada_por_ia: true,
      created_at: new Date().toISOString(),
    });

    await supabase.from("conversas").update({
      ultima_mensagem: texto || `[${etapa.midia_tipo || "mídia"}]`,
      ultima_mensagem_at: new Date().toISOString(),
    }).eq("id", fila.conversa_id);

    // 9. Marcar como enviado
    await supabase.from("followup_fila").update({
      status: "enviado",
      enviado_at: new Date().toISOString(),
    }).eq("id", followup_fila_id);

    console.log(`[followup] Enviado etapa ${etapa.ordem} para ${destino}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[followup] Exceção enviar:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

async function marcarErro(id: string, erro: string) {
  await supabase.from("followup_fila").update({ status: "erro", erro }).eq("id", id);
}
