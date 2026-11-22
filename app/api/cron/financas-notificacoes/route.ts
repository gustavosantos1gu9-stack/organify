import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TAB_GASTOS_FIXOS = "📌 Gastos Fixos";

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

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dataBR(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMoney(s: string): number | null {
  if (!s) return null;
  const clean = s.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(clean);
  return isNaN(v) ? null : v;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ─── Config ─────────────────────────────────────────────────────────────────
    const { data: cfg } = await supabase
      .from("financas_config")
      .select("grupo_jid, instancia, google_refresh_token, spreadsheet_id")
      .limit(1)
      .single();

    if (!cfg?.grupo_jid) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Grupo não configurado" });
    }
    if (!cfg.google_refresh_token || !cfg.spreadsheet_id) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Planilha não configurada" });
    }

    // ─── Evolution: credenciais do master ───────────────────────────────────────
    const { data: masterAg } = await supabase
      .from("agencias")
      .select("evolution_url, evolution_key")
      .is("parent_id", null)
      .limit(1)
      .single();

    const evolutionUrl = masterAg?.evolution_url || process.env.EVOLUTION_URL || "";
    const evolutionKey = masterAg?.evolution_key || process.env.EVOLUTION_KEY || "";

    if (!evolutionUrl || !evolutionKey) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Evolution não configurado" });
    }

    // ─── Datas: hoje + próximos 3 dias (BR) ─────────────────────────────────────
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const diasAlerta: Date[] = [];
    for (let i = 0; i <= 3; i++) {
      diasAlerta.push(new Date(brNow.getFullYear(), brNow.getMonth(), brNow.getDate() + i));
    }
    const diasDoMes = new Set(diasAlerta.map(d => d.getDate()));

    // ─── Ler aba Gastos Fixos via Values API (lê texto exibido mesmo em dropdowns) ─
    // Buscar token — tenta financas_config primeiro, fallback agência master
    let sheetsAccessToken: string | null = cfg.google_refresh_token
      ? await getAccessToken(cfg.google_refresh_token)
      : null;

    if (!sheetsAccessToken) {
      const { data: masterAg2 } = await supabase
        .from("agencias")
        .select("google_calendar_refresh_token")
        .or("google_calendar_email.eq.gustavosantos1gu9@gmail.com,nome.ilike.%teste%")
        .limit(1)
        .single();
      if (masterAg2?.google_calendar_refresh_token) {
        sheetsAccessToken = await getAccessToken(masterAg2.google_calendar_refresh_token);
      }
    }

    if (!sheetsAccessToken) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Token Google inválido" });
    }

    const gridRange = encodeURIComponent(`'${TAB_GASTOS_FIXOS}'!A1:E200`);
    const gridUrl = `${SHEETS_BASE}/${cfg.spreadsheet_id}?includeGridData=true&ranges=${gridRange}&fields=sheets(properties.title,data.rowData.values(formattedValue,userEnteredValue))`;
    let gridRes = await fetch(gridUrl, { headers: { Authorization: `Bearer ${sheetsAccessToken}` } });

    // Se 401, tentar token alternativo
    if (gridRes.status === 401) {
      const { data: masterAg3 } = await supabase
        .from("agencias")
        .select("google_calendar_refresh_token")
        .or("google_calendar_email.eq.gustavosantos1gu9@gmail.com,nome.ilike.%teste%")
        .limit(1)
        .single();
      const alt = masterAg3?.google_calendar_refresh_token
        ? await getAccessToken(masterAg3.google_calendar_refresh_token)
        : null;
      if (alt) {
        gridRes = await fetch(gridUrl, { headers: { Authorization: `Bearer ${alt}` } });
      }
    }

    const gridData = await gridRes.json();
    const sheetData = (gridData.sheets || [])[0];
    const rowDataRaw = sheetData?.data?.[0]?.rowData || [];
    const allRows: string[][] = rowDataRaw.map((row: any) =>
      (row.values || []).map((cell: any) => {
        if (cell.formattedValue) return cell.formattedValue;
        const uev = cell.userEnteredValue;
        if (!uev) return "";
        return String(uev.stringValue ?? uev.numberValue ?? uev.boolValue ?? "");
      })
    );
    const rows: string[][] = allRows.slice(3); // pular 3 linhas de header

    // ─── Filtrar vencimentos nos próximos 3 dias ─────────────────────────────────
    // Colunas: A=Origem, B=Categoria, C=Descrição, D=Valor Mensal, E=Dia Venc.
    interface ItemVenc {
      descricao: string;
      valor: number | null;
      diaVenc: number;
      diaDate: Date;
    }

    const porDia = new Map<number, ItemVenc[]>();
    for (const d of diasAlerta) porDia.set(d.getDate(), []);

    for (const row of rows) {
      const descricao = row[2]?.trim();
      const valorStr  = row[3]?.trim();
      const diaStr    = row[4]?.trim();
      if (!descricao || !diaStr) continue;

      const dia = parseInt(diaStr);
      if (isNaN(dia) || dia < 1 || dia > 31) continue;
      if (!diasDoMes.has(dia)) continue;

      const diaDate = diasAlerta.find(d => d.getDate() === dia)!;
      const valor = parseMoney(valorStr);

      porDia.get(dia)!.push({ descricao, valor, diaVenc: dia, diaDate });
    }

    // ─── Verificar se há algo ────────────────────────────────────────────────────
    const totalItens = Array.from(porDia.values()).reduce((s, v) => s + v.length, 0);
    if (totalItens === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Nenhum vencimento nos próximos 3 dias" });
    }

    // ─── Montar mensagem ─────────────────────────────────────────────────────────
    let msg = `💰 *Vencimentos próximos*\n`;

    diasAlerta.forEach((d, idx) => {
      const itens = porDia.get(d.getDate()) || [];
      if (!itens.length) return;

      const label =
        idx === 0 ? `📅 Hoje (${dataBR(d)})` :
        idx === 1 ? `📅 Amanhã (${dataBR(d)})` :
                    `📅 Em ${idx} dias (${dataBR(d)})`;

      msg += `\n${label}:\n`;
      for (const item of itens) {
        const valorStr = item.valor ? ` — R$ ${fmt(item.valor)}` : "";
        const sufixo = idx === 0 ? " ⚠️" : "";
        msg += `• ${item.descricao}${valorStr}${sufixo}\n`;
      }
    });

    // ─── Enviar no grupo ─────────────────────────────────────────────────────────
    const sendRes = await fetch(`${evolutionUrl}/message/sendText/${cfg.instancia}`, {
      method: "POST",
      headers: { apikey: evolutionKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: cfg.grupo_jid, text: msg.trim() }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error("[financas-notificacoes] Erro Evolution:", err);
      return NextResponse.json({ ok: false, error: `Evolution ${sendRes.status}` });
    }

    return NextResponse.json({ ok: true, enviado: true, totalItens });
  } catch (e: any) {
    console.error("[financas-notificacoes] Erro:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
