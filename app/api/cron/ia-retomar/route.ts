import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";

export async function GET() {
  const debugLog: string[] = [];
  const log = (msg: string) => { console.log(msg); debugLog.push(msg); };

  try {
    // Hora atual em Brasília
    const agora = new Date();
    const brTime = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hhmm = `${String(brTime.getHours()).padStart(2, "0")}:${String(brTime.getMinutes()).padStart(2, "0")}`;
    log(`[ia-retomar] iniciando, hora BR: ${hhmm}`);

    // Buscar agências com IA ativa e horário configurado
    const { data: agencias, error: errAg } = await supabase
      .from("agencias")
      .select("id, nome, openai_horario_inicio, openai_horario_fim")
      .eq("openai_ativo", true)
      .not("openai_horario_inicio", "is", null)
      .not("openai_horario_fim", "is", null);

    if (errAg) log(`[ia-retomar] ERRO agências: ${errAg.message}`);
    log(`[ia-retomar] agências com horário: ${agencias?.length || 0}`);

    if (!agencias?.length) return NextResponse.json({ ok: true, processadas: 0, debug: debugLog });

    let totalDisparadas = 0;

    for (const ag of agencias) {
      // Verificar se a agência está dentro do horário agora
      const foraDoHorario = hhmm < ag.openai_horario_inicio || hhmm > ag.openai_horario_fim;
      log(`[ia-retomar] agência ${ag.nome} (${ag.openai_horario_inicio}-${ag.openai_horario_fim}): ${foraDoHorario ? "FORA do horário" : "dentro do horário"}`);
      if (foraDoHorario) continue;

      // Buscar conversas desta agência com IA ativada
      // onde a última mensagem do lead não foi respondida pela IA
      // e chegou nas últimas 24h
      const vintequatroHAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: conversas, error: errConv } = await supabase
        .from("conversas")
        .select("id")
        .eq("agencia_id", ag.id)
        .eq("ia_ativada", true)
        .is("finalizado_at", null)
        .gt("ultima_mensagem_at", vintequatroHAtras);

      if (errConv) log(`[ia-retomar] ERRO conversas ${ag.nome}: ${errConv.message}`);
      log(`[ia-retomar] ${ag.nome}: ${conversas?.length || 0} conversas ia_ativada nas últimas 24h`);

      if (!conversas?.length) continue;

      for (const conv of conversas) {
        // Buscar última mensagem da conversa
        const { data: ultimaMsgs, error: errMsg } = await supabase
          .from("mensagens")
          .select("id, conteudo, de_mim, enviada_por_ia, created_at")
          .eq("conversa_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (errMsg) { log(`[ia-retomar] ERRO msg ${conv.id}: ${errMsg.message}`); continue; }

        const ultimaMsg = ultimaMsgs?.[0];
        if (!ultimaMsg) { log(`[ia-retomar] conv ${conv.id}: sem mensagens`); continue; }

        // Se a última mensagem é do lead (não respondida) e tem conteúdo real
        // "Mensagem" é o placeholder para eventos sem texto (deleções, protocolMessages) — ignorar
        const semConteudoReal = !ultimaMsg.conteudo || ultimaMsg.conteudo === "Mensagem" || ultimaMsg.conteudo === "😄 Sticker" || ultimaMsg.conteudo === "Mensagem apagada" || ultimaMsg.conteudo.startsWith("[") || ultimaMsg.conteudo.length < 2;
        const isUltimaDoLead = ultimaMsg.de_mim === false && !ultimaMsg.enviada_por_ia && !semConteudoReal;

        log(`[ia-retomar] conv ${conv.id.slice(0, 8)}: de_mim=${ultimaMsg.de_mim} ia=${ultimaMsg.enviada_por_ia} semConteudo=${semConteudoReal} isUltimaDoLead=${isUltimaDoLead} msg="${(ultimaMsg.conteudo || "").slice(0, 40)}"`);

        if (isUltimaDoLead) {
          // Verificar se não há resposta de IA após essa mensagem
          const { data: respostaIA } = await supabase
            .from("mensagens")
            .select("id")
            .eq("conversa_id", conv.id)
            .eq("enviada_por_ia", true)
            .gt("created_at", ultimaMsg.created_at)
            .limit(1);

          log(`[ia-retomar] conv ${conv.id.slice(0, 8)}: respostaIA após msg = ${respostaIA?.length || 0}`);

          if (!respostaIA?.length) {
            // Nenhuma resposta da IA depois da mensagem do lead → disparar
            log(`[ia-retomar] Disparando IA para conversa ${conv.id} (msg: ${ultimaMsg.conteudo?.slice(0, 40)})`);
            const _agId = ag.id;
            const _convId = conv.id;
            const _conteudo = ultimaMsg.conteudo;
            waitUntil(
              fetch(`${APP_URL}/api/ai/responder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agencia_id: _agId,
                  conversa_id: _convId,
                  mensagem_lead: _conteudo,
                  skip_delay: true,
                }),
              }).catch((e) => log(`[ia-retomar] ERRO responder conv ${_convId}: ${e.message}`))
            );
            totalDisparadas++;
          }
        }
      }
    }

    log(`[ia-retomar] finalizado: ${totalDisparadas} conversas retomadas`);
    return NextResponse.json({ ok: true, processadas: totalDisparadas, debug: debugLog });
  } catch (e: any) {
    console.error("[ia-retomar] Erro:", e);
    return NextResponse.json({ ok: false, error: e.message, debug: debugLog }, { status: 500 });
  }
}
