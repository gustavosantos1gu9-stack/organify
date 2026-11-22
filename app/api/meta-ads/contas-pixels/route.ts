import { NextRequest, NextResponse } from "next/server";

const META_API = "https://graph.facebook.com/v21.0";

// Lista contas de anúncio e pixels disponíveis pro usuário autenticado
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

    const contasMap = new Map<string, any>();

    // 1. Buscar contas diretas do usuário (com paginação)
    let url: string | null = `${META_API}/me/adaccounts?fields=id,name,account_status,currency,business_name&limit=200`;
    while (url) {
      const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.error) {
        // Token inválido ou expirado — retornar erro explícito na primeira chamada
        if (contasMap.size === 0) {
          return NextResponse.json({ error: data.error.message || "Token inválido ou expirado. Reconecte o Meta." }, { status: 400 });
        }
        break;
      }
      for (const c of data.data || []) {
        contasMap.set(c.id, c);
      }
      url = data.paging?.next || null;
    }

    // 2. Buscar contas via Business Managers do usuário
    try {
      let listBizUrl: string | null = `${META_API}/me/businesses?fields=id,name&limit=50`;
      while (listBizUrl) {
        const bizRes: Response = await fetch(listBizUrl, { headers: { Authorization: `Bearer ${token}` } });
        const bizData = await bizRes.json();
        for (const biz of bizData.data || []) {
          let bizUrl: string | null = `${META_API}/${biz.id}/owned_ad_accounts?fields=id,name,account_status,currency,business_name&limit=200`;
          while (bizUrl) {
            const res: Response = await fetch(bizUrl, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.error) break;
            for (const c of data.data || []) {
              if (!contasMap.has(c.id)) {
                contasMap.set(c.id, { ...c, business_name: c.business_name || biz.name });
              }
            }
            bizUrl = data.paging?.next || null;
          }
          // Contas compartilhadas com o business
          let clientUrl: string | null = `${META_API}/${biz.id}/client_ad_accounts?fields=id,name,account_status,currency,business_name&limit=200`;
          while (clientUrl) {
            const res: Response = await fetch(clientUrl, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.error) break;
            for (const c of data.data || []) {
              if (!contasMap.has(c.id)) {
                contasMap.set(c.id, { ...c, business_name: c.business_name || biz.name });
              }
            }
            clientUrl = data.paging?.next || null;
          }
        }
        listBizUrl = bizData.paging?.next || null;
      }
    } catch {}

    const contas = Array.from(contasMap.values()).map((c: any) => ({
      id: c.id,
      id_clean: c.id.replace("act_", ""),
      name: c.name,
      business: c.business_name || "",
      status: c.account_status,
      currency: c.currency,
    }));

    // Ordenar por nome
    contas.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return NextResponse.json({ contas });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
