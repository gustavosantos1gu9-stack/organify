import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Falta ?id=SPREADSHEET_ID" });

  const { data: cfg } = await supabase.from("financas_config").select("id").limit(1).single();
  if (!cfg) return NextResponse.json({ ok: false, error: "financas_config vazia" });

  await supabase.from("financas_config").update({
    spreadsheet_id: id,
    spreadsheet_url: `https://docs.google.com/spreadsheets/d/${id}`,
  }).eq("id", cfg.id);

  return NextResponse.json({ ok: true, spreadsheet_id: id });
}
