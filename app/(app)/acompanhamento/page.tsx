"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, getAgenciaId, carregarPermissoes } from "@/lib/supabase";
import {
  FASES, faseLabel, faseCor, faseOrdem, ONBOARDING_ITENS, PILARES, FAIXAS_PADRAO, Faixas, Numeros,
  somar, taxas, sugerirFase, diagnosticar, cenarioTrafego, idealContato, idealAgend, tomCusto, tomTaxa, Tom, INSTRUCOES_PADRAO,
} from "@/lib/metodologia";
import { Search, Settings, Sparkles, Copy, Check, X, Plus, ExternalLink, CalendarClock, ClipboardList, MessageSquare, Target, Gauge, Headphones } from "lucide-react";
import { ETAPAS_PADRAO, PADRAO_ATENDIMENTO_PADRAO } from "@/lib/padrao-atendimento";
import QualidadePublicos from "@/components/performance/QualidadePublicos";

interface Cliente {
  id: string; nome: string; status: string | null; gestor: string | null; escala_jornada: string | null;
  relatorio_id: string | null; data_inicio_campanha: string | null; data_entrada: string | null; uti: boolean | null;
}
interface Acomp {
  cliente_id: string; agencia_id?: string; cs?: string | null; foco?: string | null; tem_secretaria?: boolean | null; drive_url?: string | null;
  preco?: string | null; avaliacao_gratuita?: boolean | null; oferta?: string | null; pacotes?: string | null; ticket_medio?: number | null;
  custo_msg_ideal?: number | null; custo_lead_ideal?: number | null; custo_agend_ideal?: number | null; cpa_ideal?: number | null;
  proxima_analise?: string | null; onboarding?: Record<string, boolean>; notas_parceria?: Record<string, number>;
  filha_id?: string | null;
}
interface Registro { id: string; cliente_id: string; autor: string | null; tipo: string | null; feito: string | null; pendencia: string | null; proximo_passo: string | null; reavaliar_em: string | null; created_at: string; texto_original?: string | null }
interface Tarefa { id: string; cliente_id: string; titulo: string; prazo: string | null; feita: boolean }
interface Mensagem { id: string; cliente_id: string; semana: string; texto: string; status: string }

const brl = (n: number | null | undefined) => n === null || n === undefined ? "—" : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const hojeISO = () => new Date().toISOString().slice(0, 10);
const segundaDaSemana = () => { const d = new Date(); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return d.toISOString().slice(0, 10); };
const dataBR = (s?: string | null) => s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "—";
const parseEntrada = (s?: string | null): Date | null => {
  if (!s) return null;
  if (s.includes("/")) { const [d, m, a] = s.split("/"); const ano = a?.length === 2 ? "20" + a : a; const dt = new Date(`${ano}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}T12:00:00`); return isNaN(+dt) ? null : dt; }
  const dt = new Date(s); return isNaN(+dt) ? null : dt;
};
const iniciais = (n: string) => (n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
const TIPOS: Record<string, string> = { atendimento: "Atendimento", preco_oferta: "Preço e oferta", publico: "Público", criativo: "Criativo", campanha: "Campanha", onboarding: "Onboarding", dados: "Dados", outro: "Outro" };

export default function AcompanhamentoPage() {
  const [agId, setAgId] = useState("");
  const [dono, setDono] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [equipe, setEquipe] = useState<string[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [acomp, setAcomp] = useState<Record<string, Acomp>>({});
  const [numeros, setNumeros] = useState<Record<string, any>>({});
  const [numerosProntos, setNumerosProntos] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [faixas, setFaixas] = useState<Faixas>(FAIXAS_PADRAO);
  const [instrucoes, setInstrucoes] = useState(INSTRUCOES_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [verConfig, setVerConfig] = useState(false);
  const [f, setF] = useState({ busca: "", gestor: "", cs: "", fase: "", hoje: "" });

  const carregar = useCallback(async () => {
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const [cliR, acR, cfgR, regR, tarR, msgR, usrR, euR, perm] = await Promise.all([
      supabase.from("controle_clientes").select("id, nome, status, gestor, escala_jornada, relatorio_id, data_inicio_campanha, data_entrada, uti").eq("agencia_id", id).neq("status", "saiu").order("nome"),
      supabase.from("acomp_clientes").select("*").eq("agencia_id", id),
      supabase.from("acomp_config").select("*").eq("agencia_id", id).maybeSingle(),
      supabase.from("acomp_registros").select("id, cliente_id, autor, tipo, feito, pendencia, proximo_passo, reavaliar_em, created_at").eq("agencia_id", id).order("created_at", { ascending: false }).limit(600),
      supabase.from("acomp_tarefas").select("id, cliente_id, titulo, prazo, feita").eq("agencia_id", id).eq("feita", false),
      supabase.from("acomp_mensagens").select("id, cliente_id, semana, texto, status").eq("agencia_id", id).eq("semana", segundaDaSemana()),
      supabase.from("usuarios").select("nome").eq("agencia_id", id).order("nome"),
      user ? supabase.from("usuarios").select("nome").eq("auth_user_id", user.id).limit(1) : Promise.resolve({ data: [] }),
      carregarPermissoes().catch(() => ({ permissoes: [] as string[] })),
    ]);
    const lista = (cliR.data || []) as Cliente[];
    setClientes(lista);
    const mapa: Record<string, Acomp> = {};
    ((acR.data || []) as Acomp[]).forEach(a => { mapa[a.cliente_id] = a; });
    setAcomp(mapa);
    const cfg = cfgR.data as any;
    if (cfg?.faixas) setFaixas({ ...FAIXAS_PADRAO, ...cfg.faixas });
    if (cfg?.instrucoes) setInstrucoes(cfg.instrucoes);
    setRegistros((regR.data || []) as Registro[]);
    setTarefas((tarR.data || []) as Tarefa[]);
    setMensagens((msgR.data || []) as Mensagem[]);
    setEquipe(Array.from(new Set(((usrR.data || []) as any[]).map(u => u.nome).filter(Boolean))));
    const meuNome = ((euR as any).data?.[0]?.nome) || user?.email?.split("@")[0] || "";
    setUsuario(meuNome);
    setDono((perm as any).permissoes === null);

    setCarregando(false);
    // Números da Meta (investimento, mensagens, leads) + planilha, calculados no servidor e guardados por 1h
    const rels = lista.map(c => c.relatorio_id).filter(Boolean) as string[];
    if (rels.length) {
      try {
        const r = await fetch("/api/acompanhamento/numeros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relatorio_ids: rels }) });
        setNumeros(await r.json());
      } catch { /* segue sem números */ }
    }
    setNumerosProntos(true);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Cálculos por cliente
  const calc = useMemo(() => {
    const out: Record<string, any> = {};
    const vazio = somar([]);
    for (const c of clientes) {
      const num = c.relatorio_id ? numeros[c.relatorio_id] : null;
      const a = { ...(acomp[c.id] || { cliente_id: c.id }), tipo_contato: num?.tipo_contato || null };
      const atual: Numeros = num?.atual || vazio;
      const anterior: Numeros = num?.anterior || vazio;
      const semDados = !num || (atual.investimento === 0 && atual.contatos === 0 && atual.agendamentos === 0);
      const ob = a.onboarding || {};
      const obFeitos = ONBOARDING_ITENS.filter(i => ob[i.k]).length;
      const obCompleto = obFeitos === ONBOARDING_ITENS.length;
      const sugCalc = sugerirFase({ onboardingCompleto: obCompleto || !!c.data_inicio_campanha, temCampanha: !!c.relatorio_id, atual, anterior, ideais: a, faixas, faseConfirmada: c.escala_jornada });
      const regs = registros.filter(r => r.cliente_id === c.id);
      const diagCalc = diagnosticar({ atual, ideais: a, faixas, avaliacaoGratuita: a.avaliacao_gratuita, ultimoTipo: regs[0]?.tipo });
      const ini = c.data_inicio_campanha ? new Date(c.data_inicio_campanha) : null;
      const diasCampanha = ini && !isNaN(+ini) ? Math.round((Date.now() - +ini) / 864e5) : null;
      const sug = semDados
        ? { fase: c.escala_jornada || "", motivo: !c.relatorio_id ? "Sem relatório vinculado na Carteira." : !numerosProntos ? "Carregando números da Meta…" : "Sem dados da Meta e da planilha no período." }
        : sugCalc;
      const diag = semDados
        ? { gargalo: "Sem dados", passo: !c.relatorio_id ? "Vincular o relatório da cliente na Carteira para trazer os números da Meta." : !numerosProntos ? "Carregando números…" : "Conferir a conta de anúncio no relatório e pedir para a cliente preencher agendamentos e vendas.", area: "dados" }
        : diagCalc;
      const cen = cenarioTrafego({ atual, ideais: a, faixas, diasCampanha });
      const t = taxas(atual);
      const entrada = parseEntrada(c.data_entrada);
      const diasEntrada = entrada ? Math.round((Date.now() - +entrada) / 864e5) : null;
      const analiseVencida = !!a.proxima_analise && a.proxima_analise <= hojeISO();
      const onboardingAtrasado = !obCompleto && diasEntrada !== null && diasEntrada > 15 && !c.data_inicio_campanha;
      const tarefasVencidas = tarefas.filter(x => x.cliente_id === c.id && x.prazo && x.prazo < hojeISO()).length;
      const msgSemana = mensagens.find(m => m.cliente_id === c.id);
      const faseDif = !semDados && sug.fase !== c.escala_jornada;
      const tomGeral: Tom = semDados ? "sem" : diag.area === "escala" ? "ok" : diag.gargalo === "Lote mínimo" || diag.gargalo === "Dados de venda" ? "sem" :
        (tomCusto(t.custoContato, idealContato(a, faixas)) === "ruim" || tomTaxa(t.taxaAgend, faixas.taxaAgendMin) === "ruim") ? "ruim" : "atencao";
      const atencao = (c.uti ? 5 : 0) + (analiseVencida ? 3 : 0) + (onboardingAtrasado ? 3 : 0) + (faseDif ? 2 : 0) + (tomGeral === "ruim" ? 2 : tomGeral === "atencao" ? 1 : 0) + tarefasVencidas;
      out[c.id] = { a, atual, anterior, t, sug, diag, cen, semDados, num, obFeitos, obCompleto, analiseVencida, onboardingAtrasado, tarefasVencidas, msgSemana, faseDif, tomGeral, atencao, diasCampanha, regs };
    }
    return out;
  }, [clientes, acomp, numeros, numerosProntos, registros, tarefas, mensagens, faixas]);

  const gestores = useMemo(() => Array.from(new Set(clientes.map(c => c.gestor).filter(Boolean))) as string[], [clientes]);
  const css = useMemo(() => Array.from(new Set(Object.values(acomp).map(a => a.cs).filter(Boolean))) as string[], [acomp]);

  const filtrados = clientes
    .filter(c => !f.busca || c.nome.toLowerCase().includes(f.busca.toLowerCase()))
    .filter(c => !f.gestor || c.gestor === f.gestor)
    .filter(c => !f.cs || acomp[c.id]?.cs === f.cs)
    .filter(c => !f.fase || (c.escala_jornada || "") === f.fase)
    .filter(c => {
      const k = calc[c.id]; if (!k || !f.hoje) return true;
      if (f.hoje === "analise") return k.analiseVencida;
      if (f.hoje === "onboarding") return k.onboardingAtrasado;
      if (f.hoje === "mensagem") return !k.msgSemana || k.msgSemana.status === "rascunho";
      if (f.hoje === "fase") return k.faseDif;
      if (f.hoje === "tarefas") return k.tarefasVencidas > 0;
      return true;
    })
    .sort((x, y) => (calc[y.id]?.atencao || 0) - (calc[x.id]?.atencao || 0) || x.nome.localeCompare(y.nome));

  const contagemHoje = useMemo(() => {
    const v = Object.values(calc);
    return {
      analise: v.filter((k: any) => k.analiseVencida).length,
      onboarding: v.filter((k: any) => k.onboardingAtrasado).length,
      mensagem: v.filter((k: any) => !k.msgSemana || k.msgSemana.status === "rascunho").length,
      fase: v.filter((k: any) => k.faseDif).length,
      tarefas: v.filter((k: any) => k.tarefasVencidas > 0).length,
    };
  }, [calc]);

  useEffect(() => { if (!sel && filtrados[0]) setSel(filtrados[0].id); }, [filtrados, sel]);

  // ── gravações ──
  const salvarAcomp = async (clienteId: string, patch: Partial<Acomp>) => {
    const novo = { ...(acomp[clienteId] || { cliente_id: clienteId }), ...patch, cliente_id: clienteId, agencia_id: agId };
    setAcomp(p => ({ ...p, [clienteId]: novo }));
    await supabase.from("acomp_clientes").upsert({ ...novo, updated_at: new Date().toISOString() }, { onConflict: "cliente_id" });
  };

  const cliente = clientes.find(c => c.id === sel) || null;

  if (carregando) return <div className="ac"><div className="ac-carregando">Carregando acompanhamento…</div></div>;

  return (
    <div className="ac">
      {/* Painel do dia */}
      <section className="ac-hoje">
        <div className="ac-hoje-tx">
          <span className="ac-hoje-ctx">Hoje, {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
          <h2>{contagemHoje.analise + contagemHoje.onboarding + contagemHoje.tarefas} pendências, <span className="font-serif-accent">{contagemHoje.fase} fases para confirmar</span></h2>
        </div>
        <div className="ac-hoje-chips">
          {([
            ["analise", "Análises vencidas", contagemHoje.analise],
            ["onboarding", "Onboarding atrasado", contagemHoje.onboarding],
            ["mensagem", "Mensagem da semana", contagemHoje.mensagem],
            ["fase", "Fase para confirmar", contagemHoje.fase],
            ["tarefas", "Tarefas da cliente vencidas", contagemHoje.tarefas],
          ] as const).map(([k, l, n]) => (
            <button key={k} className={`ac-chip${f.hoje === k ? " on" : ""}`} onClick={() => setF(p => ({ ...p, hoje: p.hoje === k ? "" : k }))}>
              <b>{n}</b>{l}
            </button>
          ))}
          {dono && <button className="ac-config-btn" onClick={() => setVerConfig(v => !v)} title="Configurar metodologia e IA"><Settings size={15} /> Metodologia</button>}
        </div>
      </section>

      {verConfig && dono && <Configuracao agId={agId} faixas={faixas} instrucoes={instrucoes} onSalvo={(fx, ins) => { setFaixas(fx); setInstrucoes(ins); setVerConfig(false); }} />}

      <div className="ac-grade">
        {/* Lista */}
        <aside className="ac-lista">
          <div className="ac-filtros">
            <label className="ac-busca"><Search size={14} /><input placeholder="Buscar cliente" value={f.busca} onChange={e => setF(p => ({ ...p, busca: e.target.value }))} /></label>
            <select value={f.gestor} onChange={e => setF(p => ({ ...p, gestor: e.target.value }))}><option value="">Gestor</option>{gestores.map(g => <option key={g}>{g}</option>)}</select>
            <select value={f.cs} onChange={e => setF(p => ({ ...p, cs: e.target.value }))}><option value="">CS</option>{css.map(g => <option key={g}>{g}</option>)}</select>
            <select value={f.fase} onChange={e => setF(p => ({ ...p, fase: e.target.value }))}><option value="">Fase</option>{FASES.map(x => <option key={x.v} value={x.v}>{x.label}</option>)}</select>
          </div>
          <div className="ac-itens">
            {filtrados.map(c => {
              const k = calc[c.id];
              return (
                <button key={c.id} className={`ac-item${sel === c.id ? " on" : ""}`} onClick={() => setSel(c.id)}>
                  <span className={`ac-semaforo ${k.tomGeral}`} />
                  <span className="ac-av" style={{ background: faseCor(c.escala_jornada) + "22", color: faseCor(c.escala_jornada) }}>{iniciais(c.nome)}</span>
                  <span className="ac-item-tx">
                    <b>{c.nome}</b>
                    <small>{faseLabel(c.escala_jornada)} · {k.diag.gargalo === "Nenhum" ? "na faixa" : k.diag.gargalo}</small>
                  </span>
                  {k.faseDif && <span className="ac-tag" title={k.sug.motivo}>→ {faseLabel(k.sug.fase)}</span>}
                </button>
              );
            })}
            {filtrados.length === 0 && <p className="ac-vazio">Nenhuma cliente com esse filtro.</p>}
          </div>
        </aside>

        {/* Ficha */}
        {cliente ? (
          <Ficha key={cliente.id} c={cliente} k={calc[cliente.id]} agId={agId} usuario={usuario} equipe={equipe} faixas={faixas}
            mediaFase={(() => {
              const mesmas = clientes.filter(x => x.escala_jornada === cliente.escala_jornada && x.id !== cliente.id).map(x => calc[x.id]?.t.taxaAgend).filter((v): v is number => v !== null && v !== undefined);
              return mesmas.length >= 2 ? mesmas.reduce((s, v) => s + v, 0) / mesmas.length : null;
            })()}
            tarefas={tarefas.filter(t => t.cliente_id === cliente.id)}
            onAcomp={p => salvarAcomp(cliente.id, p)}
            onRecarregar={carregar}
            onFase={async (para, motivo) => {
              const de = cliente.escala_jornada;
              setClientes(p => p.map(x => x.id === cliente.id ? { ...x, escala_jornada: para } : x));
              await Promise.all([
                supabase.from("controle_clientes").update({ escala_jornada: para }).eq("id", cliente.id),
                supabase.from("acomp_fase_historico").insert({ agencia_id: agId, cliente_id: cliente.id, de, para, por: usuario, motivo }),
                supabase.from("escala_atualizacoes").insert({ agencia_id: agId, cliente_id: cliente.id, gestor: usuario, texto: `Fase alterada para ${faseLabel(para)} (Acompanhamento)` }),
              ]);
            }}
            setTarefas={setTarefas} setMensagens={setMensagens} setRegistros={setRegistros}
          />
        ) : <div className="ac-ficha ac-vazio">Escolha uma cliente na lista.</div>}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function Ficha(props: {
  c: Cliente; k: any; agId: string; usuario: string; equipe: string[]; faixas: Faixas; mediaFase: number | null;
  tarefas: Tarefa[]; onAcomp: (p: Partial<Acomp>) => void; onRecarregar: () => void; onFase: (para: string, motivo: string) => Promise<void>;
  setTarefas: React.Dispatch<React.SetStateAction<Tarefa[]>>; setMensagens: React.Dispatch<React.SetStateAction<Mensagem[]>>; setRegistros: React.Dispatch<React.SetStateAction<Registro[]>>;
}) {
  const { c, k, agId, usuario, faixas } = props;
  const a: Acomp = k.a;
  // Período do card de números: padrão últimos 28 dias; o calendário troca para qualquer intervalo
  const hojeBR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const ini28 = (() => { const d = new Date(hojeBR + "T12:00:00"); d.setDate(d.getDate() - 27); return d.toISOString().slice(0, 10); })();
  const [periodo, setPeriodo] = useState({ de: ini28, ate: hojeBR });
  const padrao = periodo.de === ini28 && periodo.ate === hojeBR;
  const [numPer, setNumPer] = useState<any>(null);
  const [carregPer, setCarregPer] = useState(false);
  useEffect(() => { setPeriodo({ de: ini28, ate: hojeBR }); setNumPer(null); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (padrao || !c.relatorio_id || !periodo.de || !periodo.ate || periodo.de > periodo.ate) { setNumPer(null); return; }
    let vivo = true;
    setCarregPer(true);
    fetch("/api/acompanhamento/numeros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relatorio_ids: [c.relatorio_id], de: periodo.de, ate: periodo.ate }) })
      .then(r => r.json()).then(j => { if (vivo) setNumPer(j?.[c.relatorio_id!] || null); })
      .catch(() => { if (vivo) setNumPer(null); })
      .finally(() => { if (vivo) setCarregPer(false); });
    return () => { vivo = false; };
  }, [c.relatorio_id, periodo.de, periodo.ate, padrao]);
  const numAtivo = !padrao && numPer ? numPer : k.num;
  const n: Numeros = !padrao && numPer ? numPer.atual : k.atual;
  const t = !padrao && numPer ? taxas(n) : k.t;
  const iCont = idealContato(a, faixas);
  const iAg = idealAgend(a, faixas);
  const [timeline, setTimeline] = useState<{ quando: string; quem: string; texto: string; tipo: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from("acomp_registros").select("autor, tipo, feito, pendencia, proximo_passo, created_at").eq("cliente_id", c.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("acomp_fase_historico").select("de, para, por, motivo, created_at").eq("cliente_id", c.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("escala_atualizacoes").select("gestor, texto, created_at").eq("cliente_id", c.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("anotacoes").select("usuario, conteudo, created_at").eq("agencia_id", agId).eq("cliente_id", c.id).order("created_at", { ascending: false }).limit(30),
      ]);
      const itens = [
        ...((r1.data || []) as any[]).map(r => ({ quando: r.created_at, quem: r.autor || "", tipo: "Registro", texto: [r.feito, r.pendencia && `Pendência: ${r.pendencia}`, r.proximo_passo && `Próximo: ${r.proximo_passo}`].filter(Boolean).join(" · ") })),
        ...((r2.data || []) as any[]).map(r => ({ quando: r.created_at, quem: r.por || "", tipo: faseOrdem(r.para) > faseOrdem(r.de) ? "Subiu de fase" : "Fase", texto: `${faseLabel(r.de)} → ${faseLabel(r.para)}${r.motivo ? ` · ${r.motivo}` : ""}` })),
        ...((r3.data || []) as any[]).filter(r => !String(r.texto).includes("(Acompanhamento)")).map(r => ({ quando: r.created_at, quem: r.gestor || "", tipo: "Escala", texto: r.texto })),
        ...((r4.data || []) as any[]).map(r => ({ quando: r.created_at, quem: r.usuario || "", tipo: "Anotação", texto: r.conteudo })),
      ].sort((x, y) => y.quando.localeCompare(x.quando)).slice(0, 40);
      setTimeline(itens);
    })();
  }, [c.id, agId]);

  return (
    <div className="ac-ficha">
      {/* Cabeçalho */}
      <section className="ac-topo">
        <div className="ac-topo-l">
          <span className="ac-av grande" style={{ background: faseCor(c.escala_jornada) + "33", color: "#fff" }}>{iniciais(c.nome)}</span>
          <div>
            <h2>{c.nome}</h2>
            <p>Gestor {c.gestor || "—"} · CS{" "}
              <select className="ac-sel-escuro" value={a.cs || ""} onChange={e => props.onAcomp({ cs: e.target.value || null })}>
                <option value="">definir</option>{props.equipe.map(p => <option key={p}>{p}</option>)}
              </select>
              {k.diasCampanha !== null && <> · campanha há {k.diasCampanha} dias</>}
            </p>
          </div>
          <Link href={`/controle-clientes/${c.id}`} className="ac-link-claro" title="Abrir perfil da cliente"><ExternalLink size={14} /></Link>
        </div>
        <div className="ac-fases">
          {FASES.filter(x => x.v !== "resultado_oscilando").map(x => (
            <span key={x.v} className={`ac-fase${c.escala_jornada === x.v ? " atual" : ""}${k.sug.fase === x.v && c.escala_jornada !== x.v ? " sugerida" : ""}`} style={{ ["--c" as any]: x.cor }}>{x.label}</span>
          ))}
          {c.escala_jornada === "resultado_oscilando" && <span className="ac-fase atual" style={{ ["--c" as any]: "#6B4FC8" }}>Oscilando</span>}
        </div>
        <div className="ac-sugestao">
          <span><Sparkles size={13} /> Sugestão: <b>{faseLabel(k.sug.fase)}</b> — {k.sug.motivo}</span>
          {k.faseDif && <button className="ac-btn claro" onClick={() => props.onFase(k.sug.fase, k.sug.motivo)}>Confirmar {faseLabel(k.sug.fase)}</button>}
          <label className="ac-analise"><CalendarClock size={13} /> Próxima análise
            <input type="date" value={a.proxima_analise || ""} onChange={e => props.onAcomp({ proxima_analise: e.target.value || null })} />
          </label>
        </div>
      </section>

      <div className="ac-colunas">
        <div className="ac-col">
          {/* Números vs ideais */}
          <section className="ac-card">
            <header>
              <h3><Gauge size={15} /> {padrao ? "Últimas 4 semanas" : "Período escolhido"}</h3>
              <div className="ac-periodo">
                <input type="date" value={periodo.de} max={periodo.ate} onChange={e => e.target.value && setPeriodo(p => ({ ...p, de: e.target.value }))} aria-label="Data inicial" />
                <span>até</span>
                <input type="date" value={periodo.ate} min={periodo.de} max={hojeBR} onChange={e => e.target.value && setPeriodo(p => ({ ...p, ate: e.target.value }))} aria-label="Data final" />
                {!padrao && <button className="ac-btn-link" onClick={() => setPeriodo({ de: ini28, ate: hojeBR })}>Últimas 4 semanas</button>}
              </div>
            </header>
            <small className="ac-periodo-resumo">{carregPer ? "Carregando período…" : numAtivo?.meta_ok ? `${(n as any).mensagens || 0} mensagens · ${(n as any).leads || 0} leads · ${n.agendamentos} agendamentos` : "sem dados da Meta"}</small>
            <div className="ac-kpis">
              <Kpi l="Custo por contato" v={brl(t.custoContato)} d={`ideal ${brl(iCont)}`} tom={tomCusto(t.custoContato, iCont)} />
              <Kpi l="Custo por agendamento" v={brl(t.custoAgend)} d={`ideal ${brl(iAg)}`} tom={tomCusto(t.custoAgend, iAg)} />
              <Kpi l="CPA" v={brl(t.cpa)} d={a.cpa_ideal ? `ideal ${brl(a.cpa_ideal)}` : "sem ideal"} tom={a.cpa_ideal ? tomCusto(t.cpa, a.cpa_ideal) : "sem"} />
              <Kpi l="Taxa de agendamento" v={pct(t.taxaAgend)} d={props.mediaFase !== null ? `média da fase ${pct(props.mediaFase)}` : `mín. ${faixas.taxaAgendMin}%`} tom={tomTaxa(t.taxaAgend, faixas.taxaAgendMin, faixas.taxaAgendBoa)} />
              <Kpi l="Comparecimento" v={pct(t.comparec)} d={`mín. ${faixas.comparecMin}%`} tom={tomTaxa(t.comparec, faixas.comparecMin)} />
              <Kpi l="Conversão" v={pct(t.conversao)} d={`mín. ${faixas.conversaoMin}%`} tom={tomTaxa(t.conversao, faixas.conversaoMin)} />
            </div>
            {!c.relatorio_id && <p className="ac-aviso">Esta cliente não tem relatório vinculado na Carteira: os números vêm de lá.</p>}
          </section>

          {/* Contatos reais × Meta, no mesmo período */}
          {a.filha_id
            ? <QualidadePublicos agenciaId={a.filha_id} desde={periodo.de} ate={periodo.ate} versao={0} compacto />
            : <section className="ac-card"><header><h3><Target size={15} /> Contatos reais × Meta</h3></header>
                <p className="ac-aviso">Para comparar o que o Meta informa com os contatos que chegaram de verdade, escolha a agência da cliente em “Atendimento da cliente” (precisa estar com o WhatsApp na plataforma).</p></section>}

          {/* Gargalo e próximo passo */}
          <section className="ac-card destaque">
            <header><h3><Target size={15} /> Gargalo e próximo passo</h3><span className={`ac-pill ${k.tomGeral}`}>{k.diag.gargalo}</span></header>
            <p className="ac-passo">{k.diag.passo}</p>
            <div className="ac-cenario">
              <b>Tráfego · {k.cen.c !== "—" ? `Cenário ${k.cen.c}` : "sem cenário"}</b> — {k.cen.titulo}
              <p>{k.cen.acao}</p>
            </div>
          </section>

          {/* Custos ideais */}
          <section className="ac-card">
            <header><h3>Custos ideais desta cliente</h3><small>variam por região, potencial e know-how</small></header>
            <div className="ac-form g4">
              <Campo l="Por mensagem" v={a.custo_msg_ideal} onSave={v => props.onAcomp({ custo_msg_ideal: v })} ph={`${faixas.custoMsgPadrao}`} />
              <Campo l="Por lead" v={a.custo_lead_ideal} onSave={v => props.onAcomp({ custo_lead_ideal: v })} />
              <Campo l="Por agendamento" v={a.custo_agend_ideal} onSave={v => props.onAcomp({ custo_agend_ideal: v })} ph={`${faixas.custoAgendPadrao}`} />
              <Campo l="CPA (por venda)" v={a.cpa_ideal} onSave={v => props.onAcomp({ cpa_ideal: v })} />
            </div>
            <p className="ac-nota">Em branco, vale o padrão da metodologia (R$ {faixas.custoMsgPadrao} por contato, R$ {faixas.custoAgendPadrao} por agendamento).</p>
          </section>

          <RegistroIA c={c} agId={agId} usuario={usuario} onSalvo={(r) => { props.setRegistros(p => [r, ...p]); setTimeline(p => [{ quando: r.created_at, quem: usuario, tipo: "Registro", texto: [r.feito, r.pendencia && `Pendência: ${r.pendencia}`, r.proximo_passo && `Próximo: ${r.proximo_passo}`].filter(Boolean).join(" · ") }, ...p]); if (r.reavaliar_em) props.onAcomp({ proxima_analise: r.reavaliar_em }); }} />

          <MensagemSemanal c={c} k={k} agId={agId} usuario={usuario} tarefas={props.tarefas} faixas={faixas} setMensagens={props.setMensagens} />

          <AtendimentoCliente c={c} a={a} agId={agId} onAcomp={props.onAcomp} />

          {/* Linha do tempo */}
          <section className="ac-card">
            <header><h3>Linha do tempo</h3><small>registros, fases, Escalas e anotações</small></header>
            <ol className="ac-timeline">
              {timeline.map((i, idx) => (
                <li key={idx}><span className="ac-tl-tipo">{i.tipo}</span><p>{i.texto}</p><small>{dataBR(i.quando)}{i.quem ? ` · ${i.quem}` : ""}</small></li>
              ))}
              {timeline.length === 0 && <p className="ac-vazio">Sem histórico ainda.</p>}
            </ol>
          </section>
        </div>

        <div className="ac-col">
          {/* Ficha */}
          <section className="ac-card">
            <header><h3>Ficha</h3></header>
            <div className="ac-form g2">
              <label>Foco<select value={a.foco || ""} onChange={e => props.onAcomp({ foco: e.target.value || null })}><option value="">—</option><option value="laser">Remoção a laser</option><option value="micro">Micropigmentação</option><option value="regeneracao">Regeneração</option></select></label>
              <label>Tem secretária?<select value={a.tem_secretaria === null || a.tem_secretaria === undefined ? "" : a.tem_secretaria ? "s" : "n"} onChange={e => props.onAcomp({ tem_secretaria: e.target.value === "" ? null : e.target.value === "s" })}><option value="">—</option><option value="s">Sim</option><option value="n">Não</option></select></label>
              <label>Avaliação<select value={a.avaliacao_gratuita === false ? "n" : "s"} onChange={e => props.onAcomp({ avaliacao_gratuita: e.target.value === "s" })}><option value="s">Gratuita</option><option value="n">Cobrada</option></select></label>
              <CampoTexto l="Ticket médio (R$)" v={a.ticket_medio?.toString() || ""} onSave={v => props.onAcomp({ ticket_medio: v ? Number(v.replace(",", ".")) : null })} />
              <CampoTexto l="Preço" v={a.preco || ""} onSave={v => props.onAcomp({ preco: v || null })} />
              <CampoTexto l="Drive" v={a.drive_url || ""} onSave={v => props.onAcomp({ drive_url: v || null })} />
            </div>
            <div className="ac-form g1">
              <CampoTexto l="Oferta" v={a.oferta || ""} onSave={v => props.onAcomp({ oferta: v || null })} area />
              <CampoTexto l="Pacotes e combos" v={a.pacotes || ""} onSave={v => props.onAcomp({ pacotes: v || null })} area />
            </div>
          </section>

          {/* Onboarding */}
          <section className="ac-card">
            <header><h3><ClipboardList size={15} /> Onboarding</h3><small>{k.obFeitos} de {ONBOARDING_ITENS.length}</small></header>
            <div className="ac-barra"><span style={{ width: `${(k.obFeitos / ONBOARDING_ITENS.length) * 100}%` }} /></div>
            <ul className="ac-check">
              {ONBOARDING_ITENS.map(i => {
                const on = !!a.onboarding?.[i.k];
                return <li key={i.k}><button className={on ? "on" : ""} onClick={() => props.onAcomp({ onboarding: { ...(a.onboarding || {}), [i.k]: !on } })}>{on ? <Check size={12} /> : null}</button>{i.label}</li>;
              })}
            </ul>
          </section>

          <Tarefas c={c} agId={agId} tarefas={props.tarefas} setTarefas={props.setTarefas} />

          {/* Nota de parceria */}
          <section className="ac-card">
            <header><h3>Nota de parceria</h3><small>de 1 a 5 por pilar</small></header>
            <ul className="ac-pilares">
              {PILARES.map(p => {
                const nota = a.notas_parceria?.[p.k] || 0;
                return (
                  <li key={p.k}>
                    <span>{p.label}</span>
                    <span className="ac-estrelas">{[1, 2, 3, 4, 5].map(i => <button key={i} className={i <= nota ? "on" : ""} onClick={() => props.onAcomp({ notas_parceria: { ...(a.notas_parceria || {}), [p.k]: i } })} aria-label={`${p.label} nota ${i}`} />)}</span>
                    {nota > 0 && nota <= 3 && <small>{p.dica}</small>}
                  </li>
                );
              })}
            </ul>
          </section>

          <Reuniao c={c} k={k} tarefas={props.tarefas} />
        </div>
      </div>
    </div>
  );
}

function Kpi({ l, v, d, tom }: { l: string; v: string; d: string; tom: Tom }) {
  return <div className={`ac-kpi ${tom}`}><span>{l}</span><b>{v}</b><small>{d}</small></div>;
}

function Campo({ l, v, onSave, ph }: { l: string; v?: number | null; onSave: (v: number | null) => void; ph?: string }) {
  const [x, setX] = useState(v?.toString().replace(".", ",") || "");
  return (
    <label>{l}
      <span className="ac-rs"><i>R$</i><input inputMode="decimal" placeholder={ph || "—"} value={x} onChange={e => setX(e.target.value)}
        onBlur={() => { const num = x.trim() ? Number(x.replace(/\./g, "").replace(",", ".")) : null; if (num === null || !isNaN(num)) onSave(num); }} /></span>
    </label>
  );
}
function CampoTexto({ l, v, onSave, area }: { l: string; v: string; onSave: (v: string) => void; area?: boolean }) {
  const [x, setX] = useState(v);
  return <label>{l}{area ? <textarea rows={2} value={x} onChange={e => setX(e.target.value)} onBlur={() => x !== v && onSave(x)} /> : <input value={x} onChange={e => setX(e.target.value)} onBlur={() => x !== v && onSave(x)} />}</label>;
}

async function chamarIA(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/acompanhamento/ia", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Erro na IA");
  return j;
}

function RegistroIA({ c, agId, usuario, onSalvo }: { c: Cliente; agId: string; usuario: string; onSalvo: (r: Registro) => void }) {
  const [texto, setTexto] = useState("");
  const [org, setOrg] = useState<any>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const organizar = async () => {
    setOcupado(true); setErro("");
    try { const j = await chamarIA({ acao: "organizar", agencia_id: agId, texto }); setOrg(j.organizado); }
    catch (e: any) { setErro(e.message); }
    setOcupado(false);
  };
  const salvar = async (dados: any) => {
    setOcupado(true);
    const { data } = await supabase.from("acomp_registros").insert({
      agencia_id: agId, cliente_id: c.id, autor: usuario, texto_original: texto,
      tipo: dados.tipo || "outro", feito: dados.feito || texto, pendencia: dados.pendencia || null,
      proximo_passo: dados.proximo_passo || null, reavaliar_em: dados.reavaliar_em || null,
    }).select("id, cliente_id, autor, tipo, feito, pendencia, proximo_passo, reavaliar_em, created_at").single();
    if (data) onSalvo(data as Registro);
    setTexto(""); setOrg(null); setOcupado(false);
  };
  return (
    <section className="ac-card">
      <header><h3><Sparkles size={15} /> Registro da análise</h3><small>escreva livre; a IA organiza</small></header>
      {!org ? (
        <>
          <textarea className="ac-area" rows={3} placeholder="Ex.: troquei o criativo 2 pelo vídeo novo, ampliei o público para Advantage+. Falta a cliente mandar o vídeo cru. Ver de novo na sexta." value={texto} onChange={e => setTexto(e.target.value)} />
          <div className="ac-acoes">
            <button className="ac-btn" disabled={!texto.trim() || ocupado} onClick={organizar}><Sparkles size={13} /> {ocupado ? "Organizando…" : "Organizar com IA"}</button>
            <button className="ac-btn claro" disabled={!texto.trim() || ocupado} onClick={() => salvar({ feito: texto })}>Salvar sem IA</button>
          </div>
        </>
      ) : (
        <div className="ac-form g1">
          <label>Tipo<select value={org.tipo || "outro"} onChange={e => setOrg({ ...org, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>O que foi feito<textarea rows={2} value={org.feito || ""} onChange={e => setOrg({ ...org, feito: e.target.value })} /></label>
          <label>Pendência<textarea rows={2} value={org.pendencia || ""} onChange={e => setOrg({ ...org, pendencia: e.target.value })} /></label>
          <label>Próximo passo<textarea rows={2} value={org.proximo_passo || ""} onChange={e => setOrg({ ...org, proximo_passo: e.target.value })} /></label>
          <label>Reavaliar em<input type="date" value={org.reavaliar_em || ""} onChange={e => setOrg({ ...org, reavaliar_em: e.target.value })} /></label>
          <div className="ac-acoes"><button className="ac-btn" disabled={ocupado} onClick={() => salvar(org)}><Check size={13} /> Conferido, salvar</button><button className="ac-btn claro" onClick={() => setOrg(null)}>Voltar</button></div>
        </div>
      )}
      {erro && <p className="ac-erro">{erro}</p>}
    </section>
  );
}

function MensagemSemanal({ c, k, agId, usuario, tarefas, faixas, setMensagens }: { c: Cliente; k: any; agId: string; usuario: string; tarefas: Tarefa[]; faixas: Faixas; setMensagens: React.Dispatch<React.SetStateAction<Mensagem[]>> }) {
  const [msg, setMsg] = useState<Mensagem | null>(k.msgSemana || null);
  const [texto, setTexto] = useState(k.msgSemana?.texto || "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const gerar = async () => {
    setOcupado(true); setErro("");
    try {
      const t = k.t;
      const contexto = {
        cliente: c.nome.split(" ")[0], fase: faseLabel(c.escala_jornada),
        ultimas_4_semanas: { contatos: k.atual.contatos, agendamentos: k.atual.agendamentos, comparecimentos: k.atual.comparecimentos, vendas: k.atual.vendas, investimento: k.atual.investimento },
        taxas: { custo_por_contato: t.custoContato, custo_por_agendamento: t.custoAgend, taxa_agendamento_pct: t.taxaAgend, comparecimento_pct: t.comparec, conversao_pct: t.conversao },
        ideais: { custo_por_contato: idealContato(k.a, faixas), custo_por_agendamento: idealAgend(k.a, faixas) },
        gargalo: k.diag.gargalo, proximo_passo: k.diag.passo, tarefas_da_cliente: tarefas.map(x => `${x.titulo}${x.prazo ? ` até ${dataBR(x.prazo)}` : ""}`),
        reavaliar_em: k.a.proxima_analise || null,
      };
      const j = await chamarIA({ acao: "mensagem", agencia_id: agId, contexto });
      const semana = segundaDaSemana();
      const { data } = await supabase.from("acomp_mensagens").insert({ agencia_id: agId, cliente_id: c.id, semana, texto: j.texto, status: "rascunho", autor: usuario }).select("id, cliente_id, semana, texto, status").single();
      if (data) { setMsg(data as Mensagem); setTexto((data as Mensagem).texto); setMensagens(p => [...p.filter(m => m.cliente_id !== c.id), data as Mensagem]); }
    } catch (e: any) { setErro(e.message); }
    setOcupado(false);
  };
  const status = async (s: string) => {
    if (!msg) return;
    await supabase.from("acomp_mensagens").update({ status: s, texto, updated_at: new Date().toISOString() }).eq("id", msg.id);
    const nova = { ...msg, status: s, texto };
    setMsg(nova); setMensagens(p => [...p.filter(m => m.cliente_id !== c.id), nova]);
  };
  return (
    <section className="ac-card">
      <header><h3><MessageSquare size={15} /> Mensagem da semana</h3>{msg && <span className={`ac-pill ${msg.status === "enviada" ? "ok" : msg.status === "pulada" ? "sem" : "atencao"}`}>{msg.status === "enviada" ? "Enviada" : msg.status === "pulada" ? "Pulada" : "Rascunho"}</span>}</header>
      {!msg ? (
        <div className="ac-acoes"><button className="ac-btn" disabled={ocupado} onClick={gerar}><Sparkles size={13} /> {ocupado ? "Escrevendo…" : "Gerar rascunho com IA"}</button></div>
      ) : (
        <>
          <textarea className="ac-area" rows={7} value={texto} onChange={e => setTexto(e.target.value)} />
          <div className="ac-acoes">
            <button className="ac-btn claro" onClick={async () => { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}><Copy size={13} /> {copiado ? "Copiado" : "Copiar"}</button>
            <button className="ac-btn" onClick={() => status("enviada")}><Check size={13} /> Marcar como enviada</button>
            <button className="ac-btn claro" onClick={() => status("pulada")}>Pular esta semana</button>
            <button className="ac-btn claro" disabled={ocupado} onClick={gerar}>Gerar de novo</button>
          </div>
          <p className="ac-nota">Copie e envie no grupo da cliente. O envio direto pelo sistema entra junto com o Inbox novo.</p>
        </>
      )}
      {erro && <p className="ac-erro">{erro}</p>}
    </section>
  );
}

function Tarefas({ c, agId, tarefas, setTarefas }: { c: Cliente; agId: string; tarefas: Tarefa[]; setTarefas: React.Dispatch<React.SetStateAction<Tarefa[]>> }) {
  const [titulo, setTitulo] = useState("");
  const [prazo, setPrazo] = useState("");
  const add = async () => {
    if (!titulo.trim()) return;
    const { data } = await supabase.from("acomp_tarefas").insert({ agencia_id: agId, cliente_id: c.id, titulo: titulo.trim(), prazo: prazo || null }).select("id, cliente_id, titulo, prazo, feita").single();
    if (data) setTarefas(p => [...p, data as Tarefa]);
    setTitulo(""); setPrazo("");
  };
  const concluir = async (t: Tarefa) => {
    setTarefas(p => p.filter(x => x.id !== t.id));
    await supabase.from("acomp_tarefas").update({ feita: true }).eq("id", t.id);
  };
  return (
    <section className="ac-card">
      <header><h3>Tarefas da cliente</h3><small>o que ela precisa fazer</small></header>
      <ul className="ac-check">
        {tarefas.map(t => (
          <li key={t.id} className={t.prazo && t.prazo < hojeISO() ? "vencida" : ""}>
            <button onClick={() => concluir(t)} aria-label="Concluir" />{t.titulo}{t.prazo && <small>até {dataBR(t.prazo)}</small>}
          </li>
        ))}
        {tarefas.length === 0 && <p className="ac-vazio">Nenhuma tarefa em aberto.</p>}
      </ul>
      <div className="ac-nova">
        <input placeholder="Nova tarefa (ex.: gravar 3 vídeos novos)" value={titulo} onChange={e => setTitulo(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
        <button className="ac-btn" onClick={add} aria-label="Adicionar"><Plus size={14} /></button>
      </div>
    </section>
  );
}

function Reuniao({ c, k, tarefas }: { c: Cliente; k: any; tarefas: Tarefa[] }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const t = k.t;
  const roteiro = [
    `Reunião mensal · ${c.nome}`,
    `1. Onde estamos: ${faseLabel(c.escala_jornada)}${k.faseDif ? ` (números indicam ${faseLabel(k.sug.fase)})` : ""}.`,
    `2. Números das últimas 4 semanas: ${k.atual.contatos} contatos, ${k.atual.agendamentos} agendamentos, ${k.atual.comparecimentos} comparecimentos, ${k.atual.vendas} vendas.`,
    `   Custo por contato ${brl(t.custoContato)} · por agendamento ${brl(t.custoAgend)} · taxa de agendamento ${pct(t.taxaAgend)}.`,
    `3. Gargalo: ${k.diag.gargalo}. Próximo passo: ${k.diag.passo}`,
    `4. O que fizemos: ${(k.regs || []).slice(0, 3).map((r: Registro) => r.feito).filter(Boolean).join("; ") || "—"}.`,
    `5. Tarefas dela: ${tarefas.map(x => x.titulo).join("; ") || "nenhuma em aberto"}.`,
    `6. Nota de parceria: ${PILARES.map(p => `${p.label} ${k.a.notas_parceria?.[p.k] || "—"}`).join(" · ")}.`,
    `7. Combinar a data da próxima reavaliação.`,
  ].join("\n");
  return (
    <section className="ac-card">
      <header><h3>Reunião mensal</h3><button className="ac-btn claro" onClick={() => setAberto(v => !v)}>{aberto ? "Fechar" : "Montar roteiro"}</button></header>
      {aberto && <>
        <pre className="ac-roteiro">{roteiro}</pre>
        <div className="ac-acoes"><button className="ac-btn claro" onClick={async () => { await navigator.clipboard.writeText(roteiro); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}><Copy size={13} /> {copiado ? "Copiado" : "Copiar roteiro"}</button></div>
      </>}
    </section>
  );
}

// Atendimento da cliente: números (sem IA) + leitura semanal da IA comparando com o Padrão de atendimento
function AtendimentoCliente({ c, a, agId, onAcomp }: { c: Cliente; a: Acomp; agId: string; onAcomp: (p: Partial<Acomp>) => void }) {
  const [filhas, setFilhas] = useState<{ id: string; nome: string }[]>([]);
  const [hist, setHist] = useState<any[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [aberta, setAberta] = useState(0);

  useEffect(() => {
    supabase.from("agencias").select("id, nome").eq("parent_id", agId).order("nome").then(({ data }) => setFilhas((data as any[]) || []));
  }, [agId]);
  useEffect(() => {
    supabase.from("acomp_auditorias").select("*").eq("cliente_id", c.id).order("semana_inicio", { ascending: false }).limit(8)
      .then(({ data }) => { setHist((data as any[]) || []); setAberta(0); });
  }, [c.id]);

  const analisar = async () => {
    setOcupado(true); setErro("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/acompanhamento/auditoria", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ cliente_id: c.id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível analisar agora.");
      setHist(p => [j.auditoria, ...p.filter(x => x.semana_inicio !== j.auditoria.semana_inicio)]); setAberta(0);
    } catch (e: any) { setErro(e.message); }
    setOcupado(false);
  };

  const atual = hist[aberta];
  const anterior = hist[aberta + 1];
  const nu = atual?.numeros || {};
  const nuA = anterior?.numeros || null;
  const pct = (v: number | null | undefined) => v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;
  const tempo = (m: number | null | undefined) => m === null || m === undefined ? "—" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
  const seta = (agora?: number | null, antes?: number | null, menorMelhor = false) => {
    if (agora === null || agora === undefined || antes === null || antes === undefined || agora === antes) return "";
    const melhorou = menorMelhor ? agora < antes : agora > antes;
    return melhorou ? " ▲" : " ▼";
  };
  const ia = atual?.ia;

  return (
    <section className="ac-card">
      <header><h3><Headphones size={15} /> Atendimento da cliente</h3><small>leads do Meta · horário comercial seg–sex 9h–18h</small></header>
      <div className="ac-form g1">
        <label>Agência na plataforma (WhatsApp da cliente)
          <select value={a.filha_id || ""} onChange={e => onAcomp({ filha_id: e.target.value || null })}>
            <option value="">Não está na plataforma</option>
            {filhas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
      </div>

      {!a.filha_id ? <p className="ac-vazio">Quando a cliente estiver na plataforma, escolha a agência dela acima para analisar o atendimento.</p> : (
        <>
          <div className="ac-acoes">
            <button className="ac-btn" disabled={ocupado} onClick={analisar}><Sparkles size={13} /> {ocupado ? "Analisando conversas…" : "Analisar últimos 7 dias"}</button>
            {hist.length > 1 && (
              <select className="ac-sel-claro" value={aberta} onChange={e => setAberta(Number(e.target.value))}>
                {hist.map((h, i) => <option key={h.id} value={i}>Semana de {dataBR(h.semana_inicio)}</option>)}
              </select>
            )}
          </div>
          {erro && <p className="ac-erro">{erro}</p>}
          {!atual ? <p className="ac-vazio">Ainda sem análise. A análise automática roda toda segunda-feira, ou clique em analisar.</p> : (
            <>
              <div className="ac-kpis">
                <Kpi l="1ª resposta (mediana)" v={tempo(nu.tempo_mediana_min) + seta(nu.tempo_mediana_min, nuA?.tempo_mediana_min, true)} d={`${pct(nu.ate_15min)} em até 15 min${nu.pct_ia ? ` · ${pct(nu.pct_ia)} pela IA` : ""}`} tom={nu.tempo_mediana_min === null ? "sem" : nu.tempo_mediana_min <= 15 ? "ok" : nu.tempo_mediana_min <= 60 ? "atencao" : "ruim"} />
                <Kpi l="Sem nenhuma resposta" v={String(nu.sem_resposta ?? 0)} d={`de ${nu.leads ?? 0} leads do anúncio`} tom={(nu.sem_resposta || 0) > 0 ? "ruim" : "ok"} />
                <Kpi l="Pararam e ficaram sem follow-up" v={`${nu.sem_followup ?? 0} de ${nu.pararam ?? 0}`} d={`${nu.com_2_followups ?? 0} receberam os 2 follow-ups`} tom={(nu.sem_followup || 0) === 0 ? "ok" : "ruim"} />
                <Kpi l="Desenvolveram conversa" v={pct(nu.taxa_desenvolvimento) + seta(nu.taxa_desenvolvimento, nuA?.taxa_desenvolvimento)} d={`${nu.desenvolveram ?? 0} desenvolveram · ${nu.aberto ?? 0} em aberto`} tom={nu.taxa_desenvolvimento === null || nu.taxa_desenvolvimento === undefined ? "sem" : nu.taxa_desenvolvimento >= 0.5 ? "ok" : "ruim"} />
              </div>

              {ia ? (
                <>
                  <div className="ac-diag">
                    <p><b>Nota geral: {ia.nota_geral ?? "—"}/10</b> · {ia.resumo}</p>
                    <small>Leitura da IA em {atual.conversas_lidas} conversas, comparando com o Padrão de atendimento.</small>
                  </div>
                  <ul className="ac-etapas-at">
                    {ETAPAS_PADRAO.map(e => {
                      const x = (ia.etapas || []).find((y: any) => y.k === e.k);
                      if (!x) return null;
                      const nota = x.nota;
                      return (
                        <li key={e.k}>
                          <div className="ac-et-top"><span>{e.label}</span><b className={nota === null || nota === undefined ? "" : nota >= 7 ? "ok" : nota >= 5 ? "atencao" : "ruim"}>{nota === null || nota === undefined ? "—" : `${nota}/10`}</b></div>
                          {x.comentario && <p>{x.comentario}</p>}
                          {x.exemplo && <p className="ac-et-ex">“{x.exemplo}”</p>}
                          {x.como_deveria && <p className="ac-et-dev">Como deveria: {x.como_deveria}</p>}
                        </li>
                      );
                    })}
                  </ul>
                  {ia.followups?.comentario && <p className="ac-nota"><b>Follow-ups:</b> {ia.followups.comentario}</p>}
                  <div className="ac-form g2">
                    <div><b className="ac-mini-tit">Pontos fortes</b><ul className="ac-pontos">{(ia.pontos_fortes || []).map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
                    <div><b className="ac-mini-tit">Para melhorar</b><ul className="ac-pontos">{(ia.melhorar || []).map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
                  </div>
                  {ia.mensagem_cliente && (
                    <>
                      <b className="ac-mini-tit">Mensagem para a cliente</b>
                      <textarea className="ac-area" rows={7} defaultValue={ia.mensagem_cliente} key={atual.id} id={`msg-at-${atual.id}`} />
                      <div className="ac-acoes">
                        <button className="ac-btn claro" onClick={async () => { const el = document.getElementById(`msg-at-${atual.id}`) as HTMLTextAreaElement | null; await navigator.clipboard.writeText(el?.value || ia.mensagem_cliente); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}><Copy size={13} /> {copiado ? "Copiado" : "Copiar mensagem"}</button>
                      </div>
                    </>
                  )}
                </>
              ) : <p className="ac-nota">Poucas conversas na semana para a leitura da IA (precisa de pelo menos 3). Os números acima valem normalmente.</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Configuracao({ agId, faixas, instrucoes, onSalvo }: { agId: string; faixas: Faixas; instrucoes: string; onSalvo: (f: Faixas, i: string) => void }) {
  const [fx, setFx] = useState<Faixas>(faixas);
  const [ins, setIns] = useState(instrucoes);
  const [padrao, setPadrao] = useState(PADRAO_ATENDIMENTO_PADRAO);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    supabase.from("acomp_config").select("padrao_atendimento").eq("agencia_id", agId).maybeSingle()
      .then(({ data }) => { if ((data as any)?.padrao_atendimento) setPadrao((data as any).padrao_atendimento); });
  }, [agId]);
  const campos: [keyof Faixas, string][] = [
    ["taxaAgendMin", "Taxa de agendamento mínima (%)"], ["taxaAgendBoa", "Taxa de agendamento boa (%)"], ["taxaAgendMuitoBoa", "Taxa de agendamento muito boa (%)"],
    ["comparecMin", "Comparecimento mínimo (%)"], ["conversaoMin", "Conversão mínima (%)"], ["ticketMin", "Ticket mínimo (R$)"],
    ["loteMinimo", "Lote mínimo de contatos"], ["custoMsgPadrao", "Custo por contato padrão (R$)"], ["custoAgendPadrao", "Custo por agendamento padrão (R$)"],
  ];
  return (
    <section className="ac-card ac-config">
      <header><h3><Settings size={15} /> Metodologia e IA</h3><small>vale para todas as clientes; os custos ideais de cada uma ficam na ficha dela</small></header>
      <div className="ac-form g3">
        {campos.map(([k, l]) => <label key={k}>{l}<input inputMode="decimal" value={String(fx[k])} onChange={e => setFx({ ...fx, [k]: Number(e.target.value.replace(",", ".")) || 0 })} /></label>)}
      </div>
      <div className="ac-form g1"><label>Instruções da IA (a metodologia que ela segue)<textarea rows={8} value={ins} onChange={e => setIns(e.target.value)} /></label></div>
      <div className="ac-form g1"><label>Padrão de atendimento (a IA compara o atendimento das clientes com este texto toda semana)<textarea rows={14} value={padrao} onChange={e => setPadrao(e.target.value)} /></label></div>
      <div className="ac-acoes">
        <button className="ac-btn" disabled={salvando} onClick={async () => { setSalvando(true); await supabase.from("acomp_config").upsert({ agencia_id: agId, faixas: fx, instrucoes: ins, padrao_atendimento: padrao, updated_at: new Date().toISOString() }, { onConflict: "agencia_id" }); setSalvando(false); onSalvo(fx, ins); }}>{salvando ? "Salvando…" : "Salvar"}</button>
        <button className="ac-btn claro" onClick={() => { setFx(FAIXAS_PADRAO); setIns(INSTRUCOES_PADRAO); setPadrao(PADRAO_ATENDIMENTO_PADRAO); }}><X size={13} /> Voltar ao padrão</button>
      </div>
    </section>
  );
}
