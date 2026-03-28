import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS alertas_saldo (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agencia_id UUID NOT NULL,
          ad_account_id TEXT NOT NULL,
          nome_cliente TEXT NOT NULL,
          saldo_alerta NUMERIC DEFAULT 50,
          grupo_id TEXT,
          grupo_nome TEXT,
          ativo BOOLEAN DEFAULT true,
          ultimo_alerta TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    });

    if (error) {
      // Fallback: tentar via query direta
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: `CREATE TABLE IF NOT EXISTS alertas_saldo (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agencia_id UUID NOT NULL,
            ad_account_id TEXT NOT NULL,
            nome_cliente TEXT NOT NULL,
            saldo_alerta NUMERIC DEFAULT 50,
            grupo_id TEXT,
            grupo_nome TEXT,
            ativo BOOLEAN DEFAULT true,
            ultimo_alerta TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );`,
        }),
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Crie a tabela manualmente no Supabase SQL Editor", sql: "CREATE TABLE IF NOT EXISTS alertas_saldo (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agencia_id UUID NOT NULL, ad_account_id TEXT NOT NULL, nome_cliente TEXT NOT NULL, saldo_alerta NUMERIC DEFAULT 50, grupo_id TEXT, grupo_nome TEXT, ativo BOOLEAN DEFAULT true, ultimo_alerta TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, msg: "Tabela alertas_saldo criada" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
