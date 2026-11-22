import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
const EH_RESPOSTA_BOT = /^[❌✅⏳📅💰📋🔍👤📄🎉⚠️🔗]/;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Buscar master (sem parent)
    const { data: ag } = await supabase
      .from("agencias")
      .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, cadastro_poll_last_ts")
      .is("parent_id", null)
      .single();

    if (!ag?.evolution_url || !ag?.whatsapp_instancia || !ag?.whatsapp_numero) {
      return NextResponse.json({ ok: true, msg: "master sem Evolution configurado" });
    }

    const EVO_URL = ag.evolution_url;
    const EVO_KEY = ag.evolution_key;
    const INST = ag.whatsapp_instancia;
    const MEU_NUMERO = ag.whatsapp_numero;
    const lastTs = Number(ag.cadastro_poll_last_ts || 0);

    // Buscar mensagens recentes do self-chat
    const resMsg = await fetch(`${EVO_URL}/chat/findMessages/${INST}`, {
      method: "POST",
      headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        where: { key: { remoteJid: `${MEU_NUMERO}@s.whatsapp.net` } },
        limit: 30,
      }),
    });

    if (!resMsg.ok) return NextResponse.json({ ok: true, msg: "Evolution erro" });
    const resData = await resMsg.json();
    const records: any[] = resData?.messages?.records || resData?.records || [];

    // Filtrar mensagens novas (após lastTs) que não são do bot
    const novas = records
      .filter((m: any) => {
        const ts = Number(m.messageTimestamp || 0);
        const conteudo = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
        // Só mensagens depois do último processado
        if (ts <= lastTs) return false;
        // Ignorar respostas do bot
        if (EH_RESPOSTA_BOT.test(conteudo)) return false;
        // Só textos
        if (!conteudo) return false;
        return true;
      })
      .sort((a: any, b: any) => Number(a.messageTimestamp) - Number(b.messageTimestamp));

    if (novas.length === 0) {
      return NextResponse.json({ ok: true, processadas: 0 });
    }

    console.log(`[cadastro-poll] ${novas.length} mensagens novas encontradas para processar`);

    const sendMsg = async (txt: string) => {
      await fetch(`${EVO_URL}/message/sendText/${INST}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVO_KEY },
        body: JSON.stringify({ number: MEU_NUMERO, text: txt }),
      }).catch(() => {});
    };

    let maxTs = lastTs;
    let processadas = 0;

    for (const msg of novas) {
      const ts = Number(msg.messageTimestamp || 0);
      const conteudo: string = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      const cmdLower = conteudo.toLowerCase().trim();

      console.log(`[cadastro-poll] processando ts=${ts} cmd="${cmdLower}"`);

      // 1. Verificar fluxo de contrato ativo
      const isAtivarCmd = /^ativar\s+/i.test(cmdLower);
      const isComandoExplicito = /^(aprovar|contrato)\s+[a-zA-ZÀ-ú]/i.test(cmdLower);

      const { data: fluxoAtivo } = (!isAtivarCmd && !isComandoExplicito)
        ? await supabase.from("cadastros_clientes")
            .select("*").like("status", "contrato_%")
            .not("status", "in", '("contrato_enviado","contrato_gerando")')
            .order("criado_em", { ascending: false }).limit(1).single()
        : { data: null };

      if (fluxoAtivo) {
        const step = fluxoAtivo.status;

        if (step === "contrato_modalidade") {
          const opcoes: Record<string, string> = { "1": "mensal", "2": "trimestral", "3": "quinzenal" };
          const modalidade = opcoes[cmdLower];
          if (modalidade) {
            await supabase.from("cadastros_clientes").update({ status: `contrato_valor_${modalidade}` }).eq("id", fluxoAtivo.id);
            await sendMsg(`💰 *Qual o valor do contrato?*\n\n_Digite apenas o número (ex: 2000)_`);
          } else {
            await sendMsg(`❌ Opção inválida. Responda *1*, *2* ou *3*`);
          }
          maxTs = Math.max(maxTs, ts);
          processadas++;
          continue;
        }

        if (step.startsWith("contrato_valor_")) {
          const modalidade = step.replace("contrato_valor_", "");
          const valor = cmdLower.replace(/[^\d]/g, "");
          if (valor && Number(valor) > 0) {
            await supabase.from("cadastros_clientes").update({ status: `contrato_data_${modalidade}_${valor}` }).eq("id", fluxoAtivo.id);
            await sendMsg(`📅 *Qual a data de vencimento?*\n\n_Digite a data (ex: 15/06/2026)_`);
          } else {
            await sendMsg(`❌ Valor inválido. Digite apenas o número (ex: 2000)`);
          }
          maxTs = Math.max(maxTs, ts);
          processadas++;
          continue;
        }

        if (step.startsWith("contrato_data_")) {
          const parts = step.replace("contrato_data_", "").split("_");
          const modalidade = parts[0];
          const valor = parts[1];
          const dataMatch = cmdLower.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          const dia = dataMatch ? cmdLower.trim() : cmdLower.replace(/[^\d]/g, "");
          const dataVencimento = dataMatch ? cmdLower.trim() : dia;
          if (dataMatch || (dia && Number(dia) >= 1 && Number(dia) <= 31)) {
            await supabase.from("cadastros_clientes").update({ status: "contrato_gerando" }).eq("id", fluxoAtivo.id);
            await sendMsg(`⏳ Gerando contrato de *${fluxoAtivo.nome}*...\n\n📋 ${modalidade} | R$${valor} | vencimento ${dataVencimento}`);
            try {
              const res = await fetch(`${APP_URL}/api/contrato`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  nome: fluxoAtivo.nome, email: fluxoAtivo.email,
                  cnpj: fluxoAtivo.cnpj, cpf: fluxoAtivo.cpf, rg: fluxoAtivo.rg,
                  endereco_empresa: fluxoAtivo.endereco_empresa,
                  endereco_pessoal: fluxoAtivo.endereco_pessoal,
                  modalidade, valor, data_vencimento: dataVencimento,
                }),
              });
              const result = await res.json();
              await supabase.from("cadastros_clientes").update({ status: result.success ? "contrato_enviado" : "pendente" }).eq("id", fluxoAtivo.id);
              await sendMsg(result.success
                ? `✅ Contrato de *${fluxoAtivo.nome}* gerado e enviado para assinatura!`
                : `❌ Erro ao gerar contrato: ${result.error || "erro desconhecido"}`);
            } catch (e: any) {
              await supabase.from("cadastros_clientes").update({ status: "pendente" }).eq("id", fluxoAtivo.id);
              await sendMsg(`❌ Erro ao gerar contrato: ${e.message}`);
            }
          } else {
            await sendMsg(`❌ Data inválida. Use o formato dd/mm/aaaa (ex: 15/06/2026)`);
          }
          maxTs = Math.max(maxTs, ts);
          processadas++;
          continue;
        }
      }

      // 2. Comandos diretos
      const aprovarNomeMatch = cmdLower.match(/^aprovar\s+(.+)/);
      // "contrato X", "enviar contrato X", "gerar contrato X", "mandar contrato X"
      const contratoNomeMatch = cmdLower.match(/^(?:enviar\s+|gerar\s+|mandar\s+)?contrato\s+(.+)/);
      // Contrato em uma linha: "contrato rubiliane mensal 997 15/06/2026" ou "contrato rubiliane mensal 997 15"
      const contratoUmaLinhaMatch = cmdLower.match(/^(?:enviar\s+|gerar\s+|mandar\s+)?contrato\s+(\S+(?:\s+\S+)?)\s+(mensal|trimestral|quinzenal)\s+(\d+(?:[.,]\d+)?)\s+(.+)$/i);
      const ativarMatch = cmdLower.match(/^ativar\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(mensal|quinzenal|trimestral)?$/i);

      let cadastro: any = null;

      if (cmdLower === "1" || cmdLower === "2") {
        const { data } = await supabase.from("cadastros_clientes")
          .select("*").in("status", ["notificado", "aprovado"]).order("criado_em", { ascending: false }).limit(1).single();
        cadastro = data;
      } else if (aprovarNomeMatch) {
        const { data: arr } = await supabase.from("cadastros_clientes")
          .select("*").ilike("nome", `%${aprovarNomeMatch[1].trim()}%`).order("criado_em", { ascending: false }).limit(1);
        cadastro = arr?.[0];
        if (!cadastro) { await sendMsg(`❌ Nenhum cadastro encontrado: *${aprovarNomeMatch[1].trim()}*`); maxTs = Math.max(maxTs, ts); processadas++; continue; }
      } else if (contratoNomeMatch && !contratoUmaLinhaMatch) {
        const { data: arr } = await supabase.from("cadastros_clientes")
          .select("*").ilike("nome", `%${contratoNomeMatch[1].trim()}%`).order("criado_em", { ascending: false }).limit(1);
        cadastro = arr?.[0];
        if (!cadastro) { await sendMsg(`❌ Nenhum cadastro encontrado: *${contratoNomeMatch[1].trim()}*`); maxTs = Math.max(maxTs, ts); processadas++; continue; }
      }

      if (cadastro && (cmdLower === "1" || aprovarNomeMatch)) {
        // Aprovar
        const res = await fetch(`${APP_URL}/api/cadastros/aprovar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cadastro.id }),
        });
        const result = await res.json();
        const primeiroNome = cadastro.nome.split(" ")[0].toLowerCase();
        await sendMsg(result.ok
          ? `✅ Cadastro de *${cadastro.nome}* aprovado com sucesso!\n\n_Próximos passos:_\n*2* — Enviar contrato\n*ativar ${primeiroNome} <valor> <mensal/trimestral/quinzenal>* — Criar cliente + recorrência\n_Ex: ativar ${primeiroNome} 997 mensal_`
          : `❌ Erro ao aprovar: ${result.error || "erro desconhecido"}`);
        maxTs = Math.max(maxTs, ts);
        processadas++;
        continue;
      }

      // Contrato em uma linha: "contrato rubiliane mensal 997 15/06/2026"
      if (contratoUmaLinhaMatch) {
        const nomeBusca = contratoUmaLinhaMatch[1].trim();
        const modalidade = contratoUmaLinhaMatch[2].toLowerCase();
        const valor = contratoUmaLinhaMatch[3].replace(",", ".");
        const dataVencimento = contratoUmaLinhaMatch[4].trim();
        const { data: cadArr } = await supabase.from("cadastros_clientes")
          .select("*").ilike("nome", `%${nomeBusca}%`).order("criado_em", { ascending: false }).limit(1);
        const cad = cadArr?.[0];
        if (!cad) {
          await sendMsg(`❌ Nenhum cadastro encontrado: *${nomeBusca}*`);
        } else {
          await supabase.from("cadastros_clientes").update({ status: "contrato_gerando" }).eq("id", cad.id);
          await sendMsg(`⏳ Gerando contrato de *${cad.nome}*...\n\n📋 ${modalidade} | R$${valor} | vencimento ${dataVencimento}`);
          try {
            const res = await fetch(`${APP_URL}/api/contrato`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: cad.nome, email: cad.email,
                cnpj: cad.cnpj, cpf: cad.cpf, rg: cad.rg,
                endereco_empresa: cad.endereco_empresa,
                endereco_pessoal: cad.endereco_pessoal,
                modalidade, valor, data_vencimento: dataVencimento,
              }),
            });
            const result = await res.json();
            await supabase.from("cadastros_clientes").update({ status: result.success ? "contrato_enviado" : "pendente" }).eq("id", cad.id);
            await sendMsg(result.success
              ? `✅ Contrato de *${cad.nome}* gerado e enviado para assinatura!`
              : `❌ Erro: ${result.error || "erro desconhecido"}`);
          } catch (e: any) {
            await supabase.from("cadastros_clientes").update({ status: "pendente" }).eq("id", cad.id);
            await sendMsg(`❌ Erro ao gerar contrato: ${e.message}`);
          }
        }
        maxTs = Math.max(maxTs, ts);
        processadas++;
        continue;
      }

      if (cadastro && (cmdLower === "2" || contratoNomeMatch)) {
        await supabase.from("cadastros_clientes").update({ status: "contrato_modalidade" }).eq("id", cadastro.id);
        await sendMsg(`📄 *Contrato para ${cadastro.nome}*\n\nQual a modalidade?\n\n*1* — Mensal\n*2* — Trimestral\n*3* — Quinzenal`);
        maxTs = Math.max(maxTs, ts);
        processadas++;
        continue;
      }

      if (ativarMatch) {
        const nomeBusca = ativarMatch[1].trim();
        const valor = parseFloat(ativarMatch[2].replace(",", "."));
        const frequencia = (ativarMatch[3] || "mensal").toLowerCase();

        const { data: cadArr } = await supabase.from("cadastros_clientes")
          .select("*").ilike("nome", `%${nomeBusca}%`).order("criado_em", { ascending: false }).limit(1);
        const cad = cadArr?.[0];

        if (!cad) {
          await sendMsg(`❌ Nenhum cadastro encontrado: *${nomeBusca}*`);
        } else {
          const { data: clienteExiste } = await supabase.from("clientes")
            .select("id").eq("cadastro_id", cad.id).maybeSingle();
          if (clienteExiste) {
            await sendMsg(`⚠️ *${cad.nome}* já foi ativado(a) como cliente.`);
          } else {
            const { data: novoCliente, error: errCliente } = await supabase.from("clientes").insert({
              agencia_id: ag.id, nome: cad.nome, email: cad.email,
              documento: cad.cnpj || cad.cpf || "",
              valor_oportunidade: valor,
              faturamento: cad.faturamento_medio ? parseFloat(cad.faturamento_medio.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 : 0,
              servico: "assessoria", frequencia, status: "ativo", status_recorrencia: "ativo",
              cadastro_id: cad.id,
            }).select().single();

            if (errCliente || !novoCliente) {
              await sendMsg(`❌ Erro ao criar cliente: ${errCliente?.message || "erro"}`);
            } else {
              const hoje = new Date();
              const diaVencimento = hoje.getDate();
              const valorRec = frequencia === "trimestral" ? Math.round(valor * 3 * 100) / 100 : valor;
              await supabase.from("recorrencias").insert({
                agencia_id: ag.id, tipo: "entrada",
                descricao: `Assessoria - ${cad.nome}`, valor: valorRec,
                periodicidade: frequencia === "trimestral" ? "trimestral" : frequencia === "quinzenal" ? "quinzenal" : "mensal",
                dia_vencimento: diaVencimento, ativo: true, cliente_id: novoCliente.id,
              });
              const lancamentos: any[] = [];
              if (frequencia === "mensal") {
                for (let i = 0; i < 12; i++) {
                  const d = new Date(hoje); d.setMonth(d.getMonth() + i);
                  lancamentos.push({ agencia_id: ag.id, tipo: "entrada", descricao: `Assessoria - ${cad.nome}`, valor, data_vencimento: d.toISOString().split("T")[0], cliente_id: novoCliente.id, pago: false });
                }
              } else if (frequencia === "quinzenal") {
                const vp = Math.round((valor / 2) * 100) / 100;
                for (let i = 0; i < 24; i++) {
                  const d = new Date(hoje); d.setDate(d.getDate() + i * 15);
                  lancamentos.push({ agencia_id: ag.id, tipo: "entrada", descricao: `Assessoria quinzenal - ${cad.nome} (parcela ${i + 1})`, valor: vp, data_vencimento: d.toISOString().split("T")[0], cliente_id: novoCliente.id, pago: false });
                }
              } else if (frequencia === "trimestral") {
                const vt = Math.round(valor * 3 * 100) / 100;
                for (let i = 0; i < 4; i++) {
                  const d = new Date(hoje); d.setMonth(d.getMonth() + i * 3);
                  lancamentos.push({ agencia_id: ag.id, tipo: "entrada", descricao: `Assessoria trimestral - ${cad.nome} (trimestre ${i + 1})`, valor: vt, data_vencimento: d.toISOString().split("T")[0], cliente_id: novoCliente.id, pago: false });
                }
              }
              if (lancamentos.length > 0) await supabase.from("lancamentos_futuros").insert(lancamentos);
              await supabase.from("controle_clientes").update({ cadastro_id: cad.id }).eq("agencia_id", ag.id).ilike("nome", `%${nomeBusca}%`).is("cadastro_id", null);
              await supabase.from("cadastros_clientes").update({ status: "ativado" }).eq("id", cad.id);
              const freqLabel = frequencia === "quinzenal" ? "quinzenal" : frequencia === "trimestral" ? "trimestral" : "mensal";
              await sendMsg(`✅ *${cad.nome}* ativado(a) com sucesso!\n\n💰 Valor: R$${valor}\n📅 Frequência: ${freqLabel}\n📋 ${lancamentos.length} lançamentos futuros gerados\n🔄 Recorrência criada`);
            }
          }
        }
        maxTs = Math.max(maxTs, ts);
        processadas++;
        continue;
      }

      // Mensagem não reconhecida — atualizar ts para não reprocessar
      maxTs = Math.max(maxTs, ts);
    }

    // Salvar último timestamp processado
    if (maxTs > lastTs) {
      await supabase.from("agencias").update({ cadastro_poll_last_ts: maxTs }).eq("id", ag.id);
    }

    console.log(`[cadastro-poll] finalizado: ${processadas} comandos processados, lastTs=${maxTs}`);
    return NextResponse.json({ ok: true, processadas, lastTs: maxTs });
  } catch (e: any) {
    console.error("[cadastro-poll] erro:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
