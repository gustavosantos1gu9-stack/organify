"use client";

import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, Search, Check, X, Users, Building2,
  ChevronDown, ChevronUp, UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/hooks";

const MODULOS_DISPONIVEIS = [
  { key: "inbox", label: "Inbox WhatsApp" },
  { key: "crm", label: "CRM" },
  { key: "links_campanhas", label: "Links & Campanhas" },
  { key: "configurar_campanha", label: "Configurar Campanha" },
  { key: "jornada", label: "Jornada de Compra" },
  { key: "controle_clientes", label: "Controle de Clientes" },
  { key: "cadastros", label: "Cadastros" },
  { key: "relatorios_meta", label: "Relatórios Meta" },
  { key: "relatorios_conexoes", label: "Relatórios — Conexões" },
  { key: "relatorios_alertas", label: "Relatórios — Alertas" },
  { key: "configuracoes", label: "Configurações" },
];

const MODULOS_PADRAO = ["inbox", "crm", "links_campanhas", "configurar_campanha", "jornada"];

interface Agencia {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  modulos_habilitados: string[];
  created_at: string;
}

interface UsuarioFilha {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function apiCall(method: string, body?: any) {
  const token = await getToken();
  const opts: RequestInit = {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
  if (method === "GET") {
    const res = await fetch("/api/agencias-filhas", { ...opts, method: "GET" });
    return res.json();
  }
  const res = await fetch("/api/agencias-filhas", { ...opts, method: "POST", body: JSON.stringify(body) });
  return res.json();
}

function AgenciaModal({ item, onClose, onSave }: { item?: Agencia; onClose: () => void; onSave: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    nome: item?.nome || "",
    email: item?.email || "",
    telefone: item?.telefone || "",
    modulos: item?.modulos_habilitados || [...MODULOS_PADRAO],
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const toggleModulo = (key: string) => {
    setForm(f => ({
      ...f,
      modulos: f.modulos.includes(key) ? f.modulos.filter(m => m !== key) : [...f.modulos, key],
    }));
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { setErro("Preencha o nome"); return; }
    setLoading(true);
    setErro("");
    try {
      const payload = {
        action: isEdit ? "update" : "create",
        id: item?.id,
        nome: form.nome,
        email: form.email || null,
        telefone: form.telefone || null,
        modulos_habilitados: form.modulos,
      };
      const res = await apiCall("POST", payload);
      if (res.error) { setErro(res.error); setLoading(false); return; }
      onSave();
      onClose();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in" style={{ maxWidth: "540px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "600" }}>{isEdit ? "Editar" : "Nova"} Cliente</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Nome da empresa *</label>
            <input className="form-input" placeholder="Ex: Studio Roseli" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" placeholder="contato@empresa.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: "12px", display: "block" }}>Módulos habilitados</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {MODULOS_DISPONIVEIS.map(m => {
                const ativo = form.modulos.includes(m.key);
                return (
                  <div key={m.key} onClick={() => toggleModulo(m.key)} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px", borderRadius: "8px", cursor: "pointer",
                    background: ativo ? "rgba(41,171,226,0.08)" : "#1a1a1a",
                    border: `1px solid ${ativo ? "rgba(41,171,226,0.3)" : "#2e2e2e"}`,
                  }}>
                    <div style={{
                      width: "18px", height: "18px", borderRadius: "4px",
                      border: `2px solid ${ativo ? "#29ABE2" : "#3a3a3a"}`,
                      background: ativo ? "#29ABE2" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {ativo && <Check size={12} color="#000" />}
                    </div>
                    <span style={{ fontSize: "13px", color: ativo ? "#f0f0f0" : "#808080" }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {erro && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#ef4444", marginTop: "12px" }}>{erro}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          <button className="btn-secondary" onClick={onClose} style={{ cursor: "pointer" }}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ cursor: "pointer" }}>
            <Check size={14} /> {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserModal({ agenciaId, agenciaNome, onClose, onSave }: { agenciaId: string; agenciaNome: string; onClose: () => void; onSave: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleSave = async () => {
    if (!email.trim()) { setErro("Preencha o e-mail"); return; }
    setLoading(true);
    setErro("");
    try {
      const res = await apiCall("POST", {
        action: "create_user",
        agencia_id: agenciaId,
        user_nome: nome || email.split("@")[0],
        user_email: email,
      });
      if (res.error) { setErro(res.error); setLoading(false); return; }
      onSave();
      onClose();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in" style={{ maxWidth: "420px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: "600" }}>Novo Usuário</h2>
            <p style={{ fontSize: "12px", color: "#606060", marginTop: "2px" }}>{agenciaNome}</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="form-input" placeholder="Nome do usuário" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail *</label>
            <input className="form-input" type="email" placeholder="email@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        {erro && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#ef4444", marginTop: "12px" }}>{erro}</div>
        )}
        <p style={{ fontSize: "11px", color: "#606060", marginTop: "12px" }}>O usuário receberá um email de convite para acessar a plataforma.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
          <button className="btn-secondary" onClick={onClose} style={{ cursor: "pointer" }}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ cursor: "pointer" }}>
            <Check size={14} /> {loading ? "Enviando..." : "Convidar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientesSaasPage() {
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Agencia | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Record<string, UsuarioFilha[]>>({});
  const [showUserModal, setShowUserModal] = useState<Agencia | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await apiCall("GET");
      setAgencias(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  const carregarUsuarios = async (agenciaId: string) => {
    const data = await apiCall("POST", { action: "list_users", agencia_id: agenciaId });
    setUsuarios(prev => ({ ...prev, [agenciaId]: Array.isArray(data) ? data : [] }));
  };

  const toggleExpandir = (id: string) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (!usuarios[id]) carregarUsuarios(id);
  };

  const remover = async (id: string) => {
    if (!confirm("Remover esta cliente e todos os dados dela?")) return;
    await apiCall("POST", { action: "delete", id });
    carregar();
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = agencias.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span className="current">Clientes SaaS</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Clientes SaaS</h1>
          <p style={{ fontSize: "13px", color: "#606060", marginTop: "4px" }}>Gerencie as agências das suas clientes com acesso próprio à plataforma.</p>
        </div>
      </div>

      <div className="table-wrapper">
        <div style={{ padding: "16px", display: "flex", gap: "12px", borderBottom: "1px solid #2e2e2e" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar clientes..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ cursor: "pointer" }}>
            <Plus size={14} /> Nova Cliente
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Carregando...</div>
        ) : !filtrados.length ? (
          <div style={{ textAlign: "center", color: "#606060", padding: "48px" }}>
            {agencias.length === 0 ? "Nenhuma cliente cadastrada. Clique em \"Nova Cliente\" para começar." : "Nenhuma cliente encontrada."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtrados.map(a => (
              <div key={a.id} style={{ borderBottom: "1px solid #2e2e2e" }}>
                {/* Linha principal */}
                <div style={{
                  display: "flex", alignItems: "center", padding: "16px 20px", gap: "16px",
                  cursor: "pointer",
                }} onClick={() => toggleExpandir(a.id)}>
                  <Building2 size={18} color="#29ABE2" />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0" }}>{a.nome}</p>
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                      {(a.modulos_habilitados || []).map(m => {
                        const mod = MODULOS_DISPONIVEIS.find(md => md.key === m);
                        return (
                          <span key={m} className="badge badge-gray" style={{ fontSize: "10px" }}>
                            {mod?.label || m}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button className="btn-secondary" style={{ padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); setEditando(a); }}>
                      <Edit2 size={12} /> Editar
                    </button>
                    <button className="btn-danger" style={{ padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); remover(a.id); }}>
                      <Trash2 size={12} />
                    </button>
                    {expandido === a.id ? <ChevronUp size={16} color="#606060" /> : <ChevronDown size={16} color="#606060" />}
                  </div>
                </div>

                {/* Expandido: usuários */}
                {expandido === a.id && (
                  <div style={{ padding: "0 20px 16px 54px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <p style={{ fontSize: "13px", fontWeight: "600", color: "#a0a0a0" }}>
                        <Users size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                        Usuários ({usuarios[a.id]?.length || 0})
                      </p>
                      <button className="btn-secondary" style={{ padding: "4px 10px", fontSize: "11px", cursor: "pointer" }}
                        onClick={() => setShowUserModal(a)}>
                        <UserPlus size={12} /> Convidar
                      </button>
                    </div>
                    {!usuarios[a.id] ? (
                      <p style={{ fontSize: "12px", color: "#606060" }}>Carregando...</p>
                    ) : usuarios[a.id].length === 0 ? (
                      <p style={{ fontSize: "12px", color: "#606060" }}>Nenhum usuário. Convide o primeiro acima.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {usuarios[a.id].map(u => (
                          <div key={u.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "8px 12px", background: "#1a1a1a", borderRadius: "6px", border: "1px solid #2e2e2e",
                          }}>
                            <div>
                              <span style={{ fontSize: "13px", color: "#f0f0f0" }}>{u.nome}</span>
                              <span style={{ fontSize: "11px", color: "#606060", marginLeft: "8px" }}>{u.email}</span>
                            </div>
                            <span style={{
                              fontSize: "11px", padding: "2px 8px", borderRadius: "12px",
                              background: u.ativo ? "rgba(41,171,226,0.15)" : "rgba(96,96,96,0.15)",
                              color: u.ativo ? "#f0f0f0" : "#606060",
                            }}>{u.ativo ? "Ativo" : "Inativo"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && <AgenciaModal onClose={() => setShowModal(false)} onSave={carregar} />}
      {editando && <AgenciaModal item={editando} onClose={() => setEditando(null)} onSave={carregar} />}
      {showUserModal && (
        <UserModal
          agenciaId={showUserModal.id}
          agenciaNome={showUserModal.nome}
          onClose={() => setShowUserModal(null)}
          onSave={() => carregarUsuarios(showUserModal.id)}
        />
      )}
    </div>
  );
}
