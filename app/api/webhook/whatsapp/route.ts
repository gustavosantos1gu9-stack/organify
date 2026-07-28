import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";

async function verificarTermoChave(agenciaId: string, conversaId: string, conteudo: string, numero: string, fbclid?: string, utmCampaign?: string, utmContent?: string, isCTWA?: boolean) {
  const { data: etapas } = await supabase.from("jornada_etapas")
    .select("nome, termo_chave, evento_conversao")
    .eq("agencia_id", agenciaId)
    .not("termo_chave", "is", null);

  if (!etapas?.length) return;

  const conteudoLower = conteudo.toLowerCase();
  const etapaEncontrada = etapas.find((e: any) =>
    e.termo_chave && conteudoLower.includes(e.termo_chave.toLowerCase())
  );

  if (!etapaEncontrada) return;

  // Buscar etapa anterior para histórico
  const { data: convAtual } = await supabase.from("conversas")
    .select("etapa_jornada").eq("id", conversaId).single();

  await supabase.from("conversas").update({
    etapa_jornada: etapaEncontrada.nome,
    etapa_alterada_at: new Date().toISOString(),
  }).eq("id", conversaId);

  // Cancelar follow-ups pendentes da fase anterior (nova fase = novo follow-up)
  await supabase.from("followup_fila")
    .update({ status: "cancelado" })
    .eq("conversa_id", conversaId)
    .in("status", ["pendente", "processando"]);

  // Registrar histórico de transição
  await supabase.from("etapas_historico").insert({
    conversa_id: conversaId, agencia_id: agenciaId,
    etapa_anterior: convAtual?.etapa_jornada || null,
    etapa_nova: etapaEncontrada.nome, alterado_por: "automatico",
  });

  if (etapaEncontrada.evento_conversao) {
    try {
      const pixelRes = await fetch(`${APP_URL}/api/pixel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencia_id: agenciaId,
          conversa_id: conversaId,
          etapa_nome: etapaEncontrada.nome,
          phone: numero,
          fbclid, utm_campaign: utmCampaign, utm_content: utmContent,
          is_ctwa: isCTWA || !!fbclid,
        }),
      });
      const pixelData = await pixelRes.json();
      if (!pixelData.ok) console.error("[pixel] Erro no termo-chave:", etapaEncontrada.nome, pixelData.error || pixelData.motivo);
    } catch (e) {
      console.error("[pixel] Exceção no termo-chave:", etapaEncontrada.nome, e);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Validar webhook secret (query param ou header)
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const url = new URL(req.url);
      const secretParam = url.searchParams.get("secret");
      const secretHeader = req.headers.get("x-webhook-secret");
      if (secretParam !== webhookSecret && secretHeader !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const { event, data, instance } = body;

    // ── CONNECTION_UPDATE: atualizar status e tentar reconectar ──
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = (data?.state || data?.status || "").toLowerCase();
      const instanciaName = instance || body.instanceName || "";

      if (instanciaName) {
        // Buscar agência por instância
        const { data: ag } = await supabase.from("agencias")
          .select("id, parent_id, evolution_url, evolution_key")
          .eq("whatsapp_instancia", instanciaName).single();

        if (ag) {
          const conectado = state === "open" || state === "connected";
          await supabase.from("agencias").update({ whatsapp_conectado: conectado }).eq("id", ag.id);

          // Quando conectar, puxar histórico de mensagens em background
          if (conectado) {
            waitUntil(
              fetch(`${APP_URL}/api/evolution/sync-on-connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agencia_id: ag.id, paginas_por_conversa: 2 }),
              }).catch(e => console.error("[sync-on-connect] erro ao disparar:", e))
            );
          }

          // Se desconectou, tentar reconectar automaticamente (só se não foi deletada)
          // Não reconectar se state === "close" pois pode ser deleção intencional
          if (!conectado && state === "connecting") {
            try {
              // Buscar Evolution URL (da própria agência ou do parent)
              let evoUrl = ag.evolution_url || "";
              let evoKey = ag.evolution_key || "";
              if (!evoUrl && ag.parent_id) {
                const { data: parent } = await supabase.from("agencias")
                  .select("evolution_url, evolution_key")
                  .eq("id", ag.parent_id).single();
                if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
              }
              if (evoUrl && evoKey) {
                // Verificar se a instância ainda existe antes de reconectar
                const statusRes = await fetch(`${evoUrl}/instance/connectionState/${instanciaName}`, {
                  headers: { apikey: evoKey },
                });
                const statusData = await statusRes.json();
                const currentState = (statusData?.state || statusData?.instance?.state || "").toLowerCase();
                // Só reconectar se a instância ainda existe e está em connecting
                if (currentState === "connecting" || currentState === "close") {
                  await fetch(`${evoUrl}/instance/connect/${instanciaName}`, {
                    headers: { apikey: evoKey },
                  });
                }
              }
            } catch {}
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const msg = data?.messages?.[0] || data;
      if (!msg) return NextResponse.json({ ok: true });

      const fromMe = msg.key?.fromMe || false;
      const remoteJid = msg.key?.remoteJid || "";

      if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) {
        return NextResponse.json({ ok: true });
      }

      const isLid = remoteJid.includes("@lid");
      const instanciaName = instance || body.instanceName || "";

      // Se @lid, tentar usar remoteJidAlt (número real) para encontrar a conversa
      const remoteJidAlt = msg.key?.remoteJidAlt || "";
      const numeroReal = remoteJidAlt ? remoteJidAlt.replace("@s.whatsapp.net", "").replace("@lid", "") : "";
      const numeroLid = isLid ? remoteJid.replace("@lid", "") : "";
      const numero = (isLid && numeroReal) ? numeroReal : (isLid ? numeroLid : remoteJid.replace("@s.whatsapp.net", ""));
      const msgId = msg.key?.id;
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      // Detectar mensagem histórica (sync inicial ao conectar conta nova)
      // Se a mensagem tem mais de 2 minutos, é histórica — salvar mas não tratar como nova
      const msgAgeMs = msg.messageTimestamp
        ? Date.now() - Number(msg.messageTimestamp) * 1000
        : 0;
      const isHistorica = msgAgeMs > 2 * 60 * 1000; // mais de 2 min = histórica

      // Extrair conteúdo
      let tipo = "text"; let conteudo = "";
      const m = msg.message;
      if (m?.conversation) conteudo = m.conversation;
      else if (m?.extendedTextMessage?.text) conteudo = m.extendedTextMessage.text;
      else if (m?.imageMessage) { tipo = "image"; conteudo = m.imageMessage.caption || "📷 Imagem"; }
      else if (m?.audioMessage) { tipo = "audio"; conteudo = "🎵 Áudio"; }
      else if (m?.videoMessage) { tipo = "video"; conteudo = m.videoMessage.caption || "🎥 Vídeo"; }
      else if (m?.documentMessage) { tipo = "document"; conteudo = m.documentMessage.fileName || "📄 Documento"; }
      else if (m?.stickerMessage) { tipo = "sticker"; conteudo = "😄 Sticker"; }
      else conteudo = "Mensagem";

      // Mensagens fromMe — salvar no banco e verificar termo-chave
      if (fromMe) {
        const { data: ag } = await supabase.from("agencias")
          .select("id, whatsapp_numero, parent_id, evolution_url, evolution_key").eq("whatsapp_instancia", instanciaName).single();
        if (ag) {
          // ── COMANDOS MASTER: aprovar cadastro / enviar contrato (fluxo conversacional) ──
          if (conteudo && !ag.parent_id) {
            const cmdLower = conteudo.toLowerCase().trim();
            let evoUrl = ag.evolution_url || "";
            let evoKey = ag.evolution_key || "";
            const sendMsg = async (txt: string) => {
              if (evoUrl && evoKey) await fetch(`${evoUrl}/message/sendText/${instanciaName}`, {
                method: "POST", headers: { "Content-Type": "application/json", apikey: evoKey },
                body: JSON.stringify({ number: ag.whatsapp_numero, text: txt }),
              });
            };

            // 1. Verificar se tem fluxo de contrato em andamento (excluir estados finais)
            // Ignorar fluxo ativo se o comando é "ativar", "aprovar <nome>" ou "contrato <nome>"
            // para que não seja bloqueado por fluxos travados
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
              const idCurto = fluxoAtivo.id.slice(0, 8);

              if (step === "contrato_modalidade") {
                const opcoes: Record<string, string> = { "1": "mensal", "2": "trimestral", "3": "quinzenal" };
                const modalidade = opcoes[cmdLower];
                if (modalidade) {
                  await supabase.from("cadastros_clientes").update({ status: `contrato_valor_${modalidade}` }).eq("id", fluxoAtivo.id);
                  await sendMsg(`💰 *Qual o valor do contrato?*\n\n_Digite apenas o número (ex: 2000)_`);
                } else {
                  await sendMsg(`❌ Opção inválida. Responda *1*, *2* ou *3*`);
                }
                return NextResponse.json({ ok: true });
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
                return NextResponse.json({ ok: true });
              }

              if (step.startsWith("contrato_data_")) {
                const parts = step.replace("contrato_data_", "").split("_");
                const modalidade = parts[0];
                const valor = parts[1];
                const dataInput = cmdLower.trim();
                const dataMatch = dataInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                const dia = dataMatch ? dataInput : cmdLower.replace(/[^\d]/g, "");
                const dataVencimento = dataMatch ? dataInput : dia;
                if ((dataMatch) || (dia && Number(dia) >= 1 && Number(dia) <= 31)) {
                  // Resetar status e gerar contrato
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
                      : `❌ Erro: ${result.error || "erro desconhecido"}`);
                  } catch (e: any) {
                    await supabase.from("cadastros_clientes").update({ status: "pendente" }).eq("id", fluxoAtivo.id);
                    await sendMsg(`❌ Erro ao gerar contrato: ${e.message}`);
                  }
                } else {
                  await sendMsg(`❌ Data inválida. Digite no formato dd/mm/aaaa (ex: 15/06/2026)`);
                }
                return NextResponse.json({ ok: true });
              }
            }

            // 2. Resposta rápida (1=aprovar, 2=contrato) ou comandos com ID/nome
            const aprovarMatch = cmdLower.match(/^aprovar\s+([a-f0-9]{8})/);
            const aprovarNomeMatch = !aprovarMatch && cmdLower.match(/^aprovar\s+(.+)/);
            const contratoIdMatch = cmdLower.match(/^contrato\s+([a-f0-9]{8})/);
            const contratoNomeMatch = !contratoIdMatch && cmdLower.match(/^contrato\s+(.+)/);

            // Buscar cadastro recente pra resposta por número (notificado ou aprovado)
            let cadastro: any = null;
            if (cmdLower === "1" || cmdLower === "2") {
              const { data: notificado } = await supabase.from("cadastros_clientes")
                .select("*").in("status", ["notificado", "aprovado"]).order("criado_em", { ascending: false }).limit(1).single();
              cadastro = notificado;
            } else if (aprovarNomeMatch) {
              // Buscar por nome (ex: "aprovar maria")
              const nomeBusca = aprovarNomeMatch[1].trim();
              const { data: cadastros } = await supabase.from("cadastros_clientes")
                .select("*").ilike("nome", `%${nomeBusca}%`).order("criado_em", { ascending: false }).limit(1);
              cadastro = cadastros?.[0];
              if (!cadastro) { await sendMsg(`❌ Nenhum cadastro encontrado com o nome *${nomeBusca}*`); return NextResponse.json({ ok: true }); }
            } else if (contratoNomeMatch) {
              // Buscar por nome (ex: "contrato aline")
              const nomeBusca = contratoNomeMatch[1].trim();
              const { data: cadastros } = await supabase.from("cadastros_clientes")
                .select("*").ilike("nome", `%${nomeBusca}%`).order("criado_em", { ascending: false }).limit(1);
              cadastro = cadastros?.[0];
              if (!cadastro) { await sendMsg(`❌ Nenhum cadastro encontrado com o nome *${nomeBusca}*`); return NextResponse.json({ ok: true }); }
            } else if (aprovarMatch || contratoIdMatch) {
              const idCurto = aprovarMatch?.[1] || contratoIdMatch?.[1] || "";
              const { data: cadastros } = await supabase.from("cadastros_clientes")
                .select("*").like("id", `${idCurto}%`).limit(1);
              cadastro = cadastros?.[0];
            }

            if (cadastro && (cmdLower === "1" || aprovarMatch || aprovarNomeMatch)) {
              // Aprovar
              try {
                const res = await fetch(`${APP_URL}/api/cadastros/aprovar`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: cadastro.id }),
                });
                const result = await res.json();
                const primeiroNome = cadastro.nome.split(" ")[0].toLowerCase();
                await sendMsg(result.ok
                  ? `✅ Cadastro de *${cadastro.nome}* aprovado com sucesso!\n\n_Próximos passos:_\n*2* — Enviar contrato\n*ativar ${primeiroNome} <valor> <mensal/trimestral/quinzenal>* — Criar cliente + recorrência\n_Ex: ativar ${primeiroNome} 997 mensal_`
                  : `❌ Erro ao aprovar: ${result.error || "erro desconhecido"}`);
              } catch (e: any) { console.error("[webhook] Erro aprovar:", e); }
              return NextResponse.json({ ok: true });
            }

            if (cadastro && (cmdLower === "2" || contratoIdMatch || contratoNomeMatch)) {
              // Iniciar fluxo contrato
              await supabase.from("cadastros_clientes").update({ status: "contrato_modalidade" }).eq("id", cadastro.id);
              await sendMsg(`📄 *Contrato para ${cadastro.nome}*\n\nQual a modalidade?\n\n*1* — Mensal\n*2* — Trimestral\n*3* — Quinzenal`);
              return NextResponse.json({ ok: true });
            }

            // ── COMANDO ATIVAR: cria cliente + recorrência + lançamentos futuros ──
            const ativarMatch = cmdLower.match(/^ativar\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(mensal|quinzenal|trimestral)?$/i);
            if (ativarMatch) {
              const nomeBusca = ativarMatch[1].trim();
              const valorStr = ativarMatch[2].replace(",", ".");
              const valor = parseFloat(valorStr);
              const frequencia = (ativarMatch[3] || "mensal").toLowerCase();

              if (!valor || valor <= 0) {
                await sendMsg(`❌ Valor inválido. Use: *ativar <nome> <valor> <frequencia>*\nEx: ativar aline 997 mensal`);
                return NextResponse.json({ ok: true });
              }

              // Buscar cadastro por nome
              const { data: cadArr } = await supabase.from("cadastros_clientes")
                .select("*").ilike("nome", `%${nomeBusca}%`).order("criado_em", { ascending: false }).limit(1);
              const cad = cadArr?.[0];
              if (!cad) {
                await sendMsg(`❌ Nenhum cadastro encontrado com o nome *${nomeBusca}*`);
                return NextResponse.json({ ok: true });
              }

              // Verificar se já existe cliente com esse cadastro
              const { data: clienteExiste } = await supabase.from("clientes")
                .select("id").eq("cadastro_id", cad.id).maybeSingle();
              if (clienteExiste) {
                await sendMsg(`⚠️ *${cad.nome}* já foi ativado(a) como cliente.`);
                return NextResponse.json({ ok: true });
              }

              const agenciaId = ag.id;

              // 1. Criar cliente
              const { data: novoCliente, error: errCliente } = await supabase.from("clientes").insert({
                agencia_id: agenciaId,
                nome: cad.nome,
                email: cad.email,
                documento: cad.cnpj || cad.cpf || "",
                valor_oportunidade: valor,
                faturamento: cad.faturamento_medio ? parseFloat(cad.faturamento_medio.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 : 0,
                servico: "assessoria",
                frequencia,
                status: "ativo",
                status_recorrencia: "ativo",
                cadastro_id: cad.id,
              }).select().single();

              if (errCliente || !novoCliente) {
                await sendMsg(`❌ Erro ao criar cliente: ${errCliente?.message || "erro desconhecido"}`);
                return NextResponse.json({ ok: true });
              }

              // 2. Criar recorrência
              const hoje = new Date();
              const diaVencimento = hoje.getDate();
              const periodicidade = frequencia === "trimestral" ? "trimestral" : "mensal";
              const valorRec = frequencia === "quinzenal" ? Math.round((valor / 2) * 100) / 100
                             : frequencia === "trimestral" ? Math.round(valor * 3 * 100) / 100 : valor;

              await supabase.from("recorrencias").insert({
                agencia_id: agenciaId,
                tipo: "entrada",
                descricao: `Assessoria - ${cad.nome}`,
                valor: valorRec,
                periodicidade,
                dia_vencimento: diaVencimento,
                ativo: true,
                cliente_id: novoCliente.id,
              });

              // 3. Gerar lançamentos futuros
              const lancamentos: any[] = [];
              if (frequencia === "mensal") {
                for (let i = 0; i < 12; i++) {
                  const data = new Date(hoje);
                  data.setMonth(data.getMonth() + i);
                  lancamentos.push({
                    agencia_id: agenciaId, tipo: "entrada",
                    descricao: `Assessoria - ${cad.nome}`,
                    valor, data_vencimento: data.toISOString().split("T")[0],
                    cliente_id: novoCliente.id, pago: false,
                  });
                }
              } else if (frequencia === "quinzenal") {
                const valorParcela = Math.round((valor / 2) * 100) / 100;
                for (let i = 0; i < 24; i++) {
                  const data = new Date(hoje);
                  data.setDate(data.getDate() + (i * 15));
                  lancamentos.push({
                    agencia_id: agenciaId, tipo: "entrada",
                    descricao: `Assessoria quinzenal - ${cad.nome} (parcela ${i + 1})`,
                    valor: valorParcela, data_vencimento: data.toISOString().split("T")[0],
                    cliente_id: novoCliente.id, pago: false,
                  });
                }
              } else if (frequencia === "trimestral") {
                const valorTrimestral = Math.round(valor * 3 * 100) / 100;
                for (let i = 0; i < 4; i++) {
                  const data = new Date(hoje);
                  data.setMonth(data.getMonth() + (i * 3));
                  lancamentos.push({
                    agencia_id: agenciaId, tipo: "entrada",
                    descricao: `Assessoria trimestral - ${cad.nome} (trimestre ${i + 1})`,
                    valor: valorTrimestral, data_vencimento: data.toISOString().split("T")[0],
                    cliente_id: novoCliente.id, pago: false,
                  });
                }
              }

              if (lancamentos.length > 0) {
                await supabase.from("lancamentos_futuros").insert(lancamentos);
              }

              // 4. Vincular cadastro_id no controle_clientes (se existir)
              await supabase.from("controle_clientes")
                .update({ cadastro_id: cad.id })
                .eq("agencia_id", agenciaId)
                .ilike("nome", `%${nomeBusca}%`)
                .is("cadastro_id", null);

              // 5. Atualizar cadastro
              await supabase.from("cadastros_clientes").update({ status: "ativado" }).eq("id", cad.id);

              const freqLabel = frequencia === "quinzenal" ? "quinzenal" : frequencia === "trimestral" ? "trimestral" : "mensal";
              await sendMsg(`✅ *${cad.nome}* ativado(a) com sucesso!\n\n💰 Valor: R$${valor}\n📅 Frequência: ${freqLabel}\n📋 ${lancamentos.length} lançamentos futuros gerados\n🔄 Recorrência criada`);
              return NextResponse.json({ ok: true });
            }
          }

          let { data: conv } = await supabase.from("conversas")
            .select("id, fbclid, utm_campaign, utm_content, contato_jid, origem")
            .eq("agencia_id", ag.id).eq("contato_numero", numero).single();
          // Criar conversa se não existe (mensagem enviada por mim pra contato novo)
          if (!conv) {
            // Para fromMe, pushName é o nome do REMETENTE (eu), não do destinatário
            // Tentar buscar o nome real do contato via perfil
            let nome = numero;
            try {
              let evoUrl = ag.evolution_url || "";
              let evoKey = ag.evolution_key || "";
              if (!evoUrl && ag.parent_id) {
                const { data: parent } = await supabase.from("agencias")
                  .select("evolution_url, evolution_key")
                  .eq("id", ag.parent_id).single();
                if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
              }
              if (evoUrl && evoKey) {
                const resPerfil = await fetch(`${evoUrl}/chat/fetchProfile/${instanciaName}`, {
                  method: "POST",
                  headers: { apikey: evoKey, "Content-Type": "application/json" },
                  body: JSON.stringify({ number: numero }),
                });
                const perfil = await resPerfil.json();
                if (perfil?.name) nome = perfil.name;
              }
            } catch {}
            const { data: etapaPrimeira } = await supabase.from("jornada_etapas")
              .select("nome").eq("agencia_id", ag.id).eq("eh_primeiro_contato", true).single();
            const { data: nova } = await supabase.from("conversas").insert({
              agencia_id: ag.id, instancia: instanciaName,
              contato_numero: numero, contato_nome: nome,
              contato_jid: remoteJid || null,
              ultima_mensagem: conteudo || "", ultima_mensagem_at: timestamp,
              nao_lidas: 0, etapa_jornada: etapaPrimeira?.nome || "Fez Contato",
            }).select("id, fbclid, utm_campaign, utm_content, contato_jid, origem").single();
            if (nova) conv = nova;
          }
          // Detectar Social Selling quando Gustavo envia "Gustavo aqui!" para um contato
          if (conv && conteudo && conteudo.includes("Gustavo aqui!")) {
            const semRastreio = !conv.origem || conv.origem === "Não Rastreada";
            if (semRastreio) {
              await supabase.from("conversas").update({
                origem: "Social Selling",
                utm_source: "social_selling",
                utm_medium: "direct",
                utm_campaign: "Social Selling",
              }).eq("id", conv.id);
              console.log(`[webhook] Social Selling detectado (fromMe): ${numero}`);
            }
          }

          if (conv) {
            if (msgId && conteudo) {
              // Verificar se é eco de mensagem da IA (mesmo conteúdo, sem limite de tempo — cobre reconexões tardias)
              const { data: iaExistente } = await supabase.from("mensagens")
                .select("id").eq("conversa_id", conv.id).eq("enviada_por_ia", true)
                .eq("conteudo", conteudo).limit(1);

              // Fallback: verificar também qualquer fromMe recente com mesmo conteúdo
              // Cobre race condition (eco chega antes da IA salvar) e diferenças de encoding
              const tresMinAtras = new Date(Date.now() - 3 * 60 * 1000).toISOString();
              const { data: fromMeRecente } = !iaExistente?.length
                ? await supabase.from("mensagens")
                    .select("id").eq("conversa_id", conv.id).eq("de_mim", true)
                    .eq("conteudo", conteudo).gt("created_at", tresMinAtras).limit(1)
                : { data: null };

              if (iaExistente?.length || fromMeRecente?.length) {
                // É eco da IA — não salvar duplicata
                return NextResponse.json({ ok: true });
              }

              await supabase.from("mensagens").upsert({
                conversa_id: conv.id, agencia_id: ag.id,
                mensagem_id: msgId, de_mim: true, tipo, conteudo, created_at: timestamp,
              }, { onConflict: "mensagem_id" });
              await supabase.from("conversas").update({
                ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
              }).eq("id", conv.id);
            }
            if (conteudo && !isHistorica) {
              const convIsCTWA = conv.contato_jid?.includes("@lid") || false;
              await verificarTermoChave(ag.id, conv.id, conteudo, numero, conv.fbclid, conv.utm_campaign, conv.utm_content, convIsCTWA);
            }
          }
        }
        return NextResponse.json({ ok: true });
      }

      // Mensagens do lead — processar normalmente
      const { data: agencia } = await supabase.from("agencias")
        .select("id, evolution_url, evolution_key, whatsapp_numero, meta_pixel_id, meta_token, meta_ativo, meta_business_token, meta_ad_account_id, parent_id, openai_key, openai_whisper_key")
        .eq("whatsapp_instancia", instanciaName).single();
      if (!agencia) {
        console.error("Webhook: agência não encontrada para instância:", instanciaName);
        return NextResponse.json({ ok: true });
      }

      // Auto-salvar whatsapp_numero se ainda não tem (pega do participant da msg)
      if (!agencia.whatsapp_numero) {
        const meuNumero = msg.key?.participant?.replace("@s.whatsapp.net", "").replace(/\D/g, "")
          || remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        // O número do dono é quem NÃO é o remetente (se !fromMe, o remetente é o lead)
        // Buscar da instância via Evolution (com fallback para agência pai)
        try {
          let evoUrlNum = agencia.evolution_url || "";
          let evoKeyNum = agencia.evolution_key || "";
          if (!evoUrlNum && agencia.parent_id) {
            const { data: parentNum } = await supabase.from("agencias")
              .select("evolution_url, evolution_key").eq("id", agencia.parent_id).single();
            if (parentNum) { evoUrlNum = parentNum.evolution_url || ""; evoKeyNum = parentNum.evolution_key || ""; }
          }
          const instRes = await fetch(`${evoUrlNum}/instance/fetchInstances`, {
            headers: { apikey: evoKeyNum },
          });
          const instances = await instRes.json();
          if (Array.isArray(instances)) {
            const inst = instances.find((i: any) => (i.name || i.instance?.instanceName) === instanciaName);
            const owner = inst?.owner?.replace("@s.whatsapp.net", "").replace(/\D/g, "")
              || inst?.instance?.owner?.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            if (owner) {
              await supabase.from("agencias").update({ whatsapp_numero: owner }).eq("id", agencia.id);
              agencia.whatsapp_numero = owner;
            }
          }
        } catch {}
      }

      let nome = msg.pushName || numero;

      // Buscar foto e nome do perfil (com fallback para agência pai se sub-agência sem evolution_url)
      let foto = null;
      try {
        let evoUrl = agencia.evolution_url || "";
        let evoKey = agencia.evolution_key || "";
        if (!evoUrl && agencia.parent_id) {
          const { data: parent } = await supabase.from("agencias")
            .select("evolution_url, evolution_key").eq("id", agencia.parent_id).single();
          if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
        }
        if (evoUrl && evoKey) {
          const resPerfil = await fetch(`${evoUrl}/chat/fetchProfile/${instanciaName}`, {
            method: "POST",
            headers: { "apikey": evoKey, "Content-Type": "application/json" },
            body: JSON.stringify({ number: numero }),
          });
          const perfil = await resPerfil.json();
          if (perfil?.picture) foto = perfil.picture;
          // Usar nome do perfil quando pushName está vazio (contato sem nome identificado)
          if (!msg.pushName && perfil?.name) nome = perfil.name;
        }
      } catch {}

      // Buscar ou criar conversa
      let eraNovaConversa = false;
      let { data: conversa } = await supabase.from("conversas")
        .select("*").eq("agencia_id", agencia.id).eq("contato_numero", numero).single();

      if (!conversa) {
        eraNovaConversa = true;
        // Buscar etapa de primeiro contato da agência
        const { data: etapaPrimeira } = await supabase.from("jornada_etapas")
          .select("nome").eq("agencia_id", agencia.id).eq("eh_primeiro_contato", true).single();
        const etapaInicial = etapaPrimeira?.nome || "Fez Contato";
        // Tentar inserir — se já existe (race condition), buscar a existente
        const { data: nova, error: insertErr } = await supabase.from("conversas").insert({
          agencia_id: agencia.id, instancia: instanciaName,
          contato_numero: numero, contato_nome: nome, contato_foto: foto,
          contato_jid: remoteJid,
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
          primeira_mensagem_at: timestamp, nao_lidas: isHistorica ? 0 : 1,
          origem: isLid ? "Meta Ads" : "Não Rastreada",
          etapa_jornada: etapaInicial,
        }).select().single();
        if (insertErr) {
          // Race condition — conversa foi criada por outro request simultâneo
          const { data: existente } = await supabase.from("conversas")
            .select("*").eq("agencia_id", agencia.id).eq("contato_numero", numero).single();
          if (existente) {
            conversa = existente;
            eraNovaConversa = false;
          } else {
            console.error("Webhook: erro ao criar conversa:", insertErr.message, { numero, nome });
            return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
          }
        } else {
          conversa = nova;
        }
      } else {
        const updateConv: any = {
          ultima_mensagem: conteudo, ultima_mensagem_at: timestamp,
        };
        // Só atualizar nome se o novo nome é real (não é número) e o atual é número ou vazio
        const nomeAtualENumero = !conversa.contato_nome || /^\d+$/.test(conversa.contato_nome);
        const nomeNovoEReal = nome && !/^\d+$/.test(nome);
        if (nomeNovoEReal && nomeAtualENumero) {
          updateConv.contato_nome = nome;
        }
        // Atualizar contato_jid se mudou para @lid (nunca sobrescrever @lid com @s.whatsapp.net)
        if (isLid && conversa.contato_jid !== remoteJid) {
          updateConv.contato_jid = remoteJid;
        }
        if (!isHistorica) {
          updateConv.nao_lidas = (conversa.nao_lidas || 0) + 1;
        }
        await supabase.from("conversas").update(updateConv).eq("id", conversa.id);
      }

      if (!conversa) return NextResponse.json({ ok: false, error: "Conversa não criada" }, { status: 500 });

      // Salvar mensagem (INSERT, não upsert — se já existe, é webhook duplicado)
      let msgDuplicada = false;
      if (msgId) {
        const { error: msgInsertErr } = await supabase.from("mensagens").insert({
          conversa_id: conversa.id, agencia_id: agencia.id,
          mensagem_id: msgId, de_mim: false, tipo, conteudo, created_at: timestamp,
        });
        if (msgInsertErr) {
          if (msgInsertErr.code === "23505") {
            console.log(`[webhook] Mensagem duplicada ${msgId}, pulando rastreamento mas processando IA`);
            msgDuplicada = true;
          } else {
            console.error(`[webhook] ERRO ao salvar mensagem: code=${msgInsertErr.code} msg=${msgInsertErr.message} details=${msgInsertErr.details}`);
          }
        }
      }

      // Se mensagem histórica (sync inicial), pular rastreamento e pixel
      if (!isHistorica && !msgDuplicada) {

      // ============================================
      // RASTREAMENTO — cruzar com dados pendentes
      // ============================================
      let tracking = null;

      // Detectar externalAdReply antecipadamente pra saber se é CTWA
      const _externalAdReply = msg.message?.extendedTextMessage?.contextInfo?.externalAdReply
        || msg.message?.imageMessage?.contextInfo?.externalAdReply
        || msg.message?.videoMessage?.contextInfo?.externalAdReply
        || msg.message?.documentMessage?.contextInfo?.externalAdReply
        || msg.message?.contactMessage?.contextInfo?.externalAdReply
        || msg.message?.locationMessage?.contextInfo?.externalAdReply
        || msg.message?.conversation?.contextInfo?.externalAdReply
        || msg.contextInfo?.externalAdReply
        || data?.contextInfo?.externalAdReply;
      const _isCTWA = !!_externalAdReply || !!(msg.message?.extendedTextMessage?.contextInfo?.ctwaClid);

      // 0. Se @lid (Click-to-WhatsApp) e NÃO é CTWA, buscar rastreamento pendente
      //    Se passou pela página de 5s, tem rastreamento pendente → associar
      //    IMPORTANTE: exigir link_id IS NOT NULL para nunca pegar rastreamentos de formulário
      //    (formulários têm leadgen_id mas NÃO têm link_id, enquanto /c links sempre têm link_id)
      if (isLid && eraNovaConversa && !_isCTWA) {
        const dezMinAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: lidTrack } = await supabase.from("rastreamentos_pendentes")
          .select("*")
          .eq("wa_destino", agencia.whatsapp_numero)
          .not("link_id", "is", null)        // só rastreamentos do /c link, nunca formulários
          .neq("utm_medium", "leadform")      // dupla proteção contra formulários
          .gt("created_at", dezMinAtras)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lidTrack) tracking = lidTrack;
      }

      // 1. Tentar por número do lead (só se não é CTWA e sem tracking ainda)
      if (!tracking && !_isCTWA) {
        let formCandidato: any = null; // form rastreamento guardado como candidato secundário

        // Tentar match exato primeiro
        const { data: t1 } = await supabase.from("rastreamentos_pendentes")
          .select("*").eq("wa_numero", numero).single();
        if (t1) {
          if (t1.leadgen_id) formCandidato = t1; // form lead — não setar ainda, verificar conflito
          else tracking = t1;
        }
        // Fallback: variantes do número BR (com/sem 55, com/sem 9° dígito)
        if (!tracking && !formCandidato) {
          const numClean = numero.replace(/\D/g, "");
          const variantes = [numClean];
          if (numClean.startsWith("55")) {
            variantes.push(numClean.slice(2)); // sem 55
            // sem 9° dígito: 55+DD+8dig (de 13 para 12)
            if (numClean.length === 13) variantes.push("55" + numClean.slice(2,4) + numClean.slice(5));
            // com 9° dígito: 55+DD+9+8dig (de 12 para 13)
            if (numClean.length === 12) variantes.push("55" + numClean.slice(2,4) + "9" + numClean.slice(4));
          } else {
            variantes.push("55" + numClean); // com 55
            // com 9° dígito: DD+9+8dig
            if (numClean.length === 10) variantes.push(numClean.slice(0,2) + "9" + numClean.slice(2));
            if (numClean.length === 10) variantes.push("55" + numClean.slice(0,2) + "9" + numClean.slice(2));
            // sem 9° dígito: DD+8dig (de 11 para 10)
            if (numClean.length === 11) variantes.push(numClean.slice(0,2) + numClean.slice(3));
            if (numClean.length === 11) variantes.push("55" + numClean.slice(0,2) + numClean.slice(3));
          }
          for (const v of variantes) {
            if (v === numero) continue;
            const { data: tv } = await supabase.from("rastreamentos_pendentes")
              .select("*").eq("wa_numero", v).single();
            if (tv) {
              if (tv.leadgen_id) { formCandidato = tv; break; }
              else { tracking = tv; break; }
            }
          }
        }

        // Se só achamos um rastreamento de FORMULÁRIO, verificar se a mensagem bate com algum /c link
        // Se bater → lead veio pelo link, não pelo formulário → não usar o form tracking aqui
        // (step 6b vai associar ao link correto pela mensagem)
        if (!tracking && formCandidato) {
          const msgNorm = (conteudo || "").toLowerCase().replace(/\s+/g, " ").trim();
          let msgBateLink = false;
          if (msgNorm.length >= 5) {
            const { data: linksAtivos } = await supabase.from("links_campanha")
              .select("wa_mensagem").eq("agencia_id", agencia.id).not("wa_mensagem", "is", null);
            msgBateLink = (linksAtivos || []).some((l: any) => {
              const lmsg = (l.wa_mensagem || "").toLowerCase().replace(/\s+/g, " ").trim();
              return lmsg.length >= 5 && (msgNorm === lmsg || msgNorm.includes(lmsg));
            });
          }
          if (!msgBateLink) {
            // Mensagem não é de link /c → lead provavelmente veio mesmo pelo formulário
            tracking = formCandidato;
          }
          // Se msgBateLink: não setar tracking → step 6b vai encontrar pelo link+mensagem
        }
      }

      // 2. Detectar externalAdReply (CTWA) — prioridade máxima
      {
        const externalAdReply = _externalAdReply;
        const ctwaClid = externalAdReply?.ctwaClid || msg.message?.extendedTextMessage?.contextInfo?.ctwaClid || null;
        const sourceId = externalAdReply?.sourceId || null;
        const sourceUrl = externalAdReply?.sourceUrl || null;

        // Tentar por fbclid exato
        if (ctwaClid) {
          const { data: t2 } = await supabase.from("rastreamentos_pendentes")
            .select("*").eq("fbclid", ctwaClid).single();
          if (t2) { tracking = t2; }
          else {
            const { data: t2b } = await supabase.from("rastreamentos_pendentes")
              .select("*").eq("wa_numero", ctwaClid).single();
            if (t2b) tracking = t2b;
          }
        }

        // 4. Tentar por utm_campaign via sourceUrl
        if (!tracking && sourceUrl) {
          try {
            const refUrl = new URL(sourceUrl);
            const refCampaign = refUrl.searchParams.get("utm_campaign");
            const refSource = refUrl.searchParams.get("utm_source");
            const refFbclid = refUrl.searchParams.get("fbclid");
            if (refFbclid) {
              const { data: t3 } = await supabase.from("rastreamentos_pendentes")
                .select("*").eq("fbclid", refFbclid).single();
              if (t3) tracking = t3;
            }
            if (!tracking && refCampaign) {
              const { data: t4 } = await supabase.from("rastreamentos_pendentes")
                .select("*").eq("utm_campaign", refCampaign)
                .order("created_at", { ascending: false }).limit(1).single();
              if (t4) tracking = t4;
            }
            // Se achou sourceUrl mas não rastreamento, criar inline
            if (!tracking && (refSource || refCampaign)) {
              tracking = {
                utm_source: refSource || externalAdReply?.mediaType || "ig",
                utm_campaign: refCampaign || "",
                utm_content: refUrl.searchParams.get("utm_content") || sourceId || "",
                utm_medium: refUrl.searchParams.get("utm_medium") || "",
                fbclid: refFbclid || ctwaClid || "",
                origem: "Meta Ads",
                link_id: null,
              };
            }
          } catch {}
        }

        // 5. Se tem externalAdReply — extrair campanha, conjunto e criativo
        if (!tracking && externalAdReply) {
          // Tentar buscar nomes reais da campanha/conjunto/criativo via Meta Ads API
          let campanha = "";
          let conjunto = "";
          let criativo = "";

          // Se tem sourceId, tentar buscar dados do anúncio/conjunto/campanha via Meta API
          // meta_token tem permissão de leitura de ads; meta_business_token é só CAPI
          const adsToken = agencia.meta_token || agencia.meta_business_token;
          if (sourceId && adsToken) {
            try {
              // sourceId é o ID do anúncio — buscar nome, adset_id e campaign_id
              const adRes = await fetch(`https://graph.facebook.com/v21.0/${sourceId}?fields=name,adset_id,campaign_id&access_token=${adsToken}`);
              const adData = await adRes.json();
              if (adData && !adData.error) {
                criativo = adData.name || ""; // nome do anúncio
                // Buscar nome do conjunto (adset)
                if (adData.adset_id) {
                  const adsetRes = await fetch(`https://graph.facebook.com/v21.0/${adData.adset_id}?fields=name&access_token=${adsToken}`);
                  const adsetData = await adsetRes.json();
                  if (!adsetData.error) conjunto = adsetData.name || "";
                }
                // Buscar nome da campanha
                if (adData.campaign_id) {
                  const campRes = await fetch(`https://graph.facebook.com/v21.0/${adData.campaign_id}?fields=name&access_token=${adsToken}`);
                  const campData = await campRes.json();
                  if (!campData.error) campanha = campData.name || "";
                }
              }
            } catch {}
          }

          // sourceId via Meta API é a fonte mais confiável — confiar nos dados retornados
          // A pessoa pode ter mudado a mensagem mas veio pelo anúncio/link
          tracking = {
            utm_source: "facebook",
            utm_campaign: campanha || externalAdReply.title || externalAdReply.body || "",
            utm_content: conjunto ? `${conjunto}_${criativo}` : sourceId || "",
            utm_medium: "cpc",
            fbclid: ctwaClid || "",
            origem: "Meta Ads",
            link_id: null,
            _nome_anuncio: criativo || externalAdReply.title || "",
          };
        }

        // 6. Se veio via @lid mas não achou nenhum tracking
        if (!tracking && isLid) {
          tracking = {
            utm_source: "meta",
            utm_campaign: "",
            utm_content: sourceId || "",
            utm_medium: "",
            fbclid: ctwaClid || "",
            origem: "Meta Ads",
            link_id: null,
          };
        }
      }

      // 6a2. Detectar formulário instantâneo do Meta (lead preenche form → redireciona pro WhatsApp)
      if (!tracking && eraNovaConversa) {
        const msgLower = (conteudo || "").toLowerCase();
        const isFormulario = msgLower.includes("preenchi seu formulário") || msgLower.includes("preenchi o formulário") || msgLower.includes("preenchi seu formulario") || msgLower.includes("assisti todo o vídeo") || msgLower.includes("assisti todo o video");
        if (isFormulario) {
          let campForm = "Formulário Instantâneo";
          let conjuntoForm = "";
          let criativoForm = "";
          const adsToken = agencia.meta_business_token || agencia.meta_token;
          const adAccount = agencia.meta_ad_account_id;
          if (adsToken && adAccount) {
            try {
              const acId = adAccount.startsWith("act_") ? adAccount : `act_${adAccount}`;
              // Buscar campanhas OUTCOME_LEADS ativas
              const campRes = await fetch(`https://graph.facebook.com/v21.0/${acId}/campaigns?fields=name,objective,effective_status&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]},{"field":"objective","operator":"IN","value":["OUTCOME_LEADS"]}]&limit=5&access_token=${adsToken}`);
              const campData = await campRes.json();
              if (campData.data?.length) {
                // Pegar a primeira campanha ativa de leads
                const camp = campData.data[0];
                campForm = camp.name;
                // Buscar ads ativos dessa campanha pra pegar conjunto e anúncio
                try {
                  const adsRes = await fetch(`https://graph.facebook.com/v21.0/${camp.id}/ads?fields=name,effective_status,adset{name}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=10&access_token=${adsToken}`);
                  const adsData = await adsRes.json();
                  if (adsData.data?.length) {
                    conjuntoForm = adsData.data[0].adset?.name || "";
                    criativoForm = adsData.data[0].name || "";
                  }
                } catch {}
              }
            } catch (e) {
              console.error("[whatsapp] Erro ao buscar campanha formulário:", e);
            }
          }
          tracking = {
            utm_source: "meta", utm_medium: "leadform", utm_campaign: campForm,
            utm_content: conjuntoForm, fbclid: "", origem: "Formulário Meta", link_id: null,
            _nome_anuncio: criativoForm,
          };
        }
      }

      // 6a3. Detectar Social Selling — gatilho: mensagem contém "Gustavo aqui!" (exato)
      if (!tracking) {
        const temSocialSelling = (conteudo || "").includes("Gustavo aqui!");
        if (temSocialSelling) {
          tracking = {
            utm_source: "social_selling",
            utm_medium: "direct",
            utm_campaign: "Social Selling",
            utm_content: "",
            fbclid: "",
            origem: "Social Selling",
            link_id: null,
          };
        }
      }

      // 6b. Buscar rastreamento pendente genérico por mensagem
      // Roda para todos os leads sem tracking (incluindo @lid que não achou match no step 0)
      // Valida obrigatoriamente pela mensagem para evitar falsos positivos
      if (!tracking) {
        const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentes } = await supabase.from("rastreamentos_pendentes")
          .select("*")
          .gt("created_at", cincoMinAtras)
          .or(`wa_destino.eq.${agencia.whatsapp_numero},wa_destino.is.null`)
          .order("created_at", { ascending: false })
          .limit(10);

        if (recentes && recentes.length > 0) {
          const msgNorm = (conteudo || "").toLowerCase().replace(/[^\w\sáéíóúâêôãõàçü]/g, "").replace(/\s+/g, " ").trim();

          let candidato = null;
          for (const r of recentes) {
            if (!r.utm_campaign && !r.link_id && !r.fbclid) continue;
            // Já foi usado por outro lead
            const isNumeroReal = /^\d{10,15}$/.test(r.wa_numero || "");
            if (isNumeroReal) continue;

            // Se veio de link rastreável, OBRIGAR validação da mensagem
            if (r.link_id && msgNorm) {
              const { data: linkData } = await supabase.from("links_campanha")
                .select("wa_mensagem").eq("id", r.link_id).single();
              if (linkData?.wa_mensagem) {
                const linkMsgNorm = linkData.wa_mensagem.toLowerCase().replace(/[^\w\sáéíóúâêôãõàçü]/g, "").replace(/\s+/g, " ").trim();
                if (linkMsgNorm.length >= 5 && (msgNorm === linkMsgNorm || msgNorm.includes(linkMsgNorm))) {
                  candidato = r;
                  break;
                }
                // Mensagem não bateu — NÃO associar, pular
                continue;
              }
            }

            // Candidato sem link_id (fbclid direto, utm sem link) — NÃO aceitar
            // Evita falsos positivos com rastreamentos pendentes genéricos
            continue;
          }

          if (candidato) {
            tracking = candidato;
            await supabase.from("rastreamentos_pendentes")
              .update({ wa_numero: numero })
              .eq("wa_numero", candidato.wa_numero);
          }
        }
      }

      // 7. REMOVIDO: match por conteúdo da mensagem com links_campanha
      //    Causava falsos positivos — associava ao link pessoas que nunca passaram pela página de 5s.
      //    Agora só associa ao link quem tem rastreamento pendente (prova que passou pela página).

      // ============================================
      // APLICAR RASTREAMENTO
      // ============================================

      // 8. ENRIQUECER: resolver nomes reais de anúncio/conjunto/campanha via Meta API
      //    Roda para CTWA (sourceId) e para leads do /c link (utm_content numérico = ad ID)
      if (tracking) {
        const _ctwaClid = _externalAdReply?.ctwaClid || msg.message?.extendedTextMessage?.contextInfo?.ctwaClid || "";
        // meta_token tem ads_read; meta_business_token é só CAPI
        const adsToken = agencia.meta_token || agencia.meta_business_token;
        // ID a resolver: sourceId do CTWA ou utm_content se for numérico (ad ID do Meta)
        const adIdToResolve = _externalAdReply?.sourceId
          || (/^\d{15,20}$/.test(tracking.utm_content || "") ? tracking.utm_content : null);

        if (adIdToResolve && adsToken) {
          try {
            const adRes = await fetch(`https://graph.facebook.com/v21.0/${adIdToResolve}?fields=name,adset_id,campaign_id&access_token=${adsToken}`);
            const adData = await adRes.json();
            if (adData && !adData.error && adData.adset_id) {
              const nomeAnuncio = adData.name || "";
              // Buscar nome do conjunto
              const adsetRes = await fetch(`https://graph.facebook.com/v21.0/${adData.adset_id}?fields=name&access_token=${adsToken}`);
              const adsetData = await adsetRes.json();
              const nomeConjunto = adsetData.error ? "" : (adsetData.name || "");
              // Buscar nome da campanha (só sobrescreve se utm_campaign não veio da URL /c)
              if (adData.campaign_id && !tracking.link_id) {
                const campRes = await fetch(`https://graph.facebook.com/v21.0/${adData.campaign_id}?fields=name&access_token=${adsToken}`);
                const campData = await campRes.json();
                if (!campData.error && campData.name) tracking.utm_campaign = campData.name;
              }
              if (nomeConjunto) tracking.utm_content = nomeConjunto;
              if (nomeAnuncio) tracking._nome_anuncio = nomeAnuncio;
            }
          } catch {}
        }
        // Garantir fbclid do CTWA
        if (_ctwaClid && !tracking.fbclid) tracking.fbclid = _ctwaClid;
      }

      // 8b. AUTO-CLASSIFICAR: se tem tracking com campanha mas sem tipo, tentar detectar pelo objetivo
      if (tracking && tracking.utm_campaign && !tracking.utm_medium) {
        const adsToken = agencia.meta_business_token || agencia.meta_token;
        const adAccount = (agencia as any).meta_ad_account_id;
        if (adsToken && adAccount) {
          try {
            const acId = adAccount.startsWith("act_") ? adAccount : `act_${adAccount}`;
            const campRes = await fetch(`https://graph.facebook.com/v21.0/${acId}/campaigns?fields=name,objective&filtering=[{"field":"name","operator":"CONTAIN","value":"${tracking.utm_campaign.slice(0, 50)}"}]&limit=1&access_token=${adsToken}`);
            const campData = await campRes.json();
            if (campData.data?.[0]) {
              const obj = campData.data[0].objective;
              if (obj === "OUTCOME_LEADS") { tracking.origem = "Formulário Meta"; tracking.utm_medium = "leadform"; }
              else if (obj === "OUTCOME_ENGAGEMENT") { tracking.utm_medium = "ctwa"; }
              else if (obj === "OUTCOME_TRAFFIC" || obj === "OUTCOME_SALES") { tracking.utm_medium = "link"; }
            }
          } catch {}
        }
      }

      if (tracking) {
        const linkIdFromTerm = tracking.utm_term && tracking.utm_term.match(/^[0-9a-f-]{36}$/)
          ? tracking.utm_term : tracking.link_id;

        const isPrimeiro = eraNovaConversa || !conversa.primeira_mensagem_at;
        const semRastreio = !conversa.origem || conversa.origem === "Não Rastreada";

        // Atualizar conversa se: é primeira mensagem OU conversa ainda não tem rastreamento
        if (isPrimeiro || semRastreio) {
          const updateData: any = {
            origem: tracking.origem || "Meta Ads",
            utm_source: tracking.utm_source,
            utm_medium: tracking.utm_medium,
            utm_campaign: tracking.utm_campaign,
            utm_content: tracking.utm_content,
            utm_term: tracking.utm_term,
            fbclid: tracking.fbclid,
            link_id: linkIdFromTerm,
            leadgen_id: tracking.leadgen_id || null,
          };

          if (isPrimeiro) {
            updateData.primeira_mensagem_at = timestamp;
          }

          if (tracking._link_nome) {
            updateData.link_nome = tracking._link_nome;
          }
          if (tracking._nome_anuncio) {
            updateData.nome_anuncio = tracking._nome_anuncio;
          }

          await supabase.from("conversas").update(updateData).eq("id", conversa.id);

          if (linkIdFromTerm && !tracking._link_nome) {
            const { data: linkData } = await supabase.from("links_campanha")
              .select("nome").eq("id", linkIdFromTerm).single();
            if (linkData?.nome) {
              await supabase.from("conversas").update({ link_nome: linkData.nome }).eq("id", conversa.id);
            }
          }
        } else {
          // Já tem rastreamento — salvar como rastreamento adicional (histórico)
          try {
            await supabase.from("rastreamentos_historico").insert({
              conversa_id: conversa.id,
              agencia_id: agencia.id,
              contato_numero: numero,
              origem: tracking.origem || "Meta Ads",
              utm_source: tracking.utm_source,
              utm_medium: tracking.utm_medium,
              utm_campaign: tracking.utm_campaign,
              utm_content: tracking.utm_content,
              fbclid: tracking.fbclid,
              link_id: linkIdFromTerm,
              created_at: timestamp,
            });
          } catch {}
        }

        // Limpar rastreamentos pendentes
        await supabase.from("rastreamentos_pendentes").delete().eq("wa_numero", numero);
        if (tracking.fbclid) {
          await supabase.from("rastreamentos_pendentes").delete().eq("fbclid", tracking.fbclid);
        }
      } else {
        // Sem tracking — marcar primeira mensagem e agendar retry
        await supabase.from("conversas").update({
          primeira_mensagem_at: timestamp,
          origem: conversa.origem || "Não Rastreada",
        }).eq("id", conversa.id).is("primeira_mensagem_at", null);

        if (eraNovaConversa) {
          waitUntil(
            fetch(`${APP_URL}/api/webhook/retentar-rastreamento`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversa_id: conversa.id, numero, agencia_id: agencia.id, timestamp }),
            }).catch(() => {})
          );
        }
      }

      // Verificar termo-chave na mensagem do lead
      await verificarTermoChave(
        agencia.id, conversa.id, conteudo, numero,
        conversa.fbclid || tracking?.fbclid, conversa.utm_campaign || tracking?.utm_campaign, conversa.utm_content || tracking?.utm_content,
        _isCTWA || isLid
      );

      // Disparar pixel em toda conversa nova (orgânico + anúncio) pra enriquecer o pixel
      if (eraNovaConversa) {
        const { data: etapaPrimeiro } = await supabase.from("jornada_etapas")
          .select("nome").eq("agencia_id", agencia.id).eq("eh_primeiro_contato", true).single();
        const nomeEtapa = etapaPrimeiro?.nome || "Entrou em contato";
        try {
          const pixelRes = await fetch(`${APP_URL}/api/pixel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id: agencia.id,
              conversa_id: conversa.id,
              etapa_nome: nomeEtapa,
              phone: numero,
              contato_nome: conversa.contato_nome || nome,
              fbclid: tracking?.fbclid,
              utm_campaign: tracking?.utm_campaign,
              utm_content: tracking?.utm_content,
              is_ctwa: _isCTWA || isLid || tracking?.origem === "Meta Ads" || !!tracking?.fbclid,
            }),
          });
          const pixelData = await pixelRes.json();
          if (!pixelData.ok) console.error("[pixel] Erro primeiro contato:", pixelData.error || pixelData.motivo);
        } catch (e) {
          console.error("[pixel] Exceção primeiro contato:", e);
        }
      }

      // FUNIS: cancelar pendentes quando lead responde
      if (conversa?.id) {
        supabase.from("funil_fila")
          .update({ status: "cancelado" })
          .eq("conversa_id", conversa.id)
          .eq("status", "pendente")
          .then(() => {});
      }

      // FASE: detectar sinal de adiamento na mensagem do lead
      if (conversa?.id && conteudo) {
        const sinaisAdiamento = [
          "mês que vem", "mes que vem", "vou pensar", "vou ver com",
          "depois te chamo", "vou falar com", "deixa eu pensar",
          "não tenho dinheiro", "nao tenho dinheiro", "tô sem dinheiro", "to sem dinheiro",
          "não posso agora", "nao posso agora", "mais pra frente", "mais para frente",
          "semana que vem", "próxima semana", "proxima semana", "depois eu vejo",
          "nao vou conseguir", "não vou conseguir", "esse mes nao", "esse mês não",
        ];
        const lower = conteudo.toLowerCase();
        if (sinaisAdiamento.some(s => lower.includes(s))) {
          supabase.from("conversas").update({
            fase_atendimento: "adiou",
            fase_atualizada_em: new Date().toISOString(),
            followup_count: 0,
          }).eq("id", conversa.id).then(() => {});
        }
      }

      } // fecha !isHistorica

      // IA AUTO-RESPONDER (não-bloqueante)
      console.log(`[webhook-ia] conteudo="${(conteudo||'').slice(0,30)}" tipo=${tipo} conversa=${conversa?.id} ia_ativada=${conversa?.ia_ativada} isHistorica=${isHistorica} msgDuplicada=${msgDuplicada}`);
      if (conteudo && conversa?.id) {
        let deveResponder = false;

        if (conversa.ia_ativada) {
          // Conversa já foi ativada antes — IA responde sempre
          deveResponder = true;
        } else {
          // Conversa nunca ativada — verificar se mensagem bate com gatilho
          const { data: agConfig } = await supabase.from("agencias")
            .select("ia_mensagens_gatilho").eq("id", agencia.id).single();
          let gatilhos: string[] = [];
          try { gatilhos = agConfig?.ia_mensagens_gatilho ? JSON.parse(agConfig.ia_mensagens_gatilho) : []; } catch {}

          if (gatilhos.length === 0) {
            // Sem gatilhos configurados — ativar pra todas as conversas novas
            if (eraNovaConversa) {
              deveResponder = true;
              await supabase.from("conversas").update({ ia_ativada: true }).eq("id", conversa.id);
            }
          } else {
            // Tem gatilhos — verificar se a mensagem bate (ignora acentos, pontuação e espaços extras)
            const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
            const conteudoNorm = normalizar(conteudo);
            const bateGatilho = gatilhos.some(g => {
              const gatilhoNorm = normalizar(g);
              return gatilhoNorm && (conteudoNorm.includes(gatilhoNorm) || gatilhoNorm.includes(conteudoNorm));
            });
            if (bateGatilho) {
              deveResponder = true;
              await supabase.from("conversas").update({ ia_ativada: true }).eq("id", conversa.id);
            }
          }
        }

        console.log(`[webhook-ia] deveResponder=${deveResponder} ia_ativada=${conversa.ia_ativada} agencia=${agencia.id} conversa=${conversa.id}`);
        if (deveResponder) {
          console.log(`[webhook-ia] chamando responder para conversa ${conversa.id}...`);

          // Capturar variáveis necessárias para o closure
          const _agenciaId = agencia.id;
          const _conversaId = conversa.id;
          const _msgId = msgId;
          const _remoteJid = remoteJid;
          const _instanciaName = instanciaName;
          const _tipo = tipo;
          let _conteudo = conteudo;

          // Resolver Evolution URL/key (pode ser do parent)
          let _evoUrl = agencia.evolution_url || "";
          let _evoKey = agencia.evolution_key || "";
          if (!_evoUrl && agencia.parent_id) {
            try {
              const { data: parentEvo } = await supabase.from("agencias")
                .select("evolution_url, evolution_key").eq("id", agencia.parent_id).single();
              if (parentEvo) { _evoUrl = parentEvo.evolution_url || ""; _evoKey = parentEvo.evolution_key || ""; }
            } catch {}
          }

          // Resolver chave Whisper
          let _whisperKey = (agencia as any).openai_whisper_key || "";
          if (!_whisperKey) {
            const k = agencia.openai_key || "";
            if (k && !k.startsWith("sk-ant-")) _whisperKey = k;
          }

          // waitUntil: retorna resposta ao Evolution mas mantém função viva
          waitUntil((async () => {
            // 1. Transcrever áudio imediatamente (antes do debounce do responder)
            if (_tipo === "audio" && _whisperKey && _evoUrl && _evoKey && _msgId) {
              try {
                const convertRes = await fetch(`${_evoUrl}/chat/getBase64FromMediaMessage/${_instanciaName}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: _evoKey },
                  body: JSON.stringify({
                    message: {
                      key: { id: _msgId, remoteJid: _remoteJid, fromMe: false },
                      message: msg.message,
                      messageType: "audioMessage",
                    },
                  }),
                });
                if (convertRes.ok) {
                  const b64Data = await convertRes.json();
                  const base64Audio = b64Data.base64 || b64Data.data;
                  if (base64Audio) {
                    const audioBuffer = Buffer.from(base64Audio, "base64");
                    const formData = new FormData();
                    formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "audio.ogg");
                    formData.append("model", "whisper-1");
                    formData.append("language", "pt");
                    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${_whisperKey}` },
                      body: formData,
                    });
                    const whisperData = await whisperRes.json();
                    if (whisperData.text) {
                      _conteudo = `[Áudio transcrito]: ${whisperData.text}`;
                      await supabase.from("mensagens").update({ conteudo: _conteudo })
                        .eq("conversa_id", _conversaId).eq("mensagem_id", _msgId);
                      console.log(`[webhook] Áudio transcrito: ${whisperData.text.slice(0, 80)}`);
                    } else {
                      console.error("[webhook] Whisper sem texto:", whisperData);
                    }
                  } else {
                    console.error("[webhook] getBase64 sem dados de áudio");
                  }
                } else {
                  const errText = await convertRes.text();
                  console.error("[webhook] getBase64 falhou:", convertRes.status, errText);
                }
              } catch (audioErr: any) {
                console.error("[webhook] Erro transcrição áudio:", audioErr.message);
              }
            }

            // 2. Chamar responder com conteúdo atualizado (transcrito ou original)
            await fetch(`${APP_URL}/api/ai/responder`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agencia_id: _agenciaId,
                conversa_id: _conversaId,
                mensagem_lead: _conteudo,
              }),
            }).catch((iaErr) => {
              console.error(`[webhook-ia] ERRO fetch:`, iaErr.message);
            });
          })());

        } // fecha deveResponder

        // FOLLOW-UP: agora controlado pelo cron (não pré-agenda mais)
      }
    }

    return NextResponse.json({ ok: true });
  } catch(e) {
    console.error("Webhook erro:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook ativo" });
}
