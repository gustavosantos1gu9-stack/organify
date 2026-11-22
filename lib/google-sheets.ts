import { getAccessToken } from "./google-calendar";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

// ─── Create a new Google Spreadsheet ────────────────────────────────────────
export async function createSpreadsheet(
  refreshToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string } | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;

  const res = await fetch(SHEETS_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: { title: "Resumo", index: 0 },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "💰 Finanças Pessoais — Resumo por Mês" } },
                  ],
                },
                { values: [] },
                {
                  values: [
                    { userEnteredValue: { stringValue: "Mês" } },
                    { userEnteredValue: { stringValue: "Receitas" } },
                    { userEnteredValue: { stringValue: "Gastos Empresa" } },
                    { userEnteredValue: { stringValue: "Gastos Pessoais" } },
                    { userEnteredValue: { stringValue: "Contas Pagas" } },
                    { userEnteredValue: { stringValue: "Contas Pendentes" } },
                    { userEnteredValue: { stringValue: "Saldo Estimado" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[Sheets] Erro ao criar spreadsheet:", JSON.stringify(data));
    return null;
  }

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
  };
}

// ─── Append a row to a sheet ─────────────────────────────────────────────────
export async function addRow(
  refreshToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | boolean | null)[]
): Promise<number | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;

  const range = `'${sheetName}'!A:Z`;
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

  // Extract the row number from the updated range (e.g. "Sheet1!A5:H5" → 5)
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

  const range = `'${sheetName}'!A${row}:Z${row}`;
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

// ─── Ensure a sheet tab exists ────────────────────────────────────────────────
export async function ensureSheet(
  refreshToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<boolean> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return false;

  // Check if sheet already exists
  const metaRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const exists = (meta.sheets || []).some(
    (s: any) => s.properties?.title === sheetName
  );
  if (exists) return true;

  // Create the sheet tab
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    console.error("[Sheets] Erro ensureSheet:", JSON.stringify(data));
    return false;
  }
  return true;
}

// Month names BR
const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function getMesReferencia(date?: Date): string {
  const d = date || new Date();
  // Use BR timezone
  const brDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${MESES_ABREV[brDate.getMonth()]} ${brDate.getFullYear()}`;
}

// ─── Get or create month sheet with headers ───────────────────────────────────
// Headers: Data | Criado por | Descrição | Tipo | Categoria | Valor | Vencimento | Pago
const MONTH_HEADERS = ["Data", "Criado por", "Descrição", "Tipo", "Categoria", "Valor", "Vencimento", "Pago"];

export async function getOrCreateMonthSheet(
  refreshToken: string,
  spreadsheetId: string,
  mesReferencia: string
): Promise<boolean> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return false;

  // Check if sheet exists
  const metaRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  const exists = (meta.sheets || []).some(
    (s: any) => s.properties?.title === mesReferencia
  );

  if (!exists) {
    // Create the sheet
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
    const range = `'${mesReferencia}'!A1:H1`;
    await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [MONTH_HEADERS] }),
      }
    );
  }

  return true;
}

// ─── Read all rows from a sheet ───────────────────────────────────────────────
export async function getSheetRows(
  refreshToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return [];

  const range = `'${sheetName}'!A:Z`;
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.values || [];
}
