"use client";

import { useEffect, useState } from "react";
import { Users, Clock, CheckCircle, Target, Info } from "lucide-react";

// Contatos reais × Meta e qualidade de cada público (conjunto). Regras em lib/qualidade-publicos.ts.

type Linha = {
  conjunto_id: string | null; conjunto: string; campanha: string;
  investimento: number; mensagens_meta: number; contatos_reais: number; entrega: number | null;
  custo_mensagem_meta: number | null; custo_contato_real: number | null;
  desenvolveram: number; nao_desenvolveram: number; aberto: number; sem_resposta: number; fechados: number;
  taxa_qualificacao: number | null; custo_conversa_desenvolvida: number | null;
  status: "qualificado" | "desqualificado" | "aguardando";
  tempo_resposta_mediana_min: number | null; respondidas_ate_5min: number | null;
  respondidas_ate_15min: number | null; respondidas_ate_60min: number | null; pct_resposta_ia: number | null;
};

const brl = (n: number | null) => n === null ? "—" : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => n === null ? "—" : `${Math.round(n * 100)}%`;
const tempo = (m: number | null) => m === null ? "—" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

const STATUS = {
  qualificado: { label: "Qualificado", bg: "#E3F2EC", fg: "#1E6B52" },
  desqualificado: { label: "Desqualificado", bg: "#FBE3E1", fg: "#B42318" },
  aguardando: { label: "Aguardando lote", bg: "#F3F5F7", fg: "#4A5B6C" },
};

export default function QualidadePublicos({ agenciaId, desde, ate, versao }: { agenciaId: string | null; desde: string; ate: string; versao: number }) {
  const [dados, setDados] = useState<{ total: Linha; conjuntos: Linha[]; meta_ok: boolean } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!agenciaId) return;
    setCarregando(true); setErro("");
    fetch("/api/performance/qualidade", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencia_id: agenciaId, date_from: desde, date_to: ate }),
    }).then(r => r.json()).then(j => { if (j.error) setErro(j.error); else setDados(j); })
      .catch(() => setErro("Não foi possível calcular agora."))
      .finally(() => setCarregando(false));
  }, [agenciaId, desde, ate, versao]);

  const t = dados?.total;
  const kpi = (titulo: string, valor: string, sub: string, icone: React.ReactNode) => (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>{icone}{titulo}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)" }}>{valor}</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sub}</span>
    </div>
  );
  const th = { padding: "9px 10px", textAlign: "right" as const, fontWeight: 600, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" as const };
  const td = { padding: "9px 10px", textAlign: "right" as const, fontSize: 12, color: "var(--navy)", whiteSpace: "nowrap" as const };

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Contatos reais e qualidade dos públicos</h2>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
          <Info size={12} /> Só leads de anúncio do Meta. Tempo de resposta em horário comercial (seg–sex, 9h–18h).
        </span>
      </div>

      {carregando && !dados && <div style={{ padding: 24, color: "var(--text-secondary)", fontSize: 13 }}>Calculando…</div>}
      {erro && <div style={{ padding: 12, background: "var(--caution-bg)", color: "var(--caution-text)", borderRadius: 8, fontSize: 13 }}>{erro}</div>}

      {t && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
            {kpi("Contatos reais × Meta", `${t.contatos_reais} de ${t.mensagens_meta || "—"}`, t.entrega !== null ? `${pct(t.entrega)} das mensagens do Meta chegaram` : "Meta sem mensagens no período", <Users size={14} />)}
            {kpi("Custo por contato real", brl(t.custo_contato_real), `No Meta: ${brl(t.custo_mensagem_meta)} por mensagem`, <Target size={14} />)}
            {kpi("Desenvolveram conversa", pct(t.taxa_qualificacao), `${t.desenvolveram} de ${t.fechados} fechados · ${t.aberto} em aberto`, <CheckCircle size={14} />)}
            {kpi("Custo por conversa desenvolvida", brl(t.custo_conversa_desenvolvida), "investimento ÷ contatos que desenvolveram", <Target size={14} />)}
            {kpi("Tempo de 1ª resposta", tempo(t.tempo_resposta_mediana_min), `mediana · ${pct(t.respondidas_ate_15min)} em até 15 min${t.pct_resposta_ia ? ` · ${pct(t.pct_resposta_ia)} pela IA` : ""}`, <Clock size={14} />)}
          </div>

          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ ...th, textAlign: "left" }}>Público (conjunto)</th>
                  <th style={th}>Invest.</th><th style={th}>Msgs Meta</th><th style={th}>Contatos reais</th><th style={th}>Chegaram</th>
                  <th style={th}>Custo real</th><th style={th}>Desenvolveram</th><th style={th}>Não desenv.</th><th style={th}>Em aberto</th>
                  <th style={th}>Taxa</th><th style={th}>Status</th><th style={th}>1ª resposta</th>
                </tr>
              </thead>
              <tbody>
                {dados!.conjuntos.map(l => {
                  const s = STATUS[l.status];
                  return (
                    <tr key={l.conjunto_id || "_sem"} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal", maxWidth: 280 }}>
                        <div style={{ fontWeight: 600 }}>{l.conjunto}</div>
                        {l.campanha && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{l.campanha}</div>}
                      </td>
                      <td style={td}>{brl(l.investimento)}</td>
                      <td style={td}>{l.mensagens_meta || "—"}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{l.contatos_reais}</td>
                      <td style={td}>{pct(l.entrega)}</td>
                      <td style={td}>{brl(l.custo_contato_real)}</td>
                      <td style={td}>{l.desenvolveram}</td>
                      <td style={td}>{l.nao_desenvolveram}</td>
                      <td style={{ ...td, color: "var(--text-secondary)" }}>{l.aberto}{l.sem_resposta ? ` · ${l.sem_resposta} sem resposta` : ""}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{pct(l.taxa_qualificacao)}</td>
                      <td style={td}>
                        <span title={l.status === "aguardando" ? `Precisa de 10 contatos fechados (tem ${l.fechados})` : ""}
                          style={{ background: s.bg, color: s.fg, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                      </td>
                      <td style={td}>{tempo(l.tempo_resposta_mediana_min)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <b>Desenvolveu</b>: respondeu depois da nossa 1ª resposta. <b>Não desenvolveu</b>: não respondeu depois de 2 follow-ups, passadas 24h do 2º.{" "}
              <b>Qualificado</b>: 50% ou mais desenvolvem, avaliado a partir de 10 contatos fechados. Público = conjunto de anúncios pelo ID do Meta;
              conversas antigas só entram num conjunto se o nome for exatamente igual — senão ficam em “Não identificado”.
              {!dados!.meta_ok && " Meta Ads não respondeu agora: investimento e mensagens do Meta podem aparecer zerados."}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
