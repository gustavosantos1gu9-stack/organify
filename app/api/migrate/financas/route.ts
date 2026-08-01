import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SQL_CONFIG = `
CREATE TABLE IF NOT EXISTS financas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_refresh_token text,
  google_email text,
  spreadsheet_id text,
  spreadsheet_url text,
  grupo_jid text,
  instancia text,
  notificacao_hora text DEFAULT '08:00',
  criado_em timestamptz DEFAULT now()
);`;

const SQL_LANCAMENTOS = `
CREATE TABLE IF NOT EXISTS financas_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('conta','gasto','receita')),
  categoria text NOT NULL DEFAULT 'pessoal' CHECK (categoria IN ('empresa','pessoal')),
  valor numeric(10,2) NOT NULL,
  dia_vencimento int,
  data_lancamento date DEFAULT CURRENT_DATE,
  mes_referencia text NOT NULL,
  pago boolean DEFAULT false,
  pago_at timestamptz,
  criado_por text,
  observacao text,
  sheets_row int,
  criado_em timestamptz DEFAULT now()
);`;

export async function GET() {
  const log: string[] = [];

  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    log.push(`service_role_key: ${serviceKey ? "presente" : "AUSENTE — usando anon key"}`);

    // Tentar via RPC exec_sql (requer função criada no banco)
    const { error: e1 } = await supabase.rpc("exec_sql", { sql: SQL_CONFIG + SQL_LANCAMENTOS });
    if (!e1) {
      log.push("exec_sql: OK");
      return NextResponse.json({ ok: true, msg: "Tabelas criadas via exec_sql", log });
    }
    log.push(`exec_sql erro: ${e1.message} (code: ${e1.code})`);

    // Tentar criar cada tabela separada via fetch direto ao RPC
    const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    for (const [nome, sql] of [["financas_config", SQL_CONFIG], ["financas_lancamentos", SQL_LANCAMENTOS]]) {
      const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql }),
      });
      const body = await res.text();
      log.push(`REST rpc/${nome}: ${res.status} — ${body.slice(0, 100)}`);
    }

    // Verificar se as tabelas existem agora
    const { error: check1 } = await supabase.from("financas_config").select("id").limit(1);
    const { error: check2 } = await supabase.from("financas_lancamentos").select("id").limit(1);

    if (!check1 && !check2) {
      return NextResponse.json({ ok: true, msg: "Tabelas verificadas como existentes", log });
    }

    log.push(`check financas_config: ${check1?.message || "ok"}`);
    log.push(`check financas_lancamentos: ${check2?.message || "ok"}`);

    return NextResponse.json({
      ok: false,
      msg: "Não foi possível criar automaticamente. Rode este SQL no Supabase SQL Editor:",
      sql: SQL_CONFIG + SQL_LANCAMENTOS,
      log,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, log }, { status: 500 });
  }
}
