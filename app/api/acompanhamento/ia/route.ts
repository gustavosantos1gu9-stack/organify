import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { INSTRUCOES_PADRAO } from "@/lib/metodologia";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const maxDuration = 60;

// Chave e modelo de IA da agência (ou da agência mãe). A chave nunca sai do servidor.
async function credencialIA(agenciaId: string) {
  const { data: ag } = await supabase.from("agencias").select("openai_key, openai_modelo, parent_id").eq("id", agenciaId).single();
  let key: string = (ag as any)?.openai_key || "";
  let modelo: string = (ag as any)?.openai_modelo || "";
  if (!key && (ag as any)?.parent_id) {
    const { data: pai } = await supabase.from("agencias").select("openai_key, openai_modelo").eq("id", (ag as any).parent_id).single();
    key = (pai as any)?.openai_key || "";
    modelo = modelo || (pai as any)?.openai_modelo || "";
  }
  return { key, modelo };
}

async function chamarIA(key: string, modeloAgencia: string, tarefa: "organizar" | "mensagem", sistema: string, usuario: string) {
  if (key.startsWith("sk-ant-")) {
    // Haiku para organizar texto; Sonnet para mensagem. Se o modelo não existir na conta, cai para o da agência.
    const preferidos = tarefa === "organizar"
      ? ["claude-haiku-5-5", "claude-haiku-4-5-20251001"]
      : ["claude-sonnet-5-5", "claude-sonnet-4-5", "claude-haiku-4-5-20251001"];
    if (modeloAgencia) preferidos.push(modeloAgencia);
    let ultimoErro = "";
    for (const model of preferidos) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, system: sistema, messages: [{ role: "user", content: usuario }], max_tokens: 900, temperature: 0.4 }),
        signal: AbortSignal.timeout(45000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return (j?.content?.[0]?.text as string) || "";
      ultimoErro = j?.error?.message || `HTTP ${r.status}`;
      if (r.status !== 404 && !/model/i.test(ultimoErro)) break;
    }
    throw new Error(ultimoErro || "Falha na IA");
  }
  // OpenAI
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modeloAgencia && !modeloAgencia.startsWith("claude") ? modeloAgencia : "gpt-4o-mini",
      messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
      temperature: 0.4, max_tokens: 900,
    }),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return (j?.choices?.[0]?.message?.content as string) || "";
}

export async function POST(req: NextRequest) {
  try {
    // Só usuário logado
    const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (!jwt) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const body = await req.json() as { acao: string; agencia_id: string; texto?: string; contexto?: Record<string, unknown> };
    if (!body.agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });

    const { key, modelo } = await credencialIA(body.agencia_id);
    if (!key) return NextResponse.json({ error: "A agência não tem chave de IA cadastrada (Configurações → Secretária IA)." }, { status: 400 });

    const { data: cfg } = await supabase.from("acomp_config").select("instrucoes").eq("agencia_id", body.agencia_id).maybeSingle();
    const instrucoes = (cfg as any)?.instrucoes || INSTRUCOES_PADRAO;
    const hoje = new Date().toISOString().slice(0, 10);

    if (body.acao === "organizar") {
      const sistema = `${instrucoes}

Sua tarefa agora: organizar a anotação livre do gestor ou da CS sobre uma cliente.
Responda SOMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{"tipo":"atendimento|preco_oferta|publico|criativo|campanha|onboarding|dados|outro","feito":"o que foi feito","pendencia":"o que ficou pendente ou vazio","proximo_passo":"próxima ação concreta","reavaliar_em":"AAAA-MM-DD"}
Hoje é ${hoje}. Se a anotação não disser quando reavaliar, use o lote mínimo da metodologia (ajuste de atendimento/oferta: 7 dias; tráfego: 3 a 5 dias).`;
      const saida = await chamarIA(key, modelo, "organizar", sistema, body.texto || "");
      const m = saida.match(/\{[\s\S]*\}/);
      let json: any = {};
      try { json = JSON.parse(m ? m[0] : saida); } catch { json = { tipo: "outro", feito: body.texto || "", pendencia: "", proximo_passo: "", reavaliar_em: null }; }
      return NextResponse.json({ organizado: json });
    }

    if (body.acao === "mensagem") {
      const sistema = `${instrucoes}

Sua tarefa agora: escrever a mensagem semanal para o grupo de WhatsApp da cliente (o grupo tem a cliente, o Gustavo, a gestora de tráfego e a CS).
Estrutura: cumprimento curto pelo primeiro nome; em que fase ela está; os números da semana que importam; o que nós vamos fazer; o que ela precisa fazer; quando vamos reavaliar.
Máximo 8 linhas, tom de parceria, sem travessão, no máximo 1 emoji. Use os números do contexto; não invente números.`;
      const saida = await chamarIA(key, modelo, "mensagem", sistema, `Contexto da cliente (JSON):\n${JSON.stringify(body.contexto || {}, null, 2)}`);
      return NextResponse.json({ texto: saida.trim() });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[acompanhamento/ia]", msg);
    return NextResponse.json({ error: "Não foi possível falar com a IA agora: " + msg.slice(0, 160) }, { status: 500 });
  }
}
