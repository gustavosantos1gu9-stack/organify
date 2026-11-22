import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";
const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;
// Renovar se expirar em menos de 45 dias
const RENOVAR_ANTES_DIAS = 45;

async function debugToken(token: string): Promise<{ valid: boolean; expires_at: number }> {
  const res = await fetch(`${META_API}/debug_token?input_token=${token}&access_token=${APP_ID}|${APP_SECRET}`);
  const data = await res.json();
  return {
    valid: data.data?.is_valid === true,
    expires_at: data.data?.expires_at || 0,
  };
}

async function renovarToken(token: string): Promise<string | null> {
  const res = await fetch(
    `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${token}`
  );
  const data = await res.json();
  if (data.error || !data.access_token) return null;
  return data.access_token;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agora = Math.floor(Date.now() / 1000);
  const limiteRenovacao = agora + RENOVAR_ANTES_DIAS * 24 * 60 * 60;

  // Buscar todas as agências com tokens Meta configurados
  const { data: agencias } = await supabase
    .from("agencias")
    .select("id, nome, meta_token, meta_business_token")
    .or("meta_token.not.is.null,meta_business_token.not.is.null");

  if (!agencias?.length) {
    return NextResponse.json({ ok: true, msg: "Nenhuma agência com token Meta" });
  }

  const resultados: { agencia: string; campo: string; acao: string }[] = [];

  for (const ag of agencias) {
    // Verificar e renovar meta_token
    if (ag.meta_token) {
      try {
        const debug = await debugToken(ag.meta_token);
        if (!debug.valid) {
          resultados.push({ agencia: ag.nome, campo: "meta_token", acao: "inválido — não renovável" });
        } else if (debug.expires_at > 0 && debug.expires_at < limiteRenovacao) {
          const novoToken = await renovarToken(ag.meta_token);
          if (novoToken) {
            await supabase.from("agencias").update({ meta_token: novoToken }).eq("id", ag.id);
            resultados.push({ agencia: ag.nome, campo: "meta_token", acao: "renovado" });
          } else {
            resultados.push({ agencia: ag.nome, campo: "meta_token", acao: "falha ao renovar" });
          }
        } else if (debug.expires_at === 0) {
          resultados.push({ agencia: ag.nome, campo: "meta_token", acao: "sem expiração (system user)" });
        }
        // Token ainda válido com folga — não faz nada
      } catch (e) {
        resultados.push({ agencia: ag.nome, campo: "meta_token", acao: `erro: ${String(e)}` });
      }
    }

    // Verificar e renovar meta_business_token (se diferente do meta_token)
    if (ag.meta_business_token && ag.meta_business_token !== ag.meta_token) {
      try {
        const debug = await debugToken(ag.meta_business_token);
        if (!debug.valid) {
          resultados.push({ agencia: ag.nome, campo: "meta_business_token", acao: "inválido — não renovável" });
        } else if (debug.expires_at > 0 && debug.expires_at < limiteRenovacao) {
          const novoToken = await renovarToken(ag.meta_business_token);
          if (novoToken) {
            await supabase.from("agencias").update({ meta_business_token: novoToken }).eq("id", ag.id);
            resultados.push({ agencia: ag.nome, campo: "meta_business_token", acao: "renovado" });
          } else {
            resultados.push({ agencia: ag.nome, campo: "meta_business_token", acao: "falha ao renovar" });
          }
        } else if (debug.expires_at === 0) {
          resultados.push({ agencia: ag.nome, campo: "meta_business_token", acao: "sem expiração (system user)" });
        }
      } catch (e) {
        resultados.push({ agencia: ag.nome, campo: "meta_business_token", acao: `erro: ${String(e)}` });
      }
    }

    // Também renovar tokens em relatorios_conexoes
    const { data: conexoes } = await supabase
      .from("relatorios_conexoes")
      .select("id, meta_token")
      .eq("agencia_id", ag.id)
      .not("meta_token", "is", null);

    for (const con of conexoes || []) {
      try {
        const debug = await debugToken(con.meta_token);
        if (debug.valid && debug.expires_at > 0 && debug.expires_at < limiteRenovacao) {
          const novoToken = await renovarToken(con.meta_token);
          if (novoToken) {
            await supabase.from("relatorios_conexoes").update({ meta_token: novoToken }).eq("id", con.id);
            resultados.push({ agencia: ag.nome, campo: "relatorios_conexoes.meta_token", acao: "renovado" });
          }
        }
      } catch {}
    }
  }

  console.log("[meta-token-refresh]", JSON.stringify(resultados));
  return NextResponse.json({ ok: true, total: agencias.length, resultados });
}
