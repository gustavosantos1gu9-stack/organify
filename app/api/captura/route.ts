import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { link_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, agencia_id } = await req.json();

    // Incrementar cliques no link
    if (link_id) {
      await supabase.rpc("incrementar_cliques", { link_id });
    }

    // Disparar evento Lead para o Meta Pixel (server-side)
    const { data: agencia } = await supabase
      .from("agencias")
      .select("meta_pixel_id, meta_token, meta_ativo")
      .eq("id", agencia_id)
      .single();

    if (agencia?.meta_ativo && agencia?.meta_pixel_id && agencia?.meta_token) {
      await fetch(`https://graph.facebook.com/v18.0/${agencia.meta_pixel_id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [{
            event_name: "Lead",
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            user_data: { client_ip_address: req.ip || "0.0.0.0" },
            custom_data: { utm_source, utm_medium, utm_campaign, utm_content, utm_term },
          }],
          access_token: agencia.meta_token,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
