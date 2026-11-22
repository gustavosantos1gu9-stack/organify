"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, WifiOff, Heart, MessageSquareOff, Timer } from "lucide-react";

interface AlertaAberto {
  tipo: string;
  mensagem: string;
  created_at: string;
  email_enviado: boolean;
}

interface InstanciaStatus {
  instancia: string;
  nome: string;
  alertas_abertos: AlertaAberto[];
  ultimo_resolvido: { tipo: string; resolvido_at: string; mensagem: string } | null;
  ultima_msg_recebida: string | null;
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function TipoIcon({ tipo }: { tipo: string }) {
  if (tipo === "state") return <WifiOff size={12} />;
  if (tipo === "delay") return <Timer size={12} />;
  if (tipo === "silence") return <MessageSquareOff size={12} />;
  return <AlertTriangle size={12} />;
}

function tipoLabel(tipo: string) {
  if (tipo === "state") return "Desconectado";
  if (tipo === "delay") return "Atraso";
  if (tipo === "silence") return "Silêncio";
  return tipo;
}

export default function WhatsAppStatusPage() {
  const [instancias, setInstancias] = useState<InstanciaStatus[]>([]);
  const [alertasAbertos, setAlertasAbertos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/heartbeat/status");
      const data = await res.json();
      setInstancias(data.instancias || []);
      setAlertasAbertos(data.alertas_abertos || 0);
      setUltimaAtualizacao(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const i = setInterval(carregar, 60000);
    return () => clearInterval(i);
  }, [carregar]);

  const totalOk = instancias.filter(i => i.alertas_abertos.length === 0).length;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <a href="/configuracoes/whatsapp-contas">Gerenciar Contas</a><span>›</span>
        <span className="current">Status WhatsApp</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "600", margin: 0 }}>Status WhatsApp</h1>
          <p style={{ fontSize: 12, color: "#606060", margin: "4px 0 0" }}>
            Monitoramento passivo · verificação a cada 15 min
            {ultimaAtualizacao && ` · Atualizado ${tempoRelativo(ultimaAtualizacao.toISOString())}`}
          </p>
        </div>
        <button className="btn-ghost" onClick={carregar} style={{ padding: "8px" }} disabled={loading}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "28px" }}>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={18} color="#22c55e" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Sem alertas</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#22c55e", margin: 0 }}>{totalOk}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: alertasAbertos ? "rgba(239,68,68,0.15)" : "rgba(100,100,100,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={18} color={alertasAbertos ? "#ef4444" : "#606060"} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Alertas abertos</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: alertasAbertos ? "#ef4444" : "#f0f0f0", margin: 0 }}>{alertasAbertos}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(41,171,226,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Heart size={18} color="#29ABE2" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>Monitoradas</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{instancias.length}</p>
          </div>
        </div>
      </div>

      {/* Alertas ativos */}
      {alertasAbertos > 0 && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} color="#ef4444" />
            <strong style={{ color: "#ef4444", fontSize: 14 }}>Alertas ativos</strong>
          </div>
          {instancias.filter(i => i.alertas_abertos.length > 0).map(i =>
            i.alertas_abertos.map(a => (
              <div key={`${i.instancia}-${a.tipo}`} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <TipoIcon tipo={a.tipo} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{tipoLabel(a.tipo)}</span>
                  <span style={{ fontSize: 11, color: "#606060" }}>· {i.nome} ({i.instancia})</span>
                </div>
                <p style={{ margin: "2px 0 0 18px", fontSize: 12, color: "#a0a0a0" }}>{a.mensagem}</p>
                <p style={{ margin: "2px 0 0 18px", fontSize: 11, color: "#606060" }}>
                  Desde {tempoRelativo(a.created_at)}
                  {a.email_enviado ? " · ✉️ notificado" : " · ⚠️ sem notificação (configurar e-mail/wa-financas)"}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tabela */}
      <div className="table-wrapper">
        <div style={{ padding: "16px", borderBottom: "1px solid #2e2e2e" }}>
          <span style={{ fontSize: 13, color: "#a0a0a0" }}>Instâncias monitoradas</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>INSTÂNCIA</th>
              <th>STATUS</th>
              <th>ÚLTIMA MENSAGEM RECEBIDA</th>
              <th>ÚLTIMO RESOLVIDO</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Carregando...</td></tr>
            ) : !instancias.length ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Nenhuma instância configurada.</td></tr>
            ) : instancias.map(inst => (
              <tr key={inst.instancia}>
                <td>
                  <div>
                    <p style={{ fontWeight: 500, margin: 0, color: "#f0f0f0" }}>{inst.nome}</p>
                    <p style={{ fontSize: 11, color: "#606060", margin: 0 }}>{inst.instancia}</p>
                  </div>
                </td>
                <td>
                  {inst.alertas_abertos.length === 0 ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                      <CheckCircle2 size={11} /> OK
                    </span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {inst.alertas_abertos.map(a => (
                        <span key={a.tipo} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: "rgba(239,68,68,0.15)", color: "#ef4444", width: "fit-content" }}>
                          <TipoIcon tipo={a.tipo} /> {tipoLabel(a.tipo)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ color: "#a0a0a0", fontSize: 13 }}>
                  {inst.ultima_msg_recebida
                    ? tempoRelativo(inst.ultima_msg_recebida)
                    : <span style={{ color: "#606060" }}>Nunca</span>
                  }
                </td>
                <td style={{ color: "#606060", fontSize: 12 }}>
                  {inst.ultimo_resolvido
                    ? `${tipoLabel(inst.ultimo_resolvido.tipo)} · ${tempoRelativo(inst.ultimo_resolvido.resolvido_at)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(100,100,100,0.05)", borderRadius: 8, fontSize: 12, color: "#606060" }}>
        <strong style={{ color: "#a0a0a0" }}>Critérios de alerta:</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
          <li><strong>Desconectado:</strong> connectionState ≠ "open"</li>
          <li><strong>Atraso:</strong> delay médio das últimas mensagens &gt; 5 min</li>
          <li><strong>Silêncio:</strong> sem mensagens recebidas há &gt; 2h, entre 8h–21h, em instâncias com atividade em 3+ dos últimos 7 dias</li>
        </ul>
        <p style={{ margin: "8px 0 0" }}>Alertas enviados via <strong>wa-financas → grupo Leads</strong>, fallback por e-mail.</p>
      </div>
    </div>
  );
}
