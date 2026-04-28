import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvailableSlots, createEvent } from "@/lib/google-calendar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id, mensagem_lead } = await req.json();
    if (!agencia_id || !conversa_id || !mensagem_lead) {
      return NextResponse.json({ ok: false, motivo: "Dados incompletos" });
    }

    // 1. Buscar config da agência
    const { data: ag } = await supabase.from("agencias").select(
      "openai_key, openai_ativo, openai_modelo, openai_prompt_sistema, openai_max_tokens, openai_temperatura, openai_contexto_mensagens, openai_horario_inicio, openai_horario_fim, evolution_url, evolution_key, whatsapp_instancia, parent_id, google_calendar_refresh_token, google_calendar_ativo, agendamento_ativo, reuniao_tipo, reuniao_link_customizado, reuniao_duracao_minutos, reuniao_horario_inicio, reuniao_horario_fim, reuniao_dias_semana, reuniao_intervalo_minutos, zoom_refresh_token, zoom_ativo, nome"
    ).eq("id", agencia_id).single();

    if (!ag) return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });
    if (!ag.openai_ativo || !ag.openai_key) return NextResponse.json({ ok: false, motivo: "IA não ativa" });
    if (!ag.openai_prompt_sistema) return NextResponse.json({ ok: false, motivo: "Prompt não configurado" });

    // 2. Verificar horário de funcionamento
    if (ag.openai_horario_inicio && ag.openai_horario_fim) {
      const agora = new Date();
      const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
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

    // 4. Buscar histórico de mensagens para contexto
    const limite = ag.openai_contexto_mensagens || 10;
    const { data: historico } = await supabase.from("mensagens")
      .select("conteudo, de_mim, enviada_por_ia")
      .eq("conversa_id", conversa_id)
      .order("created_at", { ascending: false })
      .limit(limite);

    // 5. Montar mensagens — injetar contexto de agendamento se ativo
    let systemPromptFinal = ag.openai_prompt_sistema;

    if (ag.agendamento_ativo && ag.google_calendar_ativo && ag.google_calendar_refresh_token) {
      // Buscar slots de hoje e amanhã
      const hoje = new Date();
      const amanha = new Date(hoje.getTime() + 86400000);
      const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const config = {
        duracao_minutos: ag.reuniao_duracao_minutos || 60,
        horario_inicio: ag.reuniao_horario_inicio || "09:00",
        horario_fim: ag.reuniao_horario_fim || "18:00",
        dias_semana: ag.reuniao_dias_semana || [1,2,3,4,5],
        intervalo_minutos: ag.reuniao_intervalo_minutos || 0,
      };
      try {
        const [slotsHoje, slotsAmanha] = await Promise.all([
          getAvailableSlots(ag.google_calendar_refresh_token, fmtDate(hoje), config),
          getAvailableSlots(ag.google_calendar_refresh_token, fmtDate(amanha), config),
        ]);
        const tipoMap: Record<string,string> = { zoom: "Zoom", google_meet: "Google Meet", presencial: "presencial", link_customizado: "link" };
        const tipoLabel = tipoMap[ag.reuniao_tipo || "google_meet"] || "online";

        systemPromptFinal += `\n\nAGENDAMENTO AUTOMÁTICO:
Você pode agendar reuniões (${tipoLabel}, ${ag.reuniao_duracao_minutos || 60}min).
Quando o lead quiser agendar, ofereça os horários disponíveis abaixo.
Quando o lead confirmar um horário, responda EXATAMENTE neste formato (em uma linha separada no final):
[AGENDAR:YYYY-MM-DD HH:MM]

Horários disponíveis hoje (${fmtDate(hoje)}): ${slotsHoje.length ? slotsHoje.join(", ") : "nenhum"}
Horários disponíveis amanhã (${fmtDate(amanha)}): ${slotsAmanha.length ? slotsAmanha.join(", ") : "nenhum"}
Se o lead pedir outro dia, diga que no momento pode agendar para hoje ou amanhã.`;
      } catch (e) {
        console.error("[IA] Erro ao buscar slots:", e);
      }
    }

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPromptFinal },
    ];

    // Histórico em ordem cronológica
    const historicoOrdenado = (historico || []).reverse();
    for (const msg of historicoOrdenado) {
      if (!msg.conteudo) continue;
      messages.push({
        role: msg.de_mim ? "assistant" : "user",
        content: msg.conteudo,
      });
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

    // 6b. Detectar comando de agendamento na resposta da IA
    const agendarMatch = resposta.match(/\[AGENDAR:(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/);
    if (agendarMatch && ag.agendamento_ativo && ag.google_calendar_refresh_token) {
      const [, dataAgendar, horarioAgendar] = agendarMatch;
      try {
        // Buscar nome do lead
        const { data: convInfo } = await supabase.from("conversas")
          .select("contato_nome, contato_numero").eq("id", conversa_id).single();

        const startDt = new Date(`${dataAgendar}T${horarioAgendar}:00-03:00`);
        const endDt = new Date(startDt.getTime() + (ag.reuniao_duracao_minutos || 60) * 60000);
        const summary = `Reunião - ${convInfo?.contato_nome || "Lead"}`;
        const description = `Agendado via Secretária IA\nNome: ${convInfo?.contato_nome || "N/A"}\nTelefone: ${convInfo?.contato_numero || "N/A"}`;

        let meetingLink = "";
        const tipo = ag.reuniao_tipo || "google_meet";

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

        // Marcar agendou_at na conversa
        await supabase.from("conversas").update({ agendou_at: new Date().toISOString() }).eq("id", conversa_id);

        console.log(`[IA] Agendamento criado: ${dataAgendar} ${horarioAgendar} (${tipo})`);
      } catch (e) {
        console.error("[IA] Erro ao criar agendamento:", e);
        resposta = resposta.replace(/\[AGENDAR:[^\]]+\]/, "").trim();
      }
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
    const evoRes = await fetch(`${evoUrl}/message/sendText/${ag.whatsapp_instancia}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({ number: destino, text: resposta }),
    });

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      console.error("[IA] Erro Evolution:", errText);
      return NextResponse.json({ ok: false, motivo: "Erro ao enviar WhatsApp" });
    }

    // 8. Salvar mensagem da IA no banco
    const evoData = await evoRes.json();
    const msgId = evoData.key?.id || `ia_${Date.now()}`;

    await supabase.from("mensagens").insert({
      conversa_id,
      agencia_id,
      mensagem_id: msgId,
      de_mim: true,
      tipo: "text",
      conteudo: resposta,
      status: "sent",
      enviada_por_ia: true,
      created_at: new Date().toISOString(),
    });

    // Atualizar conversa
    await supabase.from("conversas").update({
      ultima_mensagem: resposta,
      ultima_mensagem_at: new Date().toISOString(),
    }).eq("id", conversa_id);

    return NextResponse.json({ ok: true, resposta });
  } catch (e: any) {
    console.error("[IA] Exceção:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
