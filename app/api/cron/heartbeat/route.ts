import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = "https://www.salxconvert.com.br";
const ALERT_EMAIL = process.env.ALERT_EMAIL || "gustavosantos1gu9@gmail.com";
const GRUPO_JID = "120363412455074827@g.us";
const WA_FINANCAS_INSTANCIA = "wa-financas";

// Instâncias excluídas permanentemente do monitoramento
const INSTANCIAS_IGNORADAS = new Set(["jeci-soares", "mayara-costa", "teste-ia"]);

// Instâncias pausadas: fechar alertas silenciosamente, não monitorar
const INSTANCIAS_PAUSADAS = new Set(["rafaela-costa", "katy", "lidia-takaki-botox"]);

// Horário comercial (BRT = UTC-3)
function isHorarioComercial(): boolean {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const h = brt.getUTCHours();
  return h >= 8 && h < 21;
}

function formatarHoraBRT(isoDate: string): string {
  const d = new Date(isoDate);
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return brt.toUTCString().slice(17, 22); // HH:MM
}

// Enviar mensagem de alerta: via wa-financas → grupo, fallback e-mail
async function enviarAlerta(
  texto: string, evoUrl: string, evoKey: string, isWaFinancas = false
): Promise<{ canal: string; ok: boolean }> {
  if (!isWaFinancas) {
    try {
      const res = await fetch(`${evoUrl}/message/sendText/${WA_FINANCAS_INSTANCIA}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: GRUPO_JID, text: texto }),
      });
      if (res.ok) return { canal: "grupo", ok: true };
    } catch {}
  }
  const result = await enviarEmail(texto);
  return { canal: result.canal, ok: result.canal !== "nenhum" };
}

async function enviarEmail(texto: string): Promise<{ canal: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.RESEND_FROM || "alertas@salxconvert.com.br";
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
  const html = `<pre style="font-family:monospace">${texto}</pre><br><a href="${APP_URL}/configuracoes/whatsapp-status">Ver status</a>`;
  const subject = texto.startsWith("✅") ? "WhatsApp recuperado" : "⚠️ Alerta WhatsApp";

  if (RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: EMAIL_FROM, to: [ALERT_EMAIL], subject, html }),
      });
      if (r.ok) return { canal: "email" };
    } catch {}
  }
  if (GMAIL_USER && GMAIL_PASS) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const t = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_PASS } });
      await t.sendMail({ from: `Salx Convert <${GMAIL_USER}>`, to: ALERT_EMAIL, subject, html });
      return { canal: "email" };
    } catch {}
  }
  console.error("[heartbeat] ERRO: sem configuração de e-mail para alertar");
  return { canal: "nenhum" };
}

// Criar alerta (evitar spam: um alerta aberto por tipo por instância)
async function abrirAlerta(
  agenciaId: string, instancia: string, nome: string,
  tipo: string, motivo: string, evoUrl: string, evoKey: string
) {
  const { data: existente } = await supabase.from("instancia_alertas")
    .select("id").eq("instancia", instancia).eq("tipo", tipo).eq("resolvido", false).limit(1);
  if (existente?.length) return;

  const isWaFinancas = instancia === WA_FINANCAS_INSTANCIA;
  const texto = `⚠️ WhatsApp com problema: ${nome} (${instancia}) — ${motivo}`;

  const { data: alerta } = await supabase.from("instancia_alertas").insert({
    agencia_id: agenciaId,
    instancia,
    tipo,
    mensagem: texto,
    email_enviado: false,
    canal: null,
  }).select("id").single();

  const { canal, ok } = await enviarAlerta(texto, evoUrl, evoKey, isWaFinancas);
  console.log(`[heartbeat] ALERTA ${tipo} aberto para ${instancia} (${nome}) — canal: ${canal}`);

  if (alerta?.id) {
    await supabase.from("instancia_alertas")
      .update({ email_enviado: ok, canal }).eq("id", alerta.id);
  }
}

// Resolver alerta aberto com notificação
async function resolverAlerta(
  agenciaId: string, instancia: string, nome: string,
  tipo: string, evoUrl: string, evoKey: string
) {
  const { data: aberto } = await supabase.from("instancia_alertas")
    .select("id").eq("instancia", instancia).eq("tipo", tipo).eq("resolvido", false).limit(1);
  if (!aberto?.length) return;

  await supabase.from("instancia_alertas")
    .update({ resolvido: true, resolvido_at: new Date().toISOString() })
    .eq("instancia", instancia).eq("tipo", tipo).eq("resolvido", false);

  const isWaFinancas = instancia === WA_FINANCAS_INSTANCIA;
  const texto = `✅ ${nome} (${instancia}) voltou ao normal.`;
  const { canal } = await enviarAlerta(texto, evoUrl, evoKey, isWaFinancas);
  console.log(`[heartbeat] RESOLVIDO ${tipo} para ${instancia} (${nome}) — canal: ${canal}`);
}

// Fechar todos os alertas abertos de uma instância SEM enviar notificação
async function fecharAlertasSilencioso(instancia: string) {
  await supabase.from("instancia_alertas")
    .update({ resolvido: true, resolvido_at: new Date().toISOString() })
    .eq("instancia", instancia).eq("resolvido", false);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Buscar config do master (evo URL e key)
  const { data: master } = await supabase.from("agencias")
    .select("id, evolution_url, evolution_key").is("parent_id", null).single();
  if (!master?.evolution_url) {
    return NextResponse.json({ error: "Master sem Evolution API configurada" }, { status: 500 });
  }
  const evoUrl = master.evolution_url;
  const evoKey = master.evolution_key;

  // Buscar todas as instâncias configuradas
  const { data: agencias } = await supabase.from("agencias")
    .select("id, nome, whatsapp_instancia")
    .not("whatsapp_instancia", "is", null);

  // Fechar alertas de instâncias pausadas silenciosamente (sem notificação)
  for (const ag of (agencias || [])) {
    if (INSTANCIAS_PAUSADAS.has(ag.whatsapp_instancia)) {
      await fecharAlertasSilencioso(ag.whatsapp_instancia);
    }
  }

  const instancias = (agencias || []).filter(a =>
    !INSTANCIAS_IGNORADAS.has(a.whatsapp_instancia) &&
    !INSTANCIAS_PAUSADAS.has(a.whatsapp_instancia)
  );

  const resultados: Record<string, any> = {};
  const agora = new Date();

  for (const ag of instancias) {
    const inst = ag.whatsapp_instancia;
    resultados[inst] = { state: null, delay: null, silence: null };

    // ── VERIFICAÇÃO 1: ESTADO (connectionState) ──
    let state = "unknown";
    try {
      const r = await fetch(`${evoUrl}/instance/connectionState/${inst}`, {
        headers: { apikey: evoKey },
      });
      const d = await r.json();
      state = (d?.instance?.state || d?.state || "unknown").toLowerCase();
    } catch { state = "error"; }

    resultados[inst].state = state;

    if (state !== "open") {
      await abrirAlerta(ag.id, inst, ag.nome, "state", `desconectado (estado: ${state})`, evoUrl, evoKey);
      continue; // não verifica delay/silêncio se desconectado
    } else {
      await resolverAlerta(ag.id, inst, ag.nome, "state", evoUrl, evoKey);
    }

    // ── VERIFICAÇÃO 2: ATRASO (delay médio e máximo, últimos 15 min) ──
    // Filtra por tipo do evento: ignora "append" (histórico/sync), mantém "notify" (tempo real)
    const quinzeMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    let avgDelayMin: number | null = null;
    let maxDelayMin: number | null = null;
    let delayCheckRodou = false;

    {
      const { data: logs } = await supabase.from("webhook_payload_logs")
        .select("created_at, payload")
        .eq("agencia_id", ag.id)
        .gt("created_at", quinzeMinAtras)
        .limit(50);

      if (logs?.length) {
        delayCheckRodou = true;
        const delays: number[] = [];
        for (const log of logs) {
          const payload = log.payload as any;
          const msgTs = payload?.data?.messageTimestamp;
          const fromMe = payload?.data?.key?.fromMe;
          const tipoEvento = payload?.data?.type; // "notify" = tempo real, "append" = histórico/sync
          if (!msgTs || fromMe) continue;
          if (tipoEvento === "append") continue; // ignorar sync de histórico pelo tipo, não pela idade
          const delayS = (new Date(log.created_at).getTime() / 1000) - Number(msgTs);
          if (delayS > 0 && delayS < 86400) { // sanidade: até 24h
            const delayM = delayS / 60;
            delays.push(delayM);
            if (maxDelayMin === null || delayM > maxDelayMin) maxDelayMin = delayM;
          }
        }
        if (delays.length >= 3) {
          avgDelayMin = delays.reduce((a, b) => a + b, 0) / delays.length;
        }
      }
    }

    resultados[inst].delay = avgDelayMin;
    resultados[inst].max_delay = maxDelayMin;

    if (delayCheckRodou) {
      const atrasoMedio = avgDelayMin !== null && avgDelayMin > 5;
      const atrasoUnico = maxDelayMin !== null && maxDelayMin > 15;
      if (atrasoMedio || atrasoUnico) {
        const motivo = atrasoMedio
          ? `mensagens chegando com ${Math.round(avgDelayMin!)} min de atraso médio`
          : `mensagem chegou com ${Math.round(maxDelayMin!)} min de atraso`;
        await abrirAlerta(ag.id, inst, ag.nome, "delay", motivo, evoUrl, evoKey);
      } else {
        await resolverAlerta(ag.id, inst, ag.nome, "delay", evoUrl, evoKey);
      }
    }
    // Se delayCheckRodou === false (sem logs nos últimos 15 min), não tocar no alerta de delay

    // ── VERIFICAÇÃO 3: SILÊNCIO (sem mensagens recebidas há > 2h) ──
    // Só verificar no horário comercial (8h-21h BRT)
    if (!isHorarioComercial()) {
      resultados[inst].silence = "fora_horario";
      // NÃO resolve alerta fora do horário — check não rodou
      continue;
    }

    // Usar SQL function com JOIN por agencia_id — evita passar lista enorme de IDs
    const { data: atividadeRows, error: atividadeErr } = await supabase
      .rpc("instancia_tem_atividade_recente", { p_agencia_id: ag.id });

    if (atividadeErr || !atividadeRows?.length) {
      console.error(`[heartbeat] Erro ao checar silêncio para ${inst}:`, atividadeErr);
      resultados[inst].silence = "erro";
      // NÃO resolve alerta se check falhou
      continue;
    }

    const { dias_ativos, tem_msg_recente, ultima_msg_at } = atividadeRows[0];
    resultados[inst].dias_ativos_7d = dias_ativos;

    if (dias_ativos < 3) {
      // Instância com histórico insuficiente — não aplicar regra de silêncio
      await resolverAlerta(ag.id, inst, ag.nome, "silence", evoUrl, evoKey);
      continue;
    }

    resultados[inst].silence = !tem_msg_recente;

    if (!tem_msg_recente) {
      const horario = ultima_msg_at ? formatarHoraBRT(ultima_msg_at) : "?";
      await abrirAlerta(ag.id, inst, ag.nome, "silence",
        `sem mensagens desde ${horario}`, evoUrl, evoKey);
    } else {
      await resolverAlerta(ag.id, inst, ag.nome, "silence", evoUrl, evoKey);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: agora.toISOString(),
    verificados: instancias.length,
    pausadas: [...INSTANCIAS_PAUSADAS],
    resultados,
  });
}
