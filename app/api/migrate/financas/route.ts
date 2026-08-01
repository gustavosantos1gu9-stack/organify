import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  try {
    // Try via supabase.rpc exec_sql
    const { error } = await supabase.rpc("exec_sql", { sql: SQL });

    if (error) {
      // Try via Supabase Management API if token is set
      const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
      if (SUPABASE_ACCESS_TOKEN) {
        const res = await fetch(
          "https://api.supabase.com/v1/projects/dfjmnibyfowwmlmfbbpa/database/query",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: SQL }),
          }
        );
        if (!res.ok) {
          const body = await res.text();
          return NextResponse.json(
            { error: "Falha ao criar tabelas via Management API", detail: body, sql: SQL },
            { status: 500 }
          );
        }
        return NextResponse.json({ ok: true, msg: "Tabelas criadas via Management API" });
      }

      // No token available — return SQL for manual execution
      return NextResponse.json({
        ok: false,
        msg: "Crie as tabelas manualmente no Supabase SQL Editor. Copie o SQL abaixo.",
        sql: SQL,
      });
    }

    return NextResponse.json({ ok: true, msg: "Tabelas financas_config e financas_lancamentos criadas/verificadas" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
