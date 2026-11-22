import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";

function gerarToken(): string {
  // 48 bytes → 96 hex chars
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  try {
    // Validar sessão Supabase via Authorization header
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    if (!jwt) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    const { agencia_id } = await req.json();
    if (!agencia_id) {
      return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });
    }

    // Verificar que o usuário tem acesso à agência
    const { data: ag, error: agErr } = await supabase
      .from("agencias")
      .select("id, nome")
      .eq("id", agencia_id)
      .single();

    if (agErr || !ag) {
      return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
    }

    const token = gerarToken();
    const { error: updErr } = await supabase
      .from("agencias")
      .update({ reconexao_token: token })
      .eq("id", agencia_id);

    if (updErr) {
      console.error("[gerar-token] erro ao salvar token:", updErr.message);
      return NextResponse.json({ error: "Erro ao gerar token" }, { status: 500 });
    }

    const link = `${APP_URL}/reconectar/${token}`;
    return NextResponse.json({ token, link, agencia_nome: ag.nome });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[gerar-token] erro:", msg);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
