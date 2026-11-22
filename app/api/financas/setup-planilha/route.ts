import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessToken } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const COLOR_DARK_BLUE  = { red: 0.11, green: 0.24, blue: 0.40 };
const COLOR_GREEN_DARK = { red: 0.06, green: 0.35, blue: 0.18 };
const COLOR_WHITE      = { red: 1.0,  green: 1.0,  blue: 1.0  };
const COLOR_GREEN_BG   = { red: 0.85, green: 0.95, blue: 0.86 };
const COLOR_RED_BG     = { red: 0.99, green: 0.87, blue: 0.87 };

async function batchUpdate(accessToken: string, spreadsheetId: string, requests: any[]) {
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) console.error("[setup-planilha] batchUpdate erro:", await res.text());
  return res.ok;
}

async function putValues(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) console.error("[setup-planilha] putValues erro:", await res.text());
}

async function setupCategorySheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  sheetId: number,
  headerColor: any
) {
  const HEADERS = ["Mês", "Data", "Quem", "Descrição", "Subcategoria", "Tipo", "Valor (R$)", "Vencimento", "Pago"];

  // Write headers
  await putValues(accessToken, spreadsheetId, `'${sheetName}'!A1:I1`, [HEADERS]);

  // Formatting
  await batchUpdate(accessToken, spreadsheetId, [
    // Freeze header
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    // Header style
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerColor,
            textFormat: { foregroundColor: COLOR_WHITE, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    // Column widths: Mês, Data, Quem, Descrição, Subcategoria, Tipo, Valor, Vencimento, Pago
    ...([90, 90, 80, 200, 130, 80, 100, 90, 60].map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    }))),
    // Header row height
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 32 },
        fields: "pixelSize",
      },
    },
    // Valor column: currency format (col index 6)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 6, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "CURRENCY", pattern: '"R$"#,##0.00' },
            horizontalAlignment: "RIGHT",
          },
        },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    },
    // Conditional format: Pago = SIM → green
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 0, endColumnIndex: 9 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "SIM" }] },
            format: { backgroundColor: COLOR_GREEN_BG },
          },
        },
        index: 0,
      },
    },
    // Conditional format: Pago = NÃO + tipo = conta → light red (pending bill)
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 0, endColumnIndex: 9 }],
          booleanRule: {
            condition: {
              type: "CUSTOM_FORMULA",
              values: [{ userEnteredValue: `=AND($I2="NÃO",$F2="conta")` }],
            },
            format: { backgroundColor: COLOR_RED_BG },
          },
        },
        index: 1,
      },
    },
  ]);
}

async function setupResumo(accessToken: string, spreadsheetId: string, sheetId: number) {
  await putValues(accessToken, spreadsheetId, "Resumo!A1:H3", [
    ["💰 Finanças — Resumo por Mês", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["Mês", "Receitas", "Gastos Família", "Contas Família", "Gastos Empresa", "Contas Empresa", "Total Saídas", "Saldo"],
  ]);

  const COLOR_RESUMO = { red: 0.11, green: 0.24, blue: 0.40 };

  await batchUpdate(accessToken, spreadsheetId, [
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        mergeType: "MERGE_ALL",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLOR_RESUMO,
            textFormat: { foregroundColor: COLOR_WHITE, bold: true, fontSize: 14 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
            textFormat: { foregroundColor: COLOR_WHITE, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
      },
    },
    ...([110, 120, 130, 120, 130, 120, 120, 110].map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    }))),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 44 },
        fields: "pixelSize",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 100, startColumnIndex: 1, endColumnIndex: 8 },
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
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
  ]);
}

export async function GET() {
  const { data: cfg } = await supabase.from("financas_config").select("*").limit(1).single();
  if (!cfg?.google_refresh_token || !cfg?.spreadsheet_id) {
    return NextResponse.json({ ok: false, error: "Planilha não conectada" });
  }

  let accessToken: string;
  try { accessToken = await getAccessToken(cfg.google_refresh_token); }
  catch { return NextResponse.json({ ok: false, error: "Token inválido" }); }

  // Fetch existing sheets
  const metaRes = await fetch(`${SHEETS_BASE}/${cfg.spreadsheet_id}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const existing: { title: string; sheetId: number }[] = (meta.sheets || []).map((s: any) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
  }));

  const log: string[] = [`Abas existentes: ${existing.map((s) => s.title).join(", ")}`];

  // Create missing tabs
  const needed = ["Resumo", "Família", "Empresa"];
  const toCreate = needed.filter((n) => !existing.find((s) => s.title === n));

  if (toCreate.length > 0) {
    await batchUpdate(accessToken, cfg.spreadsheet_id, toCreate.map((title) => ({
      addSheet: { properties: { title } },
    })));
    log.push(`Criadas: ${toCreate.join(", ")}`);
  }

  // Re-fetch after creation
  const meta2Res = await fetch(`${SHEETS_BASE}/${cfg.spreadsheet_id}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta2 = await meta2Res.json();
  const allSheets: { title: string; sheetId: number }[] = (meta2.sheets || []).map((s: any) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
  }));

  // Setup each sheet
  const resumoSheet = allSheets.find((s) => s.title === "Resumo");
  if (resumoSheet) {
    await setupResumo(accessToken, cfg.spreadsheet_id, resumoSheet.sheetId);
    log.push("Resumo: configurado");
  }

  const familiaSheet = allSheets.find((s) => s.title === "Família");
  if (familiaSheet) {
    await setupCategorySheet(accessToken, cfg.spreadsheet_id, "Família", familiaSheet.sheetId, COLOR_DARK_BLUE);
    log.push("Família: configurado");
  }

  const empresaSheet = allSheets.find((s) => s.title === "Empresa");
  if (empresaSheet) {
    await setupCategorySheet(accessToken, cfg.spreadsheet_id, "Empresa", empresaSheet.sheetId, COLOR_GREEN_DARK);
    log.push("Empresa: configurado");
  }

  return NextResponse.json({ ok: true, log });
}
