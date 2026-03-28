import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function ultimoDiaMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, forcar } = await req.json();
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatorio" }, { status: 400 });

    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesIdx = hoje.getMonth();
    const ano = hoje.getFullYear();
    const ultimoDia = ultimoDiaMes(ano, mesIdx);

    // Só salvar no último dia do mês (ou se forçado)
    if (!forcar && diaHoje !== ultimoDia) {
      return NextResponse.json({ ok: false, motivo: `Snapshot só é salvo no último dia do mês (dia ${ultimoDia})` });
    }

    const mesAno = `${MESES[mesIdx]}/${ano}`;

    const { count: totalAtivos } = await supabase.from("controle_clientes")
      .select("*", { count: "exact", head: true }).eq("agencia_id", agencia_id).eq("status", "ativo");
    const { count: totalPausados } = await supabase.from("controle_clientes")
      .select("*", { count: "exact", head: true }).eq("agencia_id", agencia_id).eq("status", "pausado");
    const { count: totalEntrada } = await supabase.from("controle_clientes")
      .select("*", { count: "exact", head: true }).eq("agencia_id", agencia_id).eq("status", "entrada");
    const { count: totalGeral } = await supabase.from("controle_clientes")
      .select("*", { count: "exact", head: true }).eq("agencia_id", agencia_id).neq("status", "saiu");

    const { data: existente } = await supabase.from("snapshots_mensais")
      .select("id").eq("agencia_id", agencia_id).eq("mes_ano", mesAno).single();

    if (existente) {
      await supabase.from("snapshots_mensais").update({
        clientes_ativos: totalAtivos || 0,
        clientes_pausados: totalPausados || 0,
        clientes_entrada: totalEntrada || 0,
        clientes_total: totalGeral || 0,
      }).eq("id", existente.id);
    } else {
      await supabase.from("snapshots_mensais").insert({
        agencia_id, mes: MESES[mesIdx], ano, mes_ano: mesAno,
        clientes_ativos: totalAtivos || 0,
        clientes_pausados: totalPausados || 0,
        clientes_entrada: totalEntrada || 0,
        clientes_total: totalGeral || 0,
      });
    }

    return NextResponse.json({ ok: true, mes_ano: mesAno, ativos: totalAtivos });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const agencia_id = req.nextUrl.searchParams.get("agencia_id");
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatorio" }, { status: 400 });

    const { data } = await supabase.from("snapshots_mensais")
      .select("*").eq("agencia_id", agencia_id)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });

    return NextResponse.json({ data: data || [] });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
