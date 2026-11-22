import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
);

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

interface GastoFixo {
  origem: string;
  categoria: string;
  descricao: string;
  valor: string;
  dia: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1";
  console.log("[sincronizar-agenda] Iniciando sincronização de gastos fixos com Google Calendar");

  // 1. Buscar financas_config para spreadsheet_id e token
  const { data: cfg, error: cfgErr } = await supabase
    .from("financas_config")
    .select("google_refresh_token, spreadsheet_id")
    .limit(1)
    .single();

  if (cfgErr || !cfg) {
    console.error("[sincronizar-agenda] Erro ao buscar financas_config:", cfgErr);
    return NextResponse.json({ ok: false, error: "financas_config não encontrado" });
  }

  console.log("[sincronizar-agenda] financas_config obtido, spreadsheet_id:", cfg.spreadsheet_id);

  if (!cfg.google_refresh_token) {
    return NextResponse.json({ ok: false, error: "Token do Google não encontrado. Reconecte o Google Sheets." });
  }

  // 2. Obter access token (mesmo token da Lubia para Sheets e Calendar)
  let sheetsToken: string | null = await getAccessToken(cfg.google_refresh_token);

  if (!sheetsToken) {
    return NextResponse.json({ ok: false, error: "Não foi possível obter access token. Reconecte o Google." });
  }

  console.log("[sincronizar-agenda] refresh_token prefix:", cfg.google_refresh_token.substring(0, 15));
  console.log("[sincronizar-agenda] sheetsToken prefix:", sheetsToken.substring(0, 20));

  // Testar acesso ao Calendar com scope calendar.events
  const calTestRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1", {
    headers: { Authorization: `Bearer ${sheetsToken}` },
  });
  if (!calTestRes.ok) {
    const calTestBody = await calTestRes.json().catch(() => ({}));
    console.error("[sincronizar-agenda] Token sem Calendar scope:", calTestRes.status, JSON.stringify(calTestBody).substring(0, 200));
    return NextResponse.json({
      ok: false,
      error: "Token sem acesso ao Calendar. Clique em 'Reconectar Google' e autorize novamente.",
      calendarTestStatus: calTestRes.status,
      refreshTokenPrefix: cfg.google_refresh_token.substring(0, 20),
    });
  }
  console.log("[sincronizar-agenda] Calendar OK (calendar.events scope)");

  // 4. Ler aba "📌 Gastos Fixos" via metadata + includeGridData
  // Inclui formattedValue E userEnteredValue para lidar com células dropdown
  const spreadsheetId = cfg.spreadsheet_id;
  const range = encodeURIComponent("'📌 Gastos Fixos'!A1:E200");
  const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=${range}&fields=sheets(properties.title,data.rowData.values(formattedValue,userEnteredValue))`;

  console.log("[sincronizar-agenda] Lendo planilha via includeGridData");

  let sheetsRes = await fetch(sheetsUrl, { headers: { Authorization: `Bearer ${sheetsToken}` } });

  if (sheetsRes.status === 401) {
    return NextResponse.json({ ok: false, error: "Token expirado. Reconecte o Google na página de Finanças." });
  }

  if (!sheetsRes.ok) {
    const errBody = await sheetsRes.json();
    console.error("[sincronizar-agenda] Erro ao ler planilha:", errBody);
    return NextResponse.json({ ok: false, error: "Erro ao ler planilha", details: errBody });
  }

  const sheetsData = await sheetsRes.json();
  const sheet = (sheetsData.sheets || [])[0];
  if (!sheet) {
    return NextResponse.json({ ok: false, error: "Aba não encontrada na resposta" });
  }

  // Converter rowData em string[][] usando formattedValue OU userEnteredValue (fallback pra dropdowns)
  const rowDataRaw = sheet.data?.[0]?.rowData || [];
  const allRows: string[][] = rowDataRaw.map((row: any) =>
    (row.values || []).map((cell: any) => {
      if (cell.formattedValue) return cell.formattedValue;
      // Fallback: userEnteredValue pode ser stringValue, numberValue, etc.
      const uev = cell.userEnteredValue;
      if (!uev) return "";
      return String(uev.stringValue ?? uev.numberValue ?? uev.boolValue ?? "");
    })
  );
  console.log(`[sincronizar-agenda] Linhas lidas: ${allRows.length}`);

  return processRows(allRows, sheetsToken, debug);
}

async function processRows(allRows: string[][], calToken: string, debug = false) {
  console.log(`[sincronizar-agenda] Total de linhas recebidas: ${allRows.length}`);

  // Dados começam na linha 4 (índice 3) — primeiras 3 são cabeçalhos
  const rawRows: string[][] = [];
  const gastos: GastoFixo[] = [];
  for (let i = 3; i < allRows.length; i++) {
    const row = allRows[i] || [];
    const get = (idx: number) => (row[idx] || "").trim();

    const origem = get(0);
    const categoria = get(1);
    const descricao = get(2);
    const valorStr = get(3);
    const diaStr = get(4);

    if (origem || categoria || descricao || valorStr || diaStr) {
      rawRows.push([origem, categoria, descricao, valorStr, diaStr]);
    }

    // Pular linhas sem descrição ou dia
    if (!descricao || !diaStr) continue;
    // Pular linhas de total (descrição contém "TOTAL")
    if (descricao.toUpperCase().includes("TOTAL")) continue;

    const dia = parseInt(diaStr, 10);
    if (isNaN(dia) || dia < 1 || dia > 31) continue;

    gastos.push({ origem, categoria, descricao, valor: valorStr, dia });
  }

  console.log(`[sincronizar-agenda] Gastos fixos encontrados: ${gastos.length}`);
  for (const g of gastos) {
    console.log(`  - ${g.descricao} | Dia: ${g.dia} | Valor: ${g.valor}`);
  }

  // Determinar os 3 meses (mês atual + próximos 2)
  const hoje = new Date();
  const meses: { ano: number; mes: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    meses.push({ ano: d.getFullYear(), mes: d.getMonth() }); // mes = 0-indexed
  }

  console.log("[sincronizar-agenda] Meses a processar:", meses.map(m => `${m.ano}-${String(m.mes + 1).padStart(2, "0")}`));

  let criados = 0;
  let pulados = 0;
  let erros = 0;
  let primeiroErro: any = null;

  for (const gasto of gastos) {
    for (const { ano, mes } of meses) {
      // Verificar se o dia JÁ passou no mês atual
      if (mes === hoje.getMonth() && ano === hoje.getFullYear()) {
        if (gasto.dia < hoje.getDate()) {
          console.log(`[sincronizar-agenda] Pulando ${gasto.descricao} dia ${gasto.dia} (já passou em ${ano}-${mes + 1})`);
          pulados++;
          continue;
        }
      }

      // Verificar se o dia existe no mês (ex: dia 31 em fevereiro)
      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
      const diaReal = Math.min(gasto.dia, diasNoMes);

      // Data do evento: YYYY-MM-DD
      const dateStr = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaReal).padStart(2, "0")}`;

      // Key única para evitar duplicata
      const key = `${gasto.descricao}_${gasto.dia}`.replace(/\s+/g, "_").toLowerCase();

      // Checar existência via extendedProperties
      const mesInicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01T00:00:00-03:00`;
      const ultimoDia = new Date(ano, mes + 1, 0).getDate();
      const mesFim = `${ano}-${String(mes + 1).padStart(2, "0")}-${ultimoDia}T23:59:59-03:00`;

      const checkUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=key%3D${encodeURIComponent(key)}&timeMin=${encodeURIComponent(mesInicio)}&timeMax=${encodeURIComponent(mesFim)}&singleEvents=true`;

      try {
        const checkRes = await fetch(checkUrl, {
          headers: { Authorization: `Bearer ${calToken}` },
        });
        const checkData = await checkRes.json();
        const existing = checkData.items || [];

        if (existing.length > 0) {
          // Atualizar cor se necessário
          const ev = existing[0];
          if (ev.colorId !== "11") {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.id}`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${calToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ colorId: "11" }),
              }
            );
          }
          pulados++;
          continue;
        }
      } catch (err) {
        console.error(`[sincronizar-agenda] Erro ao checar existência de ${gasto.descricao}:`, err);
      }

      // Formatar valor
      const valorFormatado = gasto.valor
        ? gasto.valor.startsWith("R$") ? gasto.valor : `R$ ${gasto.valor}`
        : "";

      // Criar evento all-day
      const evento = {
        summary: `💰 ${gasto.descricao}${valorFormatado ? ` — ${valorFormatado}` : ""}`,
        description: `Categoria: ${gasto.categoria} | Origem: ${gasto.origem}`,
        colorId: "11", // Tomate (vermelho)
        start: { date: dateStr },
        end: { date: dateStr },
        extendedProperties: {
          private: {
            source: "financas-fixos",
            key: key,
          },
        },
      };

      try {
        const createRes = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${calToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(evento),
          }
        );

        const createData = await createRes.json();

        if (!createRes.ok) {
          console.error(`[sincronizar-agenda] Erro ao criar evento ${gasto.descricao} em ${dateStr}:`, createData);
          if (!primeiroErro) primeiroErro = { status: createRes.status, data: createData };
          erros++;
        } else {
          console.log(`[sincronizar-agenda] Evento criado: ${createData.id} — ${evento.summary} em ${dateStr}`);
          criados++;
        }
      } catch (err) {
        console.error(`[sincronizar-agenda] Exceção ao criar evento ${gasto.descricao}:`, err);
        erros++;
      }
    }
  }

  console.log(`[sincronizar-agenda] Concluído. Criados: ${criados}, Pulados: ${pulados}, Erros: ${erros}`);

  if (debug) {
    return NextResponse.json({ ok: true, rawRows, gastos });
  }

  return NextResponse.json({
    ok: true,
    criados,
    pulados,
    erros,
    primeiroErro,
    gastos: gastos.map(g => ({
      descricao: g.descricao,
      categoria: g.categoria,
      origem: g.origem,
      valor: g.valor,
      dia: g.dia,
    })),
  });
}
