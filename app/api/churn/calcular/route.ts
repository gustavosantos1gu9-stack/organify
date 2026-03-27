import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EXCLUIR = ["Naiara", "Debora Antunes"];

const MESES_MAP: Record<string, number> = {
  "Jan":0,"Fev":1,"Mar":2,"Abr":3,"Mai":4,"Jun":5,
  "Jul":6,"Ago":7,"Set":8,"Out":9,"Nov":10,"Dez":11
};

const PERIODOS = [
  {
    id: "Jan-Ago",
    label: (ano: number) => `Jan/${ano} - Ago/${ano}`,
    entrada_inicio: (ano: number) => new Date(ano, 0, 1),
    entrada_fim: (ano: number) => new Date(ano, 3, 30),
    referencia: (ano: number) => new Date(ano, 7, 31),
  },
  {
    id: "Mai-Dez",
    label: (ano: number) => `Mai/${ano} - Dez/${ano}`,
    entrada_inicio: (ano: number) => new Date(ano, 4, 1),
    entrada_fim: (ano: number) => new Date(ano, 7, 31),
    referencia: (ano: number) => new Date(ano, 11, 31),
  },
  {
    id: "Set-Abr",
    label: (ano: number) => `Set/${ano} - Abr/${ano + 1}`,
    entrada_inicio: (ano: number) => new Date(ano, 8, 1),
    entrada_fim: (ano: number) => new Date(ano, 11, 31),
    referencia: (ano: number) => new Date(ano + 1, 3, 30),
  },
];

async function calcularPeriodos(agencia_id: string, forcar = false) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const resultados = [];

  for (let ano = anoAtual - 1; ano <= anoAtual; ano++) {
    for (const periodo of PERIODOS) {
      const entrada_inicio = periodo.entrada_inicio(ano);
      const entrada_fim = periodo.entrada_fim(ano);
      const referencia = periodo.referencia(ano);
      const label = periodo.label(ano);
      const isAoVivo = hoje < referencia;

      // Só calcular períodos que já começaram
      if (hoje < entrada_inicio) continue;

      // Não calcular períodos que ainda não fecharam
      if (isAoVivo && !forcar) continue;

      // Verificar se já existe calculado e fechado
      const { data: existente } = await supabase
        .from("historico_churn_rate")
        .select("id, tempo_medio_meses, detalhes")
        .eq("agencia_id", agencia_id)
        .eq("periodo", label)
        .single();

      const jaFechadoECalculado = existente?.tempo_medio_meses && !isAoVivo && !forcar;
      if (jaFechadoECalculado) {
        resultados.push({ periodo: label, status: "ja_calculado", tempo_medio: existente.tempo_medio_meses });
        continue;
      }

      // Buscar clientes que entraram no período
      const { data: clientes } = await supabase
        .from("controle_clientes")
        .select("nome, data_entrada, data_churn, status")
        .eq("agencia_id", agencia_id)
        .gte("data_entrada", entrada_inicio.toISOString())
        .lte("data_entrada", entrada_fim.toISOString());

      if (!clientes || clientes.length === 0) {
        resultados.push({ periodo: label, status: "sem_dados" });
        continue;
      }

      const tempos: number[] = [];
      let churns = 0, ativos = 0, excluidos_count = 0;

      for (const c of clientes) {
        if (EXCLUIR.some(ex => c.nome?.toLowerCase().includes(ex.toLowerCase()))) {
          excluidos_count++;
          continue;
        }

        const entrada = new Date(c.data_entrada);
        let dataFim: Date;

        if (c.status === "saiu" && c.data_churn) {
          const [mes, anoStr] = c.data_churn.split("/");
          const mesNum = MESES_MAP[mes] ?? 0;
          const dataChurn = new Date(parseInt(anoStr), mesNum + 1, 0);
          dataFim = new Date(Math.min(dataChurn.getTime(), referencia.getTime()));
          churns++;
        } else {
          dataFim = new Date(Math.min(hoje.getTime(), referencia.getTime()));
          ativos++;
        }

        const mesesFicou = (dataFim.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (mesesFicou >= 0.5) tempos.push(mesesFicou);
      }

      const tempoMedio = tempos.length > 0
        ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10
        : null;

      const payload = {
        agencia_id,
        periodo: label,
        data_calculo: referencia.toISOString().split("T")[0],
        base_clientes: tempos.length,
        total_churn: churns,
        tempo_medio_meses: tempoMedio,
        detalhes: { ativos, churns, excluidos: excluidos_count, ao_vivo: isAoVivo, calculado_em: hoje.toISOString() }
      };

      if (existente) {
        await supabase.from("historico_churn_rate").update(payload).eq("id", existente.id);
      } else {
        await supabase.from("historico_churn_rate").insert(payload);
      }

      resultados.push({ periodo: label, status: isAoVivo ? "ao_vivo" : "calculado", tempo_medio: tempoMedio, incluidos: tempos.length, churns, ativos });
    }
  }

  return resultados;
}

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, forcar = false } = await req.json();
    if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });
    const resultados = await calcularPeriodos(agencia_id, forcar);
    return NextResponse.json({ ok: true, resultados });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const agencia_id = req.nextUrl.searchParams.get("agencia_id");
  if (!agencia_id) return NextResponse.json({ error: "agencia_id obrigatório" });
  const resultados = await calcularPeriodos(agencia_id);
  return NextResponse.json({ ok: true, resultados });
}
