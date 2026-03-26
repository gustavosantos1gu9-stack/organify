"use client";

import { useState, useEffect } from "react";
import { X, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Lead, supabase } from "@/lib/hooks";
import InputValor from "@/components/ui/InputValor";

interface EditarLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onSave: () => void;
}

const ETAPAS = [
  { value: "novo", label: "Não respondeu" },
  { value: "em_contato", label: "Em contato" },
  { value: "qualificado", label: "Qualificado" },
  { value: "reuniao_agendada", label: "Reunião agendada" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
];

const QUALIFICACOES = ["Quente", "Morno", "Frio"];
const ORIGENS = ["Facebook", "Instagram", "Google", "LinkedIn", "Indicação", "Outro"];
const STEP_LABELS = ["Informações Básicas", "Detalhes do Lead", "Informações Adicionais"];

interface HistoricoItem {
  id: string;
  etapa_anterior: string;
  etapa_nova: string;
  created_at: string;
}

export default function EditarLeadModal({ lead, onClose, onSave }: EditarLeadModalProps) {
  const [step, setStep] = useState(1);
  const [abaAtividade, setAbaAtividade] = useState<"comentarios" | "timeline" | "followups">("comentarios");
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [comentario, setComentario] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [followups, setFollowups] = useState<string[]>([]);
  const [comentarios, setComentarios] = useState<{ texto: string; data: string }[]>([]);

  const [form, setForm] = useState({
    nome: lead.nome || "",
    email: lead.email || "",
    telefone: lead.telefone || "",
    instagram: "",
    valor: lead.valor?.toString() || "",
    empresa: "",
    origem: lead.origens?.nome || "",
    etapa: lead.etapa || "novo",
    qualificacao: "Quente",
    responsavel: "Gustavo",
    categorias: "",
    observacoes: "",
    utm_campaign: lead.utm_campaign || "",
    utm_content: lead.utm_content || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Buscar histórico real do banco
  useEffect(() => {
    async function fetchHistorico() {
      const { data, error } = await supabase
        .from("leads_historico")
        .select("id, etapa_anterior, etapa_nova, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (!error && data) setHistorico(data);
    }
    fetchHistorico();
  }, [lead.id]);

  const getEtapaLabel = (key: string) =>
    ETAPAS.find((e) => e.value === key)?.label || key;

  const formatDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await supabase.from("leads").update({
        nome: form.nome,
        email: form.email || null,
        telefone: form.telefone || null,
        etapa: form.etapa,
        valor: parseFloat(form.valor) || 0,
        utm_campaign: form.utm_campaign || null,
        utm_content: form.utm_content || null,
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      onSave();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar lead");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarComentario = () => {
    if (!comentario.trim()) return;
    setComentarios((prev) => [...prev, {
      texto: comentario,
      data: new Date().toLocaleString("pt-BR"),
    }]);
    setComentario("");
  };

  const handleAddFollowup = () => {
    if (!followupDate) return;
    setFollowups((prev) => [...prev, followupDate]);
    setFollowupDate("");
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in" style={{ maxWidth: "580px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "600" }}>Editar lead</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px" }}><X size={16} /></button>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "28px" }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const isDone = n < step;
            const isActive = n === step;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <div className={`step-circle ${isDone ? "done" : isActive ? "active" : "pending"}`}
                    style={{ cursor: isDone ? "pointer" : undefined }}
                    onClick={() => isDone && setStep(n)}>
                    {isDone ? <Check size={14} /> : n}
                  </div>
                  <span style={{ fontSize: "11px", color: isActive ? "#22c55e" : isDone ? "#22c55e" : "#606060", whiteSpace: "nowrap" }}>
                    {label}
                  </span>
                </div>
                {i < 2 && <div className={`step-line ${isDone ? "done" : ""}`} style={{ marginBottom: "20px" }} />}
              </div>
            );
          })}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600" }}>Informações Básicas</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-input" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input className="form-input" placeholder="@exemplo" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor da oportunidade</label>
                <InputValor value={form.valor} onChange={(v) => set("valor", v)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <input className="form-input" placeholder="Nome da empresa" value={form.empresa} onChange={(e) => set("empresa", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600" }}>Detalhes do Lead</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Origem</label>
                <select className="form-input" value={form.origem} onChange={(e) => set("origem", e.target.value)}>
                  <option value="">Selecione</option>
                  {ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Etapa</label>
                <select className="form-input" value={form.etapa} onChange={(e) => set("etapa", e.target.value)}>
                  {ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qualificação</label>
                <select className="form-input" value={form.qualificacao} onChange={(e) => set("qualificacao", e.target.value)}>
                  {QUALIFICACOES.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px", padding: "14px", marginTop: "4px" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "#606060", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Rastreamento UTM</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Campanha</label>
                  <input className="form-input" placeholder="utm_campaign" value={form.utm_campaign} onChange={(e) => set("utm_campaign", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Público</label>
                  <input className="form-input" placeholder="utm_content" value={form.utm_content} onChange={(e) => set("utm_content", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600" }}>Informações Adicionais</h3>
            <div className="form-group">
              <label className="form-label">Responsável</label>
              <select className="form-input" value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)}>
                <option value="Gustavo">Gustavo</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-input" placeholder="Digite suas observações aqui..." value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} style={{ resize: "vertical" }} />
            </div>

            {/* Atividades */}
            <div style={{ border: "1px solid #2e2e2e", borderRadius: "10px", overflow: "hidden", marginTop: "8px" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #2e2e2e" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>Atividades</h3>
                <div style={{ display: "flex", borderBottom: "1px solid #2e2e2e" }}>
                  {[
                    { key: "comentarios", label: "Comentários", count: comentarios.length },
                    { key: "timeline", label: "Timeline", count: historico.length + 1 },
                    { key: "followups", label: "Follow-ups", count: followups.length },
                  ].map((aba) => (
                    <button key={aba.key} onClick={() => setAbaAtividade(aba.key as typeof abaAtividade)}
                      style={{
                        padding: "8px 16px", background: "none", border: "none", cursor: "pointer",
                        fontSize: "13px", fontWeight: "500",
                        color: abaAtividade === aba.key ? "#f0f0f0" : "#606060",
                        borderBottom: abaAtividade === aba.key ? "2px solid #22c55e" : "2px solid transparent",
                        marginBottom: "-1px", display: "flex", alignItems: "center", gap: "6px",
                      }}>
                      {aba.label}
                      <span style={{ background: "#2a2a2a", padding: "1px 6px", borderRadius: "10px", fontSize: "11px", color: "#a0a0a0" }}>{aba.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: "16px" }}>
                {/* Comentários */}
                {abaAtividade === "comentarios" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {comentarios.length === 0 && (
                      <p style={{ fontSize: "13px", color: "#606060", textAlign: "center", padding: "16px 0" }}>Nenhum comentário ainda</p>
                    )}
                    {comentarios.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: "10px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#22c55e", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>G</div>
                        <div style={{ flex: 1, background: "#1a1a1a", borderRadius: "8px", padding: "10px 12px" }}>
                          <p style={{ fontSize: "13px", color: "#f0f0f0", marginBottom: "4px" }}>{c.texto}</p>
                          <p style={{ fontSize: "11px", color: "#606060" }}>{c.data}</p>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#22c55e", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>G</div>
                      <div style={{ flex: 1 }}>
                        <textarea className="form-input" placeholder="Adicione um comentário..." value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} style={{ resize: "none", marginBottom: "8px" }} />
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button className="btn-primary" style={{ fontSize: "12px", padding: "6px 16px" }} onClick={handleEnviarComentario}>Enviar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline — dados reais do banco */}
                {abaAtividade === "timeline" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                      <button className="btn-ghost" style={{ fontSize: "12px" }}
                        onClick={async () => {
                          const { data } = await supabase.from("leads_historico")
                            .select("id, etapa_anterior, etapa_nova, created_at")
                            .eq("lead_id", lead.id)
                            .order("created_at", { ascending: false });
                          if (data) setHistorico(data);
                        }}>
                        Atualizar
                      </button>
                    </div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#a0a0a0", marginBottom: "12px" }}>Histórico de Atividades</p>

                    {/* Lead criado */}
                    <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(34,197,94,0.15)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>G</div>
                      <div style={{ flex: 1, background: "#1a1a1a", borderRadius: "8px", padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "500" }}>Gustavo</span>
                          <span style={{ fontSize: "11px", color: "#606060" }}>{formatDataHora(lead.created_at)}</span>
                        </div>
                        <p style={{ fontSize: "13px", color: "#a0a0a0" }}>Lead criado</p>
                      </div>
                    </div>

                    {/* Histórico de mudanças de etapa */}
                    {historico.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "#606060", textAlign: "center", padding: "12px 0" }}>Nenhuma mudança de etapa registrada.</p>
                    ) : historico.map((h) => (
                      <div key={h.id} style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(59,130,246,0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>G</div>
                        <div style={{ flex: 1, background: "#1a1a1a", borderRadius: "8px", padding: "10px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "500" }}>Gustavo</span>
                            <span style={{ fontSize: "11px", color: "#606060" }}>{formatDataHora(h.created_at)}</span>
                          </div>
                          <p style={{ fontSize: "13px", color: "#a0a0a0", marginBottom: "8px" }}>
                            Status alterado de '{getEtapaLabel(h.etapa_anterior)}' para '{getEtapaLabel(h.etapa_nova)}'
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div style={{ background: "#222", borderRadius: "6px", padding: "8px 10px" }}>
                              <p style={{ fontSize: "11px", color: "#606060", marginBottom: "4px" }}>Valor anterior:</p>
                              <p style={{ fontSize: "12px", color: "#a0a0a0" }}>{getEtapaLabel(h.etapa_anterior)}</p>
                            </div>
                            <div style={{ background: "#222", borderRadius: "6px", padding: "8px 10px" }}>
                              <p style={{ fontSize: "11px", color: "#606060", marginBottom: "4px" }}>Novo valor:</p>
                              <p style={{ fontSize: "12px", color: "#22c55e" }}>{getEtapaLabel(h.etapa_nova)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Follow-ups */}
                {abaAtividade === "followups" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: "13px", fontWeight: "600" }}>Histórico de follow-ups</p>
                      <button className="btn-primary" style={{ fontSize: "12px", padding: "5px 12px" }} onClick={handleAddFollowup}>
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                    <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#606060" }}>
                      Agende datas para receber notificações via WhatsApp lembrando de fazer um follow-up deste lead.
                    </div>
                    {followups.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "#606060", textAlign: "center", padding: "12px 0" }}>Nenhum follow-up adicionado.</p>
                    ) : followups.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1a1a1a", borderRadius: "8px", padding: "8px 12px" }}>
                        <input type="date" className="form-input" value={f} style={{ flex: 1, fontSize: "12px", padding: "4px 8px" }} readOnly />
                        <button onClick={() => setFollowups((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input type="date" className="form-input" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} style={{ flex: 1, fontSize: "12px" }} />
                      <button className="btn-secondary" style={{ fontSize: "12px", padding: "8px 12px" }} onClick={handleAddFollowup}>
                        <Check size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
          {step > 1 ? (
            <button className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft size={14} /> Anterior
            </button>
          ) : <div />}
          {step < 3 ? (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Próximo <ChevronRight size={14} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSave} disabled={loading}>
              <Check size={14} /> {loading ? "Salvando..." : "Atualizar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


interface EditarLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onSave: () => void;
}

