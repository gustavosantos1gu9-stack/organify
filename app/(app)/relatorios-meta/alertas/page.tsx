"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, RefreshCw, X, Edit2, AlertTriangle } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

const TEMPLATE_PADRAO_PIX = `Olá, tudo bem? Passando para informar que estamos com saldo baixo na conta e os anúncios podem pausar!

O saldo da conta de anúncios *<CA>* está em *<SALDO>*

Podemos abastecer?`;

const TEMPLATE_PADRAO_CARTAO = `🚨 *ALERTA — CARTÃO DE CRÉDITO*

A conta de anúncios *<CA>* está com problema no pagamento.

Status: *<STATUS>*
Método: Cartão de Crédito

_O cartão pode estar expirado, sem limite ou foi recusado. Verifique o método de pagamento no Gerenciador de Anúncios para não parar os anúncios._`;

interface Alerta {
  id?: string;
  agencia_id?: string;
  ad_account_id: string;
  nome_cliente: string;
  saldo_alerta: number;
  grupo_id: string;
  grupo_nome: string;
  template_saldo: string;
  template_status: string;
  forma_pagamento: string;
  monitorar_como: string; // 'auto' | 'saldo' | 'cartao'
  ativo: boolean;
  ultimo_alerta?: string;
  created_at?: string;
}

interface ContaInfo {
  name: string;
  balance: number;
  currency: string;
  status: string;
  account_status: number;
  forma_pagamento: string;
}

function formatMoney(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarData(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Alerta | null>(null);
  const [contas, setContas] = useState<{ id: string; name: string }[]>([]);
  const [grupos, setGrupos] = useState<{ id: string; subject: string }[]>([]);
  const [form, setForm] = useState<Alerta>({
    ad_account_id: "", nome_cliente: "", saldo_alerta: 50, grupo_id: "", grupo_nome: "",
    template_saldo: TEMPLATE_PADRAO_PIX, template_status: "", forma_pagamento: "", monitorar_como: "auto", ativo: true,
  });
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [contaInfo, setContaInfo] = useState<Record<string, ContaInfo>>({});
  const [token, setToken] = useState("");
  const [conConfig, setConConfig] = useState<any>(null);
  const [buscaConta, setBuscaConta] = useState("");
  const [buscaGrupo, setBuscaGrupo] = useState("");
  const [loadingContas, setLoadingContas] = useState(false);
  const [erroContas, setErroContas] = useState("");
  const [clientesControle, setClientesControle] = useState<{id:string;nome:string}[]>([]);
  const [waInstancias, setWaInstancias] = useState<{id:string;nome:string;conectado:boolean;instancia:string}[]>([]);
  const [waInstanciaId, setWaInstanciaId] = useState("");

  const carregar = async () => {
    const agId = await getAgenciaId();
    const res = await fetch("/api/alertas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", agencia_id: agId }),
    });
    const data = await res.json();
    setAlertas(data.data || []);

    const { data: con } = await supabase.from("relatorios_conexoes")
      .select("meta_token, evolution_url, evolution_key, whatsapp_instancia")
      .eq("agencia_id", agId!).order("created_at", { ascending: false }).limit(1).single();
    if (con) { setToken(con.meta_token || ""); setConConfig(con); }

    const { data: instancias } = await supabase.from("whatsapp_instancias")
      .select("id, nome, instancia, conectado").eq("agencia_id", agId!).order("created_at");
    setWaInstancias(instancias || []);

    // Carregar clientes do controle para vincular
    const { data: cc } = await supabase.from("controle_clientes")
      .select("id, nome").eq("agencia_id", agId!).neq("status", "saiu").order("nome");
    setClientesControle(cc || []);

    setLoading(false);
  };

  const carregarContas = async () => {
    if (!token) return;
    setLoadingContas(true);
    setErroContas("");
    try {
      const res = await fetch("/api/meta-ads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listar_contas", token }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        const todas = data.map((c: any) => {
          const id = (c.id || c.account_id || "").replace("act_", "");
          const spendCap = c.spend_cap ? parseFloat(c.spend_cap) / 100 : 0;
          const amountSpent = c.amount_spent ? parseFloat(c.amount_spent) / 100 : 0;
          const balance = spendCap > 0 ? spendCap - amountSpent : 0;
          return { id, name: c.name, balance, spendCap, account_status: c.account_status };
        });
        // Mostrar todas as contas (PIX e cartão)
        setContas(todas);
      } else {
        setErroContas(data.error || "Token expirado ou inválido");
      }
    } catch (err: any) {
      setErroContas("Erro ao carregar contas: " + (err.message || ""));
    }
    setLoadingContas(false);
  };

  const carregarGrupos = async (instanciaId?: string) => {
    const instSelecionada = instanciaId ? waInstancias.find(i => i.id === instanciaId) : null;
    let evoUrl = conConfig?.evolution_url;
    let evoKey = conConfig?.evolution_key;
    let evoInst = conConfig?.whatsapp_instancia;
    if (instSelecionada) {
      evoInst = instSelecionada.instancia;
      const { data: waData } = await supabase.from("whatsapp_instancias")
        .select("evolution_url, evolution_key").eq("id", instanciaId!).single();
      if (waData?.evolution_url) evoUrl = waData.evolution_url;
      if (waData?.evolution_key) evoKey = waData.evolution_key;
    }
    if (!evoUrl || !evoKey || !evoInst) return;
    try {
      const res = await fetch(`${evoUrl}/chat/findChats/${evoInst}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const allChats = Array.isArray(json) ? json : [];
      const gruposList = allChats
        .filter((c: any) => (c.remoteJid || c.id || "").includes("@g.us"))
        .map((c: any) => ({ id: c.remoteJid || c.id, subject: c.pushName || c.name || c.subject || "" }));

      // Buscar nomes reais dos grupos via fetchAllGroups
      try {
        const gRes = await fetch(`${evoUrl}/group/fetchAllGroups/${evoInst}?getParticipants=false`, {
          headers: { apikey: evoKey },
        });
        if (gRes.ok) {
          const allGroups = await gRes.json();
          if (Array.isArray(allGroups)) {
            const nomeMap: Record<string, string> = {};
            for (const g of allGroups) {
              if (g.id && g.subject) nomeMap[g.id] = g.subject;
            }
            // Atualizar nomes dos grupos que vieram sem nome ou com JID
            for (const g of gruposList) {
              if ((!g.subject || g.subject.includes("@g.us")) && nomeMap[g.id]) {
                g.subject = nomeMap[g.id];
              }
            }
            // Adicionar grupos que existem no fetchAllGroups mas não no findChats
            for (const g of allGroups) {
              if (g.id && !gruposList.find((gl: any) => gl.id === g.id)) {
                gruposList.push({ id: g.id, subject: g.subject || g.id });
              }
            }
          }
        }
      } catch {}

      // Remover grupos ainda sem nome legível
      setGrupos(gruposList
        .filter((g: any) => g.subject && !g.subject.includes("@g.us"))
        .sort((a: any, b: any) => a.subject.localeCompare(b.subject))
      );
    } catch {}
  };

  const verificarConta = async (adAccountId: string) => {
    if (!token) return;
    setVerificando(adAccountId);
    try {
      const res = await fetch("/api/alertas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_account", ad_account_id: adAccountId, token }),
      });
      const data = await res.json();
      if (!data.error) setContaInfo(prev => ({ ...prev, [adAccountId]: data }));
    } catch {}
    setVerificando(null);
  };

  const abrirModal = (alerta?: Alerta) => {
    if (alerta) {
      setEditando(alerta);
      setForm({ ...alerta });
      setWaInstanciaId((alerta as any).whatsapp_instancia_id || "");
      if (alerta.ad_account_id) verificarConta(alerta.ad_account_id);
    } else {
      setEditando(null);
      setWaInstanciaId("");
      setForm({
        ad_account_id: "", nome_cliente: "", saldo_alerta: 50, grupo_id: "", grupo_nome: "",
        template_saldo: TEMPLATE_PADRAO_PIX, template_status: "", forma_pagamento: "", monitorar_como: "auto", ativo: true,
      });
    }
    setBuscaConta("");
    setBuscaGrupo("");
    setModal(true);
  };

  const salvar = async () => {
    if (!form.ad_account_id || !form.nome_cliente) { alert("Preencha conta e nome da cliente"); return; }
    if (!form.grupo_id) { alert("Selecione o grupo WhatsApp"); return; }
    setSalvando(true);
    try {
      const agId = await getAgenciaId();
      const info = contaInfo[form.ad_account_id];
      const alerta = { ...form, forma_pagamento: info?.forma_pagamento || form.forma_pagamento || "", whatsapp_instancia_id: waInstanciaId || null };
      if (editando?.id) alerta.id = editando.id;

      await fetch("/api/alertas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", agencia_id: agId, alerta }),
      });
      setModal(false);
      carregar();
    } catch { alert("Erro ao salvar"); }
    finally { setSalvando(false); }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este alerta?")) return;
    await fetch("/api/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", alerta: { id } }) });
    carregar();
  };

  const toggleAtivo = async (alerta: Alerta) => {
    const agId = await getAgenciaId();
    await fetch("/api/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", agencia_id: agId, alerta: { ...alerta, ativo: !alerta.ativo } }) });
    carregar();
  };

  const verificarTodas = async () => { for (const a of alertas) await verificarConta(a.ad_account_id); };

  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (token) carregarContas(); }, [token]);
  useEffect(() => { if (conConfig) carregarGrupos(waInstanciaId || undefined); }, [conConfig, waInstanciaId, waInstancias]);

  const isCartao = (adAccountId?: string, monitorarComo?: string) => {
    const mc = monitorarComo ?? (adAccountId ? undefined : form.monitorar_como);
    if (mc === "saldo") return false;
    if (mc === "cartao") return true;
    const info = adAccountId ? contaInfo[adAccountId] : contaInfo[form.ad_account_id];
    return info?.forma_pagamento?.toLowerCase().includes("cartão") || info?.forma_pagamento?.toLowerCase().includes("crédito") || false;
  };

  // Preview da mensagem com variáveis substituídas
  const previewMsg = () => {
    const info = contaInfo[form.ad_account_id];
    const cartao = isCartao();
    const templatePadrao = cartao ? TEMPLATE_PADRAO_CARTAO : TEMPLATE_PADRAO_PIX;
    let msg = cartao ? (form.template_status || templatePadrao) : (form.template_saldo || templatePadrao);
    const vars: Record<string, string> = {
      "<CA>": form.nome_cliente || "Cliente",
      "<SALDO>": cartao ? "N/A (Cartão)" : (info ? formatMoney(info.balance) : "R$ 0,00"),
      "<LIMITE>": formatMoney(form.saldo_alerta),
      "<STATUS>": info?.status || "Ativa",
      "<PAGAMENTO>": info?.forma_pagamento || "PIX/Boleto",
    };
    for (const [k, v] of Object.entries(vars)) msg = msg.replaceAll(k, v);
    return msg;
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><a href="/relatorios-meta">Relatórios Meta</a><span>›</span><span className="current">Alertas</span></div>
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Alertas de Contas</h1>
          <p style={{ fontSize: "13px", color: "#4A5B6C", marginTop: "4px" }}>Monitora saldo (PIX/Boleto) e erros de pagamento (Cartão de Crédito) e envia alerta no grupo da cliente.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {alertas.length > 0 && (
            <button onClick={verificarTodas} className="btn-secondary" style={{ cursor: "pointer", fontSize: "12px" }}><RefreshCw size={12} /> Verificar</button>
          )}
          <button onClick={() => abrirModal()} className="btn-primary" style={{ cursor: "pointer", fontSize: "12px" }}><Plus size={12} /> Novo Alerta</button>
        </div>
      </div>

      {!token && (
        <div style={{ background: "rgba(194,98,14,0.1)", border: "1px solid rgba(194,98,14,0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#C2620E" }}>
          <AlertTriangle size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
          Token Meta não configurado. <a href="/relatorios-meta/conexoes" style={{ color: "#1C6CA6", textDecoration: "underline" }}>Configure em Conexões</a>.
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Cliente / conta</th><th>Saldo atual</th><th>Limite</th><th>Pagamento</th><th>Status</th><th>Grupo</th><th>Último alerta</th><th>Ações</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#4A5B6C", padding: "48px" }}>Carregando...</td></tr>
            ) : !alertas.length ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#4A5B6C", padding: "48px" }}>Nenhum alerta configurado.</td></tr>
            ) : alertas.map(a => {
              const info = contaInfo[a.ad_account_id];
              const saldoBaixo = info && a.saldo_alerta && info.balance <= a.saldo_alerta;
              const contaProblema = info && info.account_status !== 1;
              return (
                <tr key={a.id} style={{ opacity: a.ativo ? 1 : 0.5 }}>
                  <td>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#0A1826", margin: 0 }}>{a.nome_cliente}</p>
                    <p style={{ fontSize: "11px", color: "#4A5B6C", margin: 0 }}>act_{a.ad_account_id}</p>
                  </td>
                  <td>{verificando === a.ad_account_id ? <span style={{ fontSize: "12px", color: "#4A5B6C" }}>...</span> : info ? (isCartao(a.ad_account_id, a.monitorar_como) ? <span style={{ fontSize: "12px", color: "#4A5B6C" }}>—</span> : <span style={{ fontSize: "13px", fontWeight: "600", color: saldoBaixo ? "#B42318" : "#1E6B52" }}>{formatMoney(info.balance)}</span>) : <button onClick={() => verificarConta(a.ad_account_id)} style={{ fontSize: "11px", color: "#1C6CA6", background: "none", border: "1px solid rgba(41,171,226,0.3)", borderRadius: "6px", padding: "2px 8px", cursor: "pointer" }}>Ver</button>}</td>
                  <td style={{ fontSize: "13px", color: "#C2620E" }}>{isCartao(a.ad_account_id, a.monitorar_como) ? "—" : formatMoney(a.saldo_alerta)}</td>
                  <td style={{ fontSize: "12px", color: "#4A5B6C" }}>{info?.forma_pagamento || a.forma_pagamento || "—"}</td>
                  <td>{info ? <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: contaProblema ? "rgba(180,35,24,0.1)" : "rgba(30,107,82,0.1)", color: contaProblema ? "#B42318" : "#1E6B52", border: `1px solid ${contaProblema ? "rgba(180,35,24,0.3)" : "rgba(30,107,82,0.3)"}` }}>{info.status}</span> : "—"}</td>
                  <td style={{ fontSize: "12px", color: "#4A5B6C" }}>{a.grupo_nome || "—"}</td>
                  <td style={{ fontSize: "12px", color: "#4A5B6C" }}>{formatarData(a.ultimo_alerta || "")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => abrirModal(a)} style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #E6EBF0", background: "#E6EBF0", color: "#1C6CA6", cursor: "pointer" }}><Edit2 size={12} /></button>
                      <button onClick={() => toggleAtivo(a)} style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", background: a.ativo ? "rgba(30,107,82,0.1)" : "rgba(96,96,96,0.1)", border: `1px solid ${a.ativo ? "rgba(30,107,82,0.3)" : "#E6EBF0"}`, color: a.ativo ? "#1E6B52" : "#4A5B6C" }}>{a.ativo ? "Ativo" : "Pausado"}</button>
                      <button onClick={() => excluir(a.id!)} style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #E6EBF0", background: "#E6EBF0", color: "#B42318", cursor: "pointer" }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Criar / Editar */}
      {modal && (
        <>
          <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "560px", maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: "12px", zIndex: 101, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>{editando ? "Editar Alerta" : "Novo Alerta"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4A5B6C" }}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Conta de Anúncio (pesquisável) */}
              <div>
                <label className="form-label">Conta de Anúncio</label>
                {loadingContas ? (
                  <p style={{ fontSize: "12px", color: "#4A5B6C" }}>Carregando contas...</p>
                ) : erroContas ? (
                  <div style={{ padding: "10px 14px", background: "rgba(180,35,24,0.1)", border: "1px solid rgba(180,35,24,0.2)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "12px", color: "#B42318" }}>{erroContas}</p>
                    <a href="/relatorios-meta/conexoes" style={{ fontSize: "11px", color: "#1C6CA6" }}>Reconectar</a>
                  </div>
                ) : (
                  <>
                    <input className="form-input" placeholder="Pesquisar conta..." value={buscaConta} onChange={e => setBuscaConta(e.target.value)} style={{ marginBottom: "8px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "160px", overflowY: "auto" }}>
                      {contas.filter(c => c.name.toLowerCase().includes(buscaConta.toLowerCase()) || c.id.includes(buscaConta)).map(c => (
                        <button key={c.id} onClick={() => { setForm(f => ({ ...f, ad_account_id: c.id, nome_cliente: f.nome_cliente || c.name || "" })); verificarConta(c.id); }}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", background: form.ad_account_id === c.id ? "rgba(41,171,226,0.1)" : "#FFFFFF",
                            border: `1px solid ${form.ad_account_id === c.id ? "#1C6CA6" : "#E6EBF0"}`,
                            borderRadius: "8px", cursor: "pointer", textAlign: "left", color: "#0A1826", fontSize: "12px", width: "100%",
                          }}>
                          <div>
                            <span style={{ fontWeight: form.ad_account_id === c.id ? "600" : "400" }}>{c.name}</span>
                            {(c as any).balance > 0 && (
                              <span style={{ marginLeft: "8px", fontSize: "11px", color: "#1E6B52" }}>{formatMoney((c as any).balance)}</span>
                            )}
                          </div>
                          <span style={{ color: "#4A5B6C", fontSize: "11px" }}>act_{c.id}</span>
                        </button>
                      ))}
                      {contas.filter(c => c.name.toLowerCase().includes(buscaConta.toLowerCase()) || c.id.includes(buscaConta)).length === 0 && (
                        <p style={{ fontSize: "12px", color: "#4A5B6C", textAlign: "center", padding: "12px" }}>Nenhuma conta encontrada.</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Info da conta */}
              {contaInfo[form.ad_account_id] && (
                <div style={{ background: "#FFFFFF", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {isCartao() ? (
                    <>
                      <div><span style={{ fontSize: "10px", color: "#4A5B6C" }}>Pagamento</span><p style={{ fontSize: "14px", fontWeight: "600", color: "#C2620E", margin: "2px 0 0" }}>Cartão de Crédito</p></div>
                      <div><span style={{ fontSize: "10px", color: "#4A5B6C" }}>Status</span><p style={{ fontSize: "12px", color: contaInfo[form.ad_account_id].account_status === 1 ? "#1E6B52" : "#B42318", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].status}</p></div>
                    </>
                  ) : (
                    <>
                      <div><span style={{ fontSize: "10px", color: "#4A5B6C" }}>Saldo</span><p style={{ fontSize: "14px", fontWeight: "600", color: "#0A1826", margin: "2px 0 0" }}>{formatMoney(contaInfo[form.ad_account_id].balance)}</p></div>
                      <div><span style={{ fontSize: "10px", color: "#4A5B6C" }}>Pagamento</span><p style={{ fontSize: "12px", color: "#4A5B6C", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].forma_pagamento}</p></div>
                      <div><span style={{ fontSize: "10px", color: "#4A5B6C" }}>Status</span><p style={{ fontSize: "12px", color: contaInfo[form.ad_account_id].account_status === 1 ? "#1E6B52" : "#B42318", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].status}</p></div>
                      <div><span style={{ fontSize: "10px", color: "#4A5B6C" }}>Moeda</span><p style={{ fontSize: "12px", color: "#4A5B6C", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].currency}</p></div>
                    </>
                  )}
                </div>
              )}

              {/* Monitorar como — override do tipo detectado */}
              <div>
                <label className="form-label">Monitorar como</label>
                <select className="form-input" value={form.monitorar_como || "auto"} onChange={e => setForm(f => ({ ...f, monitorar_como: e.target.value }))}>
                  <option value="auto">Automático (detectar pelo Meta)</option>
                  <option value="saldo">Saldo (PIX/Boleto) — alerta quando saldo baixo</option>
                  <option value="cartao">Cartão de Crédito — alerta quando erro no pagamento</option>
                </select>
                {form.monitorar_como === "saldo" && (
                  <p style={{ fontSize: "11px", color: "#C2620E", marginTop: "4px" }}>⚠️ Use quando o cartão está cadastrado no Meta mas a cliente abastece via PIX.</p>
                )}
              </div>

              {/* Nome */}
              <div>
                <label className="form-label">Nome da Cliente</label>
                <div style={{ display:"flex", gap:"6px" }}>
                  <input className="form-input" style={{ flex:1 }} value={form.nome_cliente} onChange={e => setForm(f => ({ ...f, nome_cliente: e.target.value }))} placeholder="Ex: Roseli Cabral" />
                  <select className="form-input" style={{ width:"auto", minWidth:"140px" }} value="" onChange={e => { if (e.target.value) setForm(f => ({ ...f, nome_cliente: e.target.value })); }}>
                    <option value="">Vincular cliente...</option>
                    {clientesControle.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Saldo mínimo — só pra PIX/Boleto */}
              {!isCartao() && (
                <div>
                  <label className="form-label">Saldo mínimo para alerta (R$)</label>
                  <input className="form-input" type="number" step="10" min="0" value={form.saldo_alerta} onChange={e => setForm(f => ({ ...f, saldo_alerta: parseFloat(e.target.value) || 0 }))} />
                </div>
              )}

              {/* Instância WhatsApp */}
              {waInstancias.length > 0 && (
                <div>
                  <label className="form-label">WhatsApp (instância)</label>
                  <select className="form-input" value={waInstanciaId} onChange={e => setWaInstanciaId(e.target.value)}>
                    <option value="">Selecione uma instância...</option>
                    {waInstancias.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.nome} {inst.conectado ? "● Conectado" : "○ Desconectado"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Grupo WhatsApp (pesquisável) */}
              <div>
                <label className="form-label">Grupo WhatsApp</label>
                <input className="form-input" placeholder="Pesquisar grupo..." value={buscaGrupo} onChange={e => setBuscaGrupo(e.target.value)} style={{ marginBottom: "8px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "160px", overflowY: "auto" }}>
                  {grupos.filter(g => g.subject.toLowerCase().includes(buscaGrupo.toLowerCase())).map(g => (
                    <button key={g.id} onClick={() => setForm(f => ({ ...f, grupo_id: g.id, grupo_nome: g.subject }))}
                      style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "10px 14px", background: form.grupo_id === g.id ? "rgba(41,171,226,0.1)" : "#FFFFFF",
                        border: `1px solid ${form.grupo_id === g.id ? "#1C6CA6" : "#E6EBF0"}`,
                        borderRadius: "8px", cursor: "pointer", textAlign: "left", color: "#0A1826", fontSize: "12px", width: "100%",
                      }}>
                      <span style={{ fontWeight: form.grupo_id === g.id ? "600" : "400" }}>{g.subject}</span>
                    </button>
                  ))}
                  {grupos.filter(g => g.subject.toLowerCase().includes(buscaGrupo.toLowerCase())).length === 0 && (
                    <p style={{ fontSize: "12px", color: "#4A5B6C", textAlign: "center", padding: "12px" }}>
                      {grupos.length === 0 ? "Nenhum grupo encontrado. Conecte o WhatsApp em Conexões." : "Nenhum grupo encontrado."}
                    </p>
                  )}
                </div>
              </div>

              {/* Template da mensagem */}
              <div>
                <label className="form-label">{isCartao() ? "Mensagem de erro de pagamento (Cartão)" : "Mensagem de saldo baixo (PIX/Boleto)"}</label>
                {isCartao() ? (
                  <textarea className="form-input" rows={8} value={form.template_status || TEMPLATE_PADRAO_CARTAO} onChange={e => setForm(f => ({ ...f, template_status: e.target.value }))} style={{ resize: "vertical", fontSize: "13px", lineHeight: "1.5" }} />
                ) : (
                  <textarea className="form-input" rows={8} value={form.template_saldo} onChange={e => setForm(f => ({ ...f, template_saldo: e.target.value }))} style={{ resize: "vertical", fontSize: "13px", lineHeight: "1.5" }} />
                )}
              </div>

              {/* Variáveis disponíveis */}
              <div style={{ background: "#FFFFFF", borderRadius: "8px", padding: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#4A5B6C", margin: "0 0 8px" }}>Variáveis</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {(isCartao() ? [
                    { var: "<CA>", desc: "Nome da cliente" },
                    { var: "<STATUS>", desc: "Status da conta" },
                    { var: "<PAGAMENTO>", desc: "Forma de pagamento" },
                  ] : [
                    { var: "<CA>", desc: "Nome da cliente" },
                    { var: "<SALDO>", desc: "Saldo atual" },
                    { var: "<LIMITE>", desc: "Saldo mínimo" },
                    { var: "<STATUS>", desc: "Status da conta" },
                    { var: "<PAGAMENTO>", desc: "Forma de pagamento" },
                  ]).map(v => (
                    <div key={v.var} onClick={() => {
                      if (isCartao()) setForm(f => ({ ...f, template_status: (f.template_status || TEMPLATE_PADRAO_CARTAO) + v.var }));
                      else setForm(f => ({ ...f, template_saldo: f.template_saldo + v.var }));
                    }} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", background: "#E6EBF0", border: "1px solid #E6EBF0" }}>
                      <code style={{ fontSize: "11px", color: "#1C6CA6" }}>{v.var}</code>
                      <span style={{ fontSize: "11px", color: "#4A5B6C" }}>{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#4A5B6C", margin: "0 0 8px" }}>Pré-visualização</p>
                <div style={{ background: "#FFFFFF", borderRadius: "8px", padding: "14px", fontSize: "13px", color: "#0A1826", whiteSpace: "pre-wrap", lineHeight: "1.5", borderLeft: "3px solid #1C6CA6" }}>
                  {previewMsg()}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} className="btn-ghost" style={{ cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="btn-primary" style={{ cursor: "pointer" }}>
                {salvando ? "Salvando..." : editando ? "Salvar" : "Criar Alerta"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
