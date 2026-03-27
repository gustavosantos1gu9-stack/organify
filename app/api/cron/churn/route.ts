import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
        `${process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app"}/api/churn/calcular`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencia_id: ag.id }),
        }
      );
      const data = await res.json();
      resultados.push({ agencia_id: ag.id, ...data });
    }

    return NextResponse.json({ ok: true, resultados });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
