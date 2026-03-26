import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { nome, email, cpf, time_id, ativo, agencia_id } =
      await request.json();

    if (!email || !nome) {
      return NextResponse.json(
        { error: "Nome e email são obrigatórios." },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || "";

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { nome, agencia_id },
        redirectTo: `${origin}/nova-senha`,
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const auth_user_id = authData.user.id;

    const { data: usuario, error: insertError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        auth_user_id,
        nome,
        email,
        cpf,
        time_id,
        ativo,
        agencia_id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(usuario, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
