import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estadoInstancia, buscarQr, garantirWebhook } from "@/app/api/evolution/evo-util";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";

export const maxDuration = 60;

/** Comparação de token resistente a timing attacks */
function tokenSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function buscarAgenciaPorToken(token: string) {
  // Busca direto pelo token (antes pegava só 50 agências com token e podia não achar a certa)
  const { data, error } = await supabase
    .from("agencias")
    .select("id, nome, whatsapp_conectado, whatsapp_instancia, reconexao_token, evolution_url, evolution_key, parent_id")
    .eq("reconexao_token", token)
    .limit(1);

  if (error || !data) return null;
  const ag = data.find(a => a.reconexao_token && tokenSeguro(a.reconexao_token, token));
  return ag || null;
}

async function credenciaisEvo(ag: { evolution_url?: string | null; evolution_key?: string | null; parent_id?: string | null }) {
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
  return { evoUrl, evoKey };
}

async function marcarConectado(agenciaId: string) {
  await supabase.from("agencias")
    .update({ whatsapp_conectado: true, reconexao_pendente: false, reconexao_em_andamento: null })
    .eq("id", agenciaId);
}

// GET: retorna nome da agência e status (sem dados sensíveis)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const ag = await buscarAgenciaPorToken(token);
    if (!ag) {
      return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
    }

    return NextResponse.json({
      agencia_nome: ag.nome,
      whatsapp_conectado: ag.whatsapp_conectado,
      tem_instancia: !!ag.whatsapp_instancia,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reconexao/token GET] erro:", msg);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST: actions = "status" | "reconectar" | "qr"
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const ag = await buscarAgenciaPorToken(token);
    if (!ag) {
      return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
    }

    const body = await req.json() as { acao?: string; numero?: string };
    const acao = body.acao || "status";

    // ── status: confere ao vivo na Evolution (não depende só do webhook ter avisado) ──
    if (acao === "status") {
      let conectado = !!ag.whatsapp_conectado;
      if (!conectado && ag.whatsapp_instancia) {
        const { evoUrl, evoKey } = await credenciaisEvo(ag);
        if (evoUrl && evoKey) {
          const st = await estadoInstancia(evoUrl, evoKey, ag.whatsapp_instancia);
          if (st === "open" || st === "connected") {
            conectado = true;
            await garantirWebhook(evoUrl, evoKey, ag.whatsapp_instancia);
            await marcarConectado(ag.id);
          }
        }
      }
      return NextResponse.json({ whatsapp_conectado: conectado, tem_instancia: !!ag.whatsapp_instancia });
    }

    // ── qr: como o WhatsApp Web — sempre devolve o QR válido do momento ──
    // instância esperando QR → QR atual; parou de gerar (fechada) → reinicia e gera outro;
    // sumiu → recria pela rota de reconexão (que tem trava contra recriar em sequência)
    if (acao === "qr") {
      const { evoUrl, evoKey } = await credenciaisEvo(ag);
      if (!evoUrl || !evoKey) {
        return NextResponse.json({ aguarde: true, mensagem: "WhatsApp ainda não configurado para esta conta." });
      }
      const inst = ag.whatsapp_instancia || "";
      const st = inst ? await estadoInstancia(evoUrl, evoKey, inst) : "";

      if (st === "open" || st === "connected") {
        await garantirWebhook(evoUrl, evoKey, inst);
        await marcarConectado(ag.id);
        return NextResponse.json({ conectado: true });
      }

      if (st === "connecting" || st === "close") {
        const qr = await buscarQr(evoUrl, evoKey, inst, 2);
        if (qr) {
          await garantirWebhook(evoUrl, evoKey, inst);
          return NextResponse.json({ qr });
        }
      }

      // Sem QR: recria a instância
      try {
        const res = await fetch(`${APP_URL}/api/evolution/reconectar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencia_id: ag.id }),
          signal: AbortSignal.timeout(50000),
        });
        const data = await res.json() as Record<string, unknown>;
        if (data.ja_conectado) return NextResponse.json({ conectado: true });
        if (data.qr) return NextResponse.json({ qr: data.qr });
        return NextResponse.json({ aguarde: true, mensagem: (data.mensagem as string) || null });
      } catch (e) {
        console.error("[reconexao/token qr] recriar falhou:", e);
        return NextResponse.json({ aguarde: true });
      }
    }

    // ── reconectar: deleta + recria (rate-limited via em_andamento) ──
    if (acao === "reconectar") {
      const payload: Record<string, unknown> = { agencia_id: ag.id };
      if (body.numero) payload.numero = body.numero;

      let data: Record<string, unknown> = {};
      try {
        const res = await fetch(`${APP_URL}/api/evolution/reconectar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(55000),
        });
        data = await res.json() as Record<string, unknown>;
      } catch (e) {
        console.error("[reconexao/token reconectar] sem resposta:", e);
        await supabase.from("agencias").update({ reconexao_em_andamento: null }).eq("id", ag.id);
        return NextResponse.json({ aguarde: true, error: "O servidor do WhatsApp demorou para responder." });
      }
      // Não repassa campos internos sensíveis — apenas o necessário para a página pública
      return NextResponse.json({
        qr: data.qr || null,
        pairing_code: data.pairing_code || null,
        instancia: null, // não expõe nome da instância publicamente
        ja_conectado: data.ja_conectado || false,
        em_andamento: data.em_andamento || false,
        mensagem: data.mensagem || null,
        error: data.error || null,
      });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reconexao/token POST] erro:", msg);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
