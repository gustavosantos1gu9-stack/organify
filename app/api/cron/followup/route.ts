import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const agora = new Date();
    const cutoff2h  = new Date(agora.getTime() - 2  * 60 * 60 * 1000).toISOString();
    const cutoff4h  = new Date(agora.getTime() - 4  * 60 * 60 * 1000).toISOString();

    // 1. Buscar agências com follow-up ativo
    const { data: agencias } = await supabase.from("agencias")
      .select("id, openai_horario_inicio, openai_horario_fim")
      .eq("followup_ativo", true)
      .eq("openai_ativo", true);

    if (!agencias?.length) return NextResponse.json({ ok: true, processados: 0 });

    // Horário BR atual para checar janela de funcionamento
    const brTime = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hhmm = `${String(brTime.getHours()).padStart(2, "0")}:${String(brTime.getMinutes()).padStart(2, "0")}`;

    let totalEnviados = 0;
    let totalErros = 0;

    for (const ag of agencias) {
      // Verificar horário de funcionamento desta agência
      if (ag.openai_horario_inicio && ag.openai_horario_fim) {
        if (hhmm < ag.openai_horario_inicio || hhmm > ag.openai_horario_fim) continue;
      }

      // 2a. Candidatos T1 — fase recebeu_horarios: follow-up em 2h
      const { data: t1Horarios } = await supabase.from("conversas")
        .select("id, agencia_id, contato_numero, contato_jid, fase_atendimento, followup_count, fase_atualizada_em, followup_ultimo_at, fechamento_adiamento_em")
        .eq("agencia_id", ag.id)
        .eq("ia_ativada", true)
        .is("agendou_at", null)
        .is("finalizado_at", null)
        .eq("fase_atendimento", "recebeu_horarios")
        .eq("followup_count", 0)
        .lt("fase_atualizada_em", cutoff2h)
        .limit(20);

      // 2b. Candidatos T1 — demais fases: follow-up em 4h
      //     Fase "adiou" excluída aqui: exige checagem extra de fechamento_adiamento_em (BLOCO 3.2)
      const { data: t1Outros } = await supabase.from("conversas")
        .select("id, agencia_id, contato_numero, contato_jid, fase_atendimento, followup_count, fase_atualizada_em, followup_ultimo_at, fechamento_adiamento_em")
        .eq("agencia_id", ag.id)
        .eq("ia_ativada", true)
        .is("agendou_at", null)
        .is("finalizado_at", null)
        .not("fase_atendimento", "is", null)
        .neq("fase_atendimento", "agendou")
        .neq("fase_atendimento", "recebeu_horarios")
        .neq("fase_atendimento", "adiou")
        .eq("followup_count", 0)
        .lt("fase_atualizada_em", cutoff4h)
        .limit(20);

      // 2c. Candidatos T1 — fase "adiou": requer 24h desde fechamento_adiamento_em (BLOCO 3.2)
      const cutoff24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: t1Adiou } = await supabase.from("conversas")
        .select("id, agencia_id, contato_numero, contato_jid, fase_atendimento, followup_count, fase_atualizada_em, followup_ultimo_at, fechamento_adiamento_em")
        .eq("agencia_id", ag.id)
        .eq("ia_ativada", true)
        .is("agendou_at", null)
        .is("finalizado_at", null)
        .eq("fase_atendimento", "adiou")
        .eq("followup_count", 0)
        .lt("fase_atualizada_em", cutoff4h)
        .or(`fechamento_adiamento_em.is.null,fechamento_adiamento_em.lt.${cutoff24h}`)
        .limit(20);

      const t1 = [...(t1Horarios || []), ...(t1Outros || []), ...(t1Adiou || [])];

      // 3. Candidatos T2: followup_count=1 E T1 foi enviado há pelo menos 20h
      //    Usa followup_ultimo_at (quando T1 foi enviado) em vez de fase_atualizada_em
      //    para garantir intervalo mínimo entre T1 e T2, mesmo que T1 tenha sido
      //    atrasado pelo horário de funcionamento
      const cutoff20h = new Date(agora.getTime() - 20 * 60 * 60 * 1000).toISOString();
      const { data: t2 } = await supabase.from("conversas")
        .select("id, agencia_id, contato_numero, contato_jid, fase_atendimento, followup_count, fase_atualizada_em, followup_ultimo_at, fechamento_adiamento_em")
        .eq("agencia_id", ag.id)
        .eq("ia_ativada", true)
        .is("agendou_at", null)
        .is("finalizado_at", null)
        .not("fase_atendimento", "is", null)
        .neq("fase_atendimento", "agendou")
        .eq("followup_count", 1)
        .lt("followup_ultimo_at", cutoff20h)
        .limit(20);

      const candidatos = [
        ...(t1 || []).map(c => ({ ...c, tentativa: 1 })),
        ...(t2 || []).map(c => ({ ...c, tentativa: 2 })),
      ];

      for (const conv of candidatos) {
        try {
          // 4. Verificar silêncio real: lead não respondeu após a última mensagem da IA
          const { data: ultimaIA } = await supabase.from("mensagens")
            .select("created_at")
            .eq("conversa_id", conv.id)
            .eq("enviada_por_ia", true)
            .order("created_at", { ascending: false })
            .limit(1).single();

          if (!ultimaIA) continue; // Sem mensagem da IA ainda

          const { data: respostaLead } = await supabase.from("mensagens")
            .select("id")
            .eq("conversa_id", conv.id)
            .eq("de_mim", false)
            .gt("created_at", ultimaIA.created_at)
            .limit(1);

          if (respostaLead?.length) continue; // Lead respondeu — não disparar

          // BLOCO 2.2 — Secretária humana assumiu: não disparar follow-up
          // Verificar se humano respondeu manualmente após a última mensagem da IA
          const { data: humanoRespondeu } = await supabase.from("mensagens")
            .select("id")
            .eq("conversa_id", conv.id)
            .eq("de_mim", true)
            .eq("enviada_por_ia", false)
            .gt("created_at", ultimaIA.created_at)
            .limit(1);

          if (humanoRespondeu?.length) continue; // Humano assumiu — não disparar

          // 4b. Para T1: verificar se lead estava ativo dentro do período de cutoff
          // Necessário porque fase_atualizada_em não é resetado quando o lead envia mensagens —
          // sem essa checagem, uma conversa ativa pode receber follow-up errôneo
          if (conv.tentativa === 1) {
            const cutoffT1 = conv.fase_atendimento === "recebeu_horarios" ? cutoff2h : cutoff4h;
            const { data: ativoRecente } = await supabase.from("mensagens")
              .select("id")
              .eq("conversa_id", conv.id)
              .eq("de_mim", false)
              .gt("created_at", cutoffT1)
              .limit(1);
            if (ativoRecente?.length) continue; // Lead falou dentro do período — não disparar

            // 4c. Anti-spam: IA já enviou follow-up dentro do mesmo cutoff?
            // Previne re-envio de T1 quando count foi revertido por exceção/timeout
            const { data: iaRecente } = await supabase.from("mensagens")
              .select("id")
              .eq("conversa_id", conv.id)
              .eq("de_mim", true)
              .eq("enviada_por_ia", true)
              .gt("created_at", cutoffT1)
              .limit(1);
            if (iaRecente?.length) continue; // IA já mandou follow-up recente — não disparar
          }

          // 5. Buscar etapa configurada para esta tentativa (ordem = tentativa)
          const { data: etapa } = await supabase.from("followup_etapas")
            .select("id, nome, prompt_ia, texto_template, tipo_mensagem, midia_url, midia_tipo")
            .eq("agencia_id", conv.agencia_id)
            .eq("ativo", true)
            .eq("ordem", conv.tentativa)
            .single();

          if (!etapa) {
            // Fallback: pegar qualquer etapa ativa (a de menor ordem)
            const { data: etapaFallback } = await supabase.from("followup_etapas")
              .select("id")
              .eq("agencia_id", conv.agencia_id)
              .eq("ativo", true)
              .order("ordem", { ascending: true })
              .limit(1).single();
            if (!etapaFallback) continue; // Sem etapas configuradas
          }

          const etapaId = etapa?.id || (await supabase.from("followup_etapas")
            .select("id").eq("agencia_id", conv.agencia_id).eq("ativo", true)
            .order("ordem", { ascending: true }).limit(1).single()).data?.id;

          if (!etapaId) continue;

          // 6. Criar entrada na fila (para log e processamento)
          const { data: filaEntry, error: filaErr } = await supabase.from("followup_fila").insert({
            agencia_id: conv.agencia_id,
            conversa_id: conv.id,
            etapa_id: etapaId,
            contato_numero: conv.contato_numero || "",
            contato_jid: conv.contato_jid || null,
            agendar_para: new Date().toISOString(),
            fase_jornada: conv.fase_atendimento,
            status: "processando",
          }).select("id").single();

          if (filaErr || !filaEntry) {
            console.error("[cron/followup] Erro ao criar fila:", filaErr?.message);
            totalErros++;
            continue;
          }

          // 7. Pré-incrementar followup_count ANTES de chamar enviar
          // Evita race condition onde outro cron inicia antes deste terminar e vê count=0
          await supabase.from("conversas")
            .update({ followup_count: (conv.followup_count || 0) + 1 })
            .eq("id", conv.id);

          // 8. Chamar enviar
          const res = await fetch(`${APP_URL}/api/ai/followup/enviar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              followup_fila_id: filaEntry.id,
              tentativa: conv.tentativa,
            }),
          });
          const data = await res.json();

          if (data.ok) {
            totalEnviados++;
            // Registrar quando foi enviado (usado para calcular intervalo do T2)
            await supabase.from("conversas")
              .update({ followup_ultimo_at: new Date().toISOString() })
              .eq("id", conv.id);
          } else {
            totalErros++;
            // Reverter contador se envio falhou (permite retry no próximo ciclo)
            await supabase.from("conversas")
              .update({ followup_count: conv.followup_count || 0 })
              .eq("id", conv.id);
          }
        } catch (e: any) {
          console.error(`[cron/followup] Erro conversa ${conv.id}:`, e.message);
          totalErros++;
        }
      }
    }

    console.log(`[cron/followup] ${totalEnviados} enviados, ${totalErros} erros`);
    return NextResponse.json({ ok: true, enviados: totalEnviados, erros: totalErros });
  } catch (e: any) {
    console.error("[cron/followup] Exceção:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
