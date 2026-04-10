import { NextRequest, NextResponse } from "next/server";

const META_API = "https://graph.facebook.com/v21.0";

// Lista pixels de uma conta de anúncio
export async function POST(req: NextRequest) {
  try {
    const { token, ad_account_id } = await req.json();
    if (!token || !ad_account_id) {
      return NextResponse.json({ error: "Token e ad_account_id obrigatórios" }, { status: 400 });
    }

    const acId = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`;

    const pixelsRes = await fetch(
      `${META_API}/${acId}/adspixels?fields=id,name,is_created_by_business,last_fired_time&limit=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const pixelsData = await pixelsRes.json();
    if (pixelsData.error) {
      return NextResponse.json({ error: pixelsData.error.message }, { status: 400 });
    }

    return NextResponse.json({ pixels: pixelsData.data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
