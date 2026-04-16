import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      "openai_key, openai_ativo, openai_modelo, openai_prompt_sistema, openai_max_tokens, openai_temperatura, openai_contexto_mensagens, openai_horario_inicio, openai_horario_fim, evolution_url, evolution_key, whatsapp_instancia, parent_id"
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

    // 5. Montar mensagens para OpenAI
    const messages: { role: string; content: string }[] = [
      { role: "system", content: ag.openai_prompt_sistema },
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

    // 6. Chamar OpenAI
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

    const resposta = openaiData.choices?.[0]?.message?.content?.trim();
    if (!resposta) return NextResponse.json({ ok: false, motivo: "Sem resposta da IA" });

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
