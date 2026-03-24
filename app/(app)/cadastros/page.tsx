"use client";

import { useEffect, useState } from "react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import { CheckCircle, XCircle, Eye, X } from "lucide-react";

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

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cadastros_clientes")
      .select("*")
      .eq("status", filtro)
      .order("criado_em", { ascending: false });
    setCadastros(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtro]);

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
      alert("Erro ao aprovar. Tente novamente.");
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

  const TABS = [
    { key: "pendente", label: "Pendentes" },
    { key: "aprovado", label: "Aprovados" },
    { key: "rejeitado", label: "Rejeitados" },
  ] as const;

  const campos = [
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
      <div style={{ marginBottom: "20px" }}>
        <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Cadastros</span></div>
        <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Cadastros de Clientes</h1>
        <p style={{ fontSize: "13px", color: "#606060", marginTop: "4px" }}>
          Formulários enviados pelo link público
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#1a1a1a", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFiltro(t.key)}
            style={{
              padding: "7px 20px", border: "none", borderRadius: "7px", cursor: "pointer",
              fontSize: "13px", fontWeight: filtro === t.key ? "600" : "400",
              background: filtro === t.key ? "#29ABE2" : "transparent",
              color: filtro === t.key ? "#000" : "#606060",
            }}>
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
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
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

      {/* Painel de detalhe */}
      {detalhe && (
        <>
          <div onClick={() => setDetalhe(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "420px", background: "#141414", borderLeft: "1px solid #2e2e2e", zIndex: 101, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2e2e2e", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a1a", position: "sticky", top: 0, zIndex: 1 }}>
              <div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#f0f0f0", margin: 0 }}>{detalhe.nome}</p>
                <p style={{ fontSize: "11px", color: "#606060", margin: 0 }}>Entrada: {formatarData(detalhe.criado_em)}</p>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}><X size={16} /></button>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {campos.map(campo => (
                <div key={campo.key}>
                  <p style={{ fontSize: "11px", color: "#606060", margin: "0 0 3px" }}>{campo.label.toUpperCase()}</p>
                  <p style={{ fontSize: "13px", color: "#f0f0f0", margin: 0, wordBreak: "break-word" }}>
                    {(detalhe as any)[campo.key] || "—"}
                  </p>
                </div>
              ))}
            </div>

            {detalhe.status === "pendente" && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid #2e2e2e", display: "flex", gap: "10px", position: "sticky", bottom: 0, background: "#141414" }}>
                <button onClick={() => aprovar(detalhe)} disabled={aprovando === detalhe.id}
                  style={{ flex: 1, padding: "12px", background: "#22c55e", border: "none", borderRadius: "8px", cursor: "pointer", color: "#000", fontWeight: "700", fontSize: "14px", opacity: aprovando === detalhe.id ? 0.6 : 1 }}>
                  {aprovando === detalhe.id ? "Aprovando..." : "✓ Aprovar"}
                </button>
                <button onClick={() => rejeitar(detalhe.id)} disabled={rejeitando === detalhe.id}
                  style={{ flex: 1, padding: "12px", background: "#ef4444", border: "none", borderRadius: "8px", cursor: "pointer", color: "#fff", fontWeight: "700", fontSize: "14px", opacity: rejeitando === detalhe.id ? 0.6 : 1 }}>
                  {rejeitando === detalhe.id ? "Rejeitando..." : "✕ Rejeitar"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
