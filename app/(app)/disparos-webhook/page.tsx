"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Check, X, Copy, Webhook } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface WebhookConfig {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  created_at: string;
}

const EVENTOS_DISPONIVEIS = [
  { key: "lead_novo", label: "Novo Lead" },
  { key: "lead_em_contato", label: "Lead em Contato" },
  { key: "lead_qualificado", label: "Lead Qualificado" },
  { key: "lead_reuniao", label: "Reunião Agendada" },
  { key: "lead_proposta", label: "Proposta Enviada" },
  { key: "lead_ganho", label: "Lead Ganho" },
  { key: "lead_perdido", label: "Lead Perdido" },
];

export default function DisparosWebhookPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: "", url: "", eventos: [] as string[] });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const agId = await getAgenciaId();
    const { data } = await supabase
      .from("webhooks")
      .select("*")
      .eq("agencia_id", agId!)
      .order("created_at", { ascending: false });
    setWebhooks(data || []);
    setLoading(false);
  }

  async function salvar() {
    if (!form.nome || !form.url) { alert("Preencha nome e URL"); return; }
    setSalvando(true);
    const agId = await getAgenciaId();
    await supabase.from("webhooks").insert({
      agencia_id: agId,
      nome: form.nome,
      url: form.url,
      eventos: form.eventos,
      ativo: true,
    });
    setModal(false);
    setForm({ nome: "", url: "", eventos: [] });
    setSalvando(false);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm("Remover este webhook?")) return;
    await supabase.from("webhooks").delete().eq("id", id);
    carregar();
  }

  async function toggleAtivo(wh: WebhookConfig) {
    await supabase.from("webhooks").update({ ativo: !wh.ativo }).eq("id", wh.id);
    carregar();
  }

  const toggleEvento = (key: string) => {
    setForm(f => ({
      ...f,
      eventos: f.eventos.includes(key) ? f.eventos.filter(e => e !== key) : [...f.eventos, key],
    }));
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Dashboard</a><span>›</span>
        <span className="current">Disparos de Webhook</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Disparos de Webhook</h1>
        <button className="btn-primary" onClick={() => setModal(true)} style={{ cursor: "pointer" }}>
          <Plus size={14} /> Novo Webhook
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>NOME</th><th>URL</th><th>EVENTOS</th><th>STATUS</th><th>AÇÕES</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Carregando...</td></tr>
            ) : !webhooks.length ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>
                Nenhum webhook configurado. Configure webhooks para receber notificações em tempo real.
              </td></tr>
            ) : webhooks.map(wh => (
              <tr key={wh.id} style={{ opacity: wh.ativo ? 1 : 0.5 }}>
                <td style={{ fontWeight: "500" }}>{wh.nome}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <code style={{ fontSize: "11px", color: "#29ABE2", background: "#1a1a1a", padding: "2px 6px", borderRadius: "4px", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {wh.url}
                    </code>
                    <button onClick={() => navigator.clipboard.writeText(wh.url)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}>
                      <Copy size={12} />
                    </button>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {(wh.eventos || []).slice(0, 3).map(e => (
                      <span key={e} className="badge badge-gray" style={{ fontSize: "10px" }}>{e.replace(/_/g, " ")}</span>
                    ))}
                    {(wh.eventos || []).length > 3 && <span className="badge badge-gray" style={{ fontSize: "10px" }}>+{wh.eventos.length - 3}</span>}
                  </div>
                </td>
                <td>
                  <button onClick={() => toggleAtivo(wh)} style={{
                    fontSize: "11px", padding: "3px 10px", borderRadius: "20px", cursor: "pointer",
                    background: wh.ativo ? "rgba(34,197,94,0.15)" : "rgba(96,96,96,0.15)",
                    color: wh.ativo ? "#22c55e" : "#606060",
                    border: `1px solid ${wh.ativo ? "rgba(34,197,94,0.3)" : "#2e2e2e"}`,
                  }}>{wh.ativo ? "Ativo" : "Inativo"}</button>
                </td>
                <td>
                  <button className="btn-danger" style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer" }} onClick={() => remover(wh.id)}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal animate-in" style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "600" }}>Novo Webhook</h2>
              <button onClick={() => setModal(false)} className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" placeholder="Ex: Notificação CRM" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">URL do Webhook</label>
                <input className="form-input" placeholder="https://..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: "8px", display: "block" }}>Eventos</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {EVENTOS_DISPONIVEIS.map(ev => {
                    const ativo = form.eventos.includes(ev.key);
                    return (
                      <div key={ev.key} onClick={() => toggleEvento(ev.key)} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "8px 12px", borderRadius: "6px", cursor: "pointer",
                        background: ativo ? "rgba(41,171,226,0.08)" : "#1a1a1a",
                        border: `1px solid ${ativo ? "rgba(41,171,226,0.3)" : "#2e2e2e"}`,
                      }}>
                        <div style={{
                          width: "16px", height: "16px", borderRadius: "3px",
                          border: `2px solid ${ativo ? "#29ABE2" : "#3a3a3a"}`,
                          background: ativo ? "#29ABE2" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {ativo && <Check size={10} color="#000" />}
                        </div>
                        <span style={{ fontSize: "13px", color: ativo ? "#f0f0f0" : "#808080" }}>{ev.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button className="btn-secondary" onClick={() => setModal(false)} style={{ cursor: "pointer" }}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={salvando} style={{ cursor: "pointer" }}>
                <Check size={14} /> {salvando ? "Salvando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
