// Serviço de disparo de eventos para o Meta Conversions API (CAPI)
interface MetaEventData {
  pixel_id: string;
  access_token: string;
  event_name: string;
  phone?: string;
  email?: string;
  fbclid?: string;
  fbp?: string;
  contato_nome?: string;
  client_ip?: string;
  client_user_agent?: string;
  utm_campaign?: string;
  utm_content?: string;
  source_url?: string;
  valor?: number;
  moeda?: string;
  external_id?: string;
  is_ctwa?: boolean;
  event_id?: string;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function dispararEventoMeta(data: MetaEventData): Promise<{ ok: boolean; error?: string; response?: any }> {
  try {
    const {
      pixel_id, access_token, event_name, phone, email, fbclid, fbp,
      contato_nome, client_ip, client_user_agent,
      utm_campaign, utm_content, source_url, valor, moeda,
      external_id, is_ctwa, event_id,
    } = data;

    if (!pixel_id || !access_token) return { ok: false, error: "Pixel ID ou token não configurado" };

    // ── User data com hashes SHA-256 ──
    const userData: Record<string, any> = {};

    // Telefone (maior impacto depois de email) — +3.0 pts
    if (phone) {
      const numeroLimpo = phone.replace(/\D/g, "");
      const numero164 = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;
      userData.ph = [await sha256(numero164)];
    }

    // Email — +4.0 pts
    if (email) {
      userData.em = [await sha256(email.toLowerCase().trim())];
    }

    // Nome e sobrenome do contato — +1.5 pts
    if (contato_nome) {
      const partes = contato_nome.trim().toLowerCase().split(/\s+/);
      if (partes[0]) {
        userData.fn = [await sha256(partes[0])];
      }
      if (partes.length > 1) {
        userData.ln = [await sha256(partes[partes.length - 1])];
      }
    }

    // País — sempre Brasil — +0.25 pts
    userData.country = [await sha256("br")];

    // fbc: formato fb.{subdomain_index}.{creation_time}.{fbclid} — +1.0 pt
    if (fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${fbclid}`;
    }

    // fbp: cookie do browser — +1.0 pt
    if (fbp) {
      userData.fbp = fbp;
    }

    // external_id para matching — +0.5 pts
    if (external_id) {
      userData.external_id = [await sha256(external_id)];
    }

    // IP do cliente — +0.5 pts
    if (client_ip) {
      userData.client_ip_address = client_ip;
    }

    // User agent — +0.5 pts
    if (client_user_agent) {
      userData.client_user_agent = client_user_agent;
    }

    // ── Dados customizados ──
    const customData: Record<string, any> = {};
    let valorNumerico = 0;
    if (typeof valor === "number") {
      valorNumerico = valor;
    } else if (typeof valor === "string") {
      valorNumerico = parseFloat(valor) || 0;
    } else if (valor && typeof valor === "object") {
      const obj = valor as Record<string, any>;
      if ("Int" in obj) valorNumerico = Number(obj.Int) || 0;
    }
    if (valorNumerico > 0) {
      customData.value = valorNumerico;
      customData.currency = moeda || "BRL";
    } else if (event_name === "Purchase" || event_name === "AddToCart") {
      customData.value = 0;
      customData.currency = moeda || "BRL";
    }
    if (utm_campaign) customData.utm_campaign = utm_campaign;
    if (utm_content) customData.utm_content = utm_content;

    // ── Action source ──
    // Usar sempre "website" — "messaging" exige configuração especial no pixel
    const actionSource = "website";

    const eventData: Record<string, any> = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: actionSource,
      user_data: userData,
    };

    // Event ID para deduplicação
    if (event_id) {
      eventData.event_id = event_id;
    }

    eventData.event_source_url = source_url || "https://salxconvert-blond.vercel.app/";

    if (Object.keys(customData).length > 0) {
      eventData.custom_data = customData;
    }

    const payload = { data: [eventData] };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixel_id}/events?access_token=${access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await res.json();

    if (result.error) {
      console.error("Meta CAPI erro:", result.error);
      return { ok: false, error: result.error.message, response: result };
    }

    return { ok: true, response: result };
  } catch(e) {
    console.error("Meta CAPI exceção:", e);
    return { ok: false, error: String(e) };
  }
}
