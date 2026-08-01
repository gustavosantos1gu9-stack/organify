import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMesReferencia } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function sendGroupMessage(
  evolutionUrl: string,
  evolutionKey: string,
  instancia: string,
  grupoJid: string,
  text: string
) {
  const res = await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
    method: "POST",
    headers: {
      apikey: evolutionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number: grupoJid, text }),
  });
  if (!res.ok) {
    const data = await res.json();
    console.error("[financas-cron] Erro ao enviar msg:", JSON.stringify(data));
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check BR time (cron runs at 11:00 UTC = 08:00 BRT)
    const brDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = brDate.getHours();

    // Only run between 07:00 and 09:00 BR time
    if (hour < 7 || hour >= 9) {
      return NextResponse.json({ ok: true, skipped: true, reason: `Fora do horário BR (${hour}h)` });
    }

    // Load config
    const { data: cfg } = await supabase
      .from("financas_config")
      .select("grupo_jid,instancia")
      .limit(1)
      .single();

    if (!cfg?.grupo_jid) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Grupo não configurado" });
    }

    // Load Evolution credentials
    const { data: masterAg } = await supabase
      .from("agencias")
      .select("evolution_url,evolution_key,whatsapp_instancia")
      .is("parent_id", null)
      .limit(1)
      .single();

    if (!masterAg?.evolution_url || !masterAg?.evolution_key) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Evolution não configurado" });
    }

    const instanceName = cfg.instancia || masterAg.whatsapp_instancia || "default";
    const mesRef = getMesReferencia();
    const hoje = brDate.getDate();
    const amanha = hoje + 1;

    // Find contas vencendo hoje ou amanhã
    const { data: contasHoje } = await supabase
      .from("financas_lancamentos")
      .select("descricao,valor,categoria,dia_vencimento")
      .eq("tipo", "conta")
      .eq("pago", false)
      .eq("mes_referencia", mesRef)
      .eq("dia_vencimento", hoje);

    const { data: contasAmanha } = await supabase
      .from("financas_lancamentos")
      .select("descricao,valor,categoria,dia_vencimento")
      .eq("tipo", "conta")
      .eq("pago", false)
      .eq("mes_referencia", mesRef)
      .eq("dia_vencimento", amanha);

    if (!contasHoje?.length && !contasAmanha?.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Nenhuma conta vencendo hoje ou amanhã" });
    }

    const getEmoji = (cat: string) => (cat === "empresa" ? "🏢" : "🏠");
    const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    let msg = `⚠️ *Contas vencendo em breve*\n`;

    if (contasHoje?.length) {
      msg += `\nHoje (dia ${hoje}):\n`;
      msg += contasHoje.map((c) => `• ${c.descricao} - R$${fmt(c.valor)} ${getEmoji(c.categoria)}`).join("\n");
    }

    if (contasAmanha?.length) {
      msg += `\nAmanhã (dia ${amanha}):\n`;
      msg += contasAmanha.map((c) => `• ${c.descricao} - R$${fmt(c.valor)} ${getEmoji(c.categoria)}`).join("\n");
    }

    await sendGroupMessage(
      masterAg.evolution_url,
      masterAg.evolution_key,
      instanceName,
      cfg.grupo_jid,
      msg
    );

    return NextResponse.json({
      ok: true,
      enviado: true,
      contasHoje: contasHoje?.length || 0,
      contasAmanha: contasAmanha?.length || 0,
    });
  } catch (e: any) {
    console.error("[financas-cron] Erro:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
