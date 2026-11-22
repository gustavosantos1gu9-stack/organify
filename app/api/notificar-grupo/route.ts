import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatarTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  const s = d.startsWith("55") ? d.slice(2) : d;
  if (s.length === 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`;
  return tel;
}

function linkWhatsApp(tel: string): string {
  const d = tel.replace(/\D/g, "");
  const norm = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${norm}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agencia_id, titulo, campos, telefone, cliente_externo_id } = body;

    if (!agencia_id || !campos?.length) {
      return NextResponse.json({ ok: false, motivo: "Dados incompletos" });
    }

    // Se cliente_externo_id, notificar o WhatsApp do cliente usando Evolution master
    if (cliente_externo_id) {
      const { data: clienteExt } = await supabase.from("clientes_externos")
        .select("whatsapp_notificacao, agencia_id")
        .eq("id", cliente_externo_id).single();

      if (clienteExt?.whatsapp_notificacao) {
        const { data: master } = await supabase.from("agencias")
          .select("evolution_url, evolution_key, whatsapp_instancia")
          .is("parent_id", null)
          .single();

        if (master?.evolution_url && master?.evolution_key && master?.whatsapp_instancia) {
          const linhasCampos = campos
            .filter((c: any) => c.valor?.toString().trim())
            .map((c: any) => `▪ *${c.label}:* ${c.valor}`)
            .join("\n");
          const linkWA = telefone ? `\n\n💬 ${linkWhatsApp(telefone)}` : "";
          const telFormatado = telefone ? ` — ${formatarTelefone(telefone)}` : "";
          const mensagem = `🔔 *Novo Lead${titulo ? ` — ${titulo}` : ""}*${telFormatado}\n\n${linhasCampos}${linkWA}`;

          const numero = clienteExt.whatsapp_notificacao.replace(/\D/g, "");
          const numNorm = numero.startsWith("55") ? numero : `55${numero}`;

          const res = await fetch(`${master.evolution_url}/message/sendText/${master.whatsapp_instancia}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: master.evolution_key },
            body: JSON.stringify({ number: numNorm, text: mensagem }),
          });

          if (!res.ok) {
            const err = await res.text();
            console.error("[notificar-grupo] Erro Evolution cliente externo:", err);
            return NextResponse.json({ ok: false, motivo: "Erro ao enviar WhatsApp para cliente" });
          }

          console.log(`[notificar-grupo] Notificação enviada para cliente externo (${clienteExt.whatsapp_notificacao})`);
          return NextResponse.json({ ok: true });
        }
      }
    }

    // Buscar config da agência (Evolution + grupo)
    const { data: ag } = await supabase.from("agencias")
      .select("evolution_url, evolution_key, whatsapp_instancia, parent_id, grupo_notificacao_jid, nome")
      .eq("id", agencia_id).single();

    if (!ag) return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });

    // Fallback para parent se filha não tiver Evolution configurada
    let evoUrl = ag.evolution_url || "";
    let evoKey = ag.evolution_key || "";
    let instancia = ag.whatsapp_instancia || "";
    let grupoJid = ag.grupo_notificacao_jid || "";

    if ((!evoUrl || !grupoJid) && ag.parent_id) {
      const { data: parent } = await supabase.from("agencias")
        .select("evolution_url, evolution_key, whatsapp_instancia, grupo_notificacao_jid")
        .eq("id", ag.parent_id).single();
      if (parent) {
        evoUrl = evoUrl || parent.evolution_url || "";
        evoKey = evoKey || parent.evolution_key || "";
        instancia = instancia || parent.whatsapp_instancia || "";
        grupoJid = grupoJid || parent.grupo_notificacao_jid || "";
      }
    }

    if (!evoUrl || !evoKey || !instancia || !grupoJid) {
      return NextResponse.json({ ok: false, motivo: "Evolution ou grupo não configurados" });
    }

    // Montar mensagem
    const linhasCampos = campos
      .filter((c: any) => c.valor?.toString().trim())
      .map((c: any) => `▪ *${c.label}:* ${c.valor}`)
      .join("\n");

    const linkWA = telefone ? `\n\n💬 ${linkWhatsApp(telefone)}` : "";
    const telFormatado = telefone ? ` — ${formatarTelefone(telefone)}` : "";

    const mensagem = `🔔 *Novo Lead${titulo ? ` — ${titulo}` : ""}*${telFormatado}\n\n${linhasCampos}${linkWA}`;

    // Enviar para o grupo via Evolution
    const res = await fetch(`${evoUrl}/message/sendText/${instancia}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({ number: grupoJid, text: mensagem }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[notificar-grupo] Erro Evolution:", err);
      return NextResponse.json({ ok: false, motivo: "Erro ao enviar WhatsApp" });
    }

    console.log(`[notificar-grupo] Notificação enviada para grupo (agencia: ${agencia_id})`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[notificar-grupo] Exceção:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
