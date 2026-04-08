"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, RefreshCw, X, Edit2, AlertTriangle } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

const TEMPLATE_PADRAO = `Boa tarde! Passando para informar que estamos com saldo baixo na conta e os anúncios podem pausar!

O saldo da conta de anúncios *<CA>* está em *<SALDO>*
Limite configurado: <LIMITE>

Podemos abastecer?`;

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
    template_saldo: TEMPLATE_PADRAO, template_status: "", forma_pagamento: "", ativo: true,
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
          const balance = Math.max(c.balance ? parseFloat(c.balance) / 100 : 0, 0);
          const spendCap = c.spend_cap ? parseFloat(c.spend_cap) / 100 : 0;
          return { id, name: c.name, balance, spendCap, account_status: c.account_status };
        });
        // Pré-pagas: tem saldo ou spend_cap definido
        const prePagas = todas.filter((c: any) => c.spendCap > 0 || c.balance > 0);
        setContas(prePagas.length > 0 ? prePagas : todas);
      } else {
        setErroContas(data.error || "Token expirado ou inválido");
      }
    } catch (err: any) {
      setErroContas("Erro ao carregar contas: " + (err.message || ""));
    }
    setLoadingContas(false);
  };

  const carregarGrupos = async () => {
    if (!conConfig?.evolution_url || !conConfig?.evolution_key || !conConfig?.whatsapp_instancia) return;
    try {
      const res = await fetch(`${conConfig.evolution_url}/chat/findChats/${conConfig.whatsapp_instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: conConfig.evolution_key },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const allChats = Array.isArray(json) ? json : [];
      setGrupos(allChats
        .filter((c: any) => (c.remoteJid || c.id || "").includes("@g.us"))
        .map((c: any) => ({ id: c.remoteJid || c.id, subject: c.pushName || c.name || c.subject || c.remoteJid || c.id }))
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
      if (alerta.ad_account_id) verificarConta(alerta.ad_account_id);
    } else {
      setEditando(null);
      setForm({
        ad_account_id: "", nome_cliente: "", saldo_alerta: 50, grupo_id: "", grupo_nome: "",
        template_saldo: TEMPLATE_PADRAO, template_status: "", forma_pagamento: "", ativo: true,
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
      const alerta = { ...form, forma_pagamento: info?.forma_pagamento || form.forma_pagamento || "" };
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
  useEffect(() => { if (conConfig) carregarGrupos(); }, [conConfig]);

  // Preview da mensagem com variáveis substituídas
  const previewMsg = () => {
    const info = contaInfo[form.ad_account_id];
    let msg = form.template_saldo || TEMPLATE_PADRAO;
    const vars: Record<string, string> = {
      "<CA>": form.nome_cliente || "Cliente",
      "<SALDO>": info ? formatMoney(info.balance) : "R$ 0,00",
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
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Alertas de Saldo</h1>
          <p style={{ fontSize: "13px", color: "#606060", marginTop: "4px" }}>Monitora saldo das contas PIX e envia alerta no grupo da cliente.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {alertas.length > 0 && (
            <button onClick={verificarTodas} className="btn-secondary" style={{ cursor: "pointer", fontSize: "12px" }}><RefreshCw size={12} /> Verificar</button>
          )}
          <button onClick={() => abrirModal()} className="btn-primary" style={{ cursor: "pointer", fontSize: "12px" }}><Plus size={12} /> Novo Alerta</button>
        </div>
      </div>

      {!token && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#f59e0b" }}>
          <AlertTriangle size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
          Token Meta não configurado. <a href="/relatorios-meta/conexoes" style={{ color: "#29ABE2", textDecoration: "underline" }}>Configure em Conexões</a>.
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead><tr><th>CLIENTE / CONTA</th><th>SALDO ATUAL</th><th>LIMITE</th><th>PAGAMENTO</th><th>STATUS</th><th>GRUPO</th><th>ÚLTIMO ALERTA</th><th>AÇÕES</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Carregando...</td></tr>
            ) : !alertas.length ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Nenhum alerta configurado.</td></tr>
            ) : alertas.map(a => {
              const info = contaInfo[a.ad_account_id];
              const saldoBaixo = info && a.saldo_alerta && info.balance <= a.saldo_alerta;
              const contaProblema = info && info.account_status !== 1;
              return (
                <tr key={a.id} style={{ opacity: a.ativo ? 1 : 0.5 }}>
                  <td>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0", margin: 0 }}>{a.nome_cliente}</p>
                    <p style={{ fontSize: "11px", color: "#606060", margin: 0 }}>act_{a.ad_account_id}</p>
                  </td>
                  <td>{verificando === a.ad_account_id ? <span style={{ fontSize: "12px", color: "#606060" }}>...</span> : info ? <span style={{ fontSize: "13px", fontWeight: "600", color: saldoBaixo ? "#ef4444" : "#22c55e" }}>{formatMoney(info.balance)}</span> : <button onClick={() => verificarConta(a.ad_account_id)} style={{ fontSize: "11px", color: "#29ABE2", background: "none", border: "1px solid rgba(41,171,226,0.3)", borderRadius: "6px", padding: "2px 8px", cursor: "pointer" }}>Ver</button>}</td>
                  <td style={{ fontSize: "13px", color: "#f59e0b" }}>{formatMoney(a.saldo_alerta)}</td>
                  <td style={{ fontSize: "12px", color: "#a0a0a0" }}>{info?.forma_pagamento || a.forma_pagamento || "—"}</td>
                  <td>{info ? <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: contaProblema ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", color: contaProblema ? "#ef4444" : "#22c55e", border: `1px solid ${contaProblema ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}` }}>{info.status}</span> : "—"}</td>
                  <td style={{ fontSize: "12px", color: "#a0a0a0" }}>{a.grupo_nome || "—"}</td>
                  <td style={{ fontSize: "12px", color: "#606060" }}>{formatarData(a.ultimo_alerta || "")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => abrirModal(a)} style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #2e2e2e", background: "#222", color: "#29ABE2", cursor: "pointer" }}><Edit2 size={12} /></button>
                      <button onClick={() => toggleAtivo(a)} style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", background: a.ativo ? "rgba(34,197,94,0.1)" : "rgba(96,96,96,0.1)", border: `1px solid ${a.ativo ? "rgba(34,197,94,0.3)" : "#2e2e2e"}`, color: a.ativo ? "#22c55e" : "#606060" }}>{a.ativo ? "Ativo" : "Pausado"}</button>
                      <button onClick={() => excluir(a.id!)} style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #2e2e2e", background: "#222", color: "#ef4444", cursor: "pointer" }}><Trash2 size={12} /></button>
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
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "560px", maxHeight: "90vh", overflowY: "auto", background: "#141414", border: "1px solid #2e2e2e", borderRadius: "12px", zIndex: 101, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>{editando ? "Editar Alerta" : "Novo Alerta"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Conta de Anúncio (pesquisável) */}
              <div>
                <label className="form-label">Conta de Anúncio (Pré-pago)</label>
                {loadingContas ? (
                  <p style={{ fontSize: "12px", color: "#606060" }}>Carregando contas...</p>
                ) : erroContas ? (
                  <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "12px", color: "#ef4444" }}>{erroContas}</p>
                    <a href="/relatorios-meta/conexoes" style={{ fontSize: "11px", color: "#29ABE2" }}>Reconectar</a>
                  </div>
                ) : (
                  <>
                    <input className="form-input" placeholder="Pesquisar conta..." value={buscaConta} onChange={e => setBuscaConta(e.target.value)} style={{ marginBottom: "8px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "160px", overflowY: "auto" }}>
                      {contas.filter(c => c.name.toLowerCase().includes(buscaConta.toLowerCase()) || c.id.includes(buscaConta)).map(c => (
                        <button key={c.id} onClick={() => { setForm(f => ({ ...f, ad_account_id: c.id, nome_cliente: f.nome_cliente || c.name || "" })); verificarConta(c.id); }}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", background: form.ad_account_id === c.id ? "rgba(41,171,226,0.1)" : "#1a1a1a",
                            border: `1px solid ${form.ad_account_id === c.id ? "#29ABE2" : "#2e2e2e"}`,
                            borderRadius: "8px", cursor: "pointer", textAlign: "left", color: "#f0f0f0", fontSize: "12px", width: "100%",
                          }}>
                          <div>
                            <span style={{ fontWeight: form.ad_account_id === c.id ? "600" : "400" }}>{c.name}</span>
                            {(c as any).balance > 0 && (
                              <span style={{ marginLeft: "8px", fontSize: "11px", color: "#22c55e" }}>{formatMoney((c as any).balance)}</span>
                            )}
                          </div>
                          <span style={{ color: "#606060", fontSize: "11px" }}>act_{c.id}</span>
                        </button>
                      ))}
                      {contas.filter(c => c.name.toLowerCase().includes(buscaConta.toLowerCase()) || c.id.includes(buscaConta)).length === 0 && (
                        <p style={{ fontSize: "12px", color: "#606060", textAlign: "center", padding: "12px" }}>Nenhuma conta encontrada.</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Info da conta */}
              {contaInfo[form.ad_account_id] && (
                <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>SALDO</span><p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0", margin: "2px 0 0" }}>{formatMoney(contaInfo[form.ad_account_id].balance)}</p></div>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>PAGAMENTO</span><p style={{ fontSize: "12px", color: "#a0a0a0", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].forma_pagamento}</p></div>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>STATUS</span><p style={{ fontSize: "12px", color: contaInfo[form.ad_account_id].account_status === 1 ? "#22c55e" : "#ef4444", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].status}</p></div>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>MOEDA</span><p style={{ fontSize: "12px", color: "#a0a0a0", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].currency}</p></div>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="form-label">Nome da Cliente</label>
                <input className="form-input" value={form.nome_cliente} onChange={e => setForm(f => ({ ...f, nome_cliente: e.target.value }))} placeholder="Ex: Roseli Cabral" />
              </div>

              {/* Saldo mínimo */}
              <div>
                <label className="form-label">Saldo mínimo para alerta (R$)</label>
                <input className="form-input" type="number" step="10" min="0" value={form.saldo_alerta} onChange={e => setForm(f => ({ ...f, saldo_alerta: parseFloat(e.target.value) || 0 }))} />
              </div>

              {/* Grupo WhatsApp (pesquisável) */}
              <div>
                <label className="form-label">Grupo WhatsApp</label>
                <input className="form-input" placeholder="Pesquisar grupo..." value={buscaGrupo} onChange={e => setBuscaGrupo(e.target.value)} style={{ marginBottom: "8px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "160px", overflowY: "auto" }}>
                  {grupos.filter(g => g.subject.toLowerCase().includes(buscaGrupo.toLowerCase())).map(g => (
                    <button key={g.id} onClick={() => setForm(f => ({ ...f, grupo_id: g.id, grupo_nome: g.subject }))}
                      style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "10px 14px", background: form.grupo_id === g.id ? "rgba(41,171,226,0.1)" : "#1a1a1a",
                        border: `1px solid ${form.grupo_id === g.id ? "#29ABE2" : "#2e2e2e"}`,
                        borderRadius: "8px", cursor: "pointer", textAlign: "left", color: "#f0f0f0", fontSize: "12px", width: "100%",
                      }}>
                      <span style={{ fontWeight: form.grupo_id === g.id ? "600" : "400" }}>{g.subject}</span>
                    </button>
                  ))}
                  {grupos.filter(g => g.subject.toLowerCase().includes(buscaGrupo.toLowerCase())).length === 0 && (
                    <p style={{ fontSize: "12px", color: "#606060", textAlign: "center", padding: "12px" }}>
                      {grupos.length === 0 ? "Nenhum grupo encontrado. Conecte o WhatsApp em Conexões." : "Nenhum grupo encontrado."}
                    </p>
                  )}
                </div>
              </div>

              {/* Template da mensagem */}
              <div>
                <label className="form-label">Personalize sua mensagem</label>
                <textarea className="form-input" rows={8} value={form.template_saldo} onChange={e => setForm(f => ({ ...f, template_saldo: e.target.value }))} style={{ resize: "vertical", fontSize: "13px", lineHeight: "1.5" }} />
              </div>

              {/* Variáveis disponíveis */}
              <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#606060", margin: "0 0 8px" }}>VARIÁVEIS</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {[
                    { var: "<CA>", desc: "Nome da cliente" },
                    { var: "<SALDO>", desc: "Saldo atual" },
                    { var: "<LIMITE>", desc: "Saldo mínimo" },
                    { var: "<STATUS>", desc: "Status da conta" },
                    { var: "<PAGAMENTO>", desc: "Forma de pagamento" },
                  ].map(v => (
                    <div key={v.var} onClick={() => setForm(f => ({ ...f, template_saldo: f.template_saldo + v.var }))} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", background: "#222", border: "1px solid #2e2e2e" }}>
                      <code style={{ fontSize: "11px", color: "#29ABE2" }}>{v.var}</code>
                      <span style={{ fontSize: "11px", color: "#606060" }}>{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#606060", margin: "0 0 8px" }}>PRÉ-VISUALIZAÇÃO</p>
                <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "14px", fontSize: "13px", color: "#f0f0f0", whiteSpace: "pre-wrap", lineHeight: "1.5", borderLeft: "3px solid #29ABE2" }}>
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
