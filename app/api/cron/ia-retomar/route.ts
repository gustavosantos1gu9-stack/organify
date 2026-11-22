import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";

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
      .select("id, nome, openai_horario_inicio, openai_horario_fim, ia_delay_conversa_ativa_segundos")
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
        // Buscar últimas mensagens da conversa (pegar mais para ignorar placeholders)
        const { data: ultimaMsgs, error: errMsg } = await supabase
          .from("mensagens")
          .select("id, conteudo, de_mim, enviada_por_ia, created_at")
          .eq("conversa_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (errMsg) { log(`[ia-retomar] ERRO msg ${conv.id}: ${errMsg.message}`); continue; }
        if (!ultimaMsgs?.length) { log(`[ia-retomar] conv ${conv.id}: sem mensagens`); continue; }

        // "[Áudio transcrito]:" é conteúdo real — não tratar como placeholder
        const isPlaceholder = (c: string) => !c || c === "Mensagem" || c === "😄 Sticker" || c === "Mensagem apagada" || c.length < 2
          || (c.startsWith("[") && !c.startsWith("[Áudio transcrito]"));

        // Última mensagem REAL do lead (de_mim=false, não-IA, não-placeholder)
        const ultimaMsgLead = ultimaMsgs.find(m => !m.de_mim && !m.enviada_por_ia && !isPlaceholder(m.conteudo));

        if (!ultimaMsgLead) { log(`[ia-retomar] conv ${conv.id.slice(0, 8)}: sem msg real do lead`); continue; }

        // Última mensagem de qualquer tipo (para detectar auto-saudação após msg do lead)
        const ultimaMsg = ultimaMsgs.find(m => !isPlaceholder(m.conteudo)) || ultimaMsgs[0];

        // Última msg é do lead (ainda não respondida)
        const isUltimaDoLead = !ultimaMsg?.de_mim && !ultimaMsg?.enviada_por_ia && !isPlaceholder(ultimaMsg?.conteudo || "");
        // Última msg é "fromMe" não-IA (pode ser auto-saudação WA Business ou humano) — sem limite de tempo
        const ultimaMsgEFromMeNaoIA = ultimaMsg?.de_mim && !ultimaMsg?.enviada_por_ia;

        log(`[ia-retomar] conv ${conv.id.slice(0, 8)}: ultimaLead="${ultimaMsgLead.conteudo.slice(0,30)}" isUltimaDoLead=${isUltimaDoLead} fromMeNaoIA=${ultimaMsgEFromMeNaoIA}`);

        // Disparar se: última msg é do lead OU última fromMe não veio da IA (auto-saudação ou humano)
        if (isUltimaDoLead || ultimaMsgEFromMeNaoIA) {
          // Verificar se não há resposta de IA após a última msg do lead
          const { data: respostaIA } = await supabase
            .from("mensagens")
            .select("id")
            .eq("conversa_id", conv.id)
            .eq("enviada_por_ia", true)
            .gt("created_at", ultimaMsgLead.created_at)
            .limit(1);

          log(`[ia-retomar] conv ${conv.id.slice(0, 8)}: respostaIA após msg lead = ${respostaIA?.length || 0}`);

          if (!respostaIA?.length) {
            // Verificar se o delay de conversa ativa ainda não passou (não disparar antes da hora)
            const delayAtivoS = (ag as any).ia_delay_conversa_ativa_segundos || 0;
            const tempoDesdeMsg = Date.now() - new Date(ultimaMsgLead.created_at).getTime();
            if (delayAtivoS > 0 && tempoDesdeMsg < delayAtivoS * 1000) {
              const restantes = Math.round((delayAtivoS * 1000 - tempoDesdeMsg) / 1000);
              log(`[ia-retomar] conv ${conv.id.slice(0, 8)}: aguardando delay (${restantes}s restantes)`);
              continue;
            }

            // Verificar se a IA já respondeu alguma vez nesta conversa
            // Se nunca respondeu, a msg "fromMe" provavelmente é auto-saudação do WA Business (não takeover humano)
            const { data: iaAlgumaDia } = await supabase
              .from("mensagens")
              .select("id")
              .eq("conversa_id", conv.id)
              .eq("enviada_por_ia", true)
              .limit(1);
            const iaJaRespondeu = (iaAlgumaDia?.length || 0) > 0;

            // Verificar se humano respondeu REAL (>= 30s depois da msg do lead)
            // Só considerar takeover se a IA já tinha respondido antes (senão é auto-saudação WA)
            if (iaJaRespondeu) {
              const referenciaHumano = new Date(new Date(ultimaMsgLead.created_at).getTime() + 30 * 1000).toISOString();
              const { data: respostaHumano } = await supabase
                .from("mensagens")
                .select("id")
                .eq("conversa_id", conv.id)
                .eq("de_mim", true)
                .eq("enviada_por_ia", false)
                .gt("created_at", referenciaHumano)
                .limit(1);

              if (respostaHumano?.length) {
                log(`[ia-retomar] conv ${conv.id.slice(0, 8)}: humano respondeu (>= 30s), pulando`);
                continue;
              }
            }

            // Nenhuma resposta da IA nem humana real → disparar
            log(`[ia-retomar] Disparando IA para conversa ${conv.id} (msg: ${ultimaMsgLead.conteudo?.slice(0, 40)})`);
            try {
              await fetch(`${APP_URL}/api/ai/responder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agencia_id: ag.id,
                  conversa_id: conv.id,
                  mensagem_lead: ultimaMsgLead.conteudo,
                  skip_delay: true,
                }),
              });
            } catch (e: any) {
              log(`[ia-retomar] ERRO responder conv ${conv.id}: ${e.message}`);
            }
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
