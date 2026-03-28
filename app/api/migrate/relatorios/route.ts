import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Criar tabela relatorios
    const { error: err1 } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS relatorios (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
          nome TEXT NOT NULL,
          nome_cliente TEXT NOT NULL,
          ad_account_id TEXT NOT NULL,
          meta_token TEXT,
          grupo_id TEXT,
          grupo_nome TEXT,
          contato_numero TEXT,
          template TEXT NOT NULL,
          periodo TEXT DEFAULT 'hoje',
          frequencia TEXT DEFAULT 'diario',
          horario_envio TEXT DEFAULT '17:30',
          dia_semana INTEGER,
          ativo BOOLEAN DEFAULT TRUE,
          proximo_envio TIMESTAMPTZ,
          ultimo_envio TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    });

    // Se rpc não funcionar, tentar via REST insert (fallback)
    if (err1) {
      // Tentar criar via query direta no schema
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          body: JSON.stringify({
            sql: `CREATE TABLE IF NOT EXISTS relatorios (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
              nome TEXT NOT NULL,
              nome_cliente TEXT NOT NULL,
              ad_account_id TEXT NOT NULL,
              meta_token TEXT,
              grupo_id TEXT,
              grupo_nome TEXT,
              contato_numero TEXT,
              template TEXT NOT NULL,
              periodo TEXT DEFAULT 'hoje',
              frequencia TEXT DEFAULT 'diario',
              horario_envio TEXT DEFAULT '17:30',
              dia_semana INTEGER,
              ativo BOOLEAN DEFAULT TRUE,
              proximo_envio TIMESTAMPTZ,
              ultimo_envio TIMESTAMPTZ,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );`,
          }),
        }
      );

      if (!res.ok) {
        return NextResponse.json({
          error: "Não foi possível criar via RPC. Crie manualmente no Supabase SQL Editor.",
          rpc_error: err1.message,
          sql: `CREATE TABLE IF NOT EXISTS relatorios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agencia_id UUID REFERENCES agencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nome_cliente TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  meta_token TEXT,
  grupo_id TEXT,
  grupo_nome TEXT,
  contato_numero TEXT,
  template TEXT NOT NULL,
  periodo TEXT DEFAULT 'hoje',
  frequencia TEXT DEFAULT 'diario',
  horario_envio TEXT DEFAULT '17:30',
  dia_semana INTEGER,
  ativo BOOLEAN DEFAULT TRUE,
  proximo_envio TIMESTAMPTZ,
  ultimo_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Também adicionar agendou_at na tabela conversas
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS agendou_at TIMESTAMPTZ;`,
        }, { status: 500 });
      }
    }

    // Adicionar agendou_at na tabela conversas
    try {
      await supabase.rpc("exec_sql", {
        sql: "ALTER TABLE conversas ADD COLUMN IF NOT EXISTS agendou_at TIMESTAMPTZ;",
      });
    } catch {}

    return NextResponse.json({ ok: true, msg: "Tabela relatorios criada com sucesso" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
