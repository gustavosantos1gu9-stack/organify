import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { agencia_id } = await req.json();

    let { data: agencia } = await supabase.from("agencias")
      .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, parent_id")
      .eq("id", agencia_id).single();

    if (agencia && !agencia.evolution_url && agencia.parent_id) {
      const { data: parent } = await supabase.from("agencias")
        .select("evolution_url, evolution_key").eq("id", agencia.parent_id).single();
      if (parent) agencia = { ...agencia, evolution_url: parent.evolution_url, evolution_key: parent.evolution_key };
    }

    if (!agencia?.evolution_url) return NextResponse.json({ error: "Não configurado" }, { status: 400 });

    const EVO_URL = agencia.evolution_url;
    const EVO_KEY = agencia.evolution_key;
    const INST = agencia.whatsapp_instancia;
    const MEU = (agencia.whatsapp_numero || "").replace(/\D/g, "");

    // Buscar chats
    const resChats = await fetch(`${EVO_URL}/chat/findChats/${INST}`, {
      method: "POST", headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const chatsRaw = await resChats.json().catch(() => []);
    const chatList = Array.isArray(chatsRaw) ? chatsRaw : [];

    // Classificar
    let grupos = 0, broadcasts = 0, individuais = 0, lids = 0, lidsSemNumero = 0, filtrados = 0, meuNumero = 0, curtos = 0;

    for (const chat of chatList) {
      const jid = chat.remoteJid || chat.id || "";
      if (jid.includes("@g.us")) { grupos++; continue; }
      if (jid.includes("@broadcast") || jid === "status@broadcast") { broadcasts++; continue; }

      if (jid.includes("@lid")) {
        lids++;
        const alt = chat.lastMessage?.key?.remoteJidAlt || chat.participant || "";
        if (typeof alt !== "string" || !alt.includes("@s.whatsapp.net")) {
          lidsSemNumero++;
          continue;
        }
        const numero = alt.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        if (!numero || numero === MEU) { meuNumero++; continue; }
        if (numero.length < 8 || numero.length > 15) { curtos++; continue; }
        individuais++;
        continue;
      }

      if (jid.includes("@s.whatsapp.net")) {
        const numero = jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        if (!numero || numero === MEU) { meuNumero++; continue; }
        if (numero.length < 8 || numero.length > 15) { curtos++; continue; }
        individuais++;
        continue;
      }

      filtrados++;
    }

    // Contar no banco
    const { count: conversasBanco } = await supabase.from("conversas")
      .select("id", { count: "exact", head: true }).eq("agencia_id", agencia.id);
    const { count: mensagensBanco } = await supabase.from("mensagens")
      .select("id", { count: "exact", head: true }).eq("agencia_id", agencia.id);

    return NextResponse.json({
      evolution: {
        total_chats: chatList.length,
        grupos,
        broadcasts,
        individuais_validos: individuais,
        lids_total: lids,
        lids_sem_numero: lidsSemNumero,
        meu_numero_filtrado: meuNumero,
        numeros_curtos: curtos,
        outros_filtrados: filtrados,
      },
      banco: {
        conversas: conversasBanco,
        mensagens: mensagensBanco,
      },
      meu_numero: MEU || "(não configurado)",
      instancia: INST,
    });
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
