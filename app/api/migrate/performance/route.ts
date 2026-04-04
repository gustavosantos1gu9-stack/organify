import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  try {
    const { error } = await supabase.rpc("exec_sql", {
      query: `
        CREATE TABLE IF NOT EXISTS performance_semanal (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agencia_id UUID NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
          relatorio_id UUID REFERENCES relatorios(id) ON DELETE CASCADE,
          ad_account_id TEXT,
          semana_inicio DATE NOT NULL,
          semana_fim DATE NOT NULL,
          mensagens INTEGER DEFAULT 0,
          agendamentos INTEGER DEFAULT 0,
          comparecimentos INTEGER DEFAULT 0,
          vendas INTEGER DEFAULT 0,
          investimento NUMERIC(10,2) DEFAULT 0,
          modo TEXT DEFAULT 'manual',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(agencia_id, relatorio_id, semana_inicio)
        );
      `,
    });

    if (error) {
      // Tentar criar diretamente
      return NextResponse.json({
        error: "Execute este SQL no Supabase SQL Editor",
        sql: `CREATE TABLE IF NOT EXISTS performance_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id UUID NOT NULL,
  relatorio_id UUID,
  ad_account_id TEXT,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  mensagens INTEGER DEFAULT 0,
  agendamentos INTEGER DEFAULT 0,
  comparecimentos INTEGER DEFAULT 0,
  vendas INTEGER DEFAULT 0,
  investimento NUMERIC(10,2) DEFAULT 0,
  modo TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agencia_id, relatorio_id, semana_inicio)
);`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
