import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, conversa_id, etapa_nome, phone, fbclid, fbp, contato_nome, utm_campaign, utm_content, valor, is_ctwa } = await req.json();

    if (!agencia_id || !etapa_nome) {
      return NextResponse.json({ ok: false, motivo: "agencia_id e etapa_nome são obrigatórios" });
    }

    // Buscar config da agência
    const { data: agencia } = await supabase.from("agencias")
      .select("meta_pixel_id, meta_token, meta_ativo")
      .eq("id", agencia_id).single();

    if (!agencia?.meta_ativo || !agencia?.meta_pixel_id || !agencia?.meta_token) {
      return NextResponse.json({ ok: false, motivo: "Meta Ads não configurado ou inativo" });
    }

    // Buscar evento da etapa na jornada
    const { data: etapa } = await supabase.from("jornada_etapas")
      .select("evento_conversao, eh_venda, valor_padrao")
      .eq("agencia_id", agencia_id)
      .eq("nome", etapa_nome)
      .single();

    if (!etapa?.evento_conversao) {
      return NextResponse.json({ ok: false, motivo: `Etapa '${etapa_nome}' sem evento de conversão configurado` });
    }

    // Buscar dados extras da conversa pra enriquecer o pixel
    let nomeContato = contato_nome;
    let fbpContato: string | undefined = fbp;
    let isCTWA = is_ctwa || false;
    if (conversa_id) {
      const { data: conv } = await supabase.from("conversas")
        .select("contato_nome, contato_numero, fbclid, origem, contato_jid")
        .eq("id", conversa_id).single();
      if (conv) {
        if (!nomeContato) nomeContato = conv.contato_nome;
        // Detectar CTWA: origem Meta Ads, tem fbclid, ou JID é @lid
        if (!isCTWA && (conv.origem === "Meta Ads" || conv.fbclid || conv.contato_jid?.includes("@lid"))) {
          isCTWA = true;
        }
      }
    }

    // Capturar IP e User-Agent do request
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || undefined;
    const clientUa = req.headers.get("user-agent") || undefined;

    // Gerar event_id único pra deduplicação
    const eventId = `${conversa_id || phone}_${etapa.evento_conversao}_${Date.now()}`;

    // Disparar evento
    const resultado = await dispararEventoMeta({
      pixel_id: agencia.meta_pixel_id,
      access_token: agencia.meta_token,
      event_name: etapa.evento_conversao,
      phone,
      fbclid,
      fbp: fbpContato,
      contato_nome: nomeContato,
      client_ip: clientIp,
      client_user_agent: clientUa,
      utm_campaign,
      utm_content,
      valor: valor || etapa.valor_padrao || undefined,
      external_id: conversa_id ? `${conversa_id}_${etapa.evento_conversao}` : undefined,
      is_ctwa: isCTWA,
      event_id: eventId,
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
