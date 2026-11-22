import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

async function metaSpend(acId: string, token: string, desde: string, ate: string): Promise<number> {
  try {
    const params = new URLSearchParams({
      fields: "spend",
      time_range: JSON.stringify({ since: desde, until: ate }),
      access_token: token,
    });
    const url = `${META_API}/${acId}/insights?${params}`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    const json = await res.json();
    return parseFloat(json?.data?.[0]?.spend || "0");
  } catch {
    return 0;
  }
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { relatorio_ids, date_from, date_to } = await req.json();
    if (!relatorio_ids?.length) return NextResponse.json({});

    // Buscar todos os relatorios de uma vez
    const { data: relatorios } = await supabase
      .from("relatorios")
      .select("id, ad_account_id, meta_token, agencia_id")
      .in("id", relatorio_ids);

    if (!relatorios?.length) return NextResponse.json({});

    // Token da agência (fallback) — mesmo padrão do /api/relatorios/performance
    const agenciaId = relatorios[0].agencia_id;
    const { data: conData } = await supabase
      .from("relatorios_conexoes")
      .select("meta_token")
      .eq("agencia_id", agenciaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const agenciaToken = conData?.meta_token;

    // Agendamentos salvos no performance_semanal para o período
    const { data: manuais } = await supabase
      .from("performance_semanal")
      .select("relatorio_id, agendamentos")
      .in("relatorio_id", relatorio_ids)
      .gte("semana_inicio", date_from)
      .lte("semana_inicio", date_to);

    const agendMap: Record<string, number> = {};
    for (const m of manuais || []) {
      agendMap[m.relatorio_id] = (agendMap[m.relatorio_id] || 0) + (m.agendamentos || 0);
    }

    // Buscar spend do Meta em paralelo para todos os relatorios
    const results = await Promise.all(
      relatorios.map(async (rel) => {
        const token = rel.meta_token || agenciaToken;
        if (!token || !rel.ad_account_id) return { id: rel.id, custo: null };

        const acId = rel.ad_account_id.startsWith("act_") ? rel.ad_account_id : `act_${rel.ad_account_id}`;
        const spend = await metaSpend(acId, token, date_from, date_to);
        const agend = agendMap[rel.id] || 0;
        const custo = spend > 0 && agend > 0 ? spend / agend : null;
        return { id: rel.id, custo, spend, agend };
      })
    );

    const out: Record<string, number | null> = {};
    for (const r of results) out[r.id] = r.custo;

    return NextResponse.json(out);
  } catch (e) {
    console.error("custo-agendamento error:", e);
    return NextResponse.json({});
  }
}
