import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ permissoes: null, modulos_agencia: null });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ permissoes: null, modulos_agencia: null });
    }

    const { data: _usuarios } = await supabaseAdmin
      .from("usuarios")
      .select("time_id, agencia_id")
      .eq("auth_user_id", user.id)
      .limit(1);
    const usuario = _usuarios?.[0] || null;

    if (!usuario) {
      // Dono/admin — verificar se tem agência selecionada via query param
      const agenciaId = request.nextUrl.searchParams.get("agencia_id");
      if (agenciaId) {
        const { data: ag } = await supabaseAdmin
          .from("agencias")
          .select("modulos_habilitados")
          .eq("id", agenciaId)
          .single();
        return NextResponse.json({
          permissoes: null, // admin = vê tudo que a agência permite
          modulos_agencia: ag?.modulos_habilitados || null,
        });
      }
      return NextResponse.json({ permissoes: null, modulos_agencia: null });
    }

    // Buscar modulos_habilitados da agência do usuário
    let modulosAgencia: string[] | null = null;
    if (usuario.agencia_id) {
      const { data: ag } = await supabaseAdmin
        .from("agencias")
        .select("modulos_habilitados")
        .eq("id", usuario.agencia_id)
        .single();
      modulosAgencia = ag?.modulos_habilitados || null;
    }

    if (!usuario.time_id) {
      return NextResponse.json({ permissoes: [], modulos_agencia: modulosAgencia });
    }

    const { data: time } = await supabaseAdmin
      .from("times")
      .select("permissoes")
      .eq("id", usuario.time_id)
      .single();

    if (!time?.permissoes) {
      return NextResponse.json({ permissoes: null, modulos_agencia: modulosAgencia });
    }

    const permissoes = time.permissoes as Record<string, string[]>;
    const allowed: string[] = [];
    for (const [key, perms] of Object.entries(permissoes)) {
      if (Array.isArray(perms) && perms.length > 0) {
        allowed.push(key);
      }
    }

    return NextResponse.json({ permissoes: allowed, modulos_agencia: modulosAgencia });
  } catch {
    return NextResponse.json({ permissoes: null, modulos_agencia: null });
  }
}
