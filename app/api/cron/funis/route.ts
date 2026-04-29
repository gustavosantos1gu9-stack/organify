import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";

export async function GET(req: NextRequest) {
  // Autenticação do cron
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const agora = new Date().toISOString();

    // 1. Buscar itens pendentes cujo horário já passou
    const { data: pendentes } = await supabase.from("funil_fila")
      .select("id")
      .eq("status", "pendente")
      .lte("agendar_para", agora)
      .order("agendar_para", { ascending: true })
      .limit(50);

    if (!pendentes?.length) {
      return NextResponse.json({ ok: true, processados: 0 });
    }

    // 2. Processar cada um
    let enviados = 0;
    let erros = 0;
    for (const item of pendentes) {
      try {
        const res = await fetch(`${APP_URL}/api/funis/enviar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ funil_fila_id: item.id }),
        });
        const data = await res.json();
        if (data.ok) enviados++;
        else erros++;
      } catch {
        erros++;
      }
    }

    // 3. Limpeza: cancelar pendentes com mais de 7 dias
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("funil_fila")
      .update({ status: "cancelado" })
      .eq("status", "pendente")
      .lt("created_at", seteDiasAtras);

    console.log(`[cron/funis] ${enviados} enviados, ${erros} erros de ${pendentes.length} pendentes`);
    return NextResponse.json({ ok: true, processados: pendentes.length, enviados, erros });
  } catch (e: any) {
    console.error("[cron/funis] Erro:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
