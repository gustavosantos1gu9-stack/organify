import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const META_API = "https://graph.facebook.com/v21.0";

function formatMoney(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Buscar todos os alertas ativos
    const { data: alertas } = await supabase
      .from("alertas_saldo")
      .select("*")
      .eq("ativo", true);

    if (!alertas?.length) {
      return NextResponse.json({ ok: true, msg: "Nenhum alerta ativo", verificados: 0 });
    }

    const resultados: { id: string; nome: string; status: string; saldo?: number; error?: string }[] = [];

    for (const alerta of alertas) {
      try {
        // Buscar conexão (token Meta e Evolution API)
        const { data: con } = await supabase.from("relatorios_conexoes")
          .select("meta_token, evolution_url, evolution_key, whatsapp_instancia")
          .eq("agencia_id", alerta.agencia_id)
          .order("created_at", { ascending: false })
          .limit(1).single();

        if (!con?.meta_token) {
          resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "sem_token" });
          continue;
        }

        // Checar saldo na Meta
        const acId = alerta.ad_account_id.startsWith("act_") ? alerta.ad_account_id : `act_${alerta.ad_account_id}`;
        const res = await fetch(
          `${META_API}/${acId}?fields=balance,account_status,name`,
          { headers: { Authorization: `Bearer ${con.meta_token}` } }
        );

        if (!res.ok) {
          resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "erro_meta", error: `HTTP ${res.status}` });
          continue;
        }

        const meta = await res.json();
        const balance = meta.balance ? parseFloat(meta.balance) / 100 : 0;

        // Verificar status da conta
        const statusMap: Record<number, string> = {
          1: "Ativa", 2: "Desativada", 3: "Não liquidada", 7: "Em revisão",
        };
        const statusTexto = statusMap[meta.account_status] || `Status ${meta.account_status}`;
        const contaProblema = meta.account_status !== 1;

        // Verificar saldo abaixo do limite
        const saldoBaixo = alerta.saldo_alerta && balance <= alerta.saldo_alerta;

        // Se não precisa alertar, pular
        if (!saldoBaixo && !contaProblema) {
          resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "ok", saldo: balance });
          continue;
        }

        // Evitar spam: não alertar se já alertou nas últimas 6h
        if (alerta.ultimo_alerta) {
          const ultimoAlerta = new Date(alerta.ultimo_alerta);
          const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000);
          if (ultimoAlerta > seisHorasAtras) {
            resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "ja_alertado_recente", saldo: balance });
            continue;
          }
        }

        // Montar mensagem de alerta
        let mensagem = "";
        if (contaProblema) {
          mensagem = `⚠️ *ALERTA DE CONTA*\n\n`;
          mensagem += `Cliente: *${alerta.nome_cliente}*\n`;
          mensagem += `Conta: ${meta.name || acId}\n`;
          mensagem += `Status: *${statusTexto}*\n`;
          mensagem += `Saldo: ${formatMoney(balance)}\n\n`;
          mensagem += `_A conta de anúncio está com problema. Verifique no Gerenciador de Anúncios._`;
        } else if (saldoBaixo) {
          mensagem = `💰 *ALERTA DE SALDO BAIXO*\n\n`;
          mensagem += `Cliente: *${alerta.nome_cliente}*\n`;
          mensagem += `Conta: ${meta.name || acId}\n`;
          mensagem += `Saldo atual: *${formatMoney(balance)}*\n`;
          mensagem += `Limite configurado: ${formatMoney(alerta.saldo_alerta)}\n\n`;
          mensagem += `_O saldo está abaixo do limite. Recarregue via PIX para não parar os anúncios._`;
        }

        // Enviar via WhatsApp (Evolution API)
        if (mensagem && alerta.grupo_id && con.evolution_url && con.evolution_key && con.whatsapp_instancia) {
          const evoRes = await fetch(
            `${con.evolution_url}/message/sendText/${con.whatsapp_instancia}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: con.evolution_key },
              body: JSON.stringify({ number: alerta.grupo_id, text: mensagem }),
            }
          );

          if (evoRes.ok) {
            await supabase.from("alertas_saldo").update({
              ultimo_alerta: new Date().toISOString(),
            }).eq("id", alerta.id);

            resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "alerta_enviado", saldo: balance });
          } else {
            resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "erro_envio", saldo: balance, error: await evoRes.text() });
          }
        } else {
          resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "sem_destino", saldo: balance });
        }
      } catch (err: any) {
        resultados.push({ id: alerta.id, nome: alerta.nome_cliente, status: "erro", error: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      total: alertas.length,
      alertas_enviados: resultados.filter(r => r.status === "alerta_enviado").length,
      resultados,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
