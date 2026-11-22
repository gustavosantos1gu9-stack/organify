import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, instancia } = await req.json();
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });

    // Buscar config da agência (ou da mãe)
    const { data: ag } = await supabase
      .from("agencias")
      .select("evolution_url, evolution_key, whatsapp_instancia, parent_id")
      .eq("id", agencia_id)
      .single();

    if (!ag) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });

    let evoUrl = ag.evolution_url;
    let evoKey = ag.evolution_key;

    if (!evoUrl && ag.parent_id) {
      const { data: parent } = await supabase
        .from("agencias")
        .select("evolution_url, evolution_key")
        .eq("id", ag.parent_id)
        .single();
      if (parent) { evoUrl = parent.evolution_url; evoKey = parent.evolution_key; }
    }

    if (!evoUrl || !evoKey) {
      return NextResponse.json({ error: "Evolution API não configurada" }, { status: 400 });
    }

    const instanciaNome = instancia || ag.whatsapp_instancia;
    if (!instanciaNome) return NextResponse.json({ error: "Instância não encontrada" }, { status: 400 });

    const webhookUrl = `${APP_URL}/api/webhook/whatsapp?secret=${WEBHOOK_SECRET}`;

    const res = await fetch(`${evoUrl}/webhook/set/${instanciaNome}`, {
      method: "POST",
      headers: { apikey: evoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || "Erro ao configurar webhook" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, instancia: instanciaNome, webhookUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
