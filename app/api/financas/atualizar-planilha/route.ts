import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateMonthSheet, getMesReferencia, updateResumo } from "@/lib/google-sheets";
import { getAccessToken } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const COLOR_HEADER_BG   = { red: 0.11, green: 0.24, blue: 0.40 };
const COLOR_HEADER_TEXT = { red: 1.0,  green: 1.0,  blue: 1.0  };
const COLOR_GREEN_BG    = { red: 0.85, green: 0.95, blue: 0.86 };
const COLOR_EMPRESA_BG  = { red: 0.88, green: 0.93, blue: 1.0  };

async function getSheetId(accessToken: string, spreadsheetId: string, sheetName: string): Promise<number | null> {
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const sheet = (data.sheets || []).find((s: any) => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId ?? null;
}

async function applyMonthFormatting(accessToken: string, spreadsheetId: string, sheetName: string) {
  const sheetId = await getSheetId(accessToken, spreadsheetId, sheetName);
  if (sheetId === null) return;

  const requests: any[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLOR_HEADER_BG,
            textFormat: { foregroundColor: COLOR_HEADER_TEXT, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    ...([90, 80, 200, 130, 80, 90, 100, 90, 60].map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    }))),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 32 },
        fields: "pixelSize",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 6, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "CURRENCY", pattern: '"R$"#,##0.00' },
            horizontalAlignment: "RIGHT",
          },
        },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 9 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "SIM" }] },
            format: { backgroundColor: COLOR_GREEN_BG },
          },
        },
        index: 0,
      },
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 9 }],
          booleanRule: {
            condition: {
              type: "CUSTOM_FORMULA",
              values: [{ userEnteredValue: `=$F2="empresa"` }],
            },
            format: { backgroundColor: COLOR_EMPRESA_BG },
          },
        },
        index: 1,
      },
    },
  ];

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) console.error("[atualizar-planilha] Erro formatação mês:", await res.text());
}

async function applyResumoFormatting(accessToken: string, spreadsheetId: string, sheetId: number) {
  const requests: any[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
        mergeType: "MERGE_ALL",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLOR_HEADER_BG,
            textFormat: { foregroundColor: COLOR_HEADER_TEXT, bold: true, fontSize: 13 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
            textFormat: { foregroundColor: COLOR_HEADER_TEXT, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
      },
    },
    ...([110, 120, 130, 130, 120, 120, 120].map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    }))),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: "pixelSize",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 100, startColumnIndex: 1, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "CURRENCY", pattern: '"R$"#,##0.00' },
            horizontalAlignment: "RIGHT",
          },
        },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    },
  ];

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) console.error("[atualizar-planilha] Erro formatação resumo:", await res.text());
}

export async function GET() {
  const { data: cfg } = await supabase.from("financas_config").select("*").limit(1).single();
  if (!cfg?.google_refresh_token || !cfg?.spreadsheet_id) {
    return NextResponse.json({ ok: false, error: "Planilha não conectada" });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(cfg.google_refresh_token);
  } catch {
    return NextResponse.json({ ok: false, error: "Token Google inválido" });
  }

  const log: string[] = [];

  // 1. Buscar todas as abas da planilha
  const metaRes = await fetch(`${SHEETS_BASE}/${cfg.spreadsheet_id}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const sheets: { title: string; sheetId: number }[] = (meta.sheets || []).map((s: any) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
  }));

  log.push(`Abas encontradas: ${sheets.map((s) => s.title).join(", ")}`);

  // 2. Atualizar cabeçalho do Resumo e formatar
  const resumoSheet = sheets.find((s) => s.title === "Resumo");
  if (resumoSheet) {
    await fetch(
      `${SHEETS_BASE}/${cfg.spreadsheet_id}/values/Resumo!A1:G3?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [
            ["💰 Finanças Pessoais — Resumo por Mês", "", "", "", "", "", ""],
            ["", "", "", "", "", "", ""],
            ["Mês", "Receitas", "Gastos Empresa", "Gastos Pessoais", "Contas Pagas", "Contas Pendentes", "Saldo"],
          ],
        }),
      }
    );
    await applyResumoFormatting(accessToken, cfg.spreadsheet_id, resumoSheet.sheetId);
    log.push("Resumo: formatado");
  }

  // 3. Para cada aba de mês: atualizar header com Subcategoria e formatar
  const MONTH_HEADERS = ["Data", "Quem", "Descrição", "Subcategoria", "Tipo", "Categoria", "Valor (R$)", "Vencimento", "Pago"];
  const mesAtual = getMesReferencia();

  for (const sheet of sheets) {
    if (sheet.title === "Resumo") continue;

    // Atualizar header row
    const range = `'${sheet.title}'!A1:I1`;
    await fetch(
      `${SHEETS_BASE}/${cfg.spreadsheet_id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [MONTH_HEADERS] }),
      }
    );

    await applyMonthFormatting(accessToken, cfg.spreadsheet_id, sheet.title);
    log.push(`${sheet.title}: formatado`);
  }

  // 4. Garantir que a aba do mês atual existe
  await getOrCreateMonthSheet(cfg.google_refresh_token, cfg.spreadsheet_id, mesAtual);
  log.push(`Aba ${mesAtual}: garantida`);

  // 5. Recalcular Resumo com dados atuais do banco
  const { data: lancs } = await supabase
    .from("financas_lancamentos")
    .select("tipo,categoria,valor,pago,mes_referencia");

  if (lancs?.length) {
    const meses = [...new Set(lancs.map((l) => l.mes_referencia))];
    for (const mes of meses) {
      const m = lancs.filter((l) => l.mes_referencia === mes);
      await updateResumo(cfg.google_refresh_token, cfg.spreadsheet_id, mes, {
        receitas:        m.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0),
        gastosEmpresa:   m.filter((l) => l.tipo === "gasto" && l.categoria === "empresa").reduce((s, l) => s + Number(l.valor), 0),
        gastosPessoal:   m.filter((l) => l.tipo === "gasto" && l.categoria === "pessoal").reduce((s, l) => s + Number(l.valor), 0),
        contasPagas:     m.filter((l) => l.tipo === "conta" && l.pago).reduce((s, l) => s + Number(l.valor), 0),
        contasPendentes: m.filter((l) => l.tipo === "conta" && !l.pago).reduce((s, l) => s + Number(l.valor), 0),
      });
      log.push(`Resumo ${mes}: atualizado`);
    }
  }

  return NextResponse.json({ ok: true, log });
}
