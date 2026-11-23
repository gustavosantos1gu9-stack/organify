"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, getAgenciaId, carregarPermissoes } from "@/lib/supabase";
import { faseOrdem, ONBOARDING_ITENS } from "@/lib/metodologia";

type Papel = "gestor" | "cs";
interface Linha { pessoa: string; papel: Papel; clientes: number; m: Record<string, number | null> }
interface Rem { pessoa: string; papel: Papel; fixo: number; bonus_max: number; metas: Record<string, number>; pesos: Record<string, number> }

const METRICAS: Record<Papel, { k: string; l: string; meta: number; un: string }[]> = {
  gestor: [
    { k: "fase34", l: "% na Fase 3 ou 4", meta: 50, un: "%" },
    { k: "subiram", l: "Subiram de fase (30 dias)", meta: 3, un: "" },
    { k: "analises", l: "Análises em dia", meta: 80, un: "%" },
    { k: "retencao", l: "Retenção (90 dias)", meta: 90, un: "%" },
  ],
  cs: [
    { k: "onboarding", l: "Onboarding no prazo", meta: 90, un: "%" },
    { k: "mensagens", l: "Mensagens da semana enviadas", meta: 90, un: "%" },
    { k: "dados", l: "Dados em dia", meta: 80, un: "%" },
    { k: "retencao", l: "Retenção (90 dias)", meta: 90, un: "%" },
  ],
};
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const diasAtras = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const segunda = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function EquipePage() {
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const [agId, setAgId] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [rem, setRem] = useState<Record<string, Rem>>({});

  useEffect(() => {
    (async () => {
      const perm = await carregarPermissoes().catch(() => ({ permissoes: [] as string[] }));
      if ((perm as any).permissoes !== null) { setPermitido(false); return; }
      setPermitido(true);
      const id = await getAgenciaId(); if (!id) return; setAgId(id);
      const [cc, ac, fh, rg, ea, ms, rm] = await Promise.all([
        supabase.from("controle_clientes").select("id, gestor, status, escala_jornada, data_churn, data_entrada, relatorio_id").eq("agencia_id", id),
        supabase.from("acomp_clientes").select("cliente_id, cs, onboarding").eq("agencia_id", id),
        supabase.from("acomp_fase_historico").select("cliente_id, de, para, created_at").eq("agencia_id", id).gte("created_at", diasAtras(30)),
        supabase.from("acomp_registros").select("cliente_id, created_at").eq("agencia_id", id).gte("created_at", diasAtras(14)),
        supabase.from("escala_atualizacoes").select("cliente_id, created_at").eq("agencia_id", id).gte("created_at", diasAtras(14)),
        supabase.from("acomp_mensagens").select("cliente_id, status").eq("agencia_id", id).eq("semana", segunda()),
        supabase.from("equipe_remuneracao").select("*").eq("agencia_id", id),
      ]);
      const clientes = (cc.data || []) as any[];
      const acomp: Record<string, any> = {}; ((ac.data || []) as any[]).forEach(a => { acomp[a.cliente_id] = a; });
      const rels = clientes.map(c => c.relatorio_id).filter(Boolean);
      const { data: ps } = rels.length ? await supabase.from("performance_semanal").select("relatorio_id").in("relatorio_id", rels).gte("semana_inicio", diasAtras(14)) : { data: [] as any[] };
      const relComDados = new Set(((ps || []) as any[]).map(p => p.relatorio_id));
      const analisados = new Set([...((rg.data || []) as any[]), ...((ea.data || []) as any[])].map(r => r.cliente_id));
      const subiu = ((fh.data || []) as any[]).filter(h => faseOrdem(h.para) > faseOrdem(h.de));
      const enviadas = new Set(((ms.data || []) as any[]).filter(m => m.status === "enviada").map(m => m.cliente_id));
      // saídas nos últimos 3 meses (data_churn vem como "Nov/2026")
      const h = new Date(); const ult3 = [0, 1, 2].map(i => { const d = new Date(h.getFullYear(), h.getMonth() - i, 1); return `${MESES[d.getMonth()]}/${d.getFullYear()}`; });
      const ehSaida = (c: any) => c.status === "saiu" && ult3.includes(c.data_churn);
      const parseEntrada = (s?: string | null) => { if (!s) return null; if (s.includes("/")) { const [d, m, a] = s.split("/"); return new Date(`${a.length === 2 ? "20" + a : a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00`); } const x = new Date(s); return isNaN(+x) ? null : x; };

      const grupos: Record<string, { papel: Papel; ativos: any[]; saidas: number }> = {};
      const add = (pessoa: string, papel: Papel, c: any) => {
        const key = `${papel}|${pessoa}`; grupos[key] ||= { papel, ativos: [], saidas: 0 };
        if (c.status === "saiu") { if (ehSaida(c)) grupos[key].saidas++; } else grupos[key].ativos.push(c);
      };
      clientes.forEach(c => {
        if (c.gestor) add(c.gestor, "gestor", c);
        const cs = acomp[c.id]?.cs; if (cs) add(cs, "cs", c);
      });
      const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
      const out: Linha[] = Object.entries(grupos).map(([key, g]): Linha => {
        const pessoa = key.split("|")[1]; const ids = new Set(g.ativos.map(c => c.id)); const n = g.ativos.length;
        const ret = pct(n, n + g.saidas);
        if (g.papel === "gestor") return { pessoa, papel: "gestor", clientes: n, m: {
          fase34: pct(g.ativos.filter(c => c.escala_jornada === "etapa3" || c.escala_jornada === "etapa4").length, n),
          subiram: subiu.filter(x => ids.has(x.cliente_id)).length,
          analises: pct(g.ativos.filter(c => analisados.has(c.id)).length, n),
          retencao: ret,
        } };
        return { pessoa, papel: "cs", clientes: n, m: {
          onboarding: pct(g.ativos.filter(c => {
            const ob = acomp[c.id]?.onboarding || {}; const completo = ONBOARDING_ITENS.every(i => ob[i.k]);
            const ent = parseEntrada(c.data_entrada); const dias = ent ? (Date.now() - +ent) / 864e5 : 0;
            return completo || dias <= 15;
          }).length, n),
          mensagens: pct(g.ativos.filter(c => enviadas.has(c.id)).length, n),
          dados: pct(g.ativos.filter(c => c.relatorio_id && relComDados.has(c.relatorio_id)).length, n),
          retencao: ret,
        } };
      }).sort((a, b) => a.papel.localeCompare(b.papel) || b.clientes - a.clientes);
      setLinhas(out);
      const r: Record<string, Rem> = {}; ((rm.data || []) as any[]).forEach(x => { r[`${x.papel}|${x.pessoa}`] = x; });
      setRem(r);
    })();
  }, []);

  const mediaCarteira = useMemo(() => {
    const m: Record<string, number> = {};
    (["gestor", "cs"] as Papel[]).forEach(p => { const l = linhas.filter(x => x.papel === p); m[p] = l.length ? l.reduce((s, x) => s + x.clientes, 0) / l.length : 0; });
    return m;
  }, [linhas]);

  const salvar = async (l: Linha, patch: Partial<Rem>) => {
    const key = `${l.papel}|${l.pessoa}`;
    const atual: Rem = rem[key] || { pessoa: l.pessoa, papel: l.papel, fixo: 0, bonus_max: 0, metas: {}, pesos: {} };
    const novo = { ...atual, ...patch };
    setRem(p => ({ ...p, [key]: novo }));
    await supabase.from("equipe_remuneracao").upsert({ agencia_id: agId, pessoa: l.pessoa, papel: l.papel, fixo: novo.fixo, bonus_max: novo.bonus_max, metas: novo.metas, pesos: novo.pesos, updated_at: new Date().toISOString() }, { onConflict: "agencia_id,pessoa,papel" });
  };

  if (permitido === null) return <div className="ac-carregando">Carregando…</div>;
  if (!permitido) return <div className="ac-card" style={{ padding: 32, textAlign: "center" }}>Esta área é só para o administrador.</div>;

  return (
    <div className="eq">
      {(["gestor", "cs"] as Papel[]).map(papel => {
        const ls = linhas.filter(l => l.papel === papel);
        return (
          <section key={papel} className="ac-card">
            <header><h3>{papel === "gestor" ? "Gestores de tráfego" : "CS"}</h3><small>bônus = bônus máximo × atingimento ponderado das metas × ajuste pelo tamanho da carteira</small></header>
            {ls.length === 0 ? <p className="ac-vazio">{papel === "cs" ? "Nenhuma CS definida ainda. Defina a CS de cada cliente no Acompanhamento." : "Nenhum gestor na Carteira."}</p> : (
              <div style={{ overflowX: "auto" }}>
                <table className="eq-tabela">
                  <thead><tr><th>Pessoa</th><th>Clientes</th>{METRICAS[papel].map(m => <th key={m.k}>{m.l}<br /><span style={{ textTransform: "none", fontWeight: 400 }}>meta {m.meta}{m.un}</span></th>)}<th>Atingimento</th><th>Fixo</th><th>Bônus máx.</th><th>Total do mês</th></tr></thead>
                  <tbody>
                    {ls.map(l => {
                      const r = rem[`${papel}|${l.pessoa}`];
                      const pesos = METRICAS[papel].map(m => r?.pesos?.[m.k] ?? 1);
                      const ating = METRICAS[papel].reduce((s, m, i) => {
                        const v = l.m[m.k]; const meta = r?.metas?.[m.k] ?? m.meta;
                        return s + pesos[i] * (v === null || !meta ? 0 : Math.min(1, v / meta));
                      }, 0) / (pesos.reduce((a, b) => a + b, 0) || 1);
                      const ajuste = mediaCarteira[papel] ? Math.min(1.2, Math.max(0.8, l.clientes / mediaCarteira[papel])) : 1;
                      const bonus = (r?.bonus_max || 0) * ating * ajuste;
                      return (
                        <tr key={l.pessoa}>
                          <td><b>{l.pessoa}</b></td>
                          <td>{l.clientes}</td>
                          {METRICAS[papel].map(m => <td key={m.k}>{l.m[m.k] === null ? "—" : `${l.m[m.k]}${m.un}`}</td>)}
                          <td><span className="eq-barra"><span style={{ width: `${Math.round(ating * 100)}%` }} /></span>{Math.round(ating * 100)}%</td>
                          <td><input inputMode="decimal" defaultValue={r?.fixo || ""} placeholder="0" onBlur={e => salvar(l, { fixo: Number(e.target.value.replace(",", ".")) || 0 })} /></td>
                          <td><input inputMode="decimal" defaultValue={r?.bonus_max || ""} placeholder="0" onBlur={e => salvar(l, { bonus_max: Number(e.target.value.replace(",", ".")) || 0 })} /></td>
                          <td className="eq-bonus">{brl((r?.fixo || 0) + bonus)}<br /><small style={{ fontWeight: 400, color: "#7E93A8" }}>bônus {brl(bonus)} · ajuste {ajuste.toFixed(2)}×</small></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {papel === "cs" && <p className="ac-nota">Tempo de resposta nos grupos e NPS entram quando o alerta dos grupos estiver ligado.</p>}
          </section>
        );
      })}
      <p className="ac-nota">Todas as métricas têm o mesmo peso e as metas mostradas no topo de cada coluna.</p>
    </div>
  );
}
