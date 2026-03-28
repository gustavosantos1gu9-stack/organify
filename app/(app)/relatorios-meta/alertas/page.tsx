"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, RefreshCw, X, Bell, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Alerta {
  id?: string;
  agencia_id?: string;
  ad_account_id: string;
  nome_cliente: string;
  saldo_alerta: number;
  grupo_id: string;
  grupo_nome: string;
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
  const [criando, setCriando] = useState(false);
  const [contas, setContas] = useState<{ id: string; name: string }[]>([]);
  const [grupos, setGrupos] = useState<{ id: string; subject: string }[]>([]);
  const [form, setForm] = useState<Alerta>({ ad_account_id: "", nome_cliente: "", saldo_alerta: 50, grupo_id: "", grupo_nome: "", ativo: true });
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [contaInfo, setContaInfo] = useState<Record<string, ContaInfo>>({});
  const [token, setToken] = useState("");
  const [conConfig, setConConfig] = useState<any>(null);

  const carregar = async () => {
    const agId = await getAgenciaId();
    const res = await fetch("/api/alertas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", agencia_id: agId }),
    });
    const data = await res.json();
    setAlertas(data.data || []);

    // Buscar conexão
    const { data: con } = await supabase.from("relatorios_conexoes")
      .select("meta_token, evolution_url, evolution_key, whatsapp_instancia")
      .eq("agencia_id", agId!).order("created_at", { ascending: false }).limit(1).single();
    if (con) {
      setToken(con.meta_token || "");
      setConConfig(con);
    }

    setLoading(false);
  };

  const carregarContas = async () => {
    if (!token) return;
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=name,account_status&access_token=${token}&limit=50`);
      const data = await res.json();
      setContas((data.data || []).map((c: any) => ({ id: c.id.replace("act_", ""), name: c.name })));
    } catch {}
  };

  const carregarGrupos = async () => {
    if (!conConfig?.evolution_url || !conConfig?.evolution_key || !conConfig?.whatsapp_instancia) return;
    try {
      const res = await fetch(`${conConfig.evolution_url}/group/fetchAllGroups/${conConfig.whatsapp_instancia}?getParticipants=false`, {
        headers: { apikey: conConfig.evolution_key },
      });
      const data = await res.json();
      setGrupos(Array.isArray(data) ? data.map((g: any) => ({ id: g.id || g.remoteJid, subject: g.subject })) : []);
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
      if (!data.error) {
        setContaInfo(prev => ({ ...prev, [adAccountId]: data }));
      }
    } catch {}
    setVerificando(null);
  };

  const salvar = async () => {
    if (!form.ad_account_id || !form.nome_cliente || !form.grupo_id) {
      alert("Preencha todos os campos obrigatórios"); return;
    }
    setSalvando(true);
    try {
      const agId = await getAgenciaId();
      await fetch("/api/alertas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", agencia_id: agId, alerta: form }),
      });
      setCriando(false);
      setForm({ ad_account_id: "", nome_cliente: "", saldo_alerta: 50, grupo_id: "", grupo_nome: "", ativo: true });
      carregar();
    } catch { alert("Erro ao salvar"); }
    finally { setSalvando(false); }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este alerta?")) return;
    await fetch("/api/alertas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", alerta: { id } }),
    });
    carregar();
  };

  const toggleAtivo = async (alerta: Alerta) => {
    const agId = await getAgenciaId();
    await fetch("/api/alertas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", agencia_id: agId, alerta: { ...alerta, ativo: !alerta.ativo } }),
    });
    carregar();
  };

  const verificarTodas = async () => {
    for (const a of alertas) {
      await verificarConta(a.ad_account_id);
    }
  };

  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (token) carregarContas(); }, [token]);
  useEffect(() => { if (conConfig) carregarGrupos(); }, [conConfig]);

  const selecionarGrupo = (grupoId: string) => {
    const g = grupos.find(g => g.id === grupoId);
    setForm(f => ({ ...f, grupo_id: grupoId, grupo_nome: g?.subject || grupoId }));
  };

  const selecionarConta = (acId: string) => {
    const c = contas.find(c => c.id === acId);
    setForm(f => ({ ...f, ad_account_id: acId, nome_cliente: f.nome_cliente || c?.name || "" }));
    if (acId) verificarConta(acId);
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><a href="/relatorios-meta">Relatórios Meta</a><span>›</span><span className="current">Alertas</span></div>
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Alertas de Saldo e Status</h1>
          <p style={{ fontSize: "13px", color: "#606060", marginTop: "4px" }}>Monitora saldo PIX e status das contas de anúncio. Envia alerta no grupo da cliente.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {alertas.length > 0 && (
            <button onClick={verificarTodas} className="btn-secondary" style={{ cursor: "pointer", fontSize: "12px" }}>
              <RefreshCw size={12} /> Verificar Todas
            </button>
          )}
          <button onClick={() => setCriando(true)} className="btn-primary" style={{ cursor: "pointer", fontSize: "12px" }}>
            <Plus size={12} /> Novo Alerta
          </button>
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
          <thead>
            <tr>
              <th>CLIENTE / CONTA</th>
              <th>SALDO ATUAL</th>
              <th>LIMITE ALERTA</th>
              <th>FORMA PGTO</th>
              <th>STATUS CONTA</th>
              <th>GRUPO WHATSAPP</th>
              <th>ÚLTIMO ALERTA</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
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
                  <td>
                    {verificando === a.ad_account_id ? (
                      <span style={{ fontSize: "12px", color: "#606060" }}>Verificando...</span>
                    ) : info ? (
                      <span style={{ fontSize: "13px", fontWeight: "600", color: saldoBaixo ? "#ef4444" : "#22c55e" }}>
                        {formatMoney(info.balance)}
                      </span>
                    ) : (
                      <button onClick={() => verificarConta(a.ad_account_id)} style={{ fontSize: "11px", color: "#29ABE2", background: "none", border: "1px solid rgba(41,171,226,0.3)", borderRadius: "6px", padding: "2px 8px", cursor: "pointer" }}>
                        Verificar
                      </button>
                    )}
                  </td>
                  <td style={{ fontSize: "13px", color: "#f59e0b" }}>{formatMoney(a.saldo_alerta)}</td>
                  <td style={{ fontSize: "12px", color: "#a0a0a0" }}>{info?.forma_pagamento || "—"}</td>
                  <td>
                    {info ? (
                      <span style={{
                        fontSize: "11px", padding: "2px 8px", borderRadius: "20px",
                        background: contaProblema ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                        color: contaProblema ? "#ef4444" : "#22c55e",
                        border: `1px solid ${contaProblema ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                      }}>
                        {info.status}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ fontSize: "12px", color: "#a0a0a0" }}>{a.grupo_nome || "—"}</td>
                  <td style={{ fontSize: "12px", color: "#606060" }}>{formatarData(a.ultimo_alerta || "")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => toggleAtivo(a)} style={{
                        fontSize: "11px", padding: "4px 8px", borderRadius: "6px", cursor: "pointer",
                        background: a.ativo ? "rgba(34,197,94,0.1)" : "rgba(96,96,96,0.1)",
                        border: `1px solid ${a.ativo ? "rgba(34,197,94,0.3)" : "#2e2e2e"}`,
                        color: a.ativo ? "#22c55e" : "#606060",
                      }}>
                        {a.ativo ? "Ativo" : "Pausado"}
                      </button>
                      <button onClick={() => excluir(a.id!)} style={{
                        padding: "4px 8px", borderRadius: "6px", border: "1px solid #2e2e2e",
                        background: "#222", color: "#ef4444", cursor: "pointer",
                      }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de criação */}
      {criando && (
        <>
          <div onClick={() => setCriando(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "500px", maxHeight: "85vh", overflowY: "auto", background: "#141414", border: "1px solid #2e2e2e", borderRadius: "12px", zIndex: 101, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Novo Alerta de Saldo</h2>
              <button onClick={() => setCriando(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="form-label">Conta de Anúncio</label>
                <select className="form-input" value={form.ad_account_id} onChange={e => selecionarConta(e.target.value)}>
                  <option value="">Selecione...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                </select>
              </div>

              {contaInfo[form.ad_account_id] && (
                <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>SALDO</span><p style={{ fontSize: "14px", fontWeight: "600", color: "#f0f0f0", margin: "2px 0 0" }}>{formatMoney(contaInfo[form.ad_account_id].balance)}</p></div>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>FORMA DE PAGAMENTO</span><p style={{ fontSize: "12px", color: "#a0a0a0", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].forma_pagamento}</p></div>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>STATUS</span><p style={{ fontSize: "12px", color: contaInfo[form.ad_account_id].account_status === 1 ? "#22c55e" : "#ef4444", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].status}</p></div>
                  <div><span style={{ fontSize: "10px", color: "#606060" }}>MOEDA</span><p style={{ fontSize: "12px", color: "#a0a0a0", margin: "2px 0 0" }}>{contaInfo[form.ad_account_id].currency}</p></div>
                </div>
              )}

              <div>
                <label className="form-label">Nome da Cliente</label>
                <input className="form-input" value={form.nome_cliente} onChange={e => setForm(f => ({ ...f, nome_cliente: e.target.value }))} placeholder="Ex: Clínica da Dra. Ana" />
              </div>

              <div>
                <label className="form-label">Saldo mínimo para alerta (R$)</label>
                <input className="form-input" type="number" step="10" min="0" value={form.saldo_alerta} onChange={e => setForm(f => ({ ...f, saldo_alerta: parseFloat(e.target.value) || 0 }))} />
                <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Quando o saldo cair abaixo deste valor, envia alerta no grupo.</p>
              </div>

              <div>
                <label className="form-label">Grupo WhatsApp (destino do alerta)</label>
                <select className="form-input" value={form.grupo_id} onChange={e => selecionarGrupo(e.target.value)}>
                  <option value="">Selecione o grupo...</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.subject}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setCriando(false)} className="btn-ghost" style={{ cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="btn-primary" style={{ cursor: "pointer" }}>
                {salvando ? "Salvando..." : "Criar Alerta"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
