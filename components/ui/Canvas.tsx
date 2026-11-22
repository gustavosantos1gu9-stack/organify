"use client";

import Link from "next/link";
import { ReactNode } from "react";

// Peças do layout novo (canvas "SALX Convert — novo layout"), usadas em todas as páginas.

/** Cabeçalho: linha de contexto, título com destaque em itálico e ações à direita. */
export function PageHead({ contexto, titulo, destaque, acoes }: {
  contexto?: ReactNode; titulo: string; destaque?: string; acoes?: ReactNode;
}) {
  return (
    <header className="pg-head">
      <div className="pg-head-txt">
        {contexto && <span className="pg-ctx">{contexto}</span>}
        <h1 className="pg-title">
          {titulo}{destaque && <> <span className="font-serif-accent pg-accent">{destaque}</span></>}
        </h1>
      </div>
      {acoes && <div className="pg-actions">{acoes}</div>}
    </header>
  );
}

export interface Numero { label: string; valor: ReactNode; detalhe?: ReactNode }

/** Faixa escura com o resumo em números (só onde há números reais). */
export function Faixa({ contexto, titulo, destaque, link, numeros }: {
  contexto?: ReactNode; titulo?: ReactNode; destaque?: ReactNode;
  link?: { label: string; href: string }; numeros: Numero[];
}) {
  return (
    <section className="faixa lift">
      {(contexto || titulo || link) && (
        <div className="faixa-top">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {contexto && <span className="faixa-ctx">{contexto}</span>}
            {titulo && (
              <h2 className="faixa-title">
                {titulo}{destaque && <> <span className="font-serif-accent faixa-accent">{destaque}</span></>}
              </h2>
            )}
          </div>
          {link && <Link href={link.href} className="faixa-link">{link.label} →</Link>}
        </div>
      )}
      {numeros.map((n) => (
        <div key={n.label} className="faixa-num">
          <span className="faixa-lbl">{n.label}</span>
          <span className="faixa-val">{n.valor}</span>
          {n.detalhe && <span className="faixa-det">{n.detalhe}</span>}
        </div>
      ))}
    </section>
  );
}

/** Cartão branco com título. */
export function Cartao({ titulo, extra, children, lift = false, style }: {
  titulo?: ReactNode; extra?: ReactNode; children: ReactNode; lift?: boolean; style?: React.CSSProperties;
}) {
  return (
    <section className={lift ? "cartao lift" : "cartao"} style={style}>
      {(titulo || extra) && (
        <div className="cartao-head">
          {titulo && <h2 className="cartao-title">{titulo}</h2>}
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

/** Grupo de filtros em pílula. */
export function Pilulas<T extends string>({ opcoes, valor, onChange }: {
  opcoes: { label: string; valor: T }[]; valor: T; onChange: (v: T) => void;
}) {
  return (
    <div className="pilulas">
      {opcoes.map((o) => (
        <button key={o.valor} type="button" className={o.valor === valor ? "pilula on" : "pilula"} onClick={() => onChange(o.valor)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
