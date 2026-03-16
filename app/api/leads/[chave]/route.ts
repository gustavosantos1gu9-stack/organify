import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cliente admin (service role) para inserção via webhook
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: { chave: string } }
) {
  try {
    const { chave } = params;
    const body = await req.json();

    // Validar chave da API — buscar agência pela chave
    const { data: agencia, error: agenciaErr } = await supabaseAdmin
      .from("agencias")
      .select("id")
      .eq("api_key", chave)
      .single();

    if (agenciaErr || !agencia) {
      return NextResponse.json({ error: "Chave de API inválida" }, { status: 401 });
    }

    const {
      name, document, email, phone, whatsapp,
      source, social_media, company,
      opportunity_value, invoicing, observations,
      // UTMs — podem vir direto no payload ou extraídos da mensagem
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Campo 'name' é obrigatório" }, { status: 400 });
    }

    // Buscar origem correspondente
    let origemId: string | null = null;
    const origemNome = utm_source ?? source;
    if (origemNome) {
      const { data: origem } = await supabaseAdmin
        .from("origens")
        .select("id")
        .eq("agencia_id", agencia.id)
        .ilike("nome", origemNome)
        .single();
      origemId = origem?.id ?? null;
    }

    // Criar lead
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert({
        agencia_id: agencia.id,
        nome: name,
        email: email ?? null,
        telefone: phone ?? null,
        whatsapp: whatsapp ?? false,
        instagram: social_media ?? null,
        empresa: company ?? null,
        valor: opportunity_value
          ? parseFloat(String(opportunity_value).replace(/[^0-9,]/g, "").replace(",", "."))
          : null,
        faturamento: invoicing
          ? parseFloat(String(invoicing).replace(/[^0-9,]/g, "").replace(",", "."))
          : null,
        observacoes: observations ?? null,
        origem_id: origemId,
        etapa: "novo",
        // UTMs
        utm_source: utm_source ?? source ?? null,
        utm_medium: utm_medium ?? null,
        utm_campaign: utm_campaign ?? null,
        utm_content: utm_content ?? null,
        utm_term: utm_term ?? null,
        whatsapp_numero: phone ?? null,
        // CPF/CNPJ
        documento: document ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, lead_id: lead.id }, { status: 201 });
  } catch (err: unknown) {
    console.error("Erro webhook leads:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}

// GET — retorna status do endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", message: "Endpoint de leads ativo" });
}
