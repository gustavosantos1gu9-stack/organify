"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase, getAgenciaId } from "@/lib/supabase";
import { ArrowLeft, ExternalLink, FileSpreadsheet, BarChart2, Instagram } from "lucide-react";
import { Cartao } from "@/components/ui/Canvas";

// Ficha da cliente: tudo de uma cliente numa tela só (carteira, fase, contrato, cadastro, financeiro e histórico).
// Só leitura: as mudanças continuam sendo feitas na Carteira, na Escala e no Financeiro.

const FASES = [
  { key: "etapa0", label: "Fase 0", cor: "#D9534F", desc: "Sem mensagem, pouca mensagem ou custo alto" },
  { key: "etapa1", label: "Fase 1", cor: "#E8915A", desc: "Bom custo por oportunidade" },
  { key: "etapa2", label: "Fase 2", cor: "#E6C44F", desc: "Agendamento com custo alto" },
  { key: "etapa3", label: "Fase 3", cor: "#1C6CA6", desc: "Agendamento com bom custo" },
  { key: "etapa4", label: "Fase 4", cor: "#8CC6EC", desc: "Escala" },
];

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  ativo: { label: "Ativa", bg: "#E3F2EC", fg: "#1E6B52" },
  pausado: { label: "Pausada", bg: "#FBF3D5", fg: "#7A5B00" },
  entrada: { label: "Em entrada", bg: "#FCE9DA", fg: "#8A3B12" },
  saiu: { label: "Saiu", bg: "#FBE3E1", fg: "#B42318" },
  debito: { label: "Em débito", bg: "#FCE9DA", fg: "#8A3B12" },
  renovar: { label: "Renovar", bg: "#DCEBF6", fg: "#144E73" },
};

function paraData(s?: string | null): Date | null {
  if (!s) return null;
  if (s.includes("/")) { const [d, m, a] = s.split("/"); return new Date(Number(a.length === 2 ? "20" + a : a), Number(m) - 1, Number(d)); }
  const d = new Date(s.length <= 10 ? s + "T12:00:00" : s);
  return isNaN(d.getTime()) ? null : d;
}
const fmtData = (s?: string | null) => { const d = paraData(s); return d ? d.toLocaleDateString("pt-BR") : "—"; };
function tempoDesde(s?: string | null) {
  const d = paraData(s); if (!d) return "—";
  const dias = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  const meses = Math.floor(dias / 30);
  return meses > 0 ? `${meses} ${meses === 1 ? "mês" : "meses"} e ${dias % 30} dias` : `${dias} dias`;
}

interface Evento { quando: string; quem: string; texto: string; origem: "Escala" | "Carteira" }

export default function FichaClientePage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [cadastro, setCadastro] = useState<any>(null);
  const [financeiro, setFinanceiro] = useState<any>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    (async () => {
      const agId = await getAgenciaId();
      const { data: cli } = await supabase.from("controle_clientes").select("*").eq("id", id).single();
      setC(cli || null);
      if (!cli) { setCarregado(true); return; }
      const [cad, fin, esc, anot] = await Promise.all([
        cli.cadastro_id ? supabase.from("cadastros_clientes").select("*").eq("id", cli.cadastro_id).single() : Promise.resolve({ data: null }),
        cli.cadastro_id ? supabase.from("clientes").select("*").eq("cadastro_id", cli.cadastro_id).limit(1) : Promise.resolve({ data: null }),
        supabase.from("escala_atualizacoes").select("gestor, texto, created_at").eq("cliente_id", id).order("created_at", { ascending: false }).limit(40),
        agId ? supabase.from("anotacoes").select("usuario, conteudo, created_at").eq("agencia_id", agId).eq("cliente_id", id).order("created_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
      ]);
      setCadastro((cad as any)?.data || null);
      setFinanceiro(((fin as any)?.data || [])[0] || null);
      const lista: Evento[] = [
        ...(((esc as any)?.data || []) as any[]).map((e) => ({ quando: e.created_at, quem: e.gestor || "", texto: e.texto || "", origem: "Escala" as const })),
        ...(((anot as any)?.data || []) as any[]).map((a) => ({ quando: a.created_at, quem: a.usuario || "", texto: a.conteudo || "", origem: "Carteira" as const })),
      ].sort((a, b) => (a.quando < b.quando ? 1 : -1));
      setEventos(lista);
      setCarregado(true);
    })();
  }, [id]);

  if (!carregado) return <div className="ui-page"><div className="ui-skel" style={{ height: 220, borderRadius: 24 }} /><div className="ui-skel" style={{ height: 300, borderRadius: 24 }} /></div>;
  if (!c) return (
    <div className="cartao" style={{ alignItems: "flex-start" }}>
      <h2 className="cartao-title">Cliente não encontrada</h2>
      <Link href="/controle-clientes" className="btn-secondary" style={{ padding: "10px 16px", textDecoration: "none" }}>Voltar para a Carteira</Link>
    </div>
  );

  const ini = (c.nome || "?").trim().split(/\s+/).slice(0, 2).map((x: string) => x[0]).join("").toUpperCase();
  const st = STATUS[c.status] || STATUS.ativo;
  const faseIdx = FASES.findIndex((f) => f.key === c.escala_jornada);
  const oscilando = c.escala_jornada === "resultado_oscilando";
  const inicioCamp = paraData(c.data_inicio_campanha);
  const diasRenov = inicioCamp ? Math.ceil((inicioCamp.getTime() + 90 * 86400000 - Date.now()) / 86400000) : null;
  const equipe = [c.gestor && `Gestor: ${c.gestor}`, c.consultor && `Consultor: ${c.consultor}`, c.sdr && `SDR: ${c.sdr}`].filter(Boolean).join(" · ");

  const Dado = ({ l, v }: { l: string; v: React.ReactNode }) => (
    <div className="fin-stat"><span className="fin-stat-l">{l}</span><span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{v || "—"}</span></div>
  );

  return (
    <div className="ui-page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Link href="/controle-clientes" className="ficha-voltar"><ArrowLeft size={15} /> Carteira</Link>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {c.relatorio_id && <a href={`/relatorios-meta/dashboard?id=${c.relatorio_id}&tab=performance`} target="_blank" rel="noopener" className="btn-secondary ficha-btn"><BarChart2 size={15} /> Performance</a>}
          {c.link_planilha && <a href={c.link_planilha} target="_blank" rel="noopener" className="btn-secondary ficha-btn"><FileSpreadsheet size={15} /> Planilha</a>}
          {c.instagram && <a href={c.instagram.startsWith("http") ? c.instagram : `https://instagram.com/${c.instagram.replace("@", "")}`} target="_blank" rel="noopener" className="btn-secondary ficha-btn"><Instagram size={15} /> Instagram</a>}
        </div>
      </div>

      {/* Cabeçalho escuro com a fase */}
      <section className="ficha-topo">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="ficha-ini">{ini}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h1 style={{ margin: 0, color: "#FFFFFF" }} className="ficha-nome">{c.nome}</h1>
              <span style={{ fontSize: 14, color: "#9FB3C6" }}>{equipe || "Sem equipe definida"} · na carteira há {tempoDesde(c.data_entrada)}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {c.uti && <span className="ficha-pill" style={{ background: "#B42318", color: "#FFFFFF" }}>Na UTI</span>}
            <span className="ficha-pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            {oscilando && <span className="ficha-pill" style={{ background: "#EFE9FB", color: "#4A2E9E" }}>Oscilando</span>}
          </div>
        </div>
        <div className="ficha-trilho">
          {FASES.map((f, i) => {
            const feita = faseIdx >= 0 && i < faseIdx;
            const atual = i === faseIdx;
            return (
              <div key={f.key} className="ficha-passo">
                <div className={atual ? "bar" : ""} style={{ height: 6, borderRadius: 999, background: atual ? f.cor : feita ? "#7BD3A6" : "rgba(255,255,255,.16)" }} />
                <span style={{ fontSize: 12, color: atual ? "#FFFFFF" : "#9FB3C6", fontWeight: atual ? 600 : 400 }}>{f.label}{atual ? " · você está aqui" : ""}</span>
                {atual && <span style={{ fontSize: 12, color: "#9FB3C6" }}>{f.desc}</span>}
              </div>
            );
          })}
        </div>
        {faseIdx < 0 && <span style={{ fontSize: 13, color: "#F6B38C" }}>{oscilando ? "Resultado oscilando: acompanhe na escala." : "Fase ainda não definida na escala."}</span>}
      </section>

      <div className="ui-grid-2" style={{ alignItems: "start" }}>
        <Cartao titulo="Contrato e campanha" lift style={{ marginBottom: 0 }}>
          <div className="fin-stats">
            <Dado l="Entrada na carteira" v={fmtData(c.data_entrada)} />
            <Dado l="Início da campanha" v={fmtData(c.data_inicio_campanha)} />
            <Dado l="Renovação" v={diasRenov === null ? "Sem data de início" : diasRenov > 0 ? `Faltam ${diasRenov} dias` : c.renovou === true ? "Renovou" : c.renovou === false ? "Não renovou" : "Aguardando resposta"} />
            <Dado l="Investimento mensal" v={c.investimento_mensal ? Number(c.investimento_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""} />
            <Dado l="Oferta" v={c.oferta === "sim" ? "Sim" : c.oferta === "nao" ? "Não" : ""} />
            <Dado l="Faturamento médio" v={c.faturamento_medio} />
          </div>
        </Cartao>

        <Cartao titulo="Financeiro" lift style={{ marginBottom: 0 }} extra={<Link className="ui-link" href={financeiro ? `/clientes/${financeiro.id}` : "/clientes"}>{financeiro ? "Abrir no financeiro" : "Clientes do financeiro"}</Link>}>
          {financeiro ? (
            <div className="fin-stats">
              <Dado l="Situação" v={financeiro.status ? String(financeiro.status).charAt(0).toUpperCase() + String(financeiro.status).slice(1) : ""} />
              <Dado l="Valor do contrato" v={financeiro.valor_oportunidade ? Number(financeiro.valor_oportunidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""} />
              <Dado l="Recorrência" v={financeiro.status_recorrencia} />
              <Dado l="Cliente desde" v={fmtData(financeiro.created_at)} />
            </div>
          ) : (
            <div className="ficha-vazio">Essa cliente ainda não tem cadastro no financeiro. Crie pela Carteira, no aviso ao lado do nome.</div>
          )}
        </Cartao>
      </div>

      <div className="ui-grid-2" style={{ alignItems: "start" }}>
        <Cartao titulo="Linha do tempo" extra={<span style={{ fontSize: 13, color: "var(--ink-2)" }}>{eventos.length} registros</span>} style={{ marginBottom: 0 }}>
          {eventos.length === 0 ? (
            <div className="ficha-vazio">Nenhuma atualização ainda. As notas da escala e da Carteira aparecem aqui.</div>
          ) : (
            <div className="ficha-tempo">
              {eventos.slice(0, 25).map((e, i) => (
                <div key={i} className="ficha-evento">
                  <span className="ficha-ponto" style={{ background: e.origem === "Escala" ? "#1C6CA6" : "#E8915A" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 14, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.texto}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{new Date(e.quando).toLocaleDateString("pt-BR")} · {e.quem || "Equipe"} · {e.origem}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cartao>

        <Cartao titulo="Cadastro" style={{ marginBottom: 0 }} extra={cadastro ? <Link className="ui-link" href="/cadastros">Ver cadastros</Link> : undefined}>
          {cadastro ? (
            <div className="fin-stats">
              <Dado l="E-mail" v={cadastro.email} />
              <Dado l="CNPJ" v={cadastro.cnpj} />
              <Dado l="Região para anunciar" v={cadastro.regiao_anunciar} />
              <Dado l="Investimento em anúncios" v={cadastro.investimento_anuncios} />
              <Dado l="Ticket" v={cadastro.ticket_micro_laser} />
              <Dado l="Enviado em" v={fmtData(cadastro.criado_em)} />
            </div>
          ) : (
            <div className="ficha-vazio">Sem cadastro vinculado. Vincule pela Carteira, no perfil da cliente.</div>
          )}
        </Cartao>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link href={c.gestor?.toLowerCase().includes("nicolas") ? "/escala-nicolas" : c.gestor?.toLowerCase().includes("carol") ? "/escala-ester" : "/escala-lavinia"} className="ui-link">
          Abrir na escala <ExternalLink size={12} style={{ verticalAlign: "-1px" }} />
        </Link>
      </div>
    </div>
  );
}
