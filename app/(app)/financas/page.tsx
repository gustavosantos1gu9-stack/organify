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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setSuccessMsg("Google Sheets conectado com sucesso!");
    if (params.get("error")) setSuccessMsg(`Erro: ${params.get("error")}`);
    loadData();
  }, []);

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
    if (tipo === "conta") return "📄 Conta";
    if (tipo === "gasto") return "💸 Gasto";
    if (tipo === "receita") return "💰 Receita";
    return tipo;
  }

  function categoriaLabel(cat: string) {
    return cat === "empresa" ? "🏢 Empresa" : "🏠 Pessoal";
  }

  function formatMoney(v: number) {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }

  if (loading) {
    return (
      <div style={{ padding: "32px", color: "#a0a0a0" }}>Carregando...</div>
    );
  }

  return (
    <div style={{ padding: "32px", maxWidth: "860px", color: "#e0e0e0" }}>
      <h1 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "8px", color: "#f0f0f0" }}>
        💰 Finanças Pessoais
      </h1>
      <p style={{ fontSize: "13px", color: "#707070", marginBottom: "28px" }}>
        Agente financeiro via WhatsApp + Google Sheets
      </p>

      {successMsg && (
        <div style={{
          background: successMsg.startsWith("Erro") ? "#3a1515" : "#153a15",
          border: `1px solid ${successMsg.startsWith("Erro") ? "#6a2020" : "#206a20"}`,
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
          color: successMsg.startsWith("Erro") ? "#f87171" : "#4ade80",
          fontSize: "13px",
        }}>
          {successMsg}
        </div>
      )}

      {/* ─── Google Sheets ─────────────────────────────────── */}
      <section style={{
        background: "#1a1a1a",
        border: "1px solid #2e2e2e",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "#f0f0f0" }}>
          📊 Google Sheets
        </h2>

        {config?.google_email ? (
          <div>
            <div style={{ fontSize: "13px", color: "#a0a0a0", marginBottom: "8px" }}>
              Conectado como: <span style={{ color: "#29ABE2" }}>{config.google_email}</span>
            </div>
            {config.spreadsheet_url && (
              <a
                href={config.spreadsheet_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  background: "#1e3a4a",
                  border: "1px solid #2a5a6a",
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "12px",
                  color: "#29ABE2",
                  textDecoration: "none",
                  marginBottom: "12px",
                }}
              >
                Abrir Planilha →
              </a>
            )}
            <div>
              <button
                onClick={() => window.location.href = "/api/auth/google/financas"}
                style={{
                  background: "#2a2a2a",
                  border: "1px solid #3a3a3a",
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "12px",
                  color: "#a0a0a0",
                  cursor: "pointer",
                }}
              >
                Reconectar Google
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: "13px", color: "#707070", marginBottom: "12px" }}>
              Conecte sua conta Google para registrar lançamentos automaticamente na planilha.
            </p>
            <button
              onClick={() => window.location.href = "/api/auth/google/financas"}
              style={{
                background: "#29ABE2",
                border: "none",
                borderRadius: "7px",
                padding: "9px 18px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#fff",
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
        background: "#1a1a1a",
        border: "1px solid #2e2e2e",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "#f0f0f0" }}>
          💬 WhatsApp
        </h2>

        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", color: "#606060", marginBottom: "4px" }}>
            Grupo JID
          </div>
          <div style={{ fontSize: "13px", color: config?.grupo_jid ? "#4ade80" : "#a0a0a0" }}>
            {config?.grupo_jid || "Aguardando primeira mensagem do grupo"}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", color: "#606060", display: "block", marginBottom: "6px" }}>
            Instância Evolution
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={instanciaInput}
              onChange={(e) => setInstanciaInput(e.target.value)}
              placeholder="nome-da-instancia"
              style={{
                background: "#141414",
                border: "1px solid #3a3a3a",
                borderRadius: "6px",
                padding: "7px 12px",
                fontSize: "13px",
                color: "#e0e0e0",
                flex: 1,
                outline: "none",
              }}
            />
            <button
              onClick={saveInstancia}
              disabled={saving}
              style={{
                background: "#29ABE2",
                border: "none",
                borderRadius: "6px",
                padding: "7px 14px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        <div style={{
          background: "#141414",
          border: "1px solid #2e2e2e",
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "12px", color: "#606060", marginBottom: "6px" }}>
            Webhook URL para configurar no Evolution API
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#29ABE2",
            wordBreak: "break-all",
          }}>
            {WEBHOOK_URL}
          </div>
          <div style={{ fontSize: "11px", color: "#505050", marginTop: "8px" }}>
            Configure este URL no Evolution API para a instância desejada, com evento: <strong>MESSAGES_UPSERT</strong>
          </div>
        </div>
      </section>

      {/* ─── Lançamentos recentes ──────────────────────────── */}
      <section style={{
        background: "#1a1a1a",
        border: "1px solid #2e2e2e",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "#f0f0f0" }}>
          📋 Lançamentos Recentes
        </h2>

        {lancamentos.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#505050" }}>
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
                  background: "#141414",
                  borderRadius: "7px",
                  border: "1px solid #252525",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", color: "#e0e0e0", fontWeight: "500" }}>
                    {l.descricao}
                  </div>
                  <div style={{ fontSize: "11px", color: "#606060", marginTop: "2px" }}>
                    {tipoLabel(l.tipo)} · {categoriaLabel(l.categoria)} · {l.mes_referencia}
                    {l.criado_por ? ` · por ${l.criado_por}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: "90px" }}>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: l.tipo === "receita" ? "#4ade80" : "#f0f0f0",
                  }}>
                    R${formatMoney(l.valor)}
                  </div>
                  {l.tipo === "conta" && (
                    <div style={{
                      fontSize: "11px",
                      color: l.pago ? "#4ade80" : "#f87171",
                      marginTop: "2px",
                    }}>
                      {l.pago ? "Pago ✓" : l.dia_vencimento ? `Vence dia ${l.dia_vencimento}` : "Pendente"}
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
        background: "#141414",
        border: "1px solid #2e2e2e",
        borderRadius: "10px",
        padding: "20px",
      }}>
        <h2 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#a0a0a0" }}>
          Como usar
        </h2>
        <div style={{ fontSize: "12px", color: "#606060", lineHeight: "1.8" }}>
          <p>1. Conecte o Google Sheets acima (cria a planilha automaticamente)</p>
          <p>2. Configure a instância Evolution e copie o webhook URL</p>
          <p>3. No Evolution API, adicione o webhook para a instância escolhida</p>
          <p>4. Adicione a instância em um grupo do WhatsApp</p>
          <p>5. Mande &quot;ajuda&quot; no grupo para ver os comandos disponíveis</p>
        </div>
        <div style={{ marginTop: "14px", fontSize: "12px", color: "#505050" }}>
          Notificações de vencimento são enviadas diariamente às <strong style={{ color: "#a0a0a0" }}>08:00</strong> (horário de Brasília).
        </div>
      </section>
    </div>
  );
}
