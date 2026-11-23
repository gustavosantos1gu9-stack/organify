// Utilitários da Evolution API usados pela reconexão do WhatsApp.
// Toda chamada tem tempo limite: se a Evolution travar, a rota responde em vez de esperar até cair.

export const LIMITE_EVO_MS = 10000;

export function fetchEvo(url: string, init: RequestInit = {}, ms = LIMITE_EVO_MS) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

// Só aceita QR em imagem (base64). O texto cru do QR ("2@...") não vira imagem no navegador.
export function ehImagem(v: unknown): v is string {
  return typeof v === "string" && v.length > 100 &&
    (v.startsWith("data:image") || /^[A-Za-z0-9+/=]+$/.test(v.slice(0, 200)));
}

export function extractQr(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const qrcode = d.qrcode as Record<string, unknown> | undefined;
  for (const v of [d.base64, qrcode?.base64, d.qr, qrcode?.code, d.code]) {
    if (ehImagem(v)) return v;
  }
  return null;
}

/** "open" | "connecting" | "close" | "" (instância não existe ou Evolution não respondeu) */
export async function estadoInstancia(evoUrl: string, evoKey: string, inst: string): Promise<string> {
  try {
    const r = await fetchEvo(`${evoUrl}/instance/connectionState/${inst}`, { headers: { apikey: evoKey } });
    if (!r.ok) return "";
    const d = await r.json() as Record<string, unknown>;
    const i = d.instance as Record<string, unknown> | undefined;
    return String((i?.state as string) || (d.state as string) || "").toLowerCase();
  } catch {
    return "";
  }
}

/** Pede o QR atual. Numa instância fechada, o connect também reinicia a sessão e gera um QR novo. */
export async function buscarQr(evoUrl: string, evoKey: string, inst: string, tentativas = 2): Promise<string | null> {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetchEvo(`${evoUrl}/instance/connect/${inst}`, { headers: { apikey: evoKey } });
      const qr = extractQr(await r.json());
      if (qr) return qr;
    } catch { /* tenta de novo */ }
    if (i < tentativas - 1) await new Promise(res => setTimeout(res, 1200));
  }
  return null;
}

/** Garante que a instância manda as mensagens para a plataforma. Mantém um webhook que já esteja ligado. */
export async function garantirWebhook(evoUrl: string, evoKey: string, inst: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
  const secret = process.env.WEBHOOK_SECRET || "";
  try {
    const r = await fetchEvo(`${evoUrl}/webhook/find/${inst}`, { headers: { apikey: evoKey } });
    if (r.ok) {
      const d = await r.json() as Record<string, unknown> | null;
      const w = ((d?.webhook as Record<string, unknown>) || d || {}) as Record<string, unknown>;
      if (w.enabled && typeof w.url === "string" && w.url) return; // já está ligado
    }
  } catch { /* segue para configurar */ }
  try {
    await fetchEvo(`${evoUrl}/webhook/set/${inst}`, {
      method: "POST",
      headers: { apikey: evoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: `${appUrl}/api/webhook/whatsapp?secret=${secret}`,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
      }),
    });
    console.log(`[evo] webhook configurado para ${inst}`);
  } catch (e) {
    console.error(`[evo] falha ao configurar webhook de ${inst}:`, e);
  }
}
