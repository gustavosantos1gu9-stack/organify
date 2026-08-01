import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SQL = `
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
);

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
);
`;

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL não configurada" });
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(SQL);
    return NextResponse.json({ ok: true, msg: "Tabelas financas_config e financas_lancamentos criadas com sucesso!" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
