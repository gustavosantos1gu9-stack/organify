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
  const data = await res.json();
  if (!data.access_token) console.error("[Sheets] Erro refresh token:", JSON.stringify(data));
  return data.access_token || null;
}

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// Month names BR
const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function getMesReferencia(date?: Date): string {
  const d = date || new Date();
  const brDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${MESES_ABREV[brDate.getMonth()]} ${brDate.getFullYear()}`;
}

// Headers: Data | Quem | Descrição | Subcategoria | Tipo | Categoria | Valor | Vencimento | Pago
const MONTH_HEADERS = ["Data", "Quem", "Descrição", "Subcategoria", "Tipo", "Categoria", "Valor (R$)", "Vencimento", "Pago"];

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLOR_HEADER_BG   = { red: 0.11, green: 0.24, blue: 0.40 }; // azul escuro
const COLOR_HEADER_TEXT = { red: 1.0,  green: 1.0,  blue: 1.0  };
const COLOR_GREEN_BG    = { red: 0.85, green: 0.95, blue: 0.86 };
const COLOR_RED_BG      = { red: 0.99, green: 0.87, blue: 0.87 };
const COLOR_ALT_ROW     = { red: 0.95, green: 0.97, blue: 1.0  };
const COLOR_EMPRESA_BG  = { red: 0.88, green: 0.93, blue: 1.0  };

// ─── Helper: sheetId from metadata ────────────────────────────────────────────
async function getSheetId(accessToken: string, spreadsheetId: string, sheetName: string): Promise<number | null> {
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const sheet = (data.sheets || []).find((s: any) => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId ?? null;
}

// ─── Apply formatting to a month sheet ────────────────────────────────────────
async function applyMonthFormatting(accessToken: string, spreadsheetId: string, sheetName: string) {
  const sheetId = await getSheetId(accessToken, spreadsheetId, sheetName);
  if (sheetId === null) return;

  const requests: any[] = [
    // Freeze header row
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    // Header row formatting
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
    // Column widths: Data, Quem, Descrição, Subcategoria, Tipo, Categoria, Valor, Vencimento, Pago
    ...([90, 80, 200, 130, 80, 90, 100, 90, 60].map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    }))),
    // Row height for header
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 32 },
        fields: "pixelSize",
      },
    },
    // Valor column: currency format (col 6)
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
    // Conditional format: Pago = SIM → green row
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
    // Conditional format: Categoria = empresa → blue tint
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

  await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
}

// ─── Apply formatting to Resumo sheet ─────────────────────────────────────────
async function applyResumoFormatting(accessToken: string, spreadsheetId: string, sheetId: number) {
  const requests: any[] = [
    // Freeze header row
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    // Title row (row 0) merge & format
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
    // Header row (row 2) format
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
    // Column widths for Resumo
    ...([110, 120, 130, 130, 120, 120, 120].map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    }))),
    // Row 0 height
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: "pixelSize",
      },
    },
    // Currency format for columns B-G (1-6) from row 3 onwards
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

  await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
}

// ─── Create spreadsheet ────────────────────────────────────────────────────────
async function _createSpreadsheet(
  accessToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string } | null> {
  const res = await fetch(SHEETS_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: "Resumo", index: 0 } },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[Sheets] Erro ao criar spreadsheet:", JSON.stringify(data));
    return null;
  }

  const spreadsheetId: string = data.spreadsheetId;
  const resumoSheetId: number = data.sheets?.[0]?.properties?.sheetId ?? 0;

  // Add Resumo content
  await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/Resumo!A1:G3?valueInputOption=USER_ENTERED`,
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

  // Apply Resumo formatting
  await applyResumoFormatting(accessToken, spreadsheetId, resumoSheetId);

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

export async function createSpreadsheetWithToken(
  accessToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string } | null> {
  return _createSpreadsheet(accessToken, title);
}

export async function createSpreadsheet(
  refreshToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string } | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;
  return _createSpreadsheet(accessToken, title);
}

// ─── Get or create month sheet with formatting ────────────────────────────────
export async function getOrCreateMonthSheet(
  refreshToken: string,
  spreadsheetId: string,
  mesReferencia: string
): Promise<boolean> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return false;

  const metaRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const exists = (meta.sheets || []).some((s: any) => s.properties?.title === mesReferencia);

  if (!exists) {
    const createRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: mesReferencia } } }],
      }),
    });
    if (!createRes.ok) {
      console.error("[Sheets] Erro ao criar aba mês:", await createRes.text());
      return false;
    }

    // Add header row
    const range = `'${mesReferencia}'!A1:I1`;
    await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [MONTH_HEADERS] }),
      }
    );

    // Apply formatting
    await applyMonthFormatting(accessToken, spreadsheetId, mesReferencia);
  }

  return true;
}

// ─── Append a row to a sheet ──────────────────────────────────────────────────
export async function addRow(
  refreshToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | boolean | null)[]
): Promise<number | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;

  const range = `'${sheetName}'!A:I`;
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&includeValuesInResponse=true&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [values] }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error("[Sheets] Erro addRow:", JSON.stringify(data));
    return null;
  }

  const updatedRange: string = data.updates?.updatedRange || "";
  const match = updatedRange.match(/:?[A-Z]+(\d+)$/);
  return match ? parseInt(match[1]) : null;
}

// ─── Update a specific row ────────────────────────────────────────────────────
export async function updateRow(
  refreshToken: string,
  spreadsheetId: string,
  sheetName: string,
  row: number,
  values: (string | number | boolean | null)[]
): Promise<boolean> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return false;

  const range = `'${sheetName}'!A${row}:I${row}`;
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [values] }),
    }
  );

  if (!res.ok) {
    const data = await res.json();
    console.error("[Sheets] Erro updateRow:", JSON.stringify(data));
    return false;
  }
  return true;
}

// ─── Update Resumo tab with month totals ──────────────────────────────────────
export async function updateResumo(
  refreshToken: string,
  spreadsheetId: string,
  mesReferencia: string,
  totals: {
    receitas: number;
    gastosEmpresa: number;
    gastosPessoal: number;
    contasPagas: number;
    contasPendentes: number;
  }
): Promise<void> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return;

  const saldo = totals.receitas - totals.gastosEmpresa - totals.gastosPessoal - totals.contasPagas - totals.contasPendentes;

  // Find existing row for this month or append
  const rangeRead = `Resumo!A4:A100`;
  const readRes = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(rangeRead)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const readData = await readRes.json();
  const rows: string[][] = readData.values || [];
  const rowIdx = rows.findIndex((r) => r[0] === mesReferencia);

  const rowValues = [
    mesReferencia,
    totals.receitas,
    totals.gastosEmpresa,
    totals.gastosPessoal,
    totals.contasPagas,
    totals.contasPendentes,
    saldo,
  ];

  if (rowIdx >= 0) {
    // Update existing row (rowIdx + 4 because data starts at row 4, 1-indexed)
    const updateRange = `Resumo!A${rowIdx + 4}:G${rowIdx + 4}`;
    await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
  } else {
    // Append new row
    await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent("Resumo!A:G")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
  }
}
