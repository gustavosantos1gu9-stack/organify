import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

// Callback do Embedded Signup
// Recebe code + phone_number_id + waba_id do frontend após o usuário concluir o fluxo
export async function POST(req: NextRequest) {
  try {
    const { code, phone_number_id, waba_id, agencia_id, nome } = await req.json();

    if (!code || !phone_number_id || !waba_id) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;

    // 1. Trocar code por access token do usuário
    const tokenRes = await fetch(
      `${META_API}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.json({ error: tokenData.error.message }, { status: 400 });
    }

    const userToken = tokenData.access_token;

    // 2. Registrar o número WhatsApp no sistema (requer a permissão whatsapp_business_management)
    // Ativa o número pra receber mensagens
    await fetch(`${META_API}/${phone_number_id}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
    }).catch(() => {});

    // 3. Subscribir o app à WABA pra receber webhooks
    await fetch(`${META_API}/${waba_id}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
    }).catch(() => {});

    // 4. Buscar info do número
    const phoneRes = await fetch(`${META_API}/${phone_number_id}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const phoneData = await phoneRes.json();

    // 5. Salvar no banco
    await supabase.from("whatsapp_instancias").insert({
      agencia_id,
      nome: nome || phoneData.verified_name || phoneData.display_phone_number || "WhatsApp Cloud",
      instancia: `cloud-${phone_number_id}`,
      tipo: "cloud",
      cloud_phone_id: phone_number_id,
      cloud_token: userToken,
      cloud_waba_id: waba_id,
      cloud_display_phone: phoneData.display_phone_number || null,
      conectado: true,
    });

    return NextResponse.json({
      ok: true,
      nome: phoneData.verified_name,
      display_phone: phoneData.display_phone_number,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
