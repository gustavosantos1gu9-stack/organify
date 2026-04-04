import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const wa = req.nextUrl.searchParams.get("wa") || "";
  if (!wa) return NextResponse.json({ pixel_id: null });

  // Buscar agência pelo número do WhatsApp
  const { data } = await supabase.from("agencias")
    .select("meta_pixel_id, meta_ativo")
    .eq("whatsapp_numero", wa)
    .single();

  if (data?.meta_ativo && data?.meta_pixel_id) {
    return NextResponse.json({ pixel_id: data.meta_pixel_id });
  }

  return NextResponse.json({ pixel_id: null });
}
