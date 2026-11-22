import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id, etapa_nome, phone, fbclid, fbp, contato_nome, utm_campaign, utm_content, valor, is_ctwa, lead_id: lead_id_body } = await req.json();
    let lead_id: string | undefined = lead_id_body || undefined;

    if (!agencia_id || !etapa_nome) {
      return NextResponse.json({ ok: false, motivo: "agencia_id e etapa_nome são obrigatórios" });
    }

    // Buscar config da agência
    const { data: agenciaRaw } = await supabase.from("agencias")
      .select("meta_pixel_id, meta_token, meta_business_token, meta_ativo, parent_id")
      .eq("id", agencia_id).single();

    const isFilha = !!agenciaRaw?.parent_id;

    // Token para a CAPI:
    // Filha: sempre usa token da Lavínia (relatorios_conexoes do master) — comportamento de produção
    // Master: usa token próprio
    let resolvedToken = agenciaRaw?.meta_token || agenciaRaw?.meta_business_token || null;
    if (isFilha) {
      try {
        const { data: rc } = await supabase.from("relatorios_conexoes")
          .select("meta_token")
          .eq("agencia_id", agenciaRaw!.parent_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (rc?.meta_token) resolvedToken = rc.meta_token;
      } catch {}
    }

    const agencia = agenciaRaw ? { ...agenciaRaw, meta_token: resolvedToken } : null;

    if (!agencia?.meta_ativo || !agencia?.meta_pixel_id || !agencia?.meta_token) {
      return NextResponse.json({ ok: false, motivo: "Meta Ads não configurado ou inativo" });
    }

    // Buscar evento da etapa na jornada (com fallback pro parent)
    let { data: etapa } = await supabase.from("jornada_etapas")
      .select("evento_conversao, eh_venda, valor_padrao")
      .eq("agencia_id", agencia_id)
      .eq("nome", etapa_nome)
      .single();

    // Se filha não tem a etapa configurada, tentar no parent
    if (!etapa?.evento_conversao && agenciaRaw?.parent_id) {
      const { data: etapaParent } = await supabase.from("jornada_etapas")
        .select("evento_conversao, eh_venda, valor_padrao")
        .eq("agencia_id", agenciaRaw.parent_id)
        .eq("nome", etapa_nome)
        .single();
      if (etapaParent) etapa = etapaParent;
    }

    if (!etapa?.evento_conversao) {
      return NextResponse.json({ ok: false, motivo: `Etapa '${etapa_nome}' sem evento de conversão configurado` });
    }

    // Buscar dados extras da conversa pra enriquecer o pixel
    let nomeContato = contato_nome;
    let fbpContato: string | undefined = fbp;
    let isCTWA = is_ctwa || false;
    let emailContato: string | undefined = undefined;
    let fbclidResolved: string | undefined = fbclid || undefined;
    if (conversa_id) {
      const convSelect = isFilha
        ? "contato_nome, contato_numero, fbclid, ctwa_clid, origem, contato_jid, leadgen_id, lead_id"
        : "contato_nome, contato_numero, fbclid, origem, contato_jid, leadgen_id, lead_id";
      const { data: conv } = await (supabase.from("conversas") as any)
        .select(convSelect)
        .eq("id", conversa_id).single();
      if (conv) {
        if (!nomeContato) nomeContato = conv.contato_nome;
        // Fallback: usar fbclid ou ctwa_clid da conversa se não veio no request
        if (!fbclidResolved && conv.fbclid) fbclidResolved = conv.fbclid;
        if (isFilha && !fbclidResolved && (conv as any).ctwa_clid) fbclidResolved = (conv as any).ctwa_clid;
        // Detectar CTWA: origem Meta Ads, tem fbclid, JID @lid (produção), ou ctwa_clid (filha)
        if (!isCTWA && (conv.origem === "Meta Ads" || conv.fbclid || conv.contato_jid?.includes("@lid") ||
            (isFilha && (conv as any).ctwa_clid))) {
          isCTWA = true;
        }
        // Usar leadgen_id da conversa se não veio no request (Lead Ads attribution)
        if (!lead_id && conv.leadgen_id) {
          lead_id = conv.leadgen_id;
        }
        // Buscar email do lead para melhorar match rate no Meta (+4.0 pts no score)
        if (conv.lead_id) {
          const { data: leadData } = await supabase.from("leads")
            .select("email").eq("id", conv.lead_id).single();
          if (leadData?.email) emailContato = leadData.email;
        }
      }
    }

    // Capturar IP e User-Agent do request
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || undefined;
    const clientUa = req.headers.get("user-agent") || undefined;

    // Gerar event_id único pra deduplicação
    // Se tiver fbclid, usar como base estável para que form + webhook do mesmo clique sejam deduplicados pelo Meta
    const fbclidKey = fbclidResolved ? fbclidResolved.slice(-20) : null;
    const eventId = fbclidKey
      ? `${fbclidKey}_${etapa.evento_conversao}`
      : `${conversa_id || phone}_${etapa.evento_conversao}_${Date.now()}`;

    // Disparar evento
    const resultado = await dispararEventoMeta({
      pixel_id: agencia.meta_pixel_id,
      access_token: agencia.meta_token,
      event_name: etapa.evento_conversao,
      phone,
      email: emailContato,
      fbclid: fbclidResolved,
      fbp: fbpContato,
      contato_nome: nomeContato,
      client_ip: clientIp,
      client_user_agent: clientUa,
      utm_campaign,
      utm_content,
      valor: valor || etapa.valor_padrao || undefined,
      external_id: conversa_id
        ? (isFilha ? conversa_id : `${conversa_id}_${etapa.evento_conversao}`)
        : undefined,
      is_ctwa: isCTWA,
      event_id: eventId,
      lead_id: lead_id || undefined,
    });

    // Salvar log do disparo
    await supabase.from("pixel_disparos").insert({
      agencia_id,
      conversa_id,
      telefone: phone || null,
      etapa: etapa_nome,
      evento: etapa.evento_conversao,
      status: resultado.ok ? "sucesso" : "erro",
      retorno: resultado.error || (resultado.response?.events_received ? `OK (${resultado.response.events_received} events)` : "OK"),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(resultado);
  } catch(e) {
    console.error("Pixel API erro:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
