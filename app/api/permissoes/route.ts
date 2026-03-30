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
      return NextResponse.json({ permissoes: null });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ permissoes: null });
    }

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("time_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!usuario) {
      return NextResponse.json({ permissoes: null }); // sem registro em usuarios = dono/admin
    }

    if (!usuario.time_id) {
      return NextResponse.json({ permissoes: [] }); // membro sem time = sem acesso
    }

    const { data: time } = await supabaseAdmin
      .from("times")
      .select("permissoes")
      .eq("id", usuario.time_id)
      .single();

    if (!time?.permissoes) {
      return NextResponse.json({ permissoes: null });
    }

    const permissoes = time.permissoes as Record<string, string[]>;
    const allowed: string[] = [];
    for (const [key, perms] of Object.entries(permissoes)) {
      if (Array.isArray(perms) && perms.length > 0) {
        allowed.push(key);
      }
    }

    return NextResponse.json({ permissoes: allowed });
  } catch {
    return NextResponse.json({ permissoes: null });
  }
}
