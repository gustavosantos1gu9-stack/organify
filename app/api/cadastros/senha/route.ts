import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const { data: cadastro } = await supabase
      .from("cadastros_clientes")
      .select("senha_facebook_enc")
      .eq("id", id)
      .single();

    if (!cadastro?.senha_facebook_enc) {
      return NextResponse.json({ senha: "—" });
    }

    const chave = process.env.CADASTRO_ENCRYPT_KEY;
    if (!chave) return NextResponse.json({ senha: "Chave não configurada" });

    const { data, error } = await supabase.rpc("decrypt_text", {
      texto_enc: cadastro.senha_facebook_enc,
      chave,
    });

    if (error) {
      console.error("[senha] Erro decrypt:", error);
      return NextResponse.json({ senha: "Erro ao descriptografar" });
    }

    return NextResponse.json({ senha: data || "—" });
  } catch (e: any) {
    return NextResponse.json({ senha: "Erro" }, { status: 500 });
  }
}
