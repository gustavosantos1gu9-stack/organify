import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  // Proteger com secret do Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Buscar todas as agências
    const { data: agencias } = await supabase.from("agencias").select("id");
    if (!agencias?.length) return NextResponse.json({ ok: true, msg: "sem agencias" });

    const resultados = [];
    for (const ag of agencias) {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br"}/api/churn/calcular`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencia_id: ag.id }),
        }
      );
      const data = await res.json();
      resultados.push({ agencia_id: ag.id, ...data });
    }

    // Salvar snapshots mensais (último dia do mês)
    const hoje = new Date();
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    if (hoje.getDate() >= ultimoDia - 1) {
      const mesesNomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const mesNome = mesesNomes[hoje.getMonth()];
      const anoNum = hoje.getFullYear();
      const mesAno = `${mesNome}/${anoNum}`;

      for (const ag of agencias) {
        try {
          const { data: jaExiste } = await supabase.from("snapshots_mensais")
            .select("id").eq("agencia_id", ag.id).eq("mes_ano", mesAno).limit(1);
          if (jaExiste?.length) continue;

          const { data: cc } = await supabase.from("controle_clientes")
            .select("status").eq("agencia_id", ag.id);
          if (!cc?.length) continue;

          await supabase.from("snapshots_mensais").insert({
            agencia_id: ag.id,
            mes: mesNome, ano: anoNum, mes_ano: mesAno,
            clientes_ativos: cc.filter(c => c.status === "ativo").length,
            clientes_pausados: cc.filter(c => c.status === "pausado").length,
            clientes_entrada: cc.filter(c => c.status === "entrada").length,
            clientes_total: cc.filter(c => c.status !== "saiu").length,
          });
        } catch {}
      }
    }

    return NextResponse.json({ ok: true, resultados });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
