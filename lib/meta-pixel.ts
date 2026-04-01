// Serviço de disparo de eventos para o Meta Conversions API (CAPI)
interface MetaEventData {
  pixel_id: string;
  access_token: string;
  event_name: string;
  phone?: string;
  email?: string;
  fbclid?: string;
  utm_campaign?: string;
  utm_content?: string;
  source_url?: string;
  valor?: number;
  moeda?: string;
  external_id?: string;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function dispararEventoMeta(data: MetaEventData): Promise<{ ok: boolean; error?: string; response?: any }> {
  try {
    const { pixel_id, access_token, event_name, phone, email, fbclid, utm_campaign, utm_content, source_url, valor, moeda, external_id } = data;

    if (!pixel_id || !access_token) return { ok: false, error: "Pixel ID ou token não configurado" };

    // User data com hashes SHA-256 (requisito da Meta)
    const userData: Record<string, any> = {};

    if (phone) {
      const numeroLimpo = phone.replace(/\D/g, "");
      // Meta pede formato E.164 sem +, com código do país
      const numero164 = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;
      userData.ph = [await sha256(numero164)];
    }

    if (email) {
      userData.em = [await sha256(email.toLowerCase().trim())];
    }

    // fbc: formato fb.{subdomain_index}.{creation_time}.{fbclid}
    if (fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${fbclid}`;
    }

    // external_id para deduplicação
    if (external_id) {
      userData.external_id = await sha256(external_id);
    }

    // Dados customizados
    const customData: Record<string, any> = {};
    // Purchase exige value + currency obrigatoriamente
    const valorNumerico = typeof valor === "number" ? valor : (typeof valor === "object" ? 0 : Number(valor) || 0);
    if (valorNumerico > 0) {
      customData.value = valorNumerico;
      customData.currency = moeda || "BRL";
    } else if (event_name === "Purchase") {
      customData.value = 0;
      customData.currency = moeda || "BRL";
    }
    if (utm_campaign) customData.utm_campaign = utm_campaign;
    if (utm_content) customData.utm_content = utm_content;

    const eventData: Record<string, any> = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: source_url || "https://wa.me/",
      user_data: userData,
    };

    if (Object.keys(customData).length > 0) {
      eventData.custom_data = customData;
    }

    const payload = {
      data: [eventData],
    };

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
