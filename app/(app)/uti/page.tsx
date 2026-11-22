"use client";

import { useState, useEffect } from "react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import { Plus, X, ExternalLink, RefreshCw } from "lucide-react";

interface ClienteUTI {
  id: string;
  nome: string;
  instagram: string;
  investimento_mensal: number;
  gestor: string;
  consultor: string;
  status: string;
}

interface AcaoUTI {
  id: string;
  cliente_id: string;
  acao: string;
  feito: boolean;
  created_at: string;
}

const ACOES_PADRAO = [
  "Revisar criativos ativos",
  "Testar novos públicos / interesses",
  "Ajustar orçamento diário",
  "Revisar landing page / oferta",
  "Reunião de alinhamento com cliente",
  "Mudar criativo principal",
  "Pausar campanhas de baixo desempenho",
  "Criar campanha de retargeting",
  "Checar pixel e rastreamento",
  "Revisar copy dos anúncios",
];

function statusUTI(acoes: AcaoUTI[]): { label: string; cor: string } {
  if (!acoes.length) return { label: "Crítico", cor: "#B42318" };
  const feitas = acoes.filter(a => a.feito).length;
  const pct = feitas / acoes.length;
  if (pct === 0) return { label: "Crítico", cor: "#B42318" };
  if (pct < 0.5) return { label: "Em Tratamento", cor: "#C2620E" };
  if (pct < 1) return { label: "Melhorando", cor: "#1E6B52" };
  return { label: "Estável", cor: "#1C6CA6" };
}

export default function PageUTI() {
  const [clientes, setClientes] = useState<ClienteUTI[]>([]);
  const [acoes, setAcoes] = useState<Record<string, AcaoUTI[]>>({});
  const [loading, setLoading] = useState(true);
  const [novaAcao, setNovaAcao] = useState<Record<string, string>>({});
  const [adicionando, setAdicionando] = useState<Record<string, boolean>>({});
  const [agId, setAgId] = useState("");

  const carregar = async () => {
    setLoading(true);
    const id = await getAgenciaId();
    setAgId(id || "");

    const { data: cls } = await supabase
      .from("controle_clientes")
      .select("id, nome, instagram, investimento_mensal, gestor, consultor, status")
      .eq("agencia_id", id!)
      .eq("uti", true)
      .neq("status", "saiu");

    const lista = cls || [];
    setClientes(lista);

    if (lista.length) {
      const ids = lista.map((c: ClienteUTI) => c.id);
      const { data: ac } = await supabase
        .from("uti_acoes")
        .select("*")
        .in("cliente_id", ids)
        .order("created_at", { ascending: true });

      const mapa: Record<string, AcaoUTI[]> = {};
      lista.forEach((c: ClienteUTI) => { mapa[c.id] = []; });
      (ac || []).forEach((a: AcaoUTI) => {
        if (mapa[a.cliente_id]) mapa[a.cliente_id].push(a);
      });
      setAcoes(mapa);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const toggleAcao = async (acao: AcaoUTI) => {
    const novoFeito = !acao.feito;
    await supabase.from("uti_acoes").update({ feito: novoFeito }).eq("id", acao.id);
    setAcoes(prev => ({
      ...prev,
      [acao.cliente_id]: prev[acao.cliente_id].map(a => a.id === acao.id ? { ...a, feito: novoFeito } : a),
    }));
  };

  const adicionarAcaoPadrao = async (clienteId: string, texto: string) => {
    const { data } = await supabase.from("uti_acoes").insert({
      agencia_id: agId,
      cliente_id: clienteId,
      acao: texto,
      feito: false,
    }).select().single();
    if (data) {
      setAcoes(prev => ({ ...prev, [clienteId]: [...(prev[clienteId] || []), data] }));
    }
  };

  const adicionarAcaoCustom = async (clienteId: string) => {
    const texto = (novaAcao[clienteId] || "").trim();
    if (!texto) return;
    await adicionarAcaoPadrao(clienteId, texto);
    setNovaAcao(prev => ({ ...prev, [clienteId]: "" }));
    setAdicionando(prev => ({ ...prev, [clienteId]: false }));
  };

  const removerAcao = async (acao: AcaoUTI) => {
    await supabase.from("uti_acoes").delete().eq("id", acao.id);
    setAcoes(prev => ({
      ...prev,
      [acao.cliente_id]: prev[acao.cliente_id].filter(a => a.id !== acao.id),
    }));
  };

  const removerDaUTI = async (clienteId: string, nome: string) => {
    if (!confirm(`Remover ${nome} da UTI?`)) return;
    await supabase.from("controle_clientes").update({ uti: false }).eq("id", clienteId);
    setClientes(prev => prev.filter(c => c.id !== clienteId));
  };

  const acoesExistentes = (clienteId: string) =>
    new Set((acoes[clienteId] || []).map(a => a.acao));

  const acoesPadraoDisponiveis = (clienteId: string) =>
    ACOES_PADRAO.filter(a => !acoesExistentes(clienteId).has(a));

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">UTI</span></div>
          <h1 style={{ margin: 0 }}>UTI de clientes</h1>
          <p style={{ fontSize: "14px", color: "#4A5B6C", margin: "6px 0 0" }}>
            Clientes com custo alto que precisam de recuperação
          </p>
        </div>
        <button onClick={carregar}
          style={{ background: "none", border: "1px solid #E6EBF0", borderRadius: "6px", padding: "7px 12px", color: "#4A5B6C", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
          <RefreshCw size={13}/> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px", color: "#4A5B6C" }}>Carregando...</div>
      ) : !clientes.length ? (
        <div style={{ textAlign: "center", padding: "80px", color: "#4A5B6C" }}>
                    <div style={{ fontSize: "14px" }}>Nenhum cliente na UTI.</div>
          <div style={{ fontSize: "12px", color: "#404040", marginTop: "6px" }}>
            Marque clientes com o ícone 🏥 no Controle de Clientes.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {clientes.map(c => {
            const acoesCliente = acoes[c.id] || [];
            const { label: statusLabel, cor: statusCor } = statusUTI(acoesCliente);
            const feitas = acoesCliente.filter(a => a.feito).length;
            const total = acoesCliente.length;
            const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;
            const padrao = acoesPadraoDisponiveis(c.id);

            return (
              <div key={c.id} style={{ background: "#FFFFFF", border: "1px solid #ef444430", borderRadius: "10px", padding: "20px", position: "relative" }}>
                {/* Header do card */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px" }}>🏥</span>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#0A1826" }}>{c.nome}</div>
                      <div style={{ display: "flex", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
                        {c.investimento_mensal > 0 && (
                          <span style={{ fontSize: "12px", color: "#B42318", fontWeight: 600 }}>
                            R$ {c.investimento_mensal.toLocaleString("pt-BR")} / mês
                          </span>
                        )}
                        {c.instagram && (
                          <a
                            href={c.instagram.startsWith("http") ? c.instagram : `https://instagram.com/${c.instagram.replace(/^@/, "")}`}
                            target="_blank" rel="noopener"
                            style={{ fontSize: "12px", color: "#E1306C", textDecoration: "none", display: "flex", alignItems: "center", gap: "3px" }}>
                            @{c.instagram.replace(/^.*instagram\.com\//, "").replace(/^@/, "").replace(/\/$/, "")}
                            <ExternalLink size={10}/>
                          </a>
                        )}
                        {c.gestor && <span style={{ fontSize: "12px", color: "#4A5B6C" }}>Gestor: {c.gestor}</span>}
                        {c.consultor && <span style={{ fontSize: "12px", color: "#4A5B6C" }}>Consultor: {c.consultor}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Badge status */}
                    <span style={{ fontSize: "11px", fontWeight: 700, color: statusCor, background: statusCor + "20", padding: "3px 10px", borderRadius: "20px", border: `1px solid ${statusCor}40` }}>
                      {statusLabel}
                    </span>
                    {/* Remover da UTI */}
                    <button onClick={() => removerDaUTI(c.id, c.nome)}
                      title="Remover da UTI"
                      style={{ background: "none", border: "1px solid #E6EBF0", borderRadius: "6px", padding: "4px 8px", color: "#4A5B6C", cursor: "pointer", fontSize: "11px" }}>
                      Alta
                    </button>
                  </div>
                </div>

                {/* Barra de progresso */}
                {total > 0 && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", color: "#4A5B6C" }}>Progresso do plano de ação</span>
                      <span style={{ fontSize: "11px", color: "#4A5B6C" }}>{feitas}/{total} ações ({pct}%)</span>
                    </div>
                    <div style={{ height: "6px", background: "#E6EBF0", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: statusCor, borderRadius: "3px", transition: "width 0.3s" }}/>
                    </div>
                  </div>
                )}

                {/* Lista de ações */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                  {acoesCliente.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: a.feito ? "#0a1a0a" : "#FFFFFF", borderRadius: "6px", border: `1px solid ${a.feito ? "#22c55e30" : "#E6EBF0"}` }}>
                      <input
                        type="checkbox"
                        checked={a.feito}
                        onChange={() => toggleAcao(a)}
                        style={{ accentColor: "#1E6B52", width: "15px", height: "15px", cursor: "pointer", flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: "13px", color: a.feito ? "#4A5B6C" : "#d0d0d0", textDecoration: a.feito ? "line-through" : "none" }}>
                        {a.acao}
                      </span>
                      <button onClick={() => removerAcao(a)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#404040", padding: "2px", flexShrink: 0, lineHeight: 1 }}
                        title="Remover ação">
                        <X size={12}/>
                      </button>
                    </div>
                  ))}

                  {!acoesCliente.length && (
                    <div style={{ fontSize: "12px", color: "#404040", padding: "8px 0" }}>
                      Nenhuma ação adicionada ainda.
                    </div>
                  )}
                </div>

                {/* Ações rápidas */}
                <div style={{ borderTop: "1px solid #FFFFFF", paddingTop: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#6B7A89", marginBottom: "8px", fontWeight: 600 }}>ADICIONAR AÇÃO</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {padrao.map(texto => (
                      <button key={texto} onClick={() => adicionarAcaoPadrao(c.id, texto)}
                        style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", color: "#4A5B6C", cursor: "pointer", whiteSpace: "nowrap" }}>
                        + {texto}
                      </button>
                    ))}
                  </div>

                  {/* Campo custom */}
                  {adicionando[c.id] ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        autoFocus
                        value={novaAcao[c.id] || ""}
                        onChange={e => setNovaAcao(prev => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") adicionarAcaoCustom(c.id); if (e.key === "Escape") setAdicionando(prev => ({ ...prev, [c.id]: false })); }}
                        placeholder="Descrever ação personalizada..."
                        style={{ flex: 1, background: "#FFFFFF", border: "1px solid #1C6CA6", borderRadius: "6px", padding: "6px 10px", color: "#0A1826", fontSize: "12px", outline: "none" }}
                      />
                      <button onClick={() => adicionarAcaoCustom(c.id)}
                        style={{ background: "#1C6CA6", border: "none", borderRadius: "6px", padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                        Adicionar
                      </button>
                      <button onClick={() => setAdicionando(prev => ({ ...prev, [c.id]: false }))}
                        style={{ background: "none", border: "1px solid #E6EBF0", borderRadius: "6px", padding: "6px 10px", color: "#4A5B6C", cursor: "pointer", fontSize: "12px" }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAdicionando(prev => ({ ...prev, [c.id]: true }))}
                      style={{ background: "none", border: "1px dashed #E6EBF0", borderRadius: "6px", padding: "6px 12px", color: "#6B7A89", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Plus size={12}/> Ação personalizada
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
