import { NextRequest, NextResponse } from "next/server";

const META_API = "https://graph.facebook.com/v21.0";

// Lista contas de anúncio e pixels disponíveis pro usuário autenticado
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

    // 1. Buscar todas as contas de anúncio
    const contasRes = await fetch(
      `${META_API}/me/adaccounts?fields=id,name,account_status,currency,business_name&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const contasData = await contasRes.json();
    if (contasData.error) {
      return NextResponse.json({ error: contasData.error.message }, { status: 400 });
    }

    const contas = (contasData.data || []).map((c: any) => ({
      id: c.id,
      id_clean: c.id.replace("act_", ""),
      name: c.name,
      business: c.business_name || "",
      status: c.account_status,
      currency: c.currency,
    }));

    return NextResponse.json({ contas });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
