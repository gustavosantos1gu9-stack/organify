import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, horas = 48 } = await req.json();
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });

    // Verificar se a agência tem IA ativa
    const { data: ag } = await supabase.from("agencias")
      .select("openai_ativo, openai_key, openai_prompt_sistema, nome")
      .eq("id", agencia_id).single();

    if (!ag?.openai_ativo) return NextResponse.json({ error: "IA não está ativa para esta agência" }, { status: 400 });

    const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();

    // Buscar conversas com mensagem recente do lead (ia_ativada true ou false — cobre crédito esgotado também)
    const { data: conversas } = await supabase
      .from("conversas")
      .select("id, contato_nome, ultima_mensagem, ia_ativada")
      .eq("agencia_id", agencia_id)
      .is("finalizado_at", null)
      .gt("ultima_mensagem_at", desde);

    if (!conversas?.length) {
      return NextResponse.json({ ok: true, total: 0, disparadas: 0, mensagem: "Nenhuma conversa encontrada" });
    }

    // Filtrar: só conversas onde a última mensagem foi do lead (não de mim)
    const conversasParaResponder: { id: string; conteudo: string; nome: string }[] = [];

    for (const conv of conversas) {
      // Verificar se a última mensagem foi do lead (de_mim=false)
      const { data: ultimaMsg } = await supabase.from("mensagens")
        .select("conteudo, de_mim, enviada_por_ia")
        .eq("conversa_id", conv.id)
        .eq("de_mim", false)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();

      if (!ultimaMsg) continue;

      // Verificar se já tem resposta da IA após a última mensagem do lead
      const { data: respostaIA } = await supabase.from("mensagens")
        .select("id")
        .eq("conversa_id", conv.id)
        .eq("enviada_por_ia", true)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();

      const { data: ultimaMsgLead } = await supabase.from("mensagens")
        .select("created_at")
        .eq("conversa_id", conv.id)
        .eq("de_mim", false)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();

      // Pular se a IA já respondeu após a última mensagem do lead
      if (respostaIA && ultimaMsgLead) {
        const { data: respostaApos } = await supabase.from("mensagens")
          .select("id")
          .eq("conversa_id", conv.id)
          .eq("enviada_por_ia", true)
          .gt("created_at", ultimaMsgLead.created_at)
          .limit(1).maybeSingle();
        if (respostaApos) continue;
      }

      // Pular stickers e tipos sem texto
      const c = ultimaMsg.conteudo || "";
      if (c === "😄 Sticker" || c === "Mensagem" || c.length < 1) continue;

      conversasParaResponder.push({ id: conv.id, conteudo: c, nome: conv.contato_nome || conv.id });
    }

    if (!conversasParaResponder.length) {
      return NextResponse.json({ ok: true, total: conversas.length, disparadas: 0, mensagem: "Nenhuma conversa sem resposta encontrada" });
    }

    // Ativar ia_ativada e disparar ai/responder para cada conversa
    let disparadas = 0;
    const erros: string[] = [];

    for (const conv of conversasParaResponder) {
      try {
        // Marcar ia_ativada=true
        await supabase.from("conversas").update({ ia_ativada: true }).eq("id", conv.id);

        // Disparar IA com skip_delay=true (não precisa aguardar debounce)
        const res = await fetch(`${APP_URL}/api/ai/responder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agencia_id,
            conversa_id: conv.id,
            mensagem_lead: conv.conteudo,
            skip_delay: true,
          }),
        });

        const data = await res.json();
        if (data.ok) {
          disparadas++;
        } else {
          erros.push(`${conv.nome}: ${data.motivo || "erro desconhecido"}`);
        }
      } catch (e: any) {
        erros.push(`${conv.nome}: ${e.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      candidatas: conversasParaResponder.length,
      disparadas,
      erros: erros.length ? erros : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
