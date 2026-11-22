import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMesReferencia } from "@/lib/google-sheets";

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  return d.access_token || null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// ─── Tab names ────────────────────────────────────────────────────────────────
const TAB_FAMILIA  = "🏠 Família";
const TAB_EMPRESA  = "🏢 Empresa";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseMoney(token: string): number | null {
  const clean = token.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".");
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDia(tokens: string[]): number | null {
  const diaIdx = tokens.indexOf("dia");
  if (diaIdx !== -1 && tokens[diaIdx + 1]) {
    const n = parseInt(tokens[diaIdx + 1]);
    if (!isNaN(n) && n >= 1 && n <= 31) return n;
  }
  return null;
}

function extractMoney(tokens: string[]): { valor: number | null; idx: number } {
  for (let i = 0; i < tokens.length; i++) {
    const v = parseMoney(tokens[i]);
    if (v !== null && v > 0) return { valor: v, idx: i };
  }
  return { valor: null, idx: -1 };
}

// ─── Categoria detection (maps to spreadsheet categories) ─────────────────────
function detectCategoria(descricao: string, tipo_conta: "empresa" | "pessoal"): string {
  const d = normalize(descricao);

  if (tipo_conta === "empresa") {
    if (/meta|google.?ads|trafego|ads|anuncio|campanha|impulsionamento/.test(d)) return "Tráfego Pago";
    if (/vercel|supabase|ferramenta|saas|software|sistema|plataforma|assinatura|notion|slack|openai/.test(d)) return "Ferramentas / SaaS";
    if (/freelancer|equipe|funcionario|salario|colaborador|designer|dev|programador/.test(d)) return "Equipe / Freelancers";
    if (/imposto|das|simples|inss|iss|taxa|tributo|mei/.test(d)) return "Impostos";
    if (/servidor|infraestrutura|hosting|cloud|aws|gcp|digitalocean|vps/.test(d)) return "Infraestrutura";
    if (/contabilidade|contador|contabil/.test(d)) return "Contabilidade";
    if (/marketing|conteudo|design|criativo|social|video|foto/.test(d)) return "Marketing/Conteúdo";
    return "Outros";
  } else {
    if (/ifood|restaurante|lanche|sushi|pizza|hamburguer|delivery|cafe|padaria|bar/.test(d)) return "iFood/Restaurante";
    if (/mercado|supermercado|feira|alimentacao/.test(d)) return "Mercado";
    if (/aluguel|condominio|iptu|moradia|luz|energia|agua|gas|internet|telefone|celular/.test(d)) return "Moradia";
    if (/uber|gasolina|combustivel|onibus|metro|transporte|pedagio|estacionamento|99|posto/.test(d)) return "Transporte";
    if (/medico|consulta|exame|dentista|farmacia|remedio|saude|plano|hospital|clinica/.test(d)) return "Saúde";
    if (/escola|faculdade|curso|educacao|livro|mensalidade|universidade/.test(d)) return "Educação";
    if (/netflix|spotify|amazon|disney|hbo|assinatura|deezer|youtube|prime|globoplay/.test(d)) return "Assinaturas";
    if (/cinema|festa|viagem|hotel|lazer|show|ingresso|passeio/.test(d)) return "Lazer";
    if (/roupa|sapato|vestuario|calcado|tenis|camisa|calca|vestido/.test(d)) return "Vestuário";
    if (/cabeleireiro|barbeiro|salao|estetica|beleza|cuidado|maquiagem|unha/.test(d)) return "Cuidados Pessoais";
    return "Outros";
  }
}

// ─── Append row to sheet ──────────────────────────────────────────────────────
const MESES_PT = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

async function appendToSheet(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  row: { data: string; categoria: string; descricao: string; tipo: string; valor: number; mes: number; ano: number; quem: string }
): Promise<boolean> {
  // Read column A to locate the current month's section in the sheet
  const colRes = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(`'${tabName}'!A:A`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const colData = await colRes.json();
  // Map each row to its cell value (empty rows become "")
  const colValues: string[] = (colData.values || []).map((r: any[]) => r.length > 0 ? String(r[0]) : "");

  const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentMonthName = MESES_PT[brNow.getMonth()]; // e.g. "AGOSTO"

  // Find the row index (0-based) of the current month header
  const monthIdx = colValues.findIndex(v => v.toUpperCase().replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, "").includes(currentMonthName.replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, "")));

  let targetRow: number;

  if (monthIdx === -1) {
    // Month section not found — fall back to appending after all data
    targetRow = colValues.length + 1;
    console.log(`[financas] Seção ${currentMonthName} não encontrada, linha ${targetRow}`);
  } else {
    // Find where the next month section starts
    const nextMonthIdx = colValues.findIndex((v, i) =>
      i > monthIdx && MESES_PT.some(m => v.toUpperCase().replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, "").includes(m.replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, "")))
    );
    const sectionEnd = nextMonthIdx === -1 ? colValues.length : nextMonthIdx; // exclusive, 0-based

    // Find the last non-empty row inside this section (after the header)
    let lastDataIdx = monthIdx;
    for (let i = sectionEnd - 1; i > monthIdx; i--) {
      if (colValues[i] && colValues[i].trim() !== "") {
        lastDataIdx = i;
        break;
      }
    }

    // Write to the row immediately after the last data row in this section
    targetRow = lastDataIdx + 2; // +1 to convert 0-based to 1-based, +1 for next row
    console.log(`[financas] Seção ${currentMonthName} linha ${monthIdx + 1}, último dado linha ${lastDataIdx + 1}, escrevendo em ${targetRow}`);
  }

  const targetRange = `'${tabName}'!A${targetRow}:H${targetRow}`;
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        values: [["'" + row.data, row.categoria, row.descricao, row.tipo, row.valor, row.mes, row.ano, row.quem]],
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    console.error("[financas] appendToSheet erro:", JSON.stringify(err));
    return false;
  }
  return true;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getTodayBR(): { iso: string; br: string; mes: number; ano: number } {
  const now = new Date();
  const brDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const d = String(brDate.getDate()).padStart(2, "0");
  const m = String(brDate.getMonth() + 1).padStart(2, "0");
  const y = brDate.getFullYear();
  return {
    iso: `${y}-${m}-${d}`,
    br: `${d}/${m}/${y}`,
    mes: brDate.getMonth() + 1,
    ano: y,
  };
}

// ─── Evolution: send message ──────────────────────────────────────────────────
async function sendGroupMessage(evolutionUrl: string, evolutionKey: string, instancia: string, grupoJid: string, text: string) {
  const res = await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
    method: "POST",
    headers: { apikey: evolutionKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: grupoJid, text }),
  });
  if (!res.ok) console.error("[financas] Erro ao enviar msg:", await res.text());
}

// ─── Command parser ────────────────────────────────────────────────────────────
interface ParsedCommand {
  tipo: "conta" | "pagar" | "gasto" | "receita" | "lista" | "resumo" | "ajuda" | null;
  descricao: string;
  valor: number | null;
  categoria: "empresa" | "pessoal";
  dia_vencimento: number | null;
  criado_por: string;
}

function parseCommand(text: string, senderName: string): ParsedCommand {
  const norm = normalize(text);
  const tokens = norm.split(/\s+/);
  const categoria: "empresa" | "pessoal" = norm.includes("empresa") ? "empresa" : "pessoal";
  const ft = tokens.filter((t) => t !== "empresa");
  const base = { categoria, dia_vencimento: null as null, criado_por: senderName };

  if (["lista", "contas", "pendentes"].includes(ft[0]))
    return { tipo: "lista", descricao: "", valor: null, ...base };
  if (["resumo", "total", "saldo"].includes(ft[0]))
    return { tipo: "resumo", descricao: "", valor: null, ...base };
  if (["ajuda", "help", "comandos"].includes(ft[0]))
    return { tipo: "ajuda", descricao: "", valor: null, ...base };

  if (["paguei", "pago", "pagar"].includes(ft[0])) {
    const desc = ft.slice(1).filter((t) => t !== "empresa").join(" ").trim();
    return { tipo: "pagar", descricao: desc, valor: null, ...base };
  }

  if (["recebi", "receita", "entrada"].includes(ft[0])) {
    const rest = ft.slice(1);
    const { valor, idx } = extractMoney(rest);
    const desc = rest.filter((_, i) => i !== idx).filter((t) => t !== "empresa").join(" ").trim() || "Receita";
    return { tipo: "receita", descricao: desc, valor, ...base };
  }

  if (["gastei", "gasto", "comprei"].includes(ft[0])) {
    const rest = ft.slice(1);
    const { valor, idx } = extractMoney(rest);
    const desc = rest.filter((_, i) => i !== idx).filter((t) => t !== "empresa").join(" ").trim() || "Gasto";
    return { tipo: "gasto", descricao: desc, valor, ...base };
  }

  if (ft[0] === "conta") {
    const rest = ft.slice(1);
    const dia = parseDia(rest);
    const withoutDia = rest.filter((t, i) => t !== "dia" && !(rest[i - 1] === "dia"));
    const { valor, idx } = extractMoney(withoutDia);
    const desc = withoutDia.filter((_, i) => i !== idx).filter((t) => t !== "empresa").join(" ").trim() || "Conta";
    return { tipo: "conta", descricao: desc, valor, categoria, dia_vencimento: dia, criado_por: senderName };
  }

  return { tipo: null, descricao: "", valor: null, ...base };
}

// ─── Main processing ──────────────────────────────────────────────────────────
async function processMessage(body: any) {
  try {
    const event = body?.event || body?.type;
    if (!event?.includes("message") && !event?.includes("MESSAGES")) return;

    const data = body?.data || body;
    const key = data?.key || {};
    if (!key?.remoteJid?.includes("@g.us")) return;

    const grupoJid = key.remoteJid;
    const msgContent =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.ephemeralMessage?.message?.extendedTextMessage?.text || "";

    if (!msgContent?.trim()) return;

    const pushName = data?.pushName || data?.participant || key?.participant || "Desconhecido";
    const senderName = typeof pushName === "string" ? pushName.split(" ")[0] : "Desconhecido";

    const { data: rows } = await supabase.from("financas_config").select("*");
    if (!rows?.length) return;
    const cfg = rows.find((r) => r.spreadsheet_id && r.google_refresh_token) || rows.find((r) => r.google_refresh_token) || rows[0];
    if (!cfg) return;

    if (!cfg.grupo_jid) {
      await supabase.from("financas_config").update({ grupo_jid: grupoJid }).eq("id", cfg.id);
      cfg.grupo_jid = grupoJid;
    }
    if (cfg.grupo_jid && cfg.grupo_jid !== grupoJid) return;

    const { data: masterAg } = await supabase
      .from("agencias")
      .select("evolution_url,evolution_key")
      .is("parent_id", null)
      .limit(1)
      .single();

    if (!masterAg?.evolution_url || !masterAg?.evolution_key) return;

    const EVO_URL = masterAg.evolution_url;
    const EVO_KEY = masterAg.evolution_key;
    const instanceName = cfg.instancia || body?.instance || data?.instance || "default";

    // Google Sheets access token
    let accessToken: string | null = null;
    if (cfg.google_refresh_token && cfg.spreadsheet_id) {
      accessToken = await getAccessToken(cfg.google_refresh_token);
    }

    const parsed = parseCommand(msgContent, senderName);
    const mesRef = getMesReferencia();
    const today = getTodayBR();

    // ─── AJUDA ────────────────────────────────────────
    if (parsed.tipo === "ajuda") {
      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
        `📖 *Comandos disponíveis*\n\n` +
        `*Conta fixa a pagar:*\n\`conta luz 180 dia 10\`\n\`conta empresa aluguel 2500 dia 5\`\n\n` +
        `*Marcar como pago:*\n\`paguei luz\`\n\`paguei empresa das\`\n\n` +
        `*Gasto variável:*\n\`gastei 150 mercado\`\n\`gasto empresa 500 ads\`\n\n` +
        `*Receita:*\n\`recebi 3000 salario\`\n\n` +
        `*Listar pendentes:*\n\`lista\`\n\n` +
        `*Resumo do mês:*\n\`resumo\`\n\n` +
        `_Use "empresa" para despesa empresarial, senão é Família._`
      );
      return;
    }

    // ─── LISTA ────────────────────────────────────────
    if (parsed.tipo === "lista") {
      const { data: contas } = await supabase
        .from("financas_lancamentos")
        .select("descricao,valor,dia_vencimento,categoria")
        .eq("tipo", "conta").eq("pago", false).eq("mes_referencia", mesRef)
        .order("dia_vencimento", { ascending: true });

      if (!contas?.length) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid, `✅ Nenhuma conta pendente em ${mesRef}!`);
        return;
      }

      const total = contas.reduce((s, c) => s + Number(c.valor), 0);
      const linhas = contas.map((c) =>
        `• *${c.descricao}* - R$${formatMoney(c.valor)}${c.dia_vencimento ? ` | dia ${c.dia_vencimento}` : ""} ${c.categoria === "empresa" ? "🏢" : "🏠"}`
      ).join("\n");

      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
        `📋 *Contas pendentes — ${mesRef}*\n\n${linhas}\n\n💰 Total: R$${formatMoney(total)}`
      );
      return;
    }

    // ─── RESUMO ───────────────────────────────────────
    if (parsed.tipo === "resumo") {
      const { data: lancs } = await supabase
        .from("financas_lancamentos")
        .select("tipo,categoria,valor,pago")
        .eq("mes_referencia", mesRef);

      const gastosF   = (lancs||[]).filter((l) => l.tipo !== "receita" && l.categoria === "pessoal").reduce((s, l) => s + Number(l.valor), 0);
      const gastosE   = (lancs||[]).filter((l) => l.tipo !== "receita" && l.categoria === "empresa").reduce((s, l) => s + Number(l.valor), 0);
      const pendentes = (lancs||[]).filter((l) => l.tipo === "conta" && !l.pago).reduce((s, l) => s + Number(l.valor), 0);

      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
        `📊 *Resumo — ${mesRef}*\n\n` +
        `🏠 Família: R$${formatMoney(gastosF)}\n` +
        `🏢 Empresa: R$${formatMoney(gastosE)}\n` +
        `⏳ Pendentes: R$${formatMoney(pendentes)}\n` +
        `💰 Total geral: R$${formatMoney(gastosF + gastosE)}`
      );
      return;
    }

    // ─── CONTA (fixa a pagar) ─────────────────────────
    if (parsed.tipo === "conta") {
      if (!parsed.valor) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
          `❌ Informe o valor. Ex: \`conta luz 180 dia 10\``
        );
        return;
      }

      await supabase.from("financas_lancamentos").insert({
        descricao: parsed.descricao,
        tipo: "conta",
        categoria: parsed.categoria,
        valor: parsed.valor,
        dia_vencimento: parsed.dia_vencimento,
        data_lancamento: today.iso,
        mes_referencia: mesRef,
        criado_por: parsed.criado_por,
      });

      const catLabel = parsed.categoria === "empresa" ? "Empresa 🏢" : "Família 🏠";
      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
        `📌 *Conta registrada — ${catLabel}*\n${parsed.descricao} | R$${formatMoney(parsed.valor)}${parsed.dia_vencimento ? ` | Vence dia ${parsed.dia_vencimento}` : ""}\n\nDiga *paguei ${parsed.descricao}* quando pagar.`
      );
      return;
    }

    // ─── PAGAR ────────────────────────────────────────
    if (parsed.tipo === "pagar") {
      const { data: contas } = await supabase
        .from("financas_lancamentos")
        .select("id,descricao,valor,categoria")
        .eq("tipo", "conta").eq("pago", false).eq("mes_referencia", mesRef)
        .ilike("descricao", `%${parsed.descricao}%`)
        .order("criado_em", { ascending: false })
        .limit(1);

      if (!contas?.length) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
          `❌ Conta "${parsed.descricao}" não encontrada em ${mesRef}. Verifique com \`lista\`.`
        );
        return;
      }

      const conta = contas[0];
      await supabase.from("financas_lancamentos")
        .update({ pago: true, pago_at: new Date().toISOString() })
        .eq("id", conta.id);

      // Add to Google Sheets
      if (accessToken && cfg.spreadsheet_id) {
        const tabName = conta.categoria === "empresa" ? TAB_EMPRESA : TAB_FAMILIA;
        const cat = detectCategoria(conta.descricao, conta.categoria);
        await appendToSheet(accessToken, cfg.spreadsheet_id, tabName, {
          data: today.br,
          categoria: cat,
          descricao: conta.descricao,
          tipo: "Fixo",
          valor: Number(conta.valor),
          mes: today.mes,
          ano: today.ano,
          quem: parsed.criado_por,
        });
      }

      const tabLabel = conta.categoria === "empresa" ? "🏢 Empresa" : "🏠 Família";
      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
        `✅ *${conta.descricao}* pago!\nR$${formatMoney(conta.valor)} lançado em ${tabLabel}`
      );
      return;
    }

    // ─── GASTO (variável) ─────────────────────────────
    if (parsed.tipo === "gasto") {
      if (!parsed.valor) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
          `❌ Informe o valor. Ex: \`gastei 150 mercado\``
        );
        return;
      }

      await supabase.from("financas_lancamentos").insert({
        descricao: parsed.descricao,
        tipo: "gasto",
        categoria: parsed.categoria,
        valor: parsed.valor,
        data_lancamento: today.iso,
        mes_referencia: mesRef,
        criado_por: parsed.criado_por,
      });

      if (accessToken && cfg.spreadsheet_id) {
        const tabName = parsed.categoria === "empresa" ? TAB_EMPRESA : TAB_FAMILIA;
        const cat = detectCategoria(parsed.descricao, parsed.categoria);
        await appendToSheet(accessToken, cfg.spreadsheet_id, tabName, {
          data: today.br,
          categoria: cat,
          descricao: parsed.descricao,
          tipo: "Variável",
          valor: parsed.valor,
          mes: today.mes,
          ano: today.ano,
          quem: parsed.criado_por,
        });
      }

      const tabLabel = parsed.categoria === "empresa" ? "🏢 Empresa" : "🏠 Família";
      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
        `✅ *Gasto registrado — ${tabLabel}*\n${parsed.descricao} | R$${formatMoney(parsed.valor)}\n📊 Lançado na planilha`
      );
      return;
    }

    // ─── RECEITA ──────────────────────────────────────
    if (parsed.tipo === "receita") {
      if (!parsed.valor) {
        await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
          `❌ Informe o valor. Ex: \`recebi 3000 salario\``
        );
        return;
      }

      await supabase.from("financas_lancamentos").insert({
        descricao: parsed.descricao,
        tipo: "receita",
        categoria: parsed.categoria,
        valor: parsed.valor,
        data_lancamento: today.iso,
        mes_referencia: mesRef,
        criado_por: parsed.criado_por,
      });

      await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
        `💰 *Receita registrada!*\n${parsed.descricao} | R$${formatMoney(parsed.valor)}`
      );
      return;
    }

    // Unknown
    await sendGroupMessage(EVO_URL, EVO_KEY, instanceName, grupoJid,
      `❓ Não entendi. Digite *ajuda* para ver os comandos.`
    );
  } catch (e) {
    console.error("[financas webhook] Erro:", e);
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  console.log("[financas webhook] Recebido:", JSON.stringify(body).slice(0, 300));
  try {
    await processMessage(body);
  } catch (e) {
    console.error("[financas webhook] Erro:", e);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, webhook: "financas" });
}
