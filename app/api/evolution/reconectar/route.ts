import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export const maxDuration = 60;

// Só aceita QR em imagem (base64). O texto cru do QR ("2@...") não vira imagem no navegador.
function ehImagem(v: unknown): v is string {
  return typeof v === "string" && v.length > 100 && (v.startsWith("data:image") || /^[A-Za-z0-9+/=]+$/.test(v.slice(0, 200)));
}
function extractQr(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const qrcode = d.qrcode as Record<string, unknown> | undefined;
  for (const v of [d.base64, qrcode?.base64, d.qr, qrcode?.code, d.code]) {
    if (ehImagem(v)) return v;
  }
  return null;
}

// WhatsApp exige o código do país; sem o 55 o código de pareamento nunca é aceito
function normalizarNumero(n: string): string {
  const d = String(n).replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

function sanitizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, numero } = await req.json();
    if (!agencia_id) {
      return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });
    }

    // 1. Buscar config da agência
    const { data: ag, error: agErr } = await supabase
      .from("agencias")
      .select("nome, evolution_url, evolution_key, whatsapp_instancia, parent_id, reconexao_em_andamento")
      .eq("id", agencia_id)
      .single();

    if (agErr || !ag) {
      console.error("[reconectar] agência não encontrada:", agErr?.message);
      return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
    }

    let evoUrl: string = ag.evolution_url || "";
    let evoKey: string = ag.evolution_key || "";

    if (!evoUrl && ag.parent_id) {
      const { data: parent } = await supabase
        .from("agencias")
        .select("evolution_url, evolution_key")
        .eq("id", ag.parent_id)
        .single();
      if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
    }

    if (!evoUrl || !evoKey) {
      return NextResponse.json({ error: "Evolution API não configurada" }, { status: 400 });
    }

    // Derivar nome da instância
    const instNome: string = ag.whatsapp_instancia ||
      sanitizarNome(ag.nome || "") ||
      `wa-${agencia_id.replace(/-/g, "").slice(0, 12)}`;

    // 2. Verificar estado atual
    console.log(`[reconectar] verificando estado da instância: ${instNome}`);
    let state = "";
    let instanciaExiste = false;
    try {
      const statusRes = await fetch(`${evoUrl}/instance/connectionState/${instNome}`, {
        headers: { apikey: evoKey },
      });
      const statusData = await statusRes.json() as Record<string, unknown>;
      const inst = statusData.instance as Record<string, unknown> | undefined;
      state = ((inst?.state as string) || (statusData.state as string) || "").toLowerCase();
      instanciaExiste = !!state && state !== "not found" && state !== "error" && state !== "";
      console.log(`[reconectar] estado atual: "${state}", existe: ${instanciaExiste}`);
    } catch (e) {
      console.error("[reconectar] erro ao checar status:", e);
    }

    // 3. Se já conectada, não mexer
    if (state === "open" || state === "connected") {
      console.log("[reconectar] instância já conectada, sem ação");
      await supabase
        .from("agencias")
        .update({ whatsapp_conectado: true, reconexao_pendente: false })
        .eq("id", agencia_id);
      return NextResponse.json({ ja_conectado: true, instancia: instNome });
    }

    // 4. Se "connecting": devolver QR atual sem apagar
    if (state === "connecting") {
      console.log("[reconectar] instância em connecting, devolvendo QR atual");
      try {
        const connectRes = await fetch(`${evoUrl}/instance/connect/${instNome}`, {
          headers: { apikey: evoKey },
        });
        const connectData = await connectRes.json();
        const qr = extractQr(connectData);
        if (qr) {
          return NextResponse.json({ qr, instancia: instNome, novo: false });
        }
      } catch (e) {
        console.error("[reconectar] erro ao buscar QR de instância em connecting:", e);
      }
      // Sem QR no connecting — cai para reconexão forçada
    }

    // 5. Verificar trava de reconexão em andamento
    if (ag.reconexao_em_andamento) {
      const agoMs = Date.now() - new Date(ag.reconexao_em_andamento as string).getTime();
      if (agoMs < 2 * 60 * 1000) {
        console.log(`[reconectar] em andamento há ${Math.round(agoMs / 1000)}s, tentando QR atual`);
        try {
          const connectRes = await fetch(`${evoUrl}/instance/connect/${instNome}`, {
            headers: { apikey: evoKey },
          });
          const connectData = await connectRes.json();
          const qr = extractQr(connectData);
          if (qr) {
            return NextResponse.json({ qr, instancia: instNome, em_andamento: true });
          }
        } catch {}
        return NextResponse.json({ em_andamento: true, mensagem: "Reconexão em andamento. Aguarde alguns segundos." });
      }
    }

    // 6. Marcar reconexão em andamento
    await supabase
      .from("agencias")
      .update({ reconexao_em_andamento: new Date().toISOString() })
      .eq("id", agencia_id);

    // 7. Ler configurações atuais (antes de apagar)
    let webhookConfig: Record<string, unknown> | null = null;
    let settingsConfig: Record<string, unknown> | null = null;

    if (instanciaExiste) {
      try {
        const wRes = await fetch(`${evoUrl}/webhook/find/${instNome}`, {
          headers: { apikey: evoKey },
        });
        if (wRes.ok) {
          const wData = await wRes.json() as Record<string, unknown>;
          webhookConfig = (wData.webhook as Record<string, unknown>) || wData;
          console.log(`[reconectar] webhook lido: url=${(webhookConfig?.url as string) || "?"}`);
        }
      } catch (e) {
        console.error("[reconectar] falha ao ler webhook (usando padrão):", e);
      }

      try {
        const sRes = await fetch(`${evoUrl}/settings/find/${instNome}`, {
          headers: { apikey: evoKey },
        });
        if (sRes.ok) {
          settingsConfig = await sRes.json() as Record<string, unknown>;
          console.log("[reconectar] settings lidas");
        }
      } catch (e) {
        console.error("[reconectar] falha ao ler settings:", e);
      }

      // 8. Logout
      try {
        await fetch(`${evoUrl}/instance/logout/${instNome}`, {
          method: "DELETE",
          headers: { apikey: evoKey },
        });
        console.log("[reconectar] logout efetuado");
      } catch (e) {
        console.error("[reconectar] logout falhou (continuando):", e);
      }

      // 9. Apagar instância
      try {
        const delRes = await fetch(`${evoUrl}/instance/delete/${instNome}`, {
          method: "DELETE",
          headers: { apikey: evoKey },
        });
        if (delRes.ok) {
          console.log("[reconectar] instância apagada");
        } else {
          const delData = await delRes.json().catch(() => ({})) as Record<string, unknown>;
          console.error("[reconectar] delete retornou erro:", delData);
        }
      } catch (e) {
        console.error("[reconectar] erro ao apagar instância:", e);
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    // 10. Criar nova instância
    const qrcodeFlag = !numero; // qrcode: true para QR, false para pairing code
    console.log(`[reconectar] criando instância "${instNome}", qrcode=${qrcodeFlag}`);

    let createData: Record<string, unknown> = {};
    try {
      const createRes = await fetch(`${evoUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instNome,
          token: instNome,
          qrcode: qrcodeFlag,
          integration: "WHATSAPP-BAILEYS",
          syncFullHistory: true,
        }),
      });
      createData = await createRes.json() as Record<string, unknown>;
      console.log(`[reconectar] create resposta: ${JSON.stringify(createData).slice(0, 200)}`);
    } catch (e) {
      console.error("[reconectar] erro ao criar instância:", e);
      await limparTrava(agencia_id);
      return NextResponse.json({ error: "Falha ao criar instância" }, { status: 500 });
    }

    // Fallback: se create falhou com syncFullHistory, tentar sem
    if (createData.error || (createData as Record<string, unknown>).message) {
      console.log("[reconectar] create com syncFullHistory falhou, tentando sem");
      try {
        await fetch(`${evoUrl}/instance/delete/${instNome}`, {
          method: "DELETE",
          headers: { apikey: evoKey },
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));

        const createRes2 = await fetch(`${evoUrl}/instance/create`, {
          method: "POST",
          headers: { apikey: evoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceName: instNome,
            token: instNome,
            qrcode: qrcodeFlag,
            integration: "WHATSAPP-BAILEYS",
          }),
        });
        createData = await createRes2.json() as Record<string, unknown>;
        console.log(`[reconectar] create (sem syncFullHistory) resposta: ${JSON.stringify(createData).slice(0, 200)}`);
      } catch (e) {
        console.error("[reconectar] erro no fallback de create:", e);
        await limparTrava(agencia_id);
        return NextResponse.json({ error: "Falha ao criar instância (fallback)" }, { status: 500 });
      }
    }

    // Extrair token novo se a Evolution gerou um diferente
    const tokenNovo = (createData.instance as Record<string, unknown>)?.token as string | undefined;

    await new Promise(r => setTimeout(r, 1000));

    // 11. Reconfigurar webhook
    const defaultWebhook = {
      enabled: true,
      url: `${APP_URL}/api/webhook/whatsapp?secret=${WEBHOOK_SECRET}`,
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    };
    const webhookToApply = webhookConfig ? {
      enabled: true,
      url: (webhookConfig.url as string) || defaultWebhook.url,
      webhookByEvents: (webhookConfig.webhookByEvents as boolean) ?? false,
      webhookBase64: (webhookConfig.webhookBase64 as boolean) ?? false,
      events: Array.isArray(webhookConfig.events) && webhookConfig.events.length > 0
        ? webhookConfig.events
        : defaultWebhook.events,
    } : defaultWebhook;

    try {
      await fetch(`${evoUrl}/webhook/set/${instNome}`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ webhook: webhookToApply }),
      });
      console.log(`[reconectar] webhook reconfigurado: ${webhookToApply.url}`);
    } catch (e) {
      console.error("[reconectar] erro ao reconfigurar webhook:", e);
    }

    // Reaplicar settings se foram lidas
    if (settingsConfig && Object.keys(settingsConfig).length > 0) {
      try {
        await fetch(`${evoUrl}/settings/set/${instNome}`, {
          method: "POST",
          headers: { apikey: evoKey, "Content-Type": "application/json" },
          body: JSON.stringify(settingsConfig),
        });
        console.log("[reconectar] settings reaplicadas");
      } catch (e) {
        console.error("[reconectar] erro ao reaplicar settings:", e);
      }
    }

    // 12. Salvar no Supabase
    const updatePayload: Record<string, unknown> = {
      whatsapp_instancia: instNome,
      reconexao_em_andamento: null,
      reconexao_pendente: false,
    };
    if (tokenNovo && tokenNovo !== instNome) {
      (updatePayload as Record<string, unknown>).evolution_token = tokenNovo;
    }
    const { error: updErr } = await supabase
      .from("agencias")
      .update(updatePayload)
      .eq("id", agencia_id);
    if (updErr) {
      console.error("[reconectar] erro ao salvar no Supabase:", updErr.message);
    }

    // 13. QR ou pairing code
    if (numero) {
      // Pairing code: usar instância recém-criada, sem recriar
      const telefone = normalizarNumero(String(numero));
      console.log(`[reconectar] solicitando pairing code para ${telefone}`);
      await new Promise(r => setTimeout(r, 1000));
      try {
        const pairingRes = await fetch(`${evoUrl}/instance/connect/${instNome}?number=${telefone}`, {
          headers: { apikey: evoKey },
        });
        const pairingData = await pairingRes.json() as Record<string, unknown>;
        console.log(`[reconectar] pairing code resposta: ${JSON.stringify(pairingData).slice(0, 200)}`);
        const raw = pairingData.pairingCode || pairingData.pairing_code || pairingData.code;
        const qrFallback = extractQr(pairingData);
        if (raw && String(raw).length <= 12) {
          return NextResponse.json({ pairing_code: String(raw), instancia: instNome, novo: true });
        }
        if (qrFallback) {
          return NextResponse.json({ qr: qrFallback, instancia: instNome, novo: true });
        }
        console.error("[reconectar] pairing code não retornado:", JSON.stringify(pairingData));
        return NextResponse.json({ error: "Pairing code não disponível" }, { status: 500 });
      } catch (e) {
        console.error("[reconectar] erro ao solicitar pairing code:", e);
        return NextResponse.json({ error: "Erro ao solicitar código de pareamento" }, { status: 500 });
      }
    }

    // QR do create
    let qr = extractQr(createData);

    // Fallback: chamar connect separado (até 3 tentativas — a imagem às vezes demora a sair)
    for (let tentativa = 0; !qr && tentativa < 3; tentativa++) {
      await new Promise(r => setTimeout(r, 1200));
      try {
        const connectRes = await fetch(`${evoUrl}/instance/connect/${instNome}`, {
          headers: { apikey: evoKey },
        });
        const connectData = await connectRes.json();
        qr = extractQr(connectData);
        console.log(`[reconectar] QR via connect (tentativa ${tentativa + 1}): ${qr ? "obtido" : "não obtido"}`);
      } catch (e) {
        console.error("[reconectar] erro ao buscar QR via connect:", e);
      }
    }

    if (!qr) {
      return NextResponse.json({ error: "QR Code não disponível" }, { status: 500 });
    }

    console.log("[reconectar] sucesso — QR gerado");
    return NextResponse.json({ qr, instancia: instNome, novo: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reconectar] erro não tratado:", msg);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

async function limparTrava(agencia_id: string) {
  await supabase
    .from("agencias")
    .update({ reconexao_em_andamento: null })
    .eq("id", agencia_id);
}
