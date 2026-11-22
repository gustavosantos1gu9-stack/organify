// Endpoint simples de CAPI — para LP e Formulário (sem jornada_etapas)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agencia_id, event_name, phone, email, fbclid, fbp, contato_nome, utm_campaign, utm_source, utm_medium, utm_content, event_id, source_url, cliente_externo_id, formulario_id } = body;

    if (!agencia_id || !event_name) {
      return NextResponse.json({ ok: false, motivo: "agencia_id e event_name são obrigatórios" });
    }

    // Buscar pixel_id e token da agência (com fallback pro parent)
    const { data: ag } = await supabase.from("agencias")
      .select("meta_pixel_id, meta_token, meta_business_token, meta_ativo, parent_id")
      .eq("id", agencia_id).single();

    if (!ag) return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });

    let pixelId = ag.meta_pixel_id;
    let token = ag.meta_token || ag.meta_business_token;

    // Fallback pro parent — token da Lavínia via relatorios_conexoes
    if ((!pixelId || !token) && ag.parent_id) {
      const { data: parent } = await supabase.from("agencias")
        .select("meta_pixel_id").eq("id", ag.parent_id).single();
      pixelId = pixelId || parent?.meta_pixel_id;
      if (!token) {
        const { data: rc } = await supabase.from("relatorios_conexoes")
          .select("meta_token").eq("agencia_id", ag.parent_id)
          .order("created_at", { ascending: false }).limit(1).single();
        token = rc?.meta_token || null;
      }
    }

    // Override com pixel/token do cliente externo se configurado
    if (cliente_externo_id) {
      const { data: clienteExt } = await supabase.from("clientes_externos")
        .select("meta_pixel_id, meta_access_token")
        .eq("id", cliente_externo_id).single();
      if (clienteExt?.meta_pixel_id) pixelId = clienteExt.meta_pixel_id;
      if (clienteExt?.meta_access_token) token = clienteExt.meta_access_token;
    }

    if (!pixelId || !token) {
      return NextResponse.json({ ok: false, motivo: "Pixel não configurado" });
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const clientUa = req.headers.get("user-agent") || undefined;

    // Log local de visualizações/submissões de formulários
    if (formulario_id && (event_name === "ViewContent" || event_name === "Lead")) {
      void supabase.from("formularios_visualizacoes").insert({
        formulario_id,
        agencia_id,
        event_name,
        client_ip: clientIp || null,
        user_agent: clientUa || null,
        source_url: source_url || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        contato_nome: contato_nome || null,
        phone: phone || null,
        email: email || null,
      });
    }

    const resultado = await dispararEventoMeta({
      pixel_id: pixelId,
      access_token: token,
      event_name,
      phone: phone || undefined,
      email: email || undefined,
      fbclid: fbclid || undefined,
      fbp: fbp || undefined,
      contato_nome: contato_nome || undefined,
      client_ip: clientIp,
      client_user_agent: clientUa,
      utm_campaign: utm_campaign || undefined,
      utm_content: utm_content || undefined,
      source_url: source_url || undefined,
      event_id: event_id || `${agencia_id}_${event_name}_${Date.now()}`,
      action_source: "website",
    });

    return NextResponse.json(resultado);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
