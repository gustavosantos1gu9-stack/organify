import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET — backfill de conversas "Formulário Meta" sem campanha/conjunto/anúncio
export async function GET() {
  try {
    const agenciaId = "32cdce6e-4664-4ac6-979d-6d68a1a68745";
    const { data: ag } = await supabase.from("agencias")
      .select("meta_business_token, meta_token, meta_ad_account_id")
      .eq("id", agenciaId).single();

    const token = ag?.meta_business_token || ag?.meta_token;
    const adAccount = ag?.meta_ad_account_id;
    if (!token || !adAccount) {
      return NextResponse.json({ error: "Sem token ou ad account" });
    }

    // Buscar conversas de formulário sem tracking real
    const { data: conversas } = await supabase.from("conversas")
      .select("id, contato_numero, utm_campaign, utm_content, nome_anuncio, created_at")
      .eq("origem", "Formulário Meta")
      .order("created_at", { ascending: false });

    if (!conversas?.length) {
      return NextResponse.json({ message: "Nenhuma conversa de formulário encontrada" });
    }

    // Buscar todos os ads ativos de OUTCOME_LEADS com leads recentes
    const acId = adAccount.startsWith("act_") ? adAccount : `act_${adAccount}`;
    const adsRes = await fetch(
      `https://graph.facebook.com/v21.0/${acId}/ads?fields=name,adset{name},campaign{name},leads.limit(50){field_data,created_time}&filtering=[{"field":"campaign.objective","operator":"EQUAL","value":"OUTCOME_LEADS"}]&limit=50&access_token=${token}`
    );
    const adsData = await adsRes.json();

    if (!adsData.data?.length) {
      return NextResponse.json({ error: "Nenhum ad de OUTCOME_LEADS encontrado", raw: adsData });
    }

    // Montar mapa: telefone normalizado → { campanha, conjunto, criativo }
    const phoneMap: Record<string, { campanha: string; conjunto: string; criativo: string }> = {};
    for (const ad of adsData.data) {
      const leads = ad.leads?.data || [];
      for (const lead of leads) {
        const fields = lead.field_data || [];
        const phoneField = fields.find((f: any) =>
          f.name === "phone_number" || f.name === "whatsapp" || f.name === "telefone"
        );
        const rawPhone = (phoneField?.values?.[0] || "").replace(/\D/g, "");
        if (rawPhone) {
          const phone10 = rawPhone.slice(-10);
          const phone11 = rawPhone.slice(-11);
          phoneMap[phone10] = {
            campanha: ad.campaign?.name || "",
            conjunto: ad.adset?.name || "",
            criativo: ad.name || "",
          };
          phoneMap[phone11] = phoneMap[phone10];
          // Também guardar com DDI
          phoneMap[rawPhone] = phoneMap[phone10];
        }
      }
    }

    // Atualizar conversas
    const results: any[] = [];
    for (const conv of conversas) {
      const phoneNorm = (conv.contato_numero || "").replace(/\D/g, "");
      const match = phoneMap[phoneNorm] || phoneMap[phoneNorm.slice(-10)] || phoneMap[phoneNorm.slice(-11)];

      if (match && match.campanha) {
        const { error } = await supabase.from("conversas").update({
          utm_campaign: match.campanha,
          utm_content: match.conjunto,
          nome_anuncio: match.criativo,
        }).eq("id", conv.id);

        results.push({
          contato: conv.contato_numero,
          status: error ? `erro: ${error.message}` : "atualizado",
          campanha: match.campanha,
          conjunto: match.conjunto,
          criativo: match.criativo,
        });
      } else {
        results.push({
          contato: conv.contato_numero,
          status: "sem match",
          phone_keys: [phoneNorm, phoneNorm.slice(-10)],
        });
      }
    }

    return NextResponse.json({
      total_conversas: conversas.length,
      total_ads: adsData.data.length,
      total_leads_no_mapa: Object.keys(phoneMap).length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
