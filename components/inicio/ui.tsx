"use client";

import Link from "next/link";
import { ReactNode } from "react";

// ─── Fases da escala (mesmas chaves de controle_clientes.escala_jornada) ───
export const FASES = [
  { key: "etapa0", label: "Fase 0", cor: "#D9534F" },
  { key: "etapa1", label: "Fase 1", cor: "#E8915A" },
  { key: "etapa2", label: "Fase 2", cor: "#E6C44F" },
  { key: "etapa3", label: "Fase 3", cor: "#1C6CA6" },
  { key: "etapa4", label: "Fase 4", cor: "#0A1826" },
  { key: "resultado_oscilando", label: "Oscilando", cor: "#8B6FD6" },
] as const;

export const FASE_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  etapa0: { bg: "var(--alert-bg)", fg: "var(--alert-text)", label: "Fase 0" },
  etapa1: { bg: "var(--warning-bg)", fg: "var(--warning-text)", label: "Fase 1" },
  etapa2: { bg: "var(--caution-bg)", fg: "var(--caution-text)", label: "Fase 2" },
  etapa3: { bg: "var(--phase3-bg)", fg: "var(--phase3-text)", label: "Fase 3" },
  etapa4: { bg: "var(--phase4-bg)", fg: "var(--phase4-text)", label: "Fase 4" },
  resultado_oscilando: { bg: "var(--oscillating-bg)", fg: "var(--oscillating-text)", label: "Oscilando" },
};

export function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function dataExtenso() {
  const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const normaliza = (s: string | null | undefined) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// ─── Cabeçalho com saudação ────────────────────────────────────
export function Saudacao({ nome, destaque, direita }: { nome: string; destaque: string; direita?: ReactNode }) {
  return (
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{dataExtenso()}</span>
        <h1 style={{ margin: 0 }}>
          {saudacao()}{nome ? `, ${nome}` : ""}.{" "}
          <span className="font-serif-accent" style={{ fontSize: 34, color: "var(--brand-deep)" }}>{destaque}</span>
        </h1>
      </div>
      {direita}
    </header>
  );
}

// ─── Banner escuro com os números principais ───────────────────
export interface Metrica { label: string; valor: string; detalhe?: string }

export function Hero({ kicker, titulo, destaque, metricas, acao, delay = 0.05 }: {
  kicker: string; titulo: string; destaque?: string; metricas: Metrica[];
  acao?: { label: string; href: string }; delay?: number;
}) {
  return (
    <section className="ui-hero" data-delay={delay}>
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--brand-light)" }}>{kicker}</span>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "#FFFFFF", letterSpacing: "-.01em" }}>
              {titulo}{destaque && <> <span className="font-serif-accent" style={{ fontSize: 30, color: "var(--brand-light)" }}>{destaque}</span></>}
            </h2>
          </div>
          {acao && <Link href={acao.href} className="ui-hero-link">{acao.label} →</Link>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 24 }}>
          {metricas.map((m, i) => (
            <div key={m.label} data-i={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#9FB3C6" }}>{m.label}</span>
              <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.02em", color: "#FFFFFF" }}>{m.valor}</span>
              {m.detalhe && <span style={{ fontSize: 12.5, color: "#9FB3C6" }}>{m.detalhe}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Card branco padrão ─────────────────────────────────────────
export function Painel({ titulo, extra, children, delay = 0.1, lift = true, style }: {
  titulo: string; extra?: ReactNode; children: ReactNode; delay?: number; lift?: boolean; style?: React.CSSProperties;
}) {
  return (
    <section className="ui-panel lift" data-delay={delay} data-lift={lift ? "1" : "0"} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function LinkSutil({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="ui-link">{children}</Link>;
}

// ─── Barra segmentada das fases ─────────────────────────────────
export function BarraFases({ contagem, semFase }: { contagem: Record<string, number>; semFase: number }) {
  const segs = [...FASES.map((f) => ({ ...f, n: contagem[f.key] || 0 })), { key: "sem", label: "Sem fase", cor: "#CBD5DF", n: semFase }];
  const total = segs.reduce((s, x) => s + x.n, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", gap: 3, background: total ? "transparent" : "var(--border)" }}>
        {segs.filter((s) => s.n > 0).map((s, i) => (
          <div key={s.key} className="ui-grow" title={`${s.label}: ${s.n}`} style={{ flex: s.n, background: s.cor, animationDelay: `${0.15 + i * 0.05}s` }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "12px 16px" }}>
        {segs.map((s) => (
          <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: s.key === "sem" && s.n > 0 ? "var(--alert-text)" : "var(--text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.cor, flex: "none" }} />{s.label}
            </span>
            <span className="font-title" style={{ fontSize: 24, fontWeight: 600, color: s.key === "sem" && s.n > 0 ? "var(--alert-text)" : "var(--navy)" }}>{s.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Linha de "precisa de atenção" ──────────────────────────────
const TONS: Record<string, { fundo: string; tagBg: string; tagFg: string }> = {
  alerta: { fundo: "#FDF0EE", tagBg: "#B42318", tagFg: "#FFFFFF" },
  oscilando: { fundo: "#F4F0FC", tagBg: "#E4DAF8", tagFg: "#4A2E9E" },
  aviso: { fundo: "#FEF4EC", tagBg: "#FBDCC6", tagFg: "#8A3B12" },
  neutro: { fundo: "#F3F5F7", tagBg: "#E1E7ED", tagFg: "#2C3B4A" },
};

export function ItemAtencao({ tag, tom, titulo, detalhe, direita, href }: {
  tag: string; tom: keyof typeof TONS; titulo: string; detalhe?: string; direita?: string; href: string;
}) {
  const t = TONS[tom];
  return (
    <Link href={href} className="ui-attn" style={{ background: t.fundo }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.tagFg, background: t.tagBg, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>{tag}</span>
      <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
        {detalhe && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{detalhe}</span>}
      </span>
      {direita && <span style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{direita}</span>}
    </Link>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div style={{ padding: "18px 14px", borderRadius: 16, background: "var(--neutral-bg)", fontSize: 14, color: "var(--text-secondary)" }}>{children}</div>;
}

// ─── Barra horizontal com rótulo (origem, funil, gestores) ──────
export function BarraLinha({ label, valor, max, cor = "var(--brand)", direita, delay = 0 }: {
  label: string; valor: number; max: number; cor?: string; direita?: string; delay?: number;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((valor / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{direita ?? valor}</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "var(--off-white)" }}>
        <div className="ui-grow" style={{ height: 10, width: `${pct}%`, borderRadius: 999, background: cor, animationDelay: `${delay}s` }} />
      </div>
    </div>
  );
}

// ─── Atalhos em pílula ──────────────────────────────────────────
export interface Atalho { label: string; href: string; icone?: ReactNode }

export function Atalhos({ grupos }: { grupos: { titulo: string; itens: Atalho[] }[] }) {
  const visiveis = grupos.filter((g) => g.itens.length > 0);
  if (!visiveis.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
      {visiveis.map((g) => (
        <div key={g.titulo} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{g.titulo}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {g.itens.map((a) => (
              <Link key={a.href + a.label} href={a.href} className="ui-chip">{a.icone}{a.label}</Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Carregando() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="ui-skel" style={{ height: 64, maxWidth: 520 }} />
      <div className="ui-skel" style={{ height: 190, borderRadius: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        <div className="ui-skel" style={{ height: 240, borderRadius: 24 }} />
        <div className="ui-skel" style={{ height: 240, borderRadius: 24 }} />
      </div>
    </div>
  );
}
