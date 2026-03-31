import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verificar se o usuário é dono da agência master
async function getMasterAgenciaId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  // Buscar agência do usuário
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("agencia_id")
    .eq("auth_user_id", user.id)
    .single();

  // Se não tem registro em usuarios, é o dono original — buscar agência sem parent_id
  if (!usuario) {
    const { data: agencia } = await supabaseAdmin
      .from("agencias")
      .select("id")
      .is("parent_id", null)
      .limit(1)
      .single();
    return agencia?.id || null;
  }

  // Se é usuario, verificar se a agência dele é master (sem parent_id)
  const { data: agencia } = await supabaseAdmin
    .from("agencias")
    .select("id, parent_id")
    .eq("id", usuario.agencia_id)
    .single();

  if (agencia?.parent_id) return null; // é membro de agência filha, não tem acesso
  return agencia?.id || null;
}

// GET — listar agências filhas
export async function GET(req: NextRequest) {
  const masterId = await getMasterAgenciaId(req);
  if (!masterId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("agencias")
    .select("id, nome, email, telefone, modulos_habilitados, created_at")
    .eq("parent_id", masterId)
    .order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST — criar ou atualizar agência filha
export async function POST(req: NextRequest) {
  const masterId = await getMasterAgenciaId(req);
  if (!masterId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { action, id, nome, email, telefone, modulos_habilitados } = body;

  if (action === "create") {
    if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("agencias")
      .insert({
        nome,
        email: email || null,
        telefone: telefone || null,
        parent_id: masterId,
        modulos_habilitados: modulos_habilitados || ["inbox", "crm", "links_campanhas", "configurar_campanha", "jornada"],
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "update") {
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (nome !== undefined) updates.nome = nome;
    if (email !== undefined) updates.email = email;
    if (telefone !== undefined) updates.telefone = telefone;
    if (modulos_habilitados !== undefined) updates.modulos_habilitados = modulos_habilitados;

    const { data, error } = await supabaseAdmin
      .from("agencias")
      .update(updates)
      .eq("id", id)
      .eq("parent_id", masterId) // segurança: só atualiza filha
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "delete") {
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("agencias")
      .delete()
      .eq("id", id)
      .eq("parent_id", masterId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Criar usuário para agência filha
  if (action === "create_user") {
    const { agencia_id, user_nome, user_email } = body;
    if (!agencia_id || !user_email) return NextResponse.json({ error: "Dados obrigatórios" }, { status: 400 });

    // Verificar que a agência é filha do master
    const { data: ag } = await supabaseAdmin
      .from("agencias")
      .select("id")
      .eq("id", agencia_id)
      .eq("parent_id", masterId)
      .single();
    if (!ag) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });

    const origin = req.headers.get("origin") || "";
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(user_email, {
      data: { nome: user_nome, agencia_id },
      redirectTo: `${origin}/nova-senha`,
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    const { error: insertError } = await supabaseAdmin.from("usuarios").insert({
      agencia_id,
      auth_user_id: authData.user.id,
      nome: user_nome || user_email.split("@")[0],
      email: user_email,
      ativo: true,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  // Listar usuários de uma agência filha
  if (action === "list_users") {
    const { agencia_id } = body;
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome, email, ativo, time_id, created_at")
      .eq("agencia_id", agencia_id)
      .order("nome");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
