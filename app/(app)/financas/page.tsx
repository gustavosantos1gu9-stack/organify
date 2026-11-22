"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const APP_URL = "https://salxconvert-blond.vercel.app";
const WEBHOOK_URL = `${APP_URL}/api/webhook/financas`;

interface FinancasConfig {
  id: string;
  google_email: string | null;
  spreadsheet_url: string | null;
  grupo_jid: string | null;
  instancia: string | null;
}

interface Lancamento {
  id: string;
  descricao: string;
  tipo: string;
  categoria: string;
  valor: number;
  dia_vencimento: number | null;
  mes_referencia: string;
  pago: boolean;
  criado_por: string | null;
  criado_em: string;
}

export default function FinancasPage() {
  const [config, setConfig] = useState<FinancasConfig | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [instanciaInput, setInstanciaInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ criados: number; pulados: number } | null>(null);

  useEffect(() => {
    async function checkMaster() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsMaster(false); return; }
      // Usuários da equipe têm registro em "usuarios" — dono não tem
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("agencia_id")
        .eq("auth_user_id", user.id)
        .limit(1);
      if (usuarios && usuarios.length > 0) { setIsMaster(false); return; }
      // Dono: verificar se a agência não é filha
      const { data: agencias } = await supabase
        .from("agencias")
        .select("id, parent_id")
        .is("parent_id", null)
        .limit(1);
      setIsMaster(!!(agencias && agencias.length > 0));
    }
    checkMaster();

    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setSuccessMsg("Google Sheets conectado com sucesso!");
    if (params.get("error")) setSuccessMsg(`Erro: ${params.get("error")}`);
    loadData();
  }, [])

  async function loadData() {
    setLoading(true);
    try {
      const { data: cfg } = await supabase
        .from("financas_config")
        .select("id,google_email,spreadsheet_url,grupo_jid,instancia")
        .limit(1)
        .single();

      setConfig(cfg || null);
      if (cfg?.instancia) setInstanciaInput(cfg.instancia);

      const { data: lancs } = await supabase
        .from("financas_lancamentos")
        .select("id,descricao,tipo,categoria,valor,dia_vencimento,mes_referencia,pago,criado_por,criado_em")
        .order("criado_em", { ascending: false })
        .limit(10);

      setLancamentos(lancs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function sincronizarAgenda() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/financas/sincronizar-agenda");
      const data = await res.json();
      if (data.ok) {
        setSyncResult({ criados: data.criados, pulados: data.pulados });
      } else {
        setSuccessMsg(`Erro ao sincronizar: ${data.error || "tente novamente"}`);
        setTimeout(() => setSuccessMsg(""), 5000);
      }
    } catch {
      setSuccessMsg("Erro ao sincronizar com a agenda");
      setTimeout(() => setSuccessMsg(""), 5000);
    } finally {
      setSyncing(false);
    }
  }

  async function saveInstancia() {
    if (!config?.id) return;
    setSaving(true);
    try {
      await supabase
        .from("financas_config")
        .update({ instancia: instanciaInput })
        .eq("id", config.id);
      setConfig((prev) => prev ? { ...prev, instancia: instanciaInput } : prev);
      setSuccessMsg("Instância salva!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  function tipoLabel(tipo: string) {
    if (tipo === "conta") return "Conta";
    if (tipo === "gasto") return "Gasto";
    if (tipo === "receita") return "Receita";
    return tipo;
  }

  function categoriaLabel(cat: string) {
    return cat === "empresa" ? "Empresa" : "Pessoal";
  }

  function formatMoney(v: number) {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }

  if (isMaster === null || loading) {
    return (
      <div style={{ padding: "32px", color: "var(--text-secondary)" }}>Carregando...</div>
    );
  }

  if (!isMaster) {
    return (
      <div style={{ padding: "32px", color: "var(--text-secondary)" }}>Acesso restrito.</div>
    );
  }

  return (
    <div style={{ padding: "32px", maxWidth: "860px", color: "var(--navy)" }}>
      <h1 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "8px", color: "var(--navy)" }}>
        Finanças Pessoais
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "28px" }}>
        Agente financeiro via WhatsApp + Google Sheets
      </p>

      {successMsg && (
        <div style={{
          background: successMsg.startsWith("Erro") ? "rgba(180,35,24,0.1)" : "rgba(30,107,82,0.1)",
          border: `1px solid ${successMsg.startsWith("Erro") ? "rgba(180,35,24,0.3)" : "rgba(30,107,82,0.3)"}`,
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
          color: successMsg.startsWith("Erro") ? "var(--alert-text)" : "var(--success)",
          fontSize: "13px",
        }}>
          {successMsg}
        </div>
      )}

      {/* ─── Google Sheets ─────────────────────────────────── */}
      <section style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "var(--navy)" }}>
          Google Sheets
        </h2>

        {config?.google_email ? (
          <div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Conectado como: <span style={{ color: "var(--brand)" }}>{config.google_email}</span>
            </div>
            {config.spreadsheet_url && (
              <a
                href={config.spreadsheet_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  background: "rgba(28,108,166,0.1)",
                  border: "1px solid rgba(28,108,166,0.3)",
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "12px",
                  color: "var(--brand)",
                  textDecoration: "none",
                  marginBottom: "12px",
                }}
              >
                Abrir Planilha →
              </a>
            )}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.href = "/api/auth/google/financas"}
                style={{
                  background: "var(--hover-row)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Reconectar Google
              </button>
              <button
                onClick={sincronizarAgenda}
                disabled={syncing}
                style={{
                  background: syncing ? "rgba(30,107,82,0.07)" : "rgba(30,107,82,0.12)",
                  border: "1px solid rgba(30,107,82,0.3)",
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "12px",
                  color: syncing ? "rgba(30,107,82,0.6)" : "var(--success)",
                  cursor: syncing ? "not-allowed" : "pointer",
                  opacity: syncing ? 0.8 : 1,
                }}
              >
                {syncing ? "Sincronizando..." : "Sincronizar com Agenda"}
              </button>
              {syncResult && (
                <span style={{ fontSize: "12px", color: "var(--success)" }}>
                  {syncResult.criados} evento{syncResult.criados !== 1 ? "s" : ""} criado{syncResult.criados !== 1 ? "s" : ""}
                  {syncResult.pulados > 0 ? `, ${syncResult.pulados} já existiam` : ""}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
              Conecte sua conta Google para registrar lançamentos automaticamente na planilha.
            </p>
            <button
              onClick={() => window.location.href = "/api/auth/google/financas"}
              style={{
                background: "var(--brand)",
                border: "none",
                borderRadius: "7px",
                padding: "9px 18px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A1826",
                cursor: "pointer",
              }}
            >
              Conectar Google Sheets
            </button>
          </div>
        )}
      </section>

      {/* ─── WhatsApp / Evolution ──────────────────────────── */}
      <section style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "var(--navy)" }}>
          WhatsApp
        </h2>

        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
            Grupo JID
          </div>
          <div style={{ fontSize: "13px", color: config?.grupo_jid ? "var(--success)" : "var(--text-secondary)" }}>
            {config?.grupo_jid || "Aguardando primeira mensagem do grupo"}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
            Instância Evolution
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={instanciaInput}
              onChange={(e) => setInstanciaInput(e.target.value)}
              placeholder="nome-da-instancia"
              style={{
                background: "var(--off-white)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "7px 12px",
                fontSize: "13px",
                color: "var(--navy)",
                flex: 1,
                outline: "none",
              }}
            />
            <button
              onClick={saveInstancia}
              disabled={saving}
              style={{
                background: "var(--brand)",
                border: "none",
                borderRadius: "6px",
                padding: "7px 14px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A1826",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        <div style={{
          background: "var(--off-white)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
            Webhook URL para configurar no Evolution API
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: "12px",
            color: "var(--brand)",
            wordBreak: "break-all",
          }}>
            {WEBHOOK_URL}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px" }}>
            Configure este URL no Evolution API para a instância desejada, com evento: <strong>MESSAGES_UPSERT</strong>
          </div>
        </div>
      </section>

      {/* ─── Lançamentos recentes ──────────────────────────── */}
      <section style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "var(--navy)" }}>
          Lançamentos Recentes
        </h2>

        {lancamentos.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Nenhum lançamento ainda. Mande uma mensagem no grupo para começar!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {lancamentos.map((l) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "var(--off-white)",
                  borderRadius: "7px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", color: "var(--navy)", fontWeight: "500" }}>
                    {l.descricao}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    {tipoLabel(l.tipo)} · {categoriaLabel(l.categoria)} · {l.mes_referencia}
                    {l.criado_por ? ` · por ${l.criado_por}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: "90px" }}>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: l.tipo === "receita" ? "var(--success)" : "var(--navy)",
                  }}>
                    R${formatMoney(l.valor)}
                  </div>
                  {l.tipo === "conta" && (
                    <div style={{
                      fontSize: "11px",
                      color: l.pago ? "var(--success)" : "var(--alert-text)",
                      marginTop: "2px",
                    }}>
                      {l.pago ? "Pago " : l.dia_vencimento ? `Vence dia ${l.dia_vencimento}` : "Pendente"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Instruções ───────────────────────────────────── */}
      <section style={{
        background: "var(--off-white)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "20px",
      }}>
        <h2 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text-secondary)" }}>
          Como usar
        </h2>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.8" }}>
          <p>1. Conecte o Google Sheets acima (cria a planilha automaticamente)</p>
          <p>2. Configure a instância Evolution e copie o webhook URL</p>
          <p>3. No Evolution API, adicione o webhook para a instância escolhida</p>
          <p>4. Adicione a instância em um grupo do WhatsApp</p>
          <p>5. Mande &quot;ajuda&quot; no grupo para ver os comandos disponíveis</p>
        </div>
        <div style={{ marginTop: "14px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Notificações de vencimento são enviadas diariamente às <strong style={{ color: "var(--text-secondary)" }}>08:00</strong> (horário de Brasília).
        </div>
      </section>
    </div>
  );
}
