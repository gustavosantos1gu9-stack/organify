// Enviar mensagens via WhatsApp Cloud API (Meta)
const CLOUD_API = "https://graph.facebook.com/v21.0";

interface SendTextParams {
  phoneNumberId: string;
  token: string;
  to: string;
  text: string;
}

interface SendTemplateParams {
  phoneNumberId: string;
  token: string;
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
}

export async function sendText({ phoneNumberId, token, to, text }: SendTextParams) {
  const numero = to.replace(/\D/g, "");

  const res = await fetch(`${CLOUD_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: numero,
      type: "text",
      text: { body: text },
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || "Erro ao enviar mensagem");
  }

  return data;
}

export async function sendTemplate({ phoneNumberId, token, to, templateName, languageCode = "pt_BR", components }: SendTemplateParams) {
  const numero = to.replace(/\D/g, "");

  const body: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: numero,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (components) {
    body.template.components = components;
  }

  const res = await fetch(`${CLOUD_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || "Erro ao enviar template");
  }

  return data;
}

// Marcar mensagem como lida
export async function markAsRead(phoneNumberId: string, token: string, messageId: string) {
  await fetch(`${CLOUD_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

// Buscar mídia (imagem, áudio, vídeo, documento)
export async function getMediaUrl(mediaId: string, token: string): Promise<string> {
  const res = await fetch(`${CLOUD_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.url || "";
}
