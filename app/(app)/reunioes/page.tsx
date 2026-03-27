"use client";

import { useState, useMemo } from "react";
import {
  useReunioes,
  useMetaReuniao,
  useClientes,
  criarReuniao,
  atualizarReuniao,
  removerReuniao,
  salvarMetaReuniao,
  Reuniao,
} from "@/lib/hooks";
import {
  CalendarCheck,
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckCircle2,
  Users,
  MessageSquare,
  Save,
  TrendingUp,
} from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_OPTIONS = [
  { value: "Agendado", label: "Agendado", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { value: "Realizado", label: "Realizado", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  { value: "Cancelado", label: "Cancelado", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  { value: "Não compareceu", label: "Não compareceu", color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
];

const MOTIVO_OPTIONS = ["Alinhamento", "Reunião de apresentação", "Follow-up", "Outro"];

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

export default function ReunioesPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const { data: reunioes, loading, refresh } = useReunioes(mes, ano);
  const { data: metaData, refresh: refreshMeta } = useMetaReuniao(mes, ano);
  const { data: clientes } = useClientes();

  const [showModal, setShowModal] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [editando, setEditando] = useState<Reuniao | null>(null);
  const [busca, setBusca] = useState("");

  // Form state
  const [form, setForm] = useState({
    nome: "",
    participantes: "",
    status: "Agendado",
    data: "",
    motivo: "Alinhamento",
    feedback: "",
    responsavel: "",
    cliente_id: "",
  });

  // Meta form state
  const [metaForm, setMetaForm] = useState({
    meta_total: 0,
    meta_realizadas: 0,
    meta_apresentacao: 0,
    meta_alinhamento: 0,
  });

  // KPIs calculados
  const kpis = useMemo(() => {
    if (!reunioes) return { total: 0, realizadas: 0, agendadas: 0, apresentacao: 0, alinhamento: 0, canceladas: 0 };
    return {
      total: reunioes.length,
      realizadas: reunioes.filter((r) => r.status === "Realizado").length,
      agendadas: reunioes.filter((r) => r.status === "Agendado").length,
      apresentacao: reunioes.filter((r) => r.motivo?.startsWith("Reunião de apresentação")).length,
      alinhamento: reunioes.filter((r) => r.motivo?.startsWith("Alinhamento")).length,
      canceladas: reunioes.filter((r) => r.status === "Cancelado" || r.status === "Não compareceu").length,
    };
  }, [reunioes]);

  // Porcentagens de meta
  const metaPercent = useMemo(() => {
    const mt = metaData;
    if (!mt) return { total: 0, realizadas: 0, apresentacao: 0, alinhamento: 0 };
    return {
      total: mt.meta_total > 0 ? Math.round((kpis.total / mt.meta_total) * 100) : 0,
      realizadas: mt.meta_realizadas > 0 ? Math.round((kpis.realizadas / mt.meta_realizadas) * 100) : 0,
      apresentacao: mt.meta_apresentacao > 0 ? Math.round((kpis.apresentacao / mt.meta_apresentacao) * 100) : 0,
      alinhamento: mt.meta_alinhamento > 0 ? Math.round((kpis.alinhamento / mt.meta_alinhamento) * 100) : 0,
    };
  }, [kpis, metaData]);

  const filtradas = useMemo(() => {
    if (!reunioes) return [];
    if (!busca) return reunioes;
    const b = busca.toLowerCase();
    return reunioes.filter(
      (r) =>
        r.nome.toLowerCase().includes(b) ||
        (r.participantes?.toLowerCase().includes(b)) ||
        (r.motivo?.toLowerCase().includes(b))
    );
  }, [reunioes, busca]);

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAno(ano - 1); }
    else setMes(mes - 1);
  };
  const nextMonth = () => {
    if (mes === 12) { setMes(1); setAno(ano + 1); }
    else setMes(mes + 1);
  };

  const openNew = () => {
    setEditando(null);
    setForm({ nome: "", participantes: "", status: "Agendado", data: "", motivo: "Alinhamento", feedback: "", responsavel: "", cliente_id: "" });
    setShowModal(true);
  };

  const openEdit = (r: Reuniao) => {
    setEditando(r);
    setForm({
      nome: r.nome,
      participantes: r.participantes ?? "",
      status: r.status,
      data: r.data?.split("T")[0] ?? "",
      motivo: r.motivo ?? "Alinhamento",
      feedback: r.feedback ?? "",
      responsavel: r.responsavel ?? "",
      cliente_id: r.cliente_id ?? "",
    });
    setShowModal(true);
  };

  const openMeta = () => {
    setMetaForm({
      meta_total: metaData?.meta_total ?? 0,
      meta_realizadas: metaData?.meta_realizadas ?? 0,
      meta_apresentacao: metaData?.meta_apresentacao ?? 0,
      meta_alinhamento: metaData?.meta_alinhamento ?? 0,
    });
    setShowMetaModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const payload = { ...form, cliente_id: form.cliente_id || undefined };
    if (editando) {
      await atualizarReuniao(editando.id, payload);
    } else {
      await criarReuniao(payload);
    }
    setShowModal(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta reunião?")) return;
    await removerReuniao(id);
    refresh();
  };

  const handleStatusChange = async (r: Reuniao, novoStatus: string) => {
    await atualizarReuniao(r.id, { status: novoStatus });
    refresh();
  };

  const handleSaveMeta = async () => {
    await salvarMetaReuniao({ mes, ano, ...metaForm });
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

  return (
    <div className="animate-in" style={{ padding: "0" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>
            Reuniões Lavínia
          </h1>
          <p style={{ fontSize: "13px", color: "#606060", marginTop: "4px" }}>
            Controle de reuniões mensais
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={openMeta} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Target size={14} /> Definir Metas
          </button>
          <button onClick={openNew} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Nova Reunião
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
          <span style={{ fontSize: "18px", fontWeight: "600", color: "#f0f0f0" }}>
            {MESES[mes - 1]} {ano}
          </span>
        </div>
        <button onClick={nextMonth} style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#a0a0a0" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {/* Total */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Total de Reuniões</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
              <CalendarCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{kpis.total}</div>
          {metaData && metaData.meta_total > 0 && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#707070", marginBottom: "4px" }}>
                <span>Meta: {metaData.meta_total}</span>
                <span style={{ color: metaPercent.total >= 100 ? "#22c55e" : "#f59e0b" }}>{metaPercent.total}%</span>
              </div>
              <ProgressBar value={kpis.total} max={metaData.meta_total} color="#3b82f6" />
            </div>
          )}
        </div>

        {/* Realizadas */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Realizadas</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{kpis.realizadas}</div>
          {metaData && metaData.meta_realizadas > 0 && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#707070", marginBottom: "4px" }}>
                <span>Meta: {metaData.meta_realizadas}</span>
                <span style={{ color: metaPercent.realizadas >= 100 ? "#22c55e" : "#f59e0b" }}>{metaPercent.realizadas}%</span>
              </div>
              <ProgressBar value={kpis.realizadas} max={metaData.meta_realizadas} color="#22c55e" />
            </div>
          )}
        </div>

        {/* Apresentação */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Apresentação</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(168,85,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{kpis.apresentacao}</div>
          {metaData && metaData.meta_apresentacao > 0 && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#707070", marginBottom: "4px" }}>
                <span>Meta: {metaData.meta_apresentacao}</span>
                <span style={{ color: metaPercent.apresentacao >= 100 ? "#22c55e" : "#f59e0b" }}>{metaPercent.apresentacao}%</span>
              </div>
              <ProgressBar value={kpis.apresentacao} max={metaData.meta_apresentacao} color="#a855f7" />
            </div>
          )}
        </div>

        {/* Alinhamento */}
        <div className="kpi-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Alinhamento</span>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#f0f0f0" }}>{kpis.alinhamento}</div>
          {metaData && metaData.meta_alinhamento > 0 && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#707070", marginBottom: "4px" }}>
                <span>Meta: {metaData.meta_alinhamento}</span>
                <span style={{ color: metaPercent.alinhamento >= 100 ? "#22c55e" : "#f59e0b" }}>{metaPercent.alinhamento}%</span>
              </div>
              <ProgressBar value={kpis.alinhamento} max={metaData.meta_alinhamento} color="#f59e0b" />
            </div>
          )}
        </div>
      </div>

      {/* Barra de taxa de realização */}
      {kpis.total > 0 && (
        <div style={{
          background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px",
          padding: "16px 20px", marginBottom: "24px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#a0a0a0", display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp size={14} /> Taxa de Realização
            </span>
            <span style={{
              fontSize: "16px", fontWeight: "700",
              color: (kpis.realizadas / kpis.total) * 100 >= 80 ? "#22c55e" : (kpis.realizadas / kpis.total) * 100 >= 50 ? "#f59e0b" : "#ef4444",
            }}>
              {Math.round((kpis.realizadas / kpis.total) * 100)}%
            </span>
          </div>
          <ProgressBar value={kpis.realizadas} max={kpis.total} color="#29ABE2" />
          <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "11px", color: "#606060" }}>
            <span>{kpis.realizadas} realizadas</span>
            <span>{kpis.agendadas} agendadas</span>
            <span>{kpis.canceladas} canceladas/não compareceu</span>
          </div>
        </div>
      )}

      {/* Busca */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Buscar por nome, participante ou motivo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="form-input"
          style={{ maxWidth: "400px" }}
        />
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#606060" }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px", color: "#606060",
          background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px",
        }}>
          <CalendarCheck size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <p>Nenhuma reunião em {MESES[mes - 1]} {ano}</p>
          <button onClick={openNew} className="btn-primary" style={{ marginTop: "12px" }}>
            <Plus size={14} /> Adicionar primeira reunião
          </button>
        </div>
      ) : (
        <div style={{
          background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2e2e2e" }}>
                {["Nome", "Participantes", "Status", "Data", "Motivo", "Feedback", ""].map((h) => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left", fontSize: "12px",
                    color: "#707070", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => {
                const st = getStatusStyle(r.status);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #1e1e1e" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#222")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontSize: "14px", color: "#f0f0f0", fontWeight: "500" }}>
                      {r.nome}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#a0a0a0" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {r.clientes?.nome && (
                          <span style={{ color: "#29ABE2", fontSize: "12px", fontWeight: "500" }}>{r.clientes.nome}</span>
                        )}
                        {r.participantes && <span>{r.participantes}</span>}
                        {!r.clientes?.nome && !r.participantes && "—"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <select
                        value={r.status}
                        onChange={(e) => handleStatusChange(r, e.target.value)}
                        style={{
                          background: st.bg, color: st.color, border: "none",
                          borderRadius: "6px", padding: "4px 8px", fontSize: "12px",
                          fontWeight: "600", cursor: "pointer", outline: "none",
                        }}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#a0a0a0" }}>
                      {r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#a0a0a0" }}>
                      {r.motivo ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#a0a0a0", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.feedback || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(r)} className="btn-ghost" style={{ padding: "6px", color: "#707070" }}>
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="btn-ghost" style={{ padding: "6px", color: "#707070" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova/Editar Reunião */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal animate-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#f0f0f0" }}>
                {editando ? "Editar Reunião" : "Nova Reunião"}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: REUNIÃO FLAVIA ANDRADE" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Data</label>
                  <input className="form-input" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cliente associado</label>
                <select className="form-input" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">Nenhum (sem vínculo)</option>
                  {clientes?.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Participantes</label>
                  <input className="form-input" value={form.participantes} onChange={(e) => setForm({ ...form, participantes: e.target.value })} placeholder="Ex: Salx Digital" />
                </div>
                <div className="form-group">
                  <label className="form-label">Motivo</label>
                  <select className="form-input" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
                    {MOTIVO_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Responsável</label>
                <input className="form-input" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Nome do responsável" />
              </div>

              <div className="form-group">
                <label className="form-label">Feedback</label>
                <textarea className="form-input" rows={3} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} placeholder="Observações sobre a reunião..." />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} className="btn-primary">
                {editando ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Definir Metas */}
      {showMetaModal && (
        <div className="modal-overlay" onClick={() => setShowMetaModal(false)}>
          <div className="modal animate-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#f0f0f0" }}>
                Metas - {MESES[mes - 1]} {ano}
              </h2>
              <button onClick={() => setShowMetaModal(false)} className="btn-ghost" style={{ padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#707070", marginBottom: "20px" }}>
              Defina as metas para este mês. Os KPIs mostrarão a porcentagem alcançada.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Meta de Reuniões Totais</label>
                <input className="form-input" type="number" min={0} value={metaForm.meta_total} onChange={(e) => setMetaForm({ ...metaForm, meta_total: Number(e.target.value) })} />
                <span style={{ fontSize: "11px", color: "#606060" }}>Atual: {kpis.total} ({metaForm.meta_total > 0 ? Math.round((kpis.total / metaForm.meta_total) * 100) : 0}%)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Meta de Reuniões Realizadas</label>
                <input className="form-input" type="number" min={0} value={metaForm.meta_realizadas} onChange={(e) => setMetaForm({ ...metaForm, meta_realizadas: Number(e.target.value) })} />
                <span style={{ fontSize: "11px", color: "#606060" }}>Atual: {kpis.realizadas} ({metaForm.meta_realizadas > 0 ? Math.round((kpis.realizadas / metaForm.meta_realizadas) * 100) : 0}%)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Meta de Apresentações</label>
                <input className="form-input" type="number" min={0} value={metaForm.meta_apresentacao} onChange={(e) => setMetaForm({ ...metaForm, meta_apresentacao: Number(e.target.value) })} />
                <span style={{ fontSize: "11px", color: "#606060" }}>Atual: {kpis.apresentacao} ({metaForm.meta_apresentacao > 0 ? Math.round((kpis.apresentacao / metaForm.meta_apresentacao) * 100) : 0}%)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Meta de Alinhamentos</label>
                <input className="form-input" type="number" min={0} value={metaForm.meta_alinhamento} onChange={(e) => setMetaForm({ ...metaForm, meta_alinhamento: Number(e.target.value) })} />
                <span style={{ fontSize: "11px", color: "#606060" }}>Atual: {kpis.alinhamento} ({metaForm.meta_alinhamento > 0 ? Math.round((kpis.alinhamento / metaForm.meta_alinhamento) * 100) : 0}%)</span>
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
