import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addRow, getOrCreateMonthSheet, getMesReferencia, updateRow } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseMoney(token: string): number | null {
  // Accepts: 180, 1.800, 1,800, 1.800,50 R$180
  const clean = token.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".");
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getEmojiCategoria(categoria: string): string {
  return categoria === "empresa" ? "🏢" : "🏠";
}

// Parse day from "dia N" token
function parseDia(tokens: string[]): number | null {
  const diaIdx = tokens.indexOf("dia");
  if (diaIdx !== -1 && tokens[diaIdx + 1]) {
    const n = parseInt(tokens[diaIdx + 1]);
    if (!isNaN(n) && n >= 1 && n <= 31) return n;
  }
  return null;
}

// Extract a money value from the token list (first token that is a number)
function extractMoney(tokens: string[]): { valor: number | null; idx: number } {
  for (let i = 0; i < tokens.length; i++) {
    const v = parseMoney(tokens[i]);
    if (v !== null && v > 0) return { valor: v, idx: i };
  }
  return { valor: null, idx: -1 };
}

interface ParsedCommand {
  tipo: "conta" | "gasto" | "receita" | "pagar" | "lista" | "resumo" | "ajuda" | null;
  descricao: string;
  valor: number | null;
  categoria: "empresa" | "pessoal";
  dia_vencimento: number | null;
  criado_por: string;
}

function parseCommand(text: string, senderName: string): ParsedCommand {
  const norm = normalize(text);
  const tokens = norm.split(/\s+/);
  const raw = text.trim();

  // Detect categoria
  const categoria: "empresa" | "pessoal" = norm.includes("empresa") ? "empresa" : "pessoal";

  // Remove "empresa" token from tokens for parsing
  const filteredTokens = tokens.filter((t) => t !== "empresa");

  // ─── lista / contas ──────────────────────────────
  if (["lista", "contas", "pendentes"].includes(filteredTokens[0])) {
    return { tipo: "lista", descricao: "", valor: null, categoria, dia_vencimento: null, criado_por: senderName };
  }

  // ─── resumo / total ──────────────────────────────
  if (["resumo", "total", "saldo"].includes(filteredTokens[0])) {
    return { tipo: "resumo", descricao: "", valor: null, categoria, dia_vencimento: null, criado_por: senderName };
  }

  // ─── ajuda / help ────────────────────────────────
  if (["ajuda", "help", "comandos"].includes(filteredTokens[0])) {
    return { tipo: "ajuda", descricao: "", valor: null, categoria, dia_vencimento: null, criado_por: senderName };
  }

  // ─── paguei [desc] ───────────────────────────────
  if (["paguei", "pago", "pagar"].includes(filteredTokens[0])) {
    const desc = filteredTokens.slice(1).join(" ").replace("empresa", "").trim();
    return { tipo: "pagar", descricao: desc, valor: null, categoria, dia_vencimento: null, criado_por: senderName };
  }

  // ─── recebi / receita [valor] [desc] ─────────────
  if (["recebi", "receita", "entrada"].includes(filteredTokens[0])) {
    const rest = filteredTokens.slice(1);
    const { valor, idx } = extractMoney(rest);
    const desc = rest.filter((_, i) => i !== idx).join(" ").replace("empresa", "").trim();
    return { tipo: "receita", descricao: desc || "Receita", valor, categoria, dia_vencimento: null, criado_por: senderName };
  }

  // ─── gastei / gasto [valor] [desc] ───────────────
  if (["gastei", "gasto", "comprei", "paguei"].includes(filteredTokens[0])) {
    const rest = filteredTokens.slice(1);
    const { valor, idx } = extractMoney(rest);
    const descTokens = rest.filter((_, i) => i !== idx && tokens[i] !== "empresa");
    const desc = descTokens.join(" ").trim();
    return { tipo: "gasto", descricao: desc || "Gasto", valor, categoria, dia_vencimento: null, criado_por: senderName };
  }

  // ─── conta [empresa] [desc] [valor] dia [N] ──────
  if (filteredTokens[0] === "conta") {
    const rest = filteredTokens.slice(1);
    const dia = parseDia(rest);
    // Remove "dia N" from rest
    const withoutDia = rest.filter((t, i) => t !== "dia" && !(rest[i - 1] === "dia"));
    const { valor, idx } = extractMoney(withoutDia);
    const descTokens = withoutDia.filter((_, i) => i !== idx).filter((t) => t !== "empresa");
    const desc = descTokens.join(" ").trim();
    return { tipo: "conta", descricao: desc || "Conta", valor, categoria, dia_vencimento: dia, criado_por: senderName };
  }

  return { tipo: null, descricao: "", valor: null, categoria, dia_vencimento: null, criado_por: senderName };
}

// ─── Evolution API: send message to group ─────────────────────────────────────
async function sendGroupMessage(evolutionUrl: string, evolutionKey: string, instancia: string, grupoJid: string, text: string) {
  const res = await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
    method: "POST",
    headers: {
      apikey: evolutionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: grupoJid,
      text,
    }),
  });
  const data = await res.json();
  if (!res.ok) console.error("[financas] Erro ao enviar msg:", JSON.stringify(data));
  return data;
}

// ─── Main processing (runs in background via waitUntil-like pattern) ──────────
async function processMessage(body: any) {
  try {
    const event = body?.event || body?.type;
    if (!event?.includes("message") && !event?.includes("MESSAGES")) return;

    const data = body?.data || body;
    const key = data?.key || {};
    const isGroup = key?.remoteJid?.includes("@g.us");
    if (!isGroup) return;

    const grupoJid = key.remoteJid;
    const msgContent =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
      "";

    if (!msgContent?.trim()) return;

    // Sender name
    const pushName = data?.pushName || data?.participant || key?.participant || "Desconhecido";
    const senderName = typeof pushName === "string" ? pushName.split(" ")[0] : "Desconhecido";

    // Load config
    const { data: cfg } = await supabase.from("financas_config").select("*").limit(1).single();
    if (!cfg) return;

    // Auto-save group JID on first message
    if (!cfg.grupo_jid) {
      await supabase.from("financas_config").update({ grupo_jid: grupoJid }).eq("id", cfg.id);
      cfg.grupo_jid = grupoJid;
    }

    // Only process messages from the configured group
    if (cfg.grupo_jid && cfg.grupo_jid !== grupoJid) return;

    // Load Evolution credentials from master agency
    const { data: masterAg } = await supabase
      .from("agencias")
      .select("evolution_url,evolution_key")
      .is("parent_id", null)
      .limit(1)
      .single();

    if (!masterAg?.evolution_url || !masterAg?.evolution_key) {
      console.error("[financas] Evolution não configurado");
      return;
    }

    const instancia = cfg.instancia || masterAg.evolution_url; // fallback
    const EVO_URL = masterAg.evolution_url;
    const EVO_KEY = masterAg.evolution_key;

    // Get instance name from config or first instance
    let instanceName = cfg.instancia;
    if (!instanceName) {
      // Try to extract from webhook payload
      instanceName = body?.instance || data?.instance || "default";
    }

    const parsed = parseCommand(msgContent, senderName);
    const mesRef = getMesReferencia();

    // ─── AJUDA ───────────────────────────────────────
    if (parsed.tipo === "ajuda") {
      const helpText = `📖 *Comandos disponíveis*

*Registrar conta a pagar:*
\`conta [desc] [valor] dia [N]\`
\`conta empresa [desc] [valor] dia [N]\`

*Registrar gasto:*
\`gastei [valor] [desc]\`
\`gasto empresa [valor] [desc]\`

*Registrar receita:*
\`recebi [valor] [desc]\`

*Marcar como pago:*
\`paguei [desc]\`

*Listar contas pendentes:*
\`lista\` ou \`contas\`

*Ver resumo do mês:*
\`resumo\` ou \`total\`

_Adicione "empresa" para categoria empresarial._`;
      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, helpText);
      return;
    }

    // ─── LISTA ───────────────────────────────────────
    if (parsed.tipo === "lista") {
      const { data: contas } = await supabase
        .from("financas_lancamentos")
        .select("descricao,valor,dia_vencimento,categoria")
        .eq("tipo", "conta")
        .eq("pago", false)
        .eq("mes_referencia", mesRef)
        .order("dia_vencimento", { ascending: true });

      if (!contas?.length) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, `✅ Nenhuma conta pendente em ${mesRef}!`);
        return;
      }

      const total = contas.reduce((s, c) => s + Number(c.valor), 0);
      const linhas = contas
        .map((c) => `• ${c.descricao} - R$${formatMoney(c.valor)}${c.dia_vencimento ? ` | dia ${c.dia_vencimento}` : ""} ${getEmojiCategoria(c.categoria)}`)
        .join("\n");

      const reply = `📋 *Contas pendentes - ${mesRef}*\n\n${linhas}\n\nTotal: R$${formatMoney(total)}`;
      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, reply);
      return;
    }

    // ─── RESUMO ──────────────────────────────────────
    if (parsed.tipo === "resumo") {
      const { data: lancamentos } = await supabase
        .from("financas_lancamentos")
        .select("tipo,categoria,valor,pago")
        .eq("mes_referencia", mesRef);

      const receitas = (lancamentos || []).filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
      const gastosEmpresa = (lancamentos || []).filter((l) => l.tipo === "gasto" && l.categoria === "empresa").reduce((s, l) => s + Number(l.valor), 0);
      const gastosPessoal = (lancamentos || []).filter((l) => l.tipo === "gasto" && l.categoria === "pessoal").reduce((s, l) => s + Number(l.valor), 0);
      const contasPagas = (lancamentos || []).filter((l) => l.tipo === "conta" && l.pago === true).reduce((s, l) => s + Number(l.valor), 0);
      const contasPendentes = (lancamentos || []).filter((l) => l.tipo === "conta" && l.pago === false).reduce((s, l) => s + Number(l.valor), 0);
      const saldo = receitas - gastosEmpresa - gastosPessoal - contasPagas - contasPendentes;

      const reply = `📊 *Resumo - ${mesRef}*

💰 Receitas: R$${formatMoney(receitas)}
🏢 Gastos empresa: R$${formatMoney(gastosEmpresa)}
🏠 Gastos pessoais: R$${formatMoney(gastosPessoal)}
📄 Contas pagas: R$${formatMoney(contasPagas)}
⏳ Contas pendentes: R$${formatMoney(contasPendentes)}

Saldo estimado: ${saldo >= 0 ? "+" : ""}R$${formatMoney(saldo)} (receitas - tudo)`;

      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, reply);
      return;
    }

    // ─── PAGAR ───────────────────────────────────────
    if (parsed.tipo === "pagar") {
      const desc = parsed.descricao;
      const { data: contas } = await supabase
        .from("financas_lancamentos")
        .select("id,descricao,valor,sheets_row")
        .eq("tipo", "conta")
        .eq("pago", false)
        .eq("mes_referencia", mesRef)
        .ilike("descricao", `%${desc}%`)
        .order("criado_em", { ascending: false })
        .limit(1);

      if (!contas?.length) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, `❌ Conta "${desc}" não encontrada em ${mesRef}.`);
        return;
      }

      const conta = contas[0];
      await supabase
        .from("financas_lancamentos")
        .update({ pago: true, pago_at: new Date().toISOString() })
        .eq("id", conta.id);

      // Update Sheets row if available
      if (cfg.google_refresh_token && cfg.spreadsheet_id && conta.sheets_row) {
        await updateRow(cfg.google_refresh_token, cfg.spreadsheet_id, mesRef, conta.sheets_row, [
          null, null, null, null, null, null, null, "SIM",
        ]);
      }

      const reply = `✅ *${conta.descricao}* marcada como paga! ✓\nR$${formatMoney(conta.valor)}`;
      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, reply);
      return;
    }

    // ─── CONTA / GASTO / RECEITA ─────────────────────
    if (parsed.tipo && ["conta", "gasto", "receita"].includes(parsed.tipo)) {
      if (!parsed.valor) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, `❌ Não encontrei o valor. Tente: \`${parsed.tipo} [desc] [valor]\``);
        return;
      }

      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      const { data: inserted } = await supabase
        .from("financas_lancamentos")
        .insert({
          descricao: parsed.descricao,
          tipo: parsed.tipo,
          categoria: parsed.categoria,
          valor: parsed.valor,
          dia_vencimento: parsed.dia_vencimento,
          data_lancamento: today,
          mes_referencia: mesRef,
          criado_por: parsed.criado_por,
        })
        .select("id")
        .single();

      // Save to Google Sheets
      let sheetsRow: number | null = null;
      if (cfg.google_refresh_token && cfg.spreadsheet_id) {
        await getOrCreateMonthSheet(cfg.google_refresh_token, cfg.spreadsheet_id, mesRef);
        sheetsRow = await addRow(cfg.google_refresh_token, cfg.spreadsheet_id, mesRef, [
          today,
          parsed.criado_por,
          parsed.descricao,
          parsed.tipo,
          parsed.categoria,
          parsed.valor,
          parsed.dia_vencimento || "",
          "NÃO",
        ]);

        if (inserted?.id && sheetsRow) {
          await supabase
            .from("financas_lancamentos")
            .update({ sheets_row: sheetsRow })
            .eq("id", inserted.id);
        }
      }

      // Build reply
      let reply = "";
      if (parsed.tipo === "conta") {
        reply = `✅ *${parsed.descricao}* registrada\nR$${formatMoney(parsed.valor)}${parsed.dia_vencimento ? ` | Vence dia ${parsed.dia_vencimento}` : ""} | ${parsed.categoria === "empresa" ? "Empresa 🏢" : "Pessoal 🏠"}`;
      } else if (parsed.tipo === "gasto") {
        reply = `✅ *Gasto* registrado\nR$${formatMoney(parsed.valor)} - ${parsed.descricao} | ${parsed.categoria === "empresa" ? "Empresa 🏢" : "Pessoal 🏠"}`;
      } else if (parsed.tipo === "receita") {
        reply = `✅ *Receita* registrada\nR$${formatMoney(parsed.valor)} - ${parsed.descricao}`;
      }

      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, reply);
      return;
    }

    // Unknown command
    await sendGroupMessage(
      EVO_URL,
      EVO_KEY,
      instanceName,
      grupoJid,
      `❌ Não entendi. Digite *ajuda* para ver os comandos.`
    );
  } catch (e) {
    console.error("[financas webhook] Erro no processamento:", e);
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Process in background — respond immediately
  processMessage(body).catch((e) => console.error("[financas webhook] Background error:", e));

  return NextResponse.json({ ok: true });
}

// Allow GET for webhook verification
export async function GET() {
  return NextResponse.json({ ok: true, webhook: "financas" });
}
