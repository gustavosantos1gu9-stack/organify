"use client";

import { Faixa } from "@/components/ui/Canvas";

import { useEffect, useState } from "react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import { CheckCircle, XCircle, Eye, X, Copy, Check, Settings, GripVertical, Trash2, Plus, FileText } from "lucide-react";
import ModalContrato from "@/components/controle/ModalContrato";

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
  const [filtro, setFiltro] = useState<string>("pendente");
  const [copiado, setCopiado] = useState(false);
  const [senhaDescriptografada, setSenhaDescriptografada] = useState<string>("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [modalCampos, setModalCampos] = useState(false);
  const [campos, setCampos] = useState<Campo[]>(CAMPOS_PADRAO);
  const [editandoLabel, setEditandoLabel] = useState<string | null>(null);
  const [novoLabel, setNovoLabel] = useState("");
  const [novoTipo, setNovoTipo] = useState("text");
  const [adicionando, setAdicionando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [modalContrato, setModalContrato] = useState<Cadastro | null>(null);

  // Quantidade por situação, para o resumo e as abas
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const carregarContagem = async () => {
    const conta = async (st: string[]) => (await supabase.from("cadastros_clientes").select("id", { count: "exact", head: true }).in("status", st)).count ?? 0;
    const [pendente, aprovado, ativado, rejeitado] = await Promise.all([conta(["pendente", "notificado"]), conta(["aprovado"]), conta(["ativado"]), conta(["rejeitado"])]);
    setContagem({ pendente, aprovado, ativado, rejeitado });
  };

  const carregar = async () => {
    carregarContagem();
    setLoading(true);
    // "pendente" e "notificado" são ambos aguardando aprovação — mostrar juntos
    const statusFiltro = filtro === "pendente"
      ? ["pendente", "notificado"]
      : [filtro];
    const { data } = await supabase
      .from("cadastros_clientes")
      .select("*")
      .in("status", statusFiltro)
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

  const excluir = async (cadastro: Cadastro) => {
    if (!confirm(`Excluir cadastro de "${cadastro.nome}"? Isso também removerá do controle de clientes.`)) return;
    setExcluindo(cadastro.id);
    try {
      // Remove do controle de clientes (se foi aprovado e criou entrada lá)
      if (cadastro.status === "aprovado") {
        await supabase.from("controle_clientes").delete().eq("nome", cadastro.nome);
      }
      // Remove o cadastro
      await supabase.from("cadastros_clientes").delete().eq("id", cadastro.id);
      await carregar();
      if (detalhe?.id === cadastro.id) setDetalhe(null);
    } catch {
      alert("Erro ao excluir.");
    } finally {
      setExcluindo(null);
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

  const TABS: { key: string; label: string }[] = [
    { key: "pendente", label: "Pendentes" },
    { key: "aprovado", label: "Aprovados" },
    { key: "ativado", label: "Ativados" },
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
    { label: "Senha Facebook", key: "_senha_facebook" },
  ];

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Cadastros</span></div>
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Cadastros de Clientes</h1>
          <p style={{ fontSize: "13px", color: "#4A5B6C", marginTop: "4px" }}>Formulários enviados pelo link público</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Link público */}
          <div style={{ display: "flex", alignItems: "center", background: "#FFFFFF", borderRadius: "999px", padding: "4px 4px 4px 16px", gap: "8px", boxShadow: "var(--shadow-soft)" }}>
            <span style={{ fontSize: "12px", color: "#4A5B6C", whiteSpace: "nowrap" }}>Link público:</span>
            <span style={{ fontSize: "12px", color: "#1C6CA6", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{LINK_PUBLICO}</span>
            <button onClick={copiarLink}
              style={{ background: copiado ? "#E3F2EC" : "#0A1826", border: "none", borderRadius: "999px", padding: "8px 14px", cursor: "pointer", color: copiado ? "#1E6B52" : "#FFFFFF", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 600 }}>
              {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
            </button>
          </div>
          {/* Editar perguntas */}
          <button onClick={() => setModalCampos(true)} className="btn-secondary"
            style={{ height: "44px", padding: "0 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
            <Settings size={14} /> Editar perguntas
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Faixa
        contexto="Formulários que as clientes preenchem pelo link público"
        titulo={`${contagem.pendente ?? "—"} aguardando aprovação,`}
        destaque={`${contagem.ativado ?? "—"} já ativadas`}
        numeros={[
          { label: "Pendentes", valor: contagem.pendente ?? "—" },
          { label: "Aprovados", valor: contagem.aprovado ?? "—" },
          { label: "Ativados", valor: contagem.ativado ?? "—" },
          { label: "Rejeitados", valor: contagem.rejeitado ?? "—" },
        ]}
      />

      <div className="esc-abas">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFiltro(t.key)} className={filtro === t.key ? "on" : ""}>
            {t.label}{contagem[t.key] !== undefined && <span className="aba-n">{contagem[t.key]}</span>}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="cc-wrap" style={{ maxHeight: "none" }}>
        <table className="cc-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr>
              <th style={{ padding: "14px 20px", textAlign: "left" }}>Cliente</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#4A5B6C", fontWeight: "600" }}>Data de entrada</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#4A5B6C", fontWeight: "600" }}>Investimento</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", color: "#4A5B6C", fontWeight: "600" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#4A5B6C", padding: "48px" }}>Carregando...</td></tr>
            ) : !cadastros.length ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#4A5B6C", padding: "48px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "15px", color: "#0A1826", fontWeight: 600 }}>{filtro === "pendente" ? "Nenhum cadastro esperando aprovação" : "Nenhum cadastro nesta situação"}</span>
                  {filtro === "pendente" && <>
                    <span>Envie o link público para a cliente preencher os dados dela.</span>
                    <button onClick={copiarLink} className="btn-primary" style={{ padding: "10px 18px", cursor: "pointer", fontSize: "14px" }}>{copiado ? "Link copiado" : "Copiar link do cadastro"}</button>
                  </>}
                </div>
              </td></tr>
            ) : cadastros.map((c, idx) => (
              <tr key={c.id} className="cc-row" data-i={idx}>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="cc-avatar">{(c.nome || "?").trim().split(/\s+/).slice(0, 2).map((x: string) => x[0]).join("").toUpperCase()}</span>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#0A1826" }}>{c.nome}</span>
                      <span className="cc-sub">{c.email}</span>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", color: "#4A5B6C" }}>{formatarData(c.criado_em)}</td>
                <td style={{ padding: "12px 16px", color: "#0A1826", fontWeight: 600 }}>{c.investimento_anuncios || "—"}</td>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button onClick={async () => {
                      setDetalhe(c);
                      setSenhaDescriptografada(""); setSenhaVisivel(false);
                      if ((c as any).senha_facebook_enc) {
                        try {
                          const res = await fetch("/api/cadastros/senha", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: c.id }),
                          });
                          const data = await res.json();
                          setSenhaDescriptografada(data.senha || "—");
                        } catch { setSenhaDescriptografada("Erro"); }
                      }
                    }}
                      className="acao">
                      <Eye size={13} /> Ver
                    </button>
                    {(filtro === "pendente" || filtro === "notificado") && (
                      <>
                        <button onClick={() => aprovar(c)} disabled={aprovando === c.id}
                          className="acao acao-ok" style={{ opacity: aprovando === c.id ? 0.6 : 1 }}>
                          <CheckCircle size={13} /> {aprovando === c.id ? "..." : "Aprovar"}
                        </button>
                        <button onClick={() => rejeitar(c.id)} disabled={rejeitando === c.id}
                          className="acao acao-nao" style={{ opacity: rejeitando === c.id ? 0.6 : 1 }}>
                          <XCircle size={13} /> {rejeitando === c.id ? "..." : "Rejeitar"}
                        </button>
                      </>
                    )}
                    <button onClick={() => excluir(c)} disabled={excluindo === c.id}
                      className="cc-icon cc-del" title="Excluir cadastro" style={{ opacity: excluindo === c.id ? 0.6 : 1 }}>
                      <Trash2 size={14} />
                    </button>
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
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "420px", background: "#FFFFFF", borderLeft: "1px solid #E6EBF0", zIndex: 101, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6EBF0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", position: "sticky", top: 0 }}>
              <div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#0A1826", margin: 0 }}>{detalhe.nome}</p>
                <p style={{ fontSize: "11px", color: "#4A5B6C", margin: 0 }}>Entrada: {formatarData(detalhe.criado_em)}</p>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4A5B6C" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {camposDetalhe.map(campo => (
                <div key={campo.key}>
                  <p style={{ fontSize: "11px", color: "#4A5B6C", margin: "0 0 3px" }}>{campo.label.toUpperCase()}</p>
                  {campo.key === "_senha_facebook" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ fontSize: "13px", color: "#0A1826", margin: 0, wordBreak: "break-word" }}>
                        {senhaVisivel ? senhaDescriptografada || "—" : "••••••••"}
                      </p>
                      <button onClick={() => setSenhaVisivel(!senhaVisivel)}
                        style={{ background: "none", border: "1px solid #E6EBF0", borderRadius: "4px", padding: "2px 8px", cursor: "pointer", color: "#4A5B6C", fontSize: "11px" }}>
                        {senhaVisivel ? "Ocultar" : "Ver"}
                      </button>
                      {senhaVisivel && senhaDescriptografada && (
                        <button onClick={() => { navigator.clipboard.writeText(senhaDescriptografada); }}
                          style={{ background: "none", border: "1px solid #E6EBF0", borderRadius: "4px", padding: "2px 8px", cursor: "pointer", color: "#4A5B6C", fontSize: "11px" }}>
                          Copiar
                        </button>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: "13px", color: "#0A1826", margin: 0, wordBreak: "break-word" }}>{(detalhe as any)[campo.key] || "—"}</p>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid #E6EBF0", display: "flex", gap: "10px", position: "sticky", bottom: 0, background: "#FFFFFF", flexWrap: "wrap" }}>
              {(detalhe.status === "pendente" || detalhe.status === "notificado") && (
                <>
                  <button onClick={() => aprovar(detalhe)} disabled={aprovando === detalhe.id}
                    style={{ flex: 1, padding: "12px", background: "#1E6B52", border: "none", borderRadius: "8px", cursor: "pointer", color: "#0A1826", fontWeight: "700", fontSize: "14px" }}>
                    {aprovando === detalhe.id ? "Aprovando..." : "✓ Aprovar"}
                  </button>
                  <button onClick={() => rejeitar(detalhe.id)} disabled={rejeitando === detalhe.id}
                    style={{ flex: 1, padding: "12px", background: "#B42318", border: "none", borderRadius: "8px", cursor: "pointer", color: "#fff", fontWeight: "700", fontSize: "14px" }}>
                    {rejeitando === detalhe.id ? "Rejeitando..." : "✕ Rejeitar"}
                  </button>
                </>
              )}
              {(detalhe.status === "pendente" || detalhe.status === "notificado" || detalhe.status === "aprovado") && (
                <button onClick={() => setModalContrato(detalhe)}
                  style={{ width: "100%", padding: "12px", background: "#1C6CA615", border: "1px solid #1C6CA640", borderRadius: "8px", cursor: "pointer", color: "#1C6CA6", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <FileText size={14} /> Enviar Contrato via Autentique
                </button>
              )}
              <button onClick={() => excluir(detalhe)} disabled={excluindo === detalhe.id}
                style={{ width: "100%", padding: "12px", background: "transparent", border: "1px solid #ef444460", borderRadius: "8px", cursor: "pointer", color: "#B42318", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <Trash2 size={14} /> {excluindo === detalhe.id ? "Excluindo..." : "Excluir cadastro"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal enviar contrato */}
      {modalContrato && (
        <ModalContrato
          clienteId={modalContrato.id}
          nome={modalContrato.nome}
          email={modalContrato.email}
          cnpj={modalContrato.cnpj || ""}
          cpf={modalContrato.cpf || ""}
          rg={modalContrato.rg || ""}
          endereco_empresa={modalContrato.endereco_empresa || ""}
          endereco_pessoal={modalContrato.endereco_pessoal || ""}
          onClose={() => setModalContrato(null)}
        />
      )}

      {/* Modal editar perguntas */}
      {modalCampos && (
        <>
          <div onClick={() => setModalCampos(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: "12px", width: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column", zIndex: 201, boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6EBF0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#0A1826", margin: 0 }}>Editar perguntas do formulário</p>
                <p style={{ fontSize: "12px", color: "#4A5B6C", margin: 0 }}>As alterações atualizam o formulário público</p>
              </div>
              <button onClick={() => setModalCampos(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4A5B6C" }}><X size={16} /></button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
              {campos.map((campo, idx) => (
                <div key={campo.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", marginBottom: "4px", background: "#FFFFFF", border: "1px solid #E6EBF0" }}>
                  <GripVertical size={14} style={{ color: "#7E93A8", flexShrink: 0 }} />
                  {editandoLabel === campo.id ? (
                    <input autoFocus defaultValue={campo.label}
                      onBlur={e => salvarLabel(campo.id, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") salvarLabel(campo.id, (e.target as HTMLInputElement).value); }}
                      style={{ flex: 1, background: "#FFFFFF", border: "1px solid #1C6CA6", borderRadius: "6px", padding: "4px 8px", color: "#0A1826", fontSize: "13px", outline: "none" }} />
                  ) : (
                    <span onClick={() => setEditandoLabel(campo.id)} style={{ flex: 1, fontSize: "13px", color: "#0A1826", cursor: "pointer" }} title="Clique para editar">{campo.label}</span>
                  )}
                  <span style={{ fontSize: "11px", color: "#7E93A8", background: "#E6EBF0", padding: "2px 6px", borderRadius: "4px" }}>{campo.type}</span>
                  {campo.obrigatorio && <span style={{ fontSize: "10px", color: "#C2620E" }}>*</span>}
                  <button onClick={() => removerCampo(campo.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#7E93A8", padding: "2px", flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#B42318")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#7E93A8")}>
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
                    style={{ flex: 1, background: "#FFFFFF", border: "1px solid #1C6CA6", borderRadius: "6px", padding: "8px 10px", color: "#0A1826", fontSize: "13px", outline: "none" }} />
                  <select value={novoTipo} onChange={e => setNovoTipo(e.target.value)}
                    style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: "6px", padding: "8px", color: "#0A1826", fontSize: "12px" }}>
                    <option value="text">texto</option>
                    <option value="textarea">textarea</option>
                    <option value="email">email</option>
                    <option value="password">senha</option>
                    <option value="number">número</option>
                  </select>
                  <button onClick={adicionarCampo}
                    style={{ background: "#1C6CA6", border: "none", borderRadius: "6px", padding: "8px 14px", cursor: "pointer", color: "#F3F5F7", fontWeight: "600", fontSize: "13px" }}>
                    Adicionar
                  </button>
                </div>
              ) : (
                <button onClick={() => setAdicionando(true)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "1px dashed #E6EBF0", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", color: "#4A5B6C", fontSize: "13px", marginTop: "8px", width: "100%" }}>
                  <Plus size={13} /> Adicionar pergunta
                </button>
              )}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #E6EBF0", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setModalCampos(false)}
                style={{ background: "#E6EBF0", border: "none", borderRadius: "8px", padding: "10px 20px", cursor: "pointer", color: "#0A1826", fontSize: "13px" }}>
                Fechar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
