import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agencia_id } = body;

  if (!agencia_id) {
    return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });
  }

  // Usa anon key — a função SQL tem SECURITY DEFINER, bypassa RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.rpc("reclassificar_funil", {
    p_agencia_id: agencia_id,
  });

  if (error) {
    console.error("[retroativo] Erro RPC:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
