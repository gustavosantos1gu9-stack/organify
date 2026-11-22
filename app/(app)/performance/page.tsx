"use client";

import { useEffect, useState, useCallback } from "react";
import { getAgenciaId } from "@/lib/hooks";
import {
  TrendingUp, DollarSign, Users, Calendar, CheckCircle,
  ShoppingBag, RefreshCw, Save, ChevronDown, ChevronUp, BarChart2, Layers
} from "lucide-react";

interface Semana {
  semana_inicio: string;
  semana_fim: string;
  mensagens: number;
  investimento: number;
  contatos: number;
  agendamentos: number;
  comparecimentos: number;
  vendas: number;
  valor_vendas: number;
  id?: string | null;
}
interface Item {
  id?: string;
  nome: string;
  campanha?: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  mensagens: number;
  agendamentos: number;
}

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (num: number, den: number) => den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "—";
const fmtData = (d: string) => { const [y, m, dia] = d.split("-"); return `${dia}/${m}`; };
const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtMes = (d: string) => { const [y, m] = d.split("-"); return `${MESES_PT[parseInt(m)-1]}/${y.slice(2)}`; };

const hoje = new Date().toISOString().split("T")[0];
const primDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
const primDiaAno = `${new Date().getFullYear()}-01-01`;
const primDiaMesPassado = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0];
const ultimoDiaMesPassado = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0];

const PERIODOS = [
  { label: "Este mês", desde: primDiaMes, ate: hoje },
  { label: "Mês passado", desde: primDiaMesPassado, ate: ultimoDiaMesPassado },
  { label: "Este ano", desde: primDiaAno, ate: hoje },
  { label: "Tudo", desde: "2026-01-01", ate: hoje },
];

export default function PerformanceFilha() {
  const [agenciaId, setAgenciaId] = useState<string | null>(null);
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [campanhas, setCampanhas] = useState<Item[]>([]);
  const [conjuntos, setConjuntos] = useState<Item[]>([]);
  const [temMeta, setTemMeta] = useState(false);
  const [agruparPorMes, setAgruparPorMes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [edicoes, setEdicoes] = useState<Record<number, Partial<Semana>>>({});
  const [abaSuperior, setAbaSuperior] = useState<"campanha" | "conjunto">("campanha");
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [desde, setDesde] = useState(primDiaMes);
  const [ate, setAte] = useState(hoje);
  const [periodoLabel, setPeriodoLabel] = useState("Este mês");

  const carregar = useCallback(async (agId: string, d = desde, a = ate) => {
    setLoading(true);
    setEdicoes({});
    try {
      const res = await fetch("/api/performance/filha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "carregar", agencia_id: agId, date_from: d, date_to: a }),
      });
      const data = await res.json();
      setSemanas(data.semanas || []);
      setCampanhas(data.campanhas || []);
      setConjuntos(data.conjuntos || []);
      setTemMeta(data.temMeta || false);
      setAgruparPorMes(data.agruparPorMes || false);
    } finally {
      setLoading(false);
    }
  }, [desde, ate]);

  useEffect(() => {
    getAgenciaId().then(id => { if (id) { setAgenciaId(id); carregar(id); } });
  }, []);

  const selecionarPeriodo = (p: typeof PERIODOS[0]) => {
    setPeriodoLabel(p.label);
    setDesde(p.desde);
    setAte(p.ate);
    if (agenciaId) carregar(agenciaId, p.desde, p.ate);
  };

  const setEdicao = (i: number, campo: keyof Semana, valor: number) =>
    setEdicoes(prev => ({ ...prev, [i]: { ...prev[i], [campo]: valor } }));

  const semanaComEdicao = (sem: Semana, i: number): Semana => ({ ...sem, ...edicoes[i] });

  const salvar = async () => {
    if (!agenciaId || Object.keys(edicoes).length === 0) return;
    setSalvando(true);
    try {
      const semanasParaSalvar = semanas
        .map((sem, i) => edicoes[i] ? { ...sem, ...edicoes[i] } : sem)
        .filter((_, i) => edicoes[i]);
      await fetch("/api/performance/filha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salvar", agencia_id: agenciaId, semanas: semanasParaSalvar }),
      });
      await carregar(agenciaId);
    } finally { setSalvando(false); }
  };

  const total = semanas.reduce((acc, sem, i) => {
    const s = semanaComEdicao(sem, i);
    return {
      investimento: acc.investimento + s.investimento,
      mensagens: acc.mensagens + s.mensagens,
      contatos: acc.contatos + s.contatos,
      agendamentos: acc.agendamentos + s.agendamentos,
      comparecimentos: acc.comparecimentos + s.comparecimentos,
      vendas: acc.vendas + s.vendas,
      valor_vendas: acc.valor_vendas + s.valor_vendas,
    };
  }, { investimento: 0, mensagens: 0, contatos: 0, agendamentos: 0, comparecimentos: 0, vendas: 0, valor_vendas: 0 });

  const cac = total.vendas > 0 ? total.investimento / total.vendas : 0;
  const roas = total.investimento > 0 ? total.valor_vendas / total.investimento : 0;
  const hasEdicoes = Object.keys(edicoes).length > 0;
  const itensVisiveis = abaSuperior === "campanha" ? campanhas : conjuntos;

  const card = (label: string, valor: string | number, sub?: string, icon?: React.ReactNode, cor?: string) => (
    <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: "12px", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        {icon && <span style={{ color: cor || "#29ABE2" }}>{icon}</span>}
        <span style={{ fontSize: "12px", color: "#606070" }}>{label}</span>
      </div>
      <div style={{ fontSize: "22px", fontWeight: "700", color: cor || "#f0f0f0" }}>{valor}</div>
      {sub && <div style={{ fontSize: "11px", color: "#505060", marginTop: "4px" }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: "24px", maxWidth: "1300px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>Performance</h1>
          <p style={{ fontSize: "13px", color: "#606070", margin: "4px 0 0" }}>Campanhas · Agendamentos · Resultados</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Período rápido */}
          {PERIODOS.map(p => (
            <button key={p.label} onClick={() => selecionarPeriodo(p)}
              style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: periodoLabel === p.label ? "600" : "400",
                background: periodoLabel === p.label ? "#29ABE2" : "#1a1a2e",
                color: periodoLabel === p.label ? "#000" : "#a0a0b0",
                border: periodoLabel === p.label ? "none" : "1px solid #2a2a3e" }}>
              {p.label}
            </button>
          ))}
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPeriodoLabel(""); }}
            style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "8px", color: "#f0f0f0", padding: "6px 10px", fontSize: "12px" }} />
          <span style={{ color: "#606070" }}>→</span>
          <input type="date" value={ate} onChange={e => { setAte(e.target.value); setPeriodoLabel(""); }}
            style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "8px", color: "#f0f0f0", padding: "6px 10px", fontSize: "12px" }} />
          <button onClick={() => agenciaId && carregar(agenciaId, desde, ate)}
            style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "8px", color: "#29ABE2", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <RefreshCw size={13} />
          </button>
          {hasEdicoes && (
            <button onClick={salvar} disabled={salvando}
              style={{ background: "#29ABE2", border: "none", borderRadius: "8px", color: "#000", padding: "6px 14px", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              <Save size={13} /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#606070" }}>Carregando...</div>
      ) : (
        <>
          {/* KPI Cards — linha 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "12px" }}>
            {card("Investimento", fmt(total.investimento), temMeta ? "Meta Ads" : "Manual", <DollarSign size={16} />, "#ef4444")}
            {card("Mensagens / Leads", total.mensagens, "Resultado de campanha", <TrendingUp size={16} />)}
            {card("Contatos (inbox)", total.contatos, "Conversas iniciadas", <Users size={16} />, "#f59e0b")}
            {card("Agendamentos", total.agendamentos, `Taxa: ${pct(total.agendamentos, total.mensagens || total.contatos)}`, <Calendar size={16} />, "#a855f7")}
          </div>
          {/* KPI Cards — linha 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
            {card("Comparecimentos", total.comparecimentos, `Taxa: ${pct(total.comparecimentos, total.agendamentos)}`, <CheckCircle size={16} />, "#22c55e")}
            {card("Vendas", total.vendas, `Tx conv: ${pct(total.vendas, total.comparecimentos)}`, <ShoppingBag size={16} />, "#29ABE2")}
            {card("Faturamento", fmt(total.valor_vendas), "Total realizado", <DollarSign size={16} />, "#29ABE2")}
            {card("ROAS", roas > 0 ? `${roas.toFixed(2)}x` : "—", cac > 0 ? `CAC: ${fmt(cac)}` : "Faturamento / Invest.", <BarChart2 size={16} />, roas >= 3 ? "#22c55e" : roas > 0 ? "#f59e0b" : "#606070")}
          </div>

          {/* Tabela semanal */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: "12px", overflow: "hidden", marginBottom: "20px" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#f0f0f0", margin: 0 }}>{agruparPorMes ? "Por Mês" : "Por Semana"}</h2>
              <span style={{ fontSize: "11px", color: "#505060" }}>Comparecimentos · Vendas · Faturamento: edite diretamente</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                    {[agruparPorMes ? "Mês" : "Semana","Invest.","Mensagens","Contatos","Agend.","Compar.","Tx.Ag","Tx.Co","Vendas","Faturamento","ROAS"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: h === "Semana" ? "left" : "right", color: "#606070", fontWeight: "500", whiteSpace: "nowrap", fontSize: "12px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((sem, i) => {
                    const s = semanaComEdicao(sem, i);
                    const editado = !!edicoes[i];
                    const roasSem = s.investimento > 0 ? s.valor_vendas / s.investimento : 0;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #161622", background: editado ? "rgba(41,171,226,0.04)" : undefined }}>
                        <td style={{ padding: "9px 12px", color: "#a0a0b0", whiteSpace: "nowrap", fontSize: "12px" }}>
                          {agruparPorMes ? fmtMes(sem.semana_inicio) : `${fmtData(sem.semana_inicio)} – ${fmtData(sem.semana_fim)}`}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#ef4444" }}>{fmt(s.investimento)}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#f0f0f0" }}>{s.mensagens}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#f59e0b" }}>{s.contatos}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#a855f7" }}>{s.agendamentos}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>
                          <input type="number" min="0" value={s.comparecimentos} onChange={e => setEdicao(i, "comparecimentos", parseInt(e.target.value) || 0)}
                            style={{ width: "52px", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "6px", color: "#22c55e", padding: "3px 6px", textAlign: "right", fontSize: "12px" }} />
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#606070", fontSize: "12px" }}>{pct(s.agendamentos, s.mensagens || s.contatos)}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#606070", fontSize: "12px" }}>{pct(s.comparecimentos, s.agendamentos)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>
                          <input type="number" min="0" value={s.vendas} onChange={e => setEdicao(i, "vendas", parseInt(e.target.value) || 0)}
                            style={{ width: "52px", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "6px", color: "#29ABE2", padding: "3px 6px", textAlign: "right", fontSize: "12px" }} />
                        </td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>
                          <input type="number" min="0" value={s.valor_vendas} onChange={e => setEdicao(i, "valor_vendas", parseFloat(e.target.value) || 0)}
                            style={{ width: "76px", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "6px", color: "#29ABE2", padding: "3px 6px", textAlign: "right", fontSize: "12px" }} />
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: roasSem >= 3 ? "#22c55e" : roasSem > 0 ? "#f59e0b" : "#404050", fontSize: "12px" }}>
                          {roasSem > 0 ? `${roasSem.toFixed(2)}x` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid #2a2a3e", background: "#0e0e16" }}>
                    <td style={{ padding: "9px 12px", color: "#f0f0f0", fontWeight: "700" }}>Total</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#ef4444", fontWeight: "700" }}>{fmt(total.investimento)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#f0f0f0", fontWeight: "700" }}>{total.mensagens}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#f59e0b", fontWeight: "700" }}>{total.contatos}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#a855f7", fontWeight: "700" }}>{total.agendamentos}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#22c55e", fontWeight: "700" }}>{total.comparecimentos}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#606070", fontWeight: "700" }}>{pct(total.agendamentos, total.mensagens || total.contatos)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#606070", fontWeight: "700" }}>{pct(total.comparecimentos, total.agendamentos)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#29ABE2", fontWeight: "700" }}>{total.vendas}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#29ABE2", fontWeight: "700" }}>{fmt(total.valor_vendas)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: roas >= 3 ? "#22c55e" : roas > 0 ? "#f59e0b" : "#404050", fontWeight: "700" }}>{roas > 0 ? `${roas.toFixed(2)}x` : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Campanhas / Conjuntos */}
          {(campanhas.length > 0 || conjuntos.length > 0) && (
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: "12px", overflow: "hidden" }}>
              <button onClick={() => setShowBreakdown(v => !v)}
                style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#f0f0f0", margin: 0 }}>Meta Ads — Detalhamento</h2>
                  {showBreakdown && (
                    <div style={{ display: "flex", gap: "4px" }} onClick={e => e.stopPropagation()}>
                      {(["campanha", "conjunto"] as const).map(aba => (
                        <button key={aba} onClick={() => setAbaSuperior(aba)}
                          style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: abaSuperior === aba ? "600" : "400",
                            background: abaSuperior === aba ? "#29ABE2" : "#1a1a2e",
                            color: abaSuperior === aba ? "#000" : "#a0a0b0",
                            border: abaSuperior === aba ? "none" : "1px solid #2a2a3e" }}>
                          {aba === "campanha" ? "Campanhas" : "Conjuntos"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ color: "#606070" }}>{showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>

              {showBreakdown && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderTop: "1px solid #1e1e2e", borderBottom: "1px solid #1e1e2e" }}>
                        <th style={{ padding: "9px 14px", textAlign: "left", color: "#606070", fontWeight: "500" }}>
                          {abaSuperior === "campanha" ? "Campanha" : "Conjunto de Anúncios"}
                        </th>
                        {abaSuperior === "conjunto" && (
                          <th style={{ padding: "9px 14px", textAlign: "left", color: "#606070", fontWeight: "500" }}>Campanha</th>
                        )}
                        {["Invest.", "Impressões", "Cliques", "CTR", "Mensagens", "Agend.*", "CPA msg", "Custo/Agend"].map(h => (
                          <th key={h} style={{ padding: "9px 12px", textAlign: "right", color: "#606070", fontWeight: "500", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itensVisiveis.map((c, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #161622" }}>
                          <td style={{ padding: "9px 14px", color: "#d0d0e0", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.nome}>{c.nome}</td>
                          {abaSuperior === "conjunto" && (
                            <td style={{ padding: "9px 12px", color: "#606070", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px" }} title={c.campanha}>{c.campanha}</td>
                          )}
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#ef4444" }}>{fmt(c.investimento)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#a0a0b0" }}>{c.impressoes.toLocaleString("pt-BR")}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#a0a0b0" }}>{c.cliques.toLocaleString("pt-BR")}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#a0a0b0" }}>{(c.ctr * 100).toFixed(2)}%</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#29ABE2" }}>{c.mensagens}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#a855f7" }}>{c.agendamentos > 0 ? c.agendamentos : "—"}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#606070" }}>{c.mensagens > 0 ? fmt(c.investimento / c.mensagens) : "—"}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: c.agendamentos > 0 ? "#a855f7" : "#404050" }}>
                            {c.agendamentos > 0 ? fmt(c.investimento / c.agendamentos) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: "8px 14px 12px", fontSize: "11px", color: "#404050" }}>
                    * Agendamentos via UTM — disponíveis apenas para leads rastreados com parâmetros UTM nos links
                  </div>
                </div>
              )}
            </div>
          )}

          {!temMeta && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#1a1a0e", border: "1px solid #3a3a1e", borderRadius: "8px", fontSize: "13px", color: "#a0901a" }}>
              ⚠️ Meta Ads não conectado — dados de investimento e mensagens indisponíveis. Configure em Integrações.
            </div>
          )}
        </>
      )}
    </div>
  );
}
