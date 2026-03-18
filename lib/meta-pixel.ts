// Serviço de disparo de eventos para o Meta Conversions API
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
}

export async function dispararEventoMeta(data: MetaEventData): Promise<{ ok: boolean; error?: string }> {
  try {
    const { pixel_id, access_token, event_name, phone, email, fbclid, utm_campaign, utm_content, source_url, valor, moeda } = data;

    if (!pixel_id || !access_token) return { ok: false, error: "Pixel ID ou token não configurado" };

    // Hash do telefone para user_data
    const userData: Record<string, any> = {};
    if (phone) {
      const numeroLimpo = phone.replace(/\D/g, "");
      // Meta requer SHA256 hash — fazemos aqui server-side
      const encoder = new TextEncoder();
      const phoneBytes = encoder.encode(numeroLimpo);
      const hashBuffer = await crypto.subtle.digest("SHA-256", phoneBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      userData.ph = [hashArray.map(b => b.toString(16).padStart(2, "0")).join("")];
    }

    const payload = {
      data: [{
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: source_url || "https://wa.me",
        user_data: {
          ...userData,
          ...(fbclid && { fbc: `fb.1.${Date.now()}.${fbclid}` }),
          client_user_agent: "WhatsApp",
        },
        ...(valor && {
          custom_data: {
            value: valor,
            currency: moeda || "BRL",
          }
        }),
        ...(utm_campaign && {
          custom_data: {
            ...(valor ? { value: valor, currency: moeda || "BRL" } : {}),
            utm_campaign,
            utm_content: utm_content || "",
          }
        }),
      }],
      test_event_code: undefined, // remover em produção
    };

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${pixel_id}/events?access_token=${access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await res.json();

    if (result.error) {
      console.error("Meta Pixel erro:", result.error);
      return { ok: false, error: result.error.message };
    }

    return { ok: true };
  } catch(e) {
    console.error("Meta Pixel exceção:", e);
    return { ok: false, error: String(e) };
  }
}
