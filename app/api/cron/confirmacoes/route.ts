import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Buscar conversas com evento agendado no futuro
    const agora = new Date();
    const brTime = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeStr = `${brTime.getFullYear()}-${String(brTime.getMonth() + 1).padStart(2, "0")}-${String(brTime.getDate()).padStart(2, "0")}`;

    const horaBrt = brTime.getHours();

    const { data: conversas } = await supabase.from("conversas")
      .select("id, agencia_id, contato_numero, contato_nome, evento_data, evento_tipo, evento_nome, contato_jid")
      .not("evento_data", "is", null)
      .not("agendou_at", "is", null)
      .gte("evento_data", `${hojeStr}T00:00:00`);

    if (!conversas?.length) {
      return NextResponse.json({ ok: true, processados: 0 });
    }

    let enviados = 0;

    for (const conv of conversas) {
      const eventoDate = new Date(conv.evento_data);
      const eventoBr = new Date(eventoDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      // Comparar datas (dia a dia) em BRT, ignorando horário
      // Math.floor sobre timestamps causava diffDias=0 quando o evento era <24h no futuro
      // Ex: cron 18h BRT, evento 15h BRT do dia seguinte = 21h de diff → floor(21/24)=0 → "hoje"
      const hojeData = new Date(`${hojeStr}T00:00:00`);
      const eventoDataStr = `${eventoBr.getFullYear()}-${String(eventoBr.getMonth()+1).padStart(2,"0")}-${String(eventoBr.getDate()).padStart(2,"0")}`;
      const eventoData = new Date(`${eventoDataStr}T00:00:00`);
      const diffDias = Math.round((eventoData.getTime() - hojeData.getTime()) / (1000 * 60 * 60 * 24));

      // Buscar config da agência
      const { data: ag } = await supabase.from("agencias")
        .select("confirmacao_dias, confirmacao_template_vespera, confirmacao_template_dia, evolution_url, evolution_key, whatsapp_instancia, parent_id")
        .eq("id", conv.agencia_id).single();

      if (!ag) continue;

      // Parse dias configurados (default: [1, 0] = véspera + no dia)
      let diasConfirmacao: number[] = [1, 0];
      try { diasConfirmacao = JSON.parse(ag.confirmacao_dias || "[1,0]"); } catch {}

      if (!diasConfirmacao.includes(diffDias)) continue;

      // Verificar timing de envio por tipo:
      // dia_0 → só enviar a partir das 08:00 BRT (início do dia)
      // dia_1 (véspera) → enviar 24h antes do horário do evento (mesma hora do dia anterior)
      if (diffDias === 0 && horaBrt < 8) continue;
      if (diffDias === 1 && agora.getTime() < eventoDate.getTime() - 24 * 60 * 60 * 1000) continue;

      // Verificar se já enviou essa confirmação
      const tipoConfirmacao = `dia_${diffDias}`;
      const { data: jaEnviou } = await supabase.from("confirmacoes_agendamento")
        .select("id").eq("conversa_id", conv.id).eq("tipo", tipoConfirmacao).limit(1);
      if (jaEnviou?.length) continue;

      // Montar mensagem
      // Usar evento_nome (nome real confirmado no agendamento) ou fallback para contato_nome
      const nomeAgendado = conv.evento_nome || conv.contato_nome || "";
      const primeiroNome = nomeAgendado.split(" ")[0] || "cliente";
      const horario = `${String(eventoBr.getHours()).padStart(2, "0")}:${String(eventoBr.getMinutes()).padStart(2, "0")}`;
      const dataFormatada = `${String(eventoBr.getDate()).padStart(2, "0")}/${String(eventoBr.getMonth() + 1).padStart(2, "0")}`;

      let template = "";
      if (diffDias === 0) {
        template = ag.confirmacao_template_dia || "Olá {nome}, lembrando que seu agendamento é hoje às {horario}. Te esperamos!";
      } else if (diffDias === 1) {
        template = ag.confirmacao_template_vespera || "Olá {nome}, passando para confirmar seu agendamento de amanhã às {horario}. Podemos contar com sua presença?";
      } else {
        template = `Olá {nome}, seu agendamento de {tipo} está marcado para {data} às {horario}. Faltam ${diffDias} dias!`;
      }

      const texto = template
        .replace(/\{nome\}/g, primeiroNome)
        .replace(/\{nome_completo\}/g, conv.contato_nome || "")
        .replace(/\{horario\}/g, horario)
        .replace(/\{data\}/g, dataFormatada)
        .replace(/\{tipo\}/g, conv.evento_tipo || "procedimento");

      // Enviar via Evolution API
      let evoUrl = ag.evolution_url || "";
      let evoKey = ag.evolution_key || "";
      if (!evoUrl && ag.parent_id) {
        const { data: parent } = await supabase.from("agencias")
          .select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
        if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
      }

      if (!evoUrl || !evoKey || !ag.whatsapp_instancia) continue;

      const destino = conv.contato_jid || conv.contato_numero;
      try {
        const evoRes = await fetch(`${evoUrl}/message/sendText/${ag.whatsapp_instancia}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({ number: destino, text: texto }),
        });

        if (evoRes.ok) {
          // Registrar envio
          await supabase.from("confirmacoes_agendamento").insert({
            conversa_id: conv.id,
            agencia_id: conv.agencia_id,
            tipo: tipoConfirmacao,
          });

          // Salvar mensagem no banco
          const msgId = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await supabase.from("mensagens").insert({
            conversa_id: conv.id,
            agencia_id: conv.agencia_id,
            mensagem_id: msgId,
            de_mim: true,
            tipo: "text",
            conteudo: texto,
            status: "sent",
            enviada_por_ia: true,
            created_at: new Date().toISOString(),
          });

          await supabase.from("conversas").update({
            ultima_mensagem: texto,
            ultima_mensagem_at: new Date().toISOString(),
          }).eq("id", conv.id);

          enviados++;
          console.log(`[confirmacoes] Enviado ${tipoConfirmacao} para ${conv.contato_nome}`);
        }
      } catch (e: any) {
        console.error(`[confirmacoes] Erro envio ${conv.id}:`, e.message);
      }
    }

    return NextResponse.json({ ok: true, processados: conversas.length, enviados });
  } catch (e: any) {
    console.error("[confirmacoes] Erro:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
