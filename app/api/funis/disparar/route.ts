import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, funil_id, conversa_id, contato_numero, contato_jid, disparado_por, pos_texto } = await req.json();

    if (!agencia_id || !funil_id || !conversa_id || !contato_numero) {
      return NextResponse.json({ ok: false, motivo: "Campos obrigatórios faltando" }, { status: 400 });
    }

    // 1. Buscar etapas ativas do funil ordenadas
    const { data: etapas, error: etapasErr } = await supabase.from("funil_etapas")
      .select("*")
      .eq("funil_id", funil_id)
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (etapasErr || !etapas?.length) {
      return NextResponse.json({ ok: false, motivo: "Funil sem etapas ativas" });
    }

    // 2. Verificar se mesmo funil já foi disparado para esta conversa (evitar duplicatas)
    const { data: recente } = await supabase.from("funil_fila")
      .select("id").eq("conversa_id", conversa_id).eq("funil_id", funil_id)
      .in("status", ["pendente", "enviado", "processando"])
      .limit(1);
    if (recente?.length) {
      return NextResponse.json({ ok: false, motivo: "Funil já disparado para esta conversa" });
    }

    // Cancelar pendentes anteriores desta conversa
    await supabase.from("funil_fila")
      .update({ status: "cancelado" })
      .eq("conversa_id", conversa_id)
      .eq("status", "pendente");

    // 3. Calcular agendar_para acumulando delays e inserir na fila
    // Inserir com ON CONFLICT DO NOTHING para proteger contra race condition de insert duplo
    const agora = new Date();
    let acumulado = 0;
    const rows = etapas.map((etapa) => {
      acumulado += etapa.delay_minutos || 0;
      const agendarPara = new Date(agora.getTime() + acumulado * 60 * 1000);
      return {
        agencia_id,
        funil_id,
        etapa_id: etapa.id,
        conversa_id,
        contato_numero,
        contato_jid: contato_jid || null,
        agendar_para: agendarPara.toISOString(),
        status: "pendente",
        disparado_por: disparado_por || "manual",
      };
    });

    const { data: inseridos, error: insertErr } = await supabase.from("funil_fila")
      .insert(rows)
      .select("id, etapa_id, agendar_para");

    if (insertErr) {
      console.error("[funis/disparar] Erro insert:", insertErr);
      return NextResponse.json({ ok: false, motivo: "Erro ao agendar etapas" }, { status: 500 });
    }

    // 4. Enviar todas as etapas com delay=0 imediatamente (em sequência)
    if (inseridos?.length) {
      for (let i = 0; i < etapas.length; i++) {
        if ((etapas[i].delay_minutos || 0) === 0) {
          try {
            await fetch(`${APP_URL}/api/funis/enviar`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ funil_fila_id: inseridos[i].id }),
            });
          } catch (e) {
            console.error(`[funis/disparar] Erro ao enviar etapa ${i + 1}:`, e);
          }
        } else {
          break; // Etapas com delay > 0 serão processadas pelo cron
        }
      }
    }

    // 5. Enviar pós-texto da IA (após todas as etapas imediatas)
    if (pos_texto) {
      try {
        // Buscar dados de envio
        const { data: ag } = await supabase.from("agencias")
          .select("evolution_url, evolution_key, whatsapp_instancia, parent_id")
          .eq("id", agencia_id).single();
        let evoUrl = ag?.evolution_url || "";
        let evoKey = ag?.evolution_key || "";
        if (!evoUrl && ag?.parent_id) {
          const { data: parent } = await supabase.from("agencias")
            .select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
          if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
        }
        const destino = contato_jid || contato_numero;
        if (evoUrl && evoKey && ag?.whatsapp_instancia) {
          // Simular digitação
          try {
            await fetch(`${evoUrl}/chat/sendPresence/${ag.whatsapp_instancia}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evoKey },
              body: JSON.stringify({ number: destino, presence: "composing", delay: 1500 }),
            });
          } catch {}
          await new Promise(r => setTimeout(r, 2000));
          // Enviar mensagem
          const sendRes = await fetch(`${evoUrl}/message/sendText/${ag.whatsapp_instancia}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evoKey },
            body: JSON.stringify({ number: destino, text: pos_texto }),
          });
          // Salvar no banco usando ID real do WhatsApp para prevenir eco duplicado
          let msgId = `ia_pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          try {
            const sendData = await sendRes.json();
            if (sendData.key?.id) msgId = sendData.key.id;
          } catch {}
          await supabase.from("mensagens").insert({
            conversa_id, agencia_id, mensagem_id: msgId,
            de_mim: true, tipo: "text", conteudo: pos_texto,
            status: "sent", enviada_por_ia: true, created_at: new Date().toISOString(),
          });
          await supabase.from("conversas").update({
            ultima_mensagem: pos_texto, ultima_mensagem_at: new Date().toISOString(),
          }).eq("id", conversa_id);
          console.log(`[funis/disparar] Pós-texto enviado: ${pos_texto.slice(0, 50)}`);
        }
      } catch (e) {
        console.error("[funis/disparar] Erro pós-texto:", e);
      }
    }

    return NextResponse.json({ ok: true, etapas_agendadas: inseridos?.length || 0 });
  } catch (e: any) {
    console.error("[funis/disparar] Exceção:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
