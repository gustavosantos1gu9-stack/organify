import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getEvoConfig(agenciaId?: string) {
  if (!agenciaId) {
    // fallback: pegar primeira agência
    const { data } = await supabase.from("agencias").select("evolution_url,evolution_key,whatsapp_instancia").limit(1).single();
    return data;
  }
  const { data } = await supabase.from("agencias").select("evolution_url,evolution_key,whatsapp_instancia,parent_id").eq("id", agenciaId).single();
  // Se a agência filha não tem Evolution configurada, puxar da mãe
  if (data && !data.evolution_url && data.parent_id) {
    const { data: parent } = await supabase.from("agencias").select("evolution_url,evolution_key,whatsapp_instancia").eq("id", data.parent_id).single();
    if (parent) {
      return { ...data, evolution_url: parent.evolution_url, evolution_key: parent.evolution_key };
    }
  }
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const { action, instanceName, payload, agencia_id } = await req.json();
    const cfg = await getEvoConfig(agencia_id);
    if (!cfg?.evolution_url || !cfg?.evolution_key) {
      return NextResponse.json({ error: "Evolution API não configurada" }, { status: 400 });
    }

    const EVO_URL = cfg.evolution_url;
    const EVO_KEY = cfg.evolution_key;
    const instancia = instanceName || cfg.whatsapp_instancia;

    let url = "";
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "fetchInstances":
        url = `${EVO_URL}/instance/fetchInstances`; method = "GET"; break;
      case "connect":
        url = `${EVO_URL}/instance/connect/${instancia}`; method = "GET"; break;
      case "create":
        url = `${EVO_URL}/instance/create`; method = "POST"; body = JSON.stringify(payload); break;
      case "delete":
        url = `${EVO_URL}/instance/delete/${instancia}`; method = "DELETE"; break;
      case "status":
        url = `${EVO_URL}/instance/connectionState/${instancia}`; method = "GET"; break;
      case "sendText":
        url = `${EVO_URL}/message/sendText/${instancia}`; method = "POST"; body = JSON.stringify(payload); break;
      case "fetchChats":
        url = `${EVO_URL}/chat/findChats/${instancia}`; method = "POST"; body = JSON.stringify(payload || {}); break;
      case "fetchMessages":
        url = `${EVO_URL}/chat/findMessages/${instancia}`; method = "POST"; body = JSON.stringify(payload || {}); break;
      case "setWebhook":
        url = `${EVO_URL}/webhook/set/${instancia}`; method = "POST";
        body = JSON.stringify({ webhook: { ...payload, enabled: true } }); break;
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const res = await fetch(url, {
      method,
      headers: { "apikey": EVO_KEY, "Content-Type": "application/json" },
      ...(body && { body }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch(e) {
    console.error("Evolution API erro:", e);
    return NextResponse.json({ error: "Erro na Evolution API" }, { status: 500 });
  }
}
