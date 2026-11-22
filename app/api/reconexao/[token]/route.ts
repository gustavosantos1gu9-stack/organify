import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";

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
  const { data, error } = await supabase
    .from("agencias")
    .select("id, nome, whatsapp_conectado, whatsapp_instancia, reconexao_token, evolution_url, evolution_key, parent_id")
    .not("reconexao_token", "is", null)
    .limit(50); // buscar candidatos e comparar de forma segura

  if (error || !data) return null;

  // Comparação segura (evita timing attacks com === direto no DB)
  const ag = data.find(a => a.reconexao_token && tokenSeguro(a.reconexao_token, token));
  return ag || null;
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

    // ── status ──
    if (acao === "status") {
      return NextResponse.json({
        whatsapp_conectado: ag.whatsapp_conectado,
        tem_instancia: !!ag.whatsapp_instancia,
      });
    }

    // ── qr: renovar QR sem recriar instância ──
    if (acao === "qr") {
      if (!ag.whatsapp_instancia) {
        return NextResponse.json({ error: "Sem instância configurada" }, { status: 400 });
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

      try {
        const connectRes = await fetch(`${evoUrl}/instance/connect/${ag.whatsapp_instancia}`, {
          headers: { apikey: evoKey },
        });
        const connectData = await connectRes.json() as Record<string, unknown>;
        const qr = extractQr(connectData);
        if (qr) {
          return NextResponse.json({ qr });
        }
        return NextResponse.json({ error: "QR não disponível" }, { status: 500 });
      } catch (e) {
        console.error("[reconexao/token qr] erro:", e);
        return NextResponse.json({ error: "Erro ao buscar QR" }, { status: 500 });
      }
    }

    // ── reconectar: deleta + recria (rate-limited via em_andamento) ──
    if (acao === "reconectar") {
      const payload: Record<string, unknown> = { agencia_id: ag.id };
      if (body.numero) payload.numero = body.numero;

      const res = await fetch(`${APP_URL}/api/evolution/reconectar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as Record<string, unknown>;
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

function extractQr(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const qrcode = d.qrcode as Record<string, unknown> | undefined;
  return (
    (typeof d.base64 === "string" ? d.base64 : null) ||
    (typeof qrcode?.base64 === "string" ? qrcode.base64 : null) ||
    (typeof qrcode?.code === "string" ? qrcode.code : null) ||
    (typeof d.code === "string" ? d.code : null) ||
    (typeof d.qr === "string" ? d.qr : null) ||
    null
  );
}
