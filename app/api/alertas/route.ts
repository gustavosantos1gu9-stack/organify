import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

// Buscar info da conta de anúncio (saldo, status, forma de pagamento)
export async function POST(req: NextRequest) {
  try {
    const { action, agencia_id, ad_account_id, token, alerta } = await req.json();

    if (action === "check_account") {
      const acId = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`;
      const res = await fetch(
        `${META_API}/${acId}?fields=name,balance,currency,account_status,funding_source_details{type,display_string}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Meta API error: ${err}` }, { status: res.status });
      }
      const data = await res.json();

      const balance = data.balance ? parseFloat(data.balance) / 100 : 0;
      const statusMap: Record<number, string> = {
        1: "Ativa", 2: "Desativada", 3: "Não liquidada", 7: "Em revisão",
        8: "Liquidação pendente", 9: "Em período de carência", 100: "Fechamento pendente", 101: "Fechada",
      };

      // Detectar forma de pagamento
      let formaPagamento = "Desconhecida";
      const funding = data.funding_source_details;
      if (funding) {
        const display = (funding.display_string || "").toLowerCase();
        if (display.includes("pix") || display.includes("boleto") || display.includes("prepaid")) {
          formaPagamento = "PIX/Boleto (Pré-pago)";
        } else if (display.includes("credit") || display.includes("crédito") || display.includes("visa") || display.includes("master")) {
          formaPagamento = "Cartão de Crédito";
        } else {
          formaPagamento = funding.display_string || "Outra";
        }
      }
      // Se tem saldo > 0 e não identificou, provavelmente é pré-pago
      if (formaPagamento === "Desconhecida" && balance > 0) {
        formaPagamento = "PIX/Boleto (Pré-pago)";
      }

      return NextResponse.json({
        name: data.name,
        balance,
        currency: data.currency,
        status: statusMap[data.account_status] || `Status ${data.account_status}`,
        account_status: data.account_status,
        forma_pagamento: formaPagamento,
        funding_source_details: funding,
      });
    }

    if (action === "save") {
      const { data, error } = await supabase.from("alertas_saldo").upsert({
        ...alerta,
        agencia_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, data });
    }

    if (action === "delete") {
      await supabase.from("alertas_saldo").delete().eq("id", alerta.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "list") {
      const { data } = await supabase.from("alertas_saldo")
        .select("*").eq("agencia_id", agencia_id).order("created_at", { ascending: false });
      return NextResponse.json({ data: data || [] });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
