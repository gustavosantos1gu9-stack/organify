import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { funil_fila_id } = await req.json();
    if (!funil_fila_id) return NextResponse.json({ ok: false, motivo: "ID obrigatório" });

    // 1. Buscar item da fila + etapa
    const { data: fila } = await supabase.from("funil_fila")
      .select("*, etapa:funil_etapas(*)")
      .eq("id", funil_fila_id).single();

    if (!fila) return NextResponse.json({ ok: false, motivo: "Item não encontrado" });
    if (fila.status !== "pendente") return NextResponse.json({ ok: false, motivo: "Já processado" });

    const etapa = fila.etapa;
    if (!etapa) return NextResponse.json({ ok: false, motivo: "Etapa não encontrada" });

    // 2. Buscar config da agência
    const { data: ag } = await supabase.from("agencias").select(
      "evolution_url, evolution_key, whatsapp_instancia, parent_id, nome"
    ).eq("id", fila.agencia_id).single();

    if (!ag) {
      await marcarErro(funil_fila_id, "Agência não encontrada");
      return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });
    }

    // 3. Verificar se lead respondeu desde o agendamento
    const { data: respostas } = await supabase.from("mensagens")
      .select("id").eq("conversa_id", fila.conversa_id).eq("de_mim", false)
      .gt("created_at", fila.created_at).limit(1);

    if (respostas?.length) {
      await supabase.from("funil_fila").update({ status: "cancelado" }).eq("id", funil_fila_id);
      return NextResponse.json({ ok: false, motivo: "Lead respondeu, cancelado" });
    }

    // 4. Verificar se humano respondeu manualmente
    const { data: humanas } = await supabase.from("mensagens")
      .select("id").eq("conversa_id", fila.conversa_id).eq("de_mim", true).eq("enviada_por_ia", false)
      .gt("created_at", fila.created_at).limit(1);

    if (humanas?.length) {
      await supabase.from("funil_fila").update({ status: "cancelado" }).eq("id", funil_fila_id);
      return NextResponse.json({ ok: false, motivo: "Humano assumiu, cancelado" });
    }

    // 5. Resolver Evolution API config (herdar do parent se necessário)
    let evoUrl = ag.evolution_url || "";
    let evoKey = ag.evolution_key || "";
    if (!evoUrl && ag.parent_id) {
      const { data: parent } = await supabase.from("agencias").select("evolution_url, evolution_key").eq("id", ag.parent_id).single();
      if (parent) { evoUrl = parent.evolution_url || ""; evoKey = parent.evolution_key || ""; }
    }

    if (!evoUrl || !evoKey || !ag.whatsapp_instancia) {
      await marcarErro(funil_fila_id, "WhatsApp não configurado");
      return NextResponse.json({ ok: false, motivo: "WhatsApp não configurado" });
    }

    // 6. Enviar via Evolution API baseado no tipo_conteudo
    const destino = fila.contato_jid || fila.contato_numero;
    const tipo = etapa.tipo_conteudo || "text";
    let evoRes: Response;
    let textoEnviado = etapa.texto || "";

    if (tipo === "text") {
      if (!etapa.texto) {
        await marcarErro(funil_fila_id, "Etapa de texto sem conteúdo");
        return NextResponse.json({ ok: false, motivo: "Sem conteúdo" });
      }
      evoRes = await fetch(`${evoUrl}/message/sendText/${ag.whatsapp_instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: destino, text: etapa.texto }),
      });
    } else if (tipo === "image" || tipo === "video") {
      if (!etapa.midia_url) {
        await marcarErro(funil_fila_id, `Etapa de ${tipo} sem mídia`);
        return NextResponse.json({ ok: false, motivo: "Sem mídia" });
      }
      evoRes = await fetch(`${evoUrl}/message/sendMedia/${ag.whatsapp_instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          number: destino,
          mediatype: tipo,
          media: etapa.midia_url,
          caption: etapa.texto || "",
        }),
      });
    } else if (tipo === "audio") {
      if (!etapa.midia_url) {
        await marcarErro(funil_fila_id, "Etapa de audio sem mídia");
        return NextResponse.json({ ok: false, motivo: "Sem mídia" });
      }
      // Se tem texto, enviar como mensagem separada antes do áudio
      if (etapa.texto) {
        await fetch(`${evoUrl}/message/sendText/${ag.whatsapp_instancia}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({ number: destino, text: etapa.texto }),
        });
      }
      evoRes = await fetch(`${evoUrl}/message/sendMedia/${ag.whatsapp_instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          number: destino,
          mediatype: "audio",
          media: etapa.midia_url,
        }),
      });
    } else {
      await marcarErro(funil_fila_id, `Tipo de conteúdo desconhecido: ${tipo}`);
      return NextResponse.json({ ok: false, motivo: "Tipo desconhecido" });
    }

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      console.error("[funis/enviar] Erro Evolution:", errText);
      await marcarErro(funil_fila_id, `Evolution ${evoRes.status}`);
      return NextResponse.json({ ok: false, motivo: "Erro ao enviar" });
    }

    // 7. Salvar mensagem no banco
    const evoData = await evoRes.json();
    const msgId = evoData.key?.id || `funil_${Date.now()}`;
    const conteudoSalvo = etapa.texto || `[${tipo}]`;

    await supabase.from("mensagens").insert({
      conversa_id: fila.conversa_id,
      agencia_id: fila.agencia_id,
      mensagem_id: msgId,
      de_mim: true,
      tipo: etapa.midia_url ? tipo : "text",
      conteudo: conteudoSalvo,
      midia_url: etapa.midia_url || null,
      status: "sent",
      enviada_por_ia: true,
      funil_id: fila.funil_id,
      created_at: new Date().toISOString(),
    });

    // 8. Atualizar conversa
    await supabase.from("conversas").update({
      ultima_mensagem: conteudoSalvo,
      ultima_mensagem_at: new Date().toISOString(),
    }).eq("id", fila.conversa_id);

    // 9. Marcar como enviado
    await supabase.from("funil_fila").update({
      status: "enviado",
      enviado_at: new Date().toISOString(),
    }).eq("id", funil_fila_id);

    console.log(`[funis/enviar] Enviado etapa ${etapa.ordem} (${tipo}) para ${destino}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[funis/enviar] Exceção:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

async function marcarErro(id: string, erro: string) {
  await supabase.from("funil_fila").update({ status: "erro", erro }).eq("id", id);
}
