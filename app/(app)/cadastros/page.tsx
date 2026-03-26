"use client";

import { useEffect, useState } from "react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import { CheckCircle, XCircle, Eye, X, Copy, Check, Settings, GripVertical, Trash2, Plus } from "lucide-react";

interface Cadastro {
  id: string;
  nome: string;
  cnpj: string;
  cpf: string;
  rg: string;
  endereco_empresa: string;
  endereco_pessoal: string;
  email: string;
  investimento_anuncios: string;
  ticket_micro_laser: string;
  regiao_anunciar: string;
  faturamento_medio: string;
  login_facebook: string;
  status: string;
  criado_em: string;
}

interface Campo {
  id: string;
  label: string;
  type: string;
  obrigatorio: boolean;
}

const CAMPOS_PADRAO: Campo[] = [
  { id: "nome", label: "Nome completo", type: "text", obrigatorio: true },
  { id: "cnpj", label: "CNPJ", type: "text", obrigatorio: true },
  { id: "cpf", label: "CPF", type: "text", obrigatorio: true },
  { id: "rg", label: "RG", type: "text", obrigatorio: true },
  { id: "endereco_empresa", label: "Endereço da Empresa", type: "textarea", obrigatorio: true },
  { id: "endereco_pessoal", label: "Endereço Pessoal", type: "textarea", obrigatorio: true },
  { id: "email", label: "Email", type: "email", obrigatorio: true },
  { id: "investimento_anuncios", label: "Investimento em anúncios", type: "text", obrigatorio: true },
  { id: "ticket_micro_laser", label: "Ticket da micro/laser", type: "text", obrigatorio: true },
  { id: "regiao_anunciar", label: "Região/cidade para anunciar", type: "text", obrigatorio: true },
  { id: "faturamento_medio", label: "Faturamento médio", type: "text", obrigatorio: true },
  { id: "login_facebook", label: "Login do Facebook", type: "text", obrigatorio: true },
  { id: "senha_facebook", label: "Senha do Facebook", type: "password", obrigatorio: true },
];

const LINK_PUBLICO = typeof window !== "undefined"
  ? `${window.location.origin}/cadastro`
  : "https://salxconvert-blond.vercel.app/cadastro";

function formatarData(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function CadastrosPage() {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [rejeitando, setRejeitando] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Cadastro | null>(null);
  const [filtro, setFiltro] = useState<"pendente" | "aprovado" | "rejeitado">("pendente");
  const [copiado, setCopiado] = useState(false);
  const [modalCampos, setModalCampos] = useState(false);
  const [campos, setCampos] = useState<Campo[]>(CAMPOS_PADRAO);
  const [editandoLabel, setEditandoLabel] = useState<string | null>(null);
  const [novoLabel, setNovoLabel] = useState("");
  const [novoTipo, setNovoTipo] = useState("text");
  const [adicionando, setAdicionando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cadastros_clientes")
      .select("*")
      .eq("status", filtro)
      .order("criado_em", { ascending: true });
    setCadastros(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtro]);

  const copiarLink = () => {
    navigator.clipboard.writeText(LINK_PUBLICO);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const aprovar = async (cadastro: Cadastro) => {
    setAprovando(cadastro.id);
    try {
      const res = await fetch("/api/cadastros/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cadastro.id }),
      });
      if (!res.ok) throw new Error();
      await carregar();
      if (detalhe?.id === cadastro.id) setDetalhe(null);
    } catch {
      alert("Erro ao aprovar.");
    } finally {
      setAprovando(null);
    }
  };

  const rejeitar = async (id: string) => {
    setRejeitando(id);
    try {
      await supabase.from("cadastros_clientes").update({ status: "rejeitado" }).eq("id", id);
      await carregar();
      if (detalhe?.id === id) setDetalhe(null);
    } finally {
      setRejeitando(null);
    }
  };

  const salvarLabel = (id: string, label: string) => {
    setCampos(prev => prev.map(c => c.id === id ? { ...c, label } : c));
    setEditandoLabel(null);
  };

  const removerCampo = (id: string) => {
    setCampos(prev => prev.filter(c => c.id !== id));
  };

  const adicionarCampo = () => {
    if (!novoLabel.trim()) return;
    const newId = novoLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setCampos(prev => [...prev, { id: newId, label: novoLabel.trim(), type: novoTipo, obrigatorio: true }]);
    setNovoLabel("");
    setNovoTipo("text");
    setAdicionando(false);
  };

  const TABS = [
    { key: "pendente", label: "Pendentes" },
    { key: "aprovado", label: "Aprovados" },
    { key: "rejeitado", label: "Rejeitados" },
  ] as const;

  const camposDetalhe = [
    { label: "CNPJ", key: "cnpj" },
    { label: "CPF", key: "cpf" },
    { label: "RG", key: "rg" },
    { label: "Email", key: "email" },
    { label: "Endereço da Empresa", key: "endereco_empresa" },
    { label: "Endereço Pessoal", key: "endereco_pessoal" },
    { label: "Investimento em Anúncios", key: "investimento_anuncios" },
    { label: "Ticket Micro/Laser", key: "ticket_micro_laser" },
    { label: "Região para Anunciar", key: "regiao_anunciar" },
    { label: "Faturamento Médio", key: "faturamento_medio" },
    { label: "Login Facebook", key: "login_facebook" },
  ];

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Cadastros</span></div>
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Cadastros de Clientes</h1>
          <p style={{ fontSize: "13px", color: "#606060", marginTop: "4px" }}>Formulários enviados pelo link público</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Link público */}
          <div style={{ display: "flex", alignItems: "center", background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px", padding: "0 4px 0 12px", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#606060", whiteSpace: "nowrap" }}>Link público:</span>
            <span style={{ fontSize: "12px", color: "#29ABE2", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{LINK_PUBLICO}</span>
            <button onClick={copiarLink}
              style={{ background: copiado ? "#052e16" : "#2a2a2a", border: "none", borderRadius: "6px", padding: "7px 10px", cursor: "pointer", color: copiado ? "#22c55e" : "#a0a0a0", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
              {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
            </button>
          </div>
          {/* Editar perguntas */}
          <button onClick={() => setModalCampos(true)}
            style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", color: "#a0a0a0", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <Settings size={14} /> Editar perguntas
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#1a1a1a", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFiltro(t.key)}
            style={{ padding: "7px 20px", border: "none", borderRadius: "7px", cursor: "pointer", fontSize: "13px", fontWeight: filtro === t.key ? "600" : "400", background: filtro === t.key ? "#29ABE2" : "transparent", color: filtro === t.key ? "#000" : "#606060" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ border: "1px solid #2e2e2e", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#1a1a1a", borderBottom: "1px solid #2e2e2e" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#606060", fontWeight: "600" }}>NOME</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#606060", fontWeight: "600" }}>EMAIL</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#606060", fontWeight: "600" }}>DATA DE ENTRADA</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#606060", fontWeight: "600" }}>INVESTIMENTO</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", color: "#606060", fontWeight: "600" }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Carregando...</td></tr>
            ) : !cadastros.length ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Nenhum cadastro {filtro}.</td></tr>
            ) : cadastros.map((c, idx) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #1e1e1e", background: idx % 2 === 0 ? "transparent" : "#0a0a0a" }}>
                <td style={{ padding: "12px 16px", color: "#f0f0f0", fontWeight: "600" }}>{c.nome}</td>
                <td style={{ padding: "12px 16px", color: "#a0a0a0" }}>{c.email}</td>
                <td style={{ padding: "12px 16px", color: "#a0a0a0" }}>{formatarData(c.criado_em)}</td>
                <td style={{ padding: "12px 16px", color: "#a0a0a0" }}>{c.investimento_anuncios}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button onClick={() => setDetalhe(c)}
                      style={{ background: "#2a2a2a", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#a0a0a0", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                      <Eye size={13} /> Ver
                    </button>
                    {filtro === "pendente" && (
                      <>
                        <button onClick={() => aprovar(c)} disabled={aprovando === c.id}
                          style={{ background: "#052e16", border: "1px solid #22c55e40", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#22c55e", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", opacity: aprovando === c.id ? 0.6 : 1 }}>
                          <CheckCircle size={13} /> {aprovando === c.id ? "..." : "Aprovar"}
                        </button>
                        <button onClick={() => rejeitar(c.id)} disabled={rejeitando === c.id}
                          style={{ background: "#2d0a0a", border: "1px solid #ef444440", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", opacity: rejeitando === c.id ? 0.6 : 1 }}>
                          <XCircle size={13} /> {rejeitando === c.id ? "..." : "Rejeitar"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Painel detalhe */}
      {detalhe && (
        <>
          <div onClick={() => setDetalhe(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "420px", background: "#141414", borderLeft: "1px solid #2e2e2e", zIndex: 101, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2e2e2e", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a1a", position: "sticky", top: 0 }}>
              <div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>{detalhe.nome}</p>
                <p style={{ fontSize: "11px", color: "#606060", margin: 0 }}>Entrada: {formatarData(detalhe.criado_em)}</p>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {camposDetalhe.map(campo => (
                <div key={campo.key}>
                  <p style={{ fontSize: "11px", color: "#606060", margin: "0 0 3px" }}>{campo.label.toUpperCase()}</p>
                  <p style={{ fontSize: "13px", color: "#f0f0f0", margin: 0, wordBreak: "break-word" }}>{(detalhe as any)[campo.key] || "—"}</p>
                </div>
              ))}
            </div>
            {detalhe.status === "pendente" && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid #2e2e2e", display: "flex", gap: "10px", position: "sticky", bottom: 0, background: "#141414" }}>
                <button onClick={() => aprovar(detalhe)} disabled={aprovando === detalhe.id}
                  style={{ flex: 1, padding: "12px", background: "#22c55e", border: "none", borderRadius: "8px", cursor: "pointer", color: "#000", fontWeight: "700", fontSize: "14px" }}>
                  {aprovando === detalhe.id ? "Aprovando..." : "✓ Aprovar"}
                </button>
                <button onClick={() => rejeitar(detalhe.id)} disabled={rejeitando === detalhe.id}
                  style={{ flex: 1, padding: "12px", background: "#ef4444", border: "none", borderRadius: "8px", cursor: "pointer", color: "#fff", fontWeight: "700", fontSize: "14px" }}>
                  {rejeitando === detalhe.id ? "Rejeitando..." : "✕ Rejeitar"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal editar perguntas */}
      {modalCampos && (
        <>
          <div onClick={() => setModalCampos(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#141414", border: "1px solid #2e2e2e", borderRadius: "12px", width: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column", zIndex: 201, boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2e2e2e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>Editar perguntas do formulário</p>
                <p style={{ fontSize: "12px", color: "#606060", margin: 0 }}>As alterações atualizam o formulário público</p>
              </div>
              <button onClick={() => setModalCampos(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}><X size={16} /></button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
              {campos.map((campo, idx) => (
                <div key={campo.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", marginBottom: "4px", background: "#1a1a1a", border: "1px solid #2e2e2e" }}>
                  <GripVertical size={14} style={{ color: "#404040", flexShrink: 0 }} />
                  {editandoLabel === campo.id ? (
                    <input autoFocus defaultValue={campo.label}
                      onBlur={e => salvarLabel(campo.id, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") salvarLabel(campo.id, (e.target as HTMLInputElement).value); }}
                      style={{ flex: 1, background: "#0f0f0f", border: "1px solid #29ABE2", borderRadius: "6px", padding: "4px 8px", color: "#f0f0f0", fontSize: "13px", outline: "none" }} />
                  ) : (
                    <span onClick={() => setEditandoLabel(campo.id)} style={{ flex: 1, fontSize: "13px", color: "#f0f0f0", cursor: "pointer" }} title="Clique para editar">{campo.label}</span>
                  )}
                  <span style={{ fontSize: "11px", color: "#404040", background: "#2a2a2a", padding: "2px 6px", borderRadius: "4px" }}>{campo.type}</span>
                  {campo.obrigatorio && <span style={{ fontSize: "10px", color: "#f59e0b" }}>*</span>}
                  <button onClick={() => removerCampo(campo.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#404040", padding: "2px", flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#404040")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* Adicionar campo */}
              {adicionando ? (
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
                  <input autoFocus value={novoLabel} onChange={e => setNovoLabel(e.target.value)}
                    placeholder="Nome da pergunta..."
                    onKeyDown={e => { if (e.key === "Enter") adicionarCampo(); if (e.key === "Escape") setAdicionando(false); }}
                    style={{ flex: 1, background: "#0f0f0f", border: "1px solid #29ABE2", borderRadius: "6px", padding: "8px 10px", color: "#f0f0f0", fontSize: "13px", outline: "none" }} />
                  <select value={novoTipo} onChange={e => setNovoTipo(e.target.value)}
                    style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "6px", padding: "8px", color: "#f0f0f0", fontSize: "12px" }}>
                    <option value="text">texto</option>
                    <option value="textarea">textarea</option>
                    <option value="email">email</option>
                    <option value="password">senha</option>
                    <option value="number">número</option>
                  </select>
                  <button onClick={adicionarCampo}
                    style={{ background: "#29ABE2", border: "none", borderRadius: "6px", padding: "8px 14px", cursor: "pointer", color: "#000", fontWeight: "600", fontSize: "13px" }}>
                    Adicionar
                  </button>
                </div>
              ) : (
                <button onClick={() => setAdicionando(true)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "1px dashed #2e2e2e", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", color: "#606060", fontSize: "13px", marginTop: "8px", width: "100%" }}>
                  <Plus size={13} /> Adicionar pergunta
                </button>
              )}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #2e2e2e", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setModalCampos(false)}
                style={{ background: "#2a2a2a", border: "none", borderRadius: "8px", padding: "10px 20px", cursor: "pointer", color: "#f0f0f0", fontSize: "13px" }}>
                Fechar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
