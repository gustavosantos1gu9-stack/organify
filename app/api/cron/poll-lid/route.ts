import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export async function GET() {
  try {
    // 1. Buscar conversas com IA ativa
    const { data: conversas } = await supabase.from("conversas")
      .select("id, agencia_id, contato_jid, contato_numero, instancia, ia_ativada")
      .not("instancia", "is", null)
      .limit(100);

    const ativas = (conversas || []).filter(function(c) { return c.instancia && c.ia_ativada; });
    if (!ativas.length) return NextResponse.json({ ok: true, processadas: 0 });

    let processadas = 0;
    const debug: string[] = [];
    const cincoMinAtras = Math.floor(Date.now() / 1000) - 300;

    for (let i = 0; i < ativas.length; i++) {
      const conv = ativas[i];

      // 2. Buscar credenciais Evolution
      const { data: ag } = await supabase.from("agencias")
        .select("evolution_url, evolution_key, parent_id").eq("id", conv.agencia_id).single();
      if (!ag) { debug.push("no-ag:" + conv.agencia_id); continue; }

      let evoUrl = ag.evolution_url || "";
      let evoKey = ag.evolution_key || "";
      if (!evoUrl && ag.parent_id) {
        const { data: p } = await supabase.from("agencias")
          .select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
        if (p) { evoUrl = p.evolution_url || ""; evoKey = p.evolution_key || ""; }
      }
      if (!evoUrl || !evoKey) { debug.push("no-cred:" + conv.instancia); continue; }

      // 3. Última mensagem do lead no banco
      const { data: ultima } = await supabase.from("mensagens")
        .select("created_at").eq("conversa_id", conv.id).eq("de_mim", false)
        .order("created_at", { ascending: false }).limit(1);
      const ultimoTs = ultima && ultima[0] && ultima[0].created_at
        ? Math.floor(new Date(ultima[0].created_at).getTime() / 1000)
        : cincoMinAtras;

      // 4. Buscar mensagens no Evolution
      const jid = conv.contato_jid;
      if (!jid) { debug.push("no-jid"); continue; }

      try {
        const res = await fetch(evoUrl + "/chat/findMessages/" + conv.instancia, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evoKey },
          body: JSON.stringify({ where: { key: { remoteJid: jid, fromMe: false } }, limit: 3 }),
        });
        const data = await res.json();
        const records = (data && data.messages && data.messages.records) ? data.messages.records : [];
        debug.push("jid:" + jid + " records:" + records.length + " ultimoTs:" + ultimoTs);

        for (let j = 0; j < records.length; j++) {
          const msg = records[j];
          const msgTs = msg.messageTimestamp || 0;
          const msgId = msg.key ? msg.key.id : null;
          if (!msgId || msgTs <= ultimoTs) {
            debug.push("skip:" + msgId + " ts:" + msgTs + "<=" + ultimoTs);
            continue;
          }

          // Já processada?
          const { data: existe } = await supabase.from("mensagens")
            .select("id").eq("mensagem_id", msgId).limit(1);
          if (existe && existe.length) { debug.push("exists:" + msgId); continue; }

          // Despachar pro webhook
          const secretParam = WEBHOOK_SECRET ? "?secret=" + WEBHOOK_SECRET : "";
          await fetch(APP_URL + "/api/webhook/whatsapp" + secretParam, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "messages.upsert", instance: conv.instancia, data: { messages: [msg] } }),
          });
          processadas++;
          debug.push("sent:" + msgId);
        }
      } catch (e: any) {
        debug.push("err:" + (e.message || "unknown"));
      }
    }

    // ── IA FALLBACK: mensagens no banco não respondidas pela IA ──
    let iaFallbackEnviados = 0;
    const brTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hhmm = `${String(brTime.getHours()).padStart(2, "0")}:${String(brTime.getMinutes()).padStart(2, "0")}`;
    const trintaSegAtrasISO = new Date(Date.now() - 120 * 1000).toISOString();
    const cincoMinAtrasISO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const vinteQuatroHAtrasISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const conv of ativas) {
      try {
        // Verificar config da agência
        const { data: agConf } = await supabase.from("agencias")
          .select("openai_ativo, openai_horario_inicio, openai_horario_fim")
          .eq("id", conv.agencia_id).single();
        if (!agConf?.openai_ativo) continue;
        if (agConf.openai_horario_inicio && agConf.openai_horario_fim) {
          if (hhmm < agConf.openai_horario_inicio || hhmm > agConf.openai_horario_fim) continue;
        }

        // Última mensagem da conversa
        const { data: ultimas } = await supabase.from("mensagens")
          .select("id, conteudo, de_mim, enviada_por_ia, created_at")
          .eq("conversa_id", conv.id)
          .order("created_at", { ascending: false }).limit(1);
        const ultima = ultimas?.[0];
        if (!ultima) continue;
        if (ultima.de_mim || ultima.enviada_por_ia) continue; // última é da IA ou humano
        if (ultima.created_at > trintaSegAtrasISO) continue; // muito recente (debounce)
        if (ultima.created_at < vinteQuatroHAtrasISO) continue; // muito antiga

        // Já tem resposta da IA após essa mensagem? (inclui respostas recentes ainda sendo processadas)
        const { data: iaApos } = await supabase.from("mensagens")
          .select("id").eq("conversa_id", conv.id).eq("enviada_por_ia", true)
          .gt("created_at", ultima.created_at).limit(1);
        if (iaApos?.length) continue;

        // IA respondeu nos últimos 3 minutos na conversa? (pode estar processando agora)
        const tresMinAtrasISO = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { data: iaRecente } = await supabase.from("mensagens")
          .select("id").eq("conversa_id", conv.id).eq("enviada_por_ia", true)
          .gt("created_at", tresMinAtrasISO).limit(1);
        if (iaRecente?.length) continue;

        // Humano respondeu recentemente?
        const { data: humanoRecente } = await supabase.from("mensagens")
          .select("id").eq("conversa_id", conv.id).eq("de_mim", true).eq("enviada_por_ia", false)
          .gt("created_at", cincoMinAtrasISO).limit(1);
        if (humanoRecente?.length) continue;

        // Disparar IA
        fetch(`${APP_URL}/api/ai/responder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agencia_id: conv.agencia_id,
            conversa_id: conv.id,
            mensagem_lead: ultima.conteudo,
            skip_delay: true,
          }),
        }).catch(() => {});
        iaFallbackEnviados++;
        debug.push("ia-fallback:" + conv.id);
      } catch {}
    }

    // ── FOLLOW-UP + FUNIS: processar pendentes cujo horário já passou ──
    let followupEnviados = 0;
    let funisEnviados = 0;
    const agora = new Date().toISOString();

    // Follow-ups pendentes
    const { data: followupPendentes } = await supabase.from("followup_fila")
      .select("id").eq("status", "pendente").lte("agendar_para", agora)
      .order("agendar_para", { ascending: true }).limit(20);
    if (followupPendentes?.length) {
      for (const item of followupPendentes) {
        try {
          const res = await fetch(`${APP_URL}/api/ai/followup/enviar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ followup_fila_id: item.id }),
          });
          const data = await res.json();
          if (data.ok) followupEnviados++;
        } catch {}
      }
    }

    // Funis pendentes
    const { data: funisPendentes } = await supabase.from("funil_fila")
      .select("id").eq("status", "pendente").lte("agendar_para", agora)
      .order("agendar_para", { ascending: true }).limit(20);
    if (funisPendentes?.length) {
      for (const item of funisPendentes) {
        try {
          const res = await fetch(`${APP_URL}/api/funis/enviar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ funil_fila_id: item.id }),
          });
          const data = await res.json();
          if (data.ok) funisEnviados++;
        } catch {}
      }
    }

    // Processar conversion leads pendentes (fallback do frontend)
    try {
      await fetch(`${APP_URL}/api/cron/conversion-leads`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
    } catch {}

    return NextResponse.json({ ok: true, processadas, iaFallbackEnviados, followupEnviados, funisEnviados, debug });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
