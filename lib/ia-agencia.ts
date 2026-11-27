import { SupabaseClient } from "@supabase/supabase-js";

// Chave e modelo de IA da agência (ou da agência mãe). A chave nunca sai do servidor.
export async function credencialIA(supabase: SupabaseClient, agenciaId: string) {
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

/** Chamada barata que devolve JSON. Usa o mesmo modelo da agência (OpenAI) ou o Haiku (Anthropic). */
export async function iaJson(key: string, modeloAgencia: string, sistema: string, usuario: string, maxTokens = 1800): Promise<{ json: any; modelo: string }> {
  if (key.startsWith("sk-ant-")) {
    const modelos = ["claude-haiku-4-5-20251001", ...(modeloAgencia ? [modeloAgencia] : [])];
    for (const model of modelos) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, system: sistema + "\nResponda SOMENTE com um objeto JSON válido.", messages: [{ role: "user", content: usuario }], max_tokens: maxTokens, temperature: 0.2 }),
        signal: AbortSignal.timeout(55000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) throw new Error("CHAVE_INVALIDA");
      if (r.ok) {
        const txt: string = j?.content?.[0]?.text || "";
        return { json: JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)), modelo: model };
      }
      if (r.status !== 404) break;
    }
    throw new Error("Falha na IA");
  }
  const model = modeloAgencia && !modeloAgencia.startsWith("claude") ? modeloAgencia : "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.2, max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
    }),
    signal: AbortSignal.timeout(55000),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new Error("CHAVE_INVALIDA");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { json: JSON.parse(j?.choices?.[0]?.message?.content || "{}"), modelo: model };
}
