"use client";

import { useState, useMemo } from "react";
import {
  useEscalas,
  useMetaEscala,
  useClientes,
  criarEscala,
  atualizarEscala,
  removerEscala,
  salvarMetaEscala,
  enviarEscalaProximoMes,
  Escala,
} from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  Save,
  TrendingUp,
  ClipboardCheck,
  BarChart3,
  ArrowRightCircle,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface EscalaPageProps {
  tipo: "ester" | "nicolas";
  titulo: string;
  subtitulo: string;
}

export default function EscalaPage({ tipo, titulo, subtitulo }: EscalaPageProps) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const { data: escalas, loading, refresh } = useEscalas(tipo, mes, ano);
  const { data: metaData, refresh: refreshMeta } = useMetaEscala(tipo, mes, ano);
  const { data: clientes } = useClientes();

  const [showModal, setShowModal] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [editando, setEditando] = useState<Escala | null>(null);
  const [busca, setBusca] = useState("");

  const [form, setForm] = useState({
    nome: "",
    cliente_id: "",
    planilha_preenchida: false,
    agendamentos: 0,
    custo_por_agendamento: 0,
    escala: false,
    investimento_anterior: 0,
    investimento_atual: 0,
    link_planilha: "",
  });

  const [metaForm, setMetaForm] = useState({
    meta_planilhas: 0,
    meta_escala_pct: 50,
  });

  // KPIs
  const kpis = useMemo(() => {
    if (!escalas) return { total: 0, planilhas: 0, escalados: 0, totalAgendamentos: 0, investTotal: 0, custoMedio: 0 };
    const planilhas = escalas.filter((e) => e.planilha_preenchida).length;
    const escalados = escalas.filter((e) => e.escala).length;
    const totalAgendamentos = escalas.reduce((s, e) => s + (e.agendamentos || 0), 0);
    const investTotal = escalas.reduce((s, e) => s + (e.investimento_atual || 0), 0);
    const custoMedio = totalAgendamentos > 0 ? investTotal / totalAgendamentos : 0;
    return { total: escalas.length, planilhas, escalados, totalAgendamentos, investTotal, custoMedio };
  }, [escalas]);

  // % de escala sobre quem preencheu planilha
  const taxaEscala = kpis.planilhas > 0 ? Math.round((kpis.escalados / kpis.planilhas) * 100) : 0;

  // Meta: % alcançada da meta de escala
  // Ex: meta_escala_pct = 50% → precisa 50% de quem preencheu planilha escalarem
  // Se 6 preencheram e meta é 50%, precisa 3 escalas. Se tem 3, meta = 100%
  const metaCalc = useMemo(() => {
    if (!metaData) return { planilhasPct: 0, escalaPctAlcancada: 0, escalaEsperadas: 0 };
    const planilhasPct = metaData.meta_planilhas > 0 ? Math.round((kpis.planilhas / metaData.meta_planilhas) * 100) : 0;
    const escalaEsperadas = kpis.planilhas > 0 ? Math.ceil((metaData.meta_escala_pct / 100) * kpis.planilhas) : 0;
    const escalaPctAlcancada = escalaEsperadas > 0 ? Math.round((kpis.escalados / escalaEsperadas) * 100) : 0;
    return { planilhasPct, escalaPctAlcancada, escalaEsperadas };
  }, [metaData, kpis]);

  const filtradas = useMemo(() => {
    if (!escalas) return [];
    if (!busca) return escalas;
    const b = busca.toLowerCase();
    return escalas.filter((e) => e.nome.toLowerCase().includes(b) || e.clientes?.nome?.toLowerCase().includes(b));
  }, [escalas, busca]);

  const prevMonth = () => { if (mes === 1) { setMes(12); setAno(ano - 1); } else setMes(mes - 1); };
  const nextMonth = () => { if (mes === 12) { setMes(1); setAno(ano + 1); } else setMes(mes + 1); };

  const openNew = () => {
    setEditando(null);
    setForm({ nome: "", cliente_id: "", planilha_preenchida: false, agendamentos: 0, custo_por_agendamento: 0, escala: false, investimento_anterior: 0, investimento_atual: 0, link_planilha: "" });
    setShowModal(true);
  };

  const openEdit = (e: Escala) => {
    setEditando(e);
    setForm({
      nome: e.nome,
      cliente_id: e.cliente_id ?? "",
      planilha_preenchida: e.planilha_preenchida,
      agendamentos: e.agendamentos,
      custo_por_agendamento: e.custo_por_agendamento,
      escala: e.escala,
      investimento_anterior: e.investimento_anterior,
      investimento_atual: e.investimento_atual,
      link_planilha: e.link_planilha ?? "",
    });
    setShowModal(true);
  };

  const openMeta = () => {
    setMetaForm({
      meta_planilhas: metaData?.meta_planilhas ?? 0,
      meta_escala_pct: metaData?.meta_escala_pct ?? 50,
    });
    setShowMetaModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const payload = { ...form, tipo, mes, ano, cliente_id: form.cliente_id || undefined };
    if (editando) {
      await atualizarEscala(editando.id, payload);
    } else {
      await criarEscala(payload);
    }
    setShowModal(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este registro?")) return;
    await removerEscala(id);
    refresh();
  };

  const handleToggle = async (e: Escala, field: "planilha_preenchida" | "escala") => {
    await atualizarEscala(e.id, { [field]: !e[field] });
    refresh();
  };

  const handleEnviarProximoMes = async (e: Escala) => {
    const proxMes = e.mes === 12 ? 1 : e.mes + 1;
    const proxAno = e.mes === 12 ? e.ano + 1 : e.ano;
    if (!confirm(`Enviar "${e.nome}" para ${MESES[proxMes - 1]} ${proxAno}?`)) return;
    await enviarEscalaProximoMes(e);
    refresh();
  };

  const handleSaveMeta = async () => {
    await salvarMetaEscala({ tipo, mes, ano, ...metaForm });
    setShowMetaModal(false);
    refreshMeta();
  };

  function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
      <div style={{ width: "100%", height: "6px", background: "#2e2e2e", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
    );
  }

  function BoolBadge({ value, labelTrue = "Sim", labelFalse = "Não" }: { value: boolean; labelTrue?: string; labelFalse?: string }) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600",
        background: value ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: value ? "#22c55e" : "#ef4444",
      }}>
        {value ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
        {value ? labelTrue : labelFalse}
      </span>
    );
  }

  return (
    <div className="animate-in" style={{ padding: "0" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>{titulo}</h1>
          <p style={{ fontSize: "13px", color: "#606060", marginTop: "4px" }}>{subtitulo}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={openMeta} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Target size={14} /> Definir Metas
          </button>
          <button onClick={openNew} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Novo Registro
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div style={{
        display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px",
        background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px", padding: "12px 20px",
      }}>
        <button onClick={prevMonth} style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#a0a0a0" }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: "600", color: "#f0f0f0" }}>{MESES[mes - 1]} {ano}</span>
        </div>
        <button onClick={nextMonth} style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#a0a0a0" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {/* Total */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Total Clientes</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
              <BarChart3 size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{kpis.total}</div>
        </div>

        {/* Planilhas preenchidas */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Planilhas Preenchidas</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e" }}>
              <ClipboardCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{kpis.planilhas}</div>
          {metaData && metaData.meta_planilhas > 0 && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#707070", marginBottom: "4px" }}>
                <span>Meta: {metaData.meta_planilhas}</span>
                <span style={{ color: metaCalc.planilhasPct >= 100 ? "#22c55e" : "#f59e0b" }}>{metaCalc.planilhasPct}%</span>
              </div>
              <ProgressBar value={kpis.planilhas} max={metaData.meta_planilhas} color="#22c55e" />
            </div>
          )}
        </div>

        {/* Escalados */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Escalaram</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(168,85,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{kpis.escalados}</div>
          {metaData && metaData.meta_escala_pct > 0 && kpis.planilhas > 0 && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#707070", marginBottom: "4px" }}>
                <span>Meta: {metaCalc.escalaEsperadas} ({metaData.meta_escala_pct}% de {kpis.planilhas})</span>
                <span style={{ color: metaCalc.escalaPctAlcancada >= 100 ? "#22c55e" : "#f59e0b" }}>{metaCalc.escalaPctAlcancada}%</span>
              </div>
              <ProgressBar value={kpis.escalados} max={metaCalc.escalaEsperadas} color="#a855f7" />
            </div>
          )}
        </div>

        {/* Investimento total */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Investimento Total</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{formatCurrency(kpis.investTotal)}</div>
          <div style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>
            Custo médio/agend.: {formatCurrency(kpis.custoMedio)}
          </div>
        </div>
      </div>

      {/* Barra taxa de escala */}
      {kpis.planilhas > 0 && (
        <div style={{
          background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px",
          padding: "16px 20px", marginBottom: "24px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0", display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp size={14} /> Taxa de Escala (sobre planilhas preenchidas)
            </span>
            <span style={{
              fontSize: "16px", fontWeight: "700",
              color: taxaEscala >= 60 ? "#22c55e" : taxaEscala >= 30 ? "#f59e0b" : "#ef4444",
            }}>
              {taxaEscala}%
            </span>
          </div>
          <ProgressBar value={kpis.escalados} max={kpis.planilhas} color="#29ABE2" />
          <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "11px", color: "#606060" }}>
            <span>{kpis.planilhas} planilhas preenchidas</span>
            <span>{kpis.escalados} escalaram</span>
            <span>{kpis.totalAgendamentos} agendamentos totais</span>
          </div>
        </div>
      )}

      {/* Busca */}
      <div style={{ marginBottom: "16px" }}>
        <input type="text" placeholder="Buscar por nome ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="form-input" style={{ maxWidth: "400px" }} />
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#606060" }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#606060", background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px" }}>
          <FileSpreadsheet size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <p>Nenhum registro em {MESES[mes - 1]} {ano}</p>
          <button onClick={openNew} className="btn-primary" style={{ marginTop: "12px" }}>
            <Plus size={14} /> Adicionar primeiro
          </button>
        </div>
      ) : (
        <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2e2e2e" }}>
                {["Nome", "Planilha", "Agend.", "Custo/Agend.", "Escala", "Invest. Anterior", "Invest. Atual", "Link", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "11px", color: "#707070", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #1e1e1e" }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = "#222")}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "14px", color: "#f0f0f0", fontWeight: "500" }}>{e.nome}</span>
                      {e.clientes?.nome && (
                        <span style={{ fontSize: "11px", color: "#29ABE2" }}>{e.clientes.nome}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button onClick={() => handleToggle(e, "planilha_preenchida")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <BoolBadge value={e.planilha_preenchida} />
                    </button>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: "13px", color: "#f0f0f0", fontWeight: "500" }}>
                    {e.agendamentos}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: "13px", color: "#a0a0a0" }}>
                    {formatCurrency(e.custo_por_agendamento)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button onClick={() => handleToggle(e, "escala")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <BoolBadge value={e.escala} />
                    </button>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: "13px", color: "#a0a0a0" }}>
                    {formatCurrency(e.investimento_anterior)}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: "13px", color: "#f0f0f0" }}>
                    {formatCurrency(e.investimento_atual)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {e.link_planilha ? (
                      <a href={e.link_planilha} target="_blank" rel="noopener noreferrer" style={{ color: "#29ABE2", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                        <ExternalLink size={13} /> Abrir
                      </a>
                    ) : (
                      <span style={{ color: "#606060", fontSize: "12px" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "2px", justifyContent: "flex-end" }}>
                      <button onClick={() => handleEnviarProximoMes(e)} className="btn-ghost" style={{ padding: "6px", color: "#29ABE2" }} title="Enviar para próximo mês">
                        <ArrowRightCircle size={14} />
                      </button>
                      <button onClick={() => openEdit(e)} className="btn-ghost" style={{ padding: "6px", color: "#707070" }}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="btn-ghost" style={{ padding: "6px", color: "#707070" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal animate-in" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#f0f0f0" }}>
                {editando ? "Editar Registro" : "Novo Registro"}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} placeholder="Nome do registro" />
              </div>

              <div className="form-group">
                <label className="form-label">Cliente associado</label>
                <select className="form-input" value={form.cliente_id} onChange={(ev) => setForm({ ...form, cliente_id: ev.target.value })}>
                  <option value="">Nenhum</option>
                  {clientes?.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Planilha preenchida</label>
                  <select className="form-input" value={form.planilha_preenchida ? "true" : "false"} onChange={(ev) => setForm({ ...form, planilha_preenchida: ev.target.value === "true" })}>
                    <option value="false">Não</option>
                    <option value="true">Sim</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Escala</label>
                  <select className="form-input" value={form.escala ? "true" : "false"} onChange={(ev) => setForm({ ...form, escala: ev.target.value === "true" })}>
                    <option value="false">Não</option>
                    <option value="true">Sim</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Agendamentos</label>
                  <input className="form-input" type="number" min={0} value={form.agendamentos} onChange={(ev) => setForm({ ...form, agendamentos: Number(ev.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Custo por agendamento</label>
                  <input className="form-input" type="number" min={0} step={0.01} value={form.custo_por_agendamento} onChange={(ev) => setForm({ ...form, custo_por_agendamento: Number(ev.target.value) })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Investimento anterior</label>
                  <input className="form-input" type="number" min={0} step={0.01} value={form.investimento_anterior} onChange={(ev) => setForm({ ...form, investimento_anterior: Number(ev.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Investimento atual</label>
                  <input className="form-input" type="number" min={0} step={0.01} value={form.investimento_atual} onChange={(ev) => setForm({ ...form, investimento_atual: Number(ev.target.value) })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Link da planilha</label>
                <input className="form-input" value={form.link_planilha} onChange={(ev) => setForm({ ...form, link_planilha: ev.target.value })} placeholder="https://..." />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} className="btn-primary">{editando ? "Salvar" : "Criar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Metas */}
      {showMetaModal && (
        <div className="modal-overlay" onClick={() => setShowMetaModal(false)}>
          <div className="modal animate-in" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#f0f0f0" }}>
                Metas - {MESES[mes - 1]} {ano}
              </h2>
              <button onClick={() => setShowMetaModal(false)} className="btn-ghost" style={{ padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#707070", marginBottom: "20px" }}>
              A meta de escala calcula automaticamente quantos clientes precisam escalar com base em quem preencheu a planilha.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Meta de Planilhas Preenchidas</label>
                <input className="form-input" type="number" min={0} value={metaForm.meta_planilhas} onChange={(ev) => setMetaForm({ ...metaForm, meta_planilhas: Number(ev.target.value) })} />
                <span style={{ fontSize: "11px", color: "#606060" }}>Atual: {kpis.planilhas} ({metaForm.meta_planilhas > 0 ? Math.round((kpis.planilhas / metaForm.meta_planilhas) * 100) : 0}%)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Meta de Escala (% sobre planilhas preenchidas)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input className="form-input" type="number" min={0} max={100} value={metaForm.meta_escala_pct} onChange={(ev) => setMetaForm({ ...metaForm, meta_escala_pct: Number(ev.target.value) })} />
                  <span style={{ color: "#a0a0a0", fontSize: "14px" }}>%</span>
                </div>
                <span style={{ fontSize: "11px", color: "#606060" }}>
                  Ex: Se {kpis.planilhas || "X"} preencheram e meta é {metaForm.meta_escala_pct}%, precisa de{" "}
                  {kpis.planilhas > 0 ? Math.ceil((metaForm.meta_escala_pct / 100) * kpis.planilhas) : "Y"} escalas.
                  Atual: {kpis.escalados} escalaram
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setShowMetaModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveMeta} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Save size={14} /> Salvar Metas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
