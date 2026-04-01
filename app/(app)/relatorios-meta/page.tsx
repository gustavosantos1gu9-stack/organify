"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit3, Send, Eye, Pause, Play, Copy, Search,
  FileText, Check, X, RefreshCw, MessageCircle, AlertCircle, BarChart2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Relatorio {
  id: string;
  agencia_id: string;
  nome: string;
  nome_cliente: string;
  ad_account_id: string;
  meta_token?: string;
  grupo_id?: string;
  grupo_nome?: string;
  contato_numero?: string;
  template: string;
  periodo: string;
  frequencia: string;
  horario_envio?: string;
  dia_semana?: number;
  ativo: boolean;
  ultimo_envio?: string;
  created_at: string;
}

interface Conexao {
  meta_token: string;
  evolution_url: string;
  evolution_key: string;
  whatsapp_instancia: string;
  whatsapp_conectado: boolean;
  meta_nome?: string;
}

interface ContaAnuncio { id: string; name: string; }
interface GrupoWA { id: string; subject: string; size: number; }

const TEMPLATE_PADRAO = `📊 *Relatório de Campanhas — Meta ADS*
Cliente: <CA>
Período analisado: <DATA>

📊 *Visão Geral de Performance*
*Impressões*: <IMP>
*Alcance*: <ALCAN>
*Cliques no link*: <CLIQ>
*Frequência*: <FREQUENCIA>
*CTR (Taxa de Clique)*: <CTR>
*CPM (Custo por Mil Impressões)*: <CPM>
_Indicadores gerais de atenção e interesse gerado pela comunicação._

💬 *Resultados de Conversação / Leads*
*Conversas iniciadas*: <ALL_LEADS>
*Custo por conversa*: <ALL_LEADS_COST>
*Taxa de Conversão Clique → Conversa*: <CONV_MSG_CLICK>
_Eficiência em transformar visitantes em potenciais clientes._

🎨 *Top 3 criativos*:
{{top_3_creatives_ranking}}

💰 *Investimento*
*Valor investido*: <INV>
*Saldo atual*: <SALDO>

📈 *Relatório Completo em Dashboard*
<LINK_DASH>

💬 *Seu Feedback é Importante*
1. Como está a qualidade desses leads, qualificados?
2. Tivemos alguma boa negociação em andamento?`;

const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "ultima_semana", label: "Última semana (Dom - Sab)" },
  { value: "ultimos_7_dias", label: "Últimos 7 dias" },
  { value: "mes_atual", label: "Mês atual" },
];

const FREQUENCIAS = [
  { value: "manual", label: "Manual" },
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
];

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const VARIAVEIS = [
  { var: "<CA>", desc: "Nome do cliente" },
  { var: "<DATA>", desc: "Período analisado" },
  { var: "<IMP>", desc: "Impressões" },
  { var: "<ALCAN>", desc: "Alcance" },
  { var: "<CLIQ>", desc: "Cliques no link" },
  { var: "<FREQUENCIA>", desc: "Frequência" },
  { var: "<CTR>", desc: "Taxa de clique" },
  { var: "<CPM>", desc: "Custo por mil impressões" },
  { var: "<ALL_LEADS>", desc: "Conversas/leads" },
  { var: "<ALL_LEADS_COST>", desc: "Custo por conversa" },
  { var: "<CONV_MSG_CLICK>", desc: "Conversão clique → conversa" },
  { var: "{{top_3_creatives_ranking}}", desc: "Top 3 criativos" },
  { var: "<INV>", desc: "Valor investido" },
  { var: "<SALDO>", desc: "Saldo atual" },
  { var: "<LINK_DASH>", desc: "Link do dashboard visual" },
];

export default function RelatoriosMetaPage() {
  const router = useRouter();
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "pausado">("todos");
  const [filtroFreq, setFiltroFreq] = useState("");

  // Conexão
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [contas, setContas] = useState<ContaAnuncio[]>([]);
  const [grupos, setGrupos] = useState<GrupoWA[]>([]);
  const [loadingContas, setLoadingContas] = useState(false);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  // Modal
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Relatorio | null>(null);

  // Form
  const [nome, setNome] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [grupoNome, setGrupoNome] = useState("");
  const [contatoNumero, setContatoNumero] = useState("");
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [periodo, setPeriodo] = useState("hoje");
  const [frequencia, setFrequencia] = useState("diario");
  const [horarioEnvio, setHorarioEnvio] = useState("17:30");
  const [diaSemana, setDiaSemana] = useState(1);
  const [destinoTipo, setDestinoTipo] = useState<"grupo" | "contato">("grupo");
  const [salvando, setSalvando] = useState(false);

  // Preview
  const [previewMsg, setPreviewMsg] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Envio
  const [enviando, setEnviando] = useState<string | null>(null);

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    const agId = await getAgenciaId();

    // Carregar conexão do módulo de relatórios (só usa as conexões próprias)
    const { data: con } = await supabase
      .from("relatorios_conexoes")
      .select("*")
      .eq("agencia_id", agId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (con) {
      setConexao(con);
      if (con.meta_token) carregarContas(con.meta_token);

      // Grupos: só do WhatsApp conectado neste módulo
      if (con.evolution_url && con.evolution_key && con.whatsapp_instancia) {
        carregarGrupos(con.evolution_url, con.evolution_key, con.whatsapp_instancia);
      }
    }

    // Carregar relatórios
    const { data } = await supabase
      .from("relatorios")
      .select("*")
      .eq("agencia_id", agId!)
      .order("created_at", { ascending: false });
    setRelatorios(data || []);
    setLoading(false);
  }

  async function carregarContas(token: string) {
    setLoadingContas(true);
    try {
      const res = await fetch("/api/meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listar_contas", token }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setContas(data);
    } catch {}
    setLoadingContas(false);
  }

  async function carregarGrupos(url: string, key: string, instancia: string) {
    setLoadingGrupos(true);
    try {
      const res = await fetch(`${url}/chat/findChats/${instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const allChats = Array.isArray(json) ? json : [];

      // Grupos estão no campo remoteJid com @g.us
      const gruposFiltrados = allChats
        .filter((c: any) => (c.remoteJid || c.id || "").includes("@g.us"))
        .map((c: any) => ({
          id: c.remoteJid || c.id,
          subject: c.pushName || c.name || c.subject || c.remoteJid || c.id,
          size: c.size || 0,
        }))
        .sort((a: any, b: any) => a.subject.localeCompare(b.subject));

      setGrupos(gruposFiltrados);
    } catch (e) {
      console.error("Erro ao carregar grupos:", e);
    }
    setLoadingGrupos(false);
  }

  function abrirModal(rel?: Relatorio) {
    if (rel) {
      setEditando(rel);
      setNome(rel.nome);
      setNomeCliente(rel.nome_cliente);
      setAdAccountId(rel.ad_account_id);
      setGrupoId(rel.grupo_id || "");
      setGrupoNome(rel.grupo_nome || "");
      setContatoNumero(rel.contato_numero || "");
      setTemplate(rel.template);
      setPeriodo(rel.periodo);
      setFrequencia(rel.frequencia);
      setHorarioEnvio(rel.horario_envio || "17:30");
      setDiaSemana(rel.dia_semana ?? 1);
      setDestinoTipo(rel.grupo_id ? "grupo" : "contato");
    } else {
      setEditando(null);
      setNome("");
      setNomeCliente("");
      setAdAccountId("");
      setGrupoId("");
      setGrupoNome("");
      setContatoNumero("");
      setTemplate(TEMPLATE_PADRAO);
      setPeriodo("hoje");
      setFrequencia("diario");
      setHorarioEnvio("17:30");
      setDiaSemana(1);
      setDestinoTipo("grupo");
    }
    setShowPreview(false);
    setPreviewMsg("");
    setModal(true);
  }

  async function salvar() {
    if (!nome.trim() || !nomeCliente.trim() || !adAccountId.trim()) {
      alert("Preencha nome, cliente e conta de anúncio"); return;
    }
    if (destinoTipo === "grupo" && !grupoId) { alert("Selecione um grupo"); return; }
    if (destinoTipo === "contato" && !contatoNumero) { alert("Informe o número"); return; }

    setSalvando(true);
    const agId = await getAgenciaId();
    const payload = {
      agencia_id: agId,
      nome,
      nome_cliente: nomeCliente,
      ad_account_id: adAccountId,
      meta_token: conexao?.meta_token || null,
      grupo_id: destinoTipo === "grupo" ? grupoId : null,
      grupo_nome: destinoTipo === "grupo" ? grupoNome : null,
      contato_numero: destinoTipo === "contato" ? contatoNumero : null,
      template,
      periodo,
      frequencia,
      horario_envio: horarioEnvio,
      dia_semana: frequencia === "semanal" ? diaSemana : null,
      ativo: true,
    };

    if (editando) {
      await supabase.from("relatorios").update(payload).eq("id", editando.id);
    } else {
      await supabase.from("relatorios").insert(payload);
    }

    setSalvando(false);
    setModal(false);
    carregarTudo();
  }

  async function deletar(id: string) {
    if (!confirm("Deletar este relatório?")) return;
    await supabase.from("relatorios").delete().eq("id", id);
    carregarTudo();
  }

  async function toggleAtivo(rel: Relatorio) {
    await supabase.from("relatorios").update({ ativo: !rel.ativo }).eq("id", rel.id);
    carregarTudo();
  }

  async function enviarAgora(rel: Relatorio) {
    setEnviando(rel.id);
    try {
      const res = await fetch("/api/relatorios/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatorio_id: rel.id }),
      });
      const data = await res.json();
      if (data.success) { alert("Relatório enviado!"); carregarTudo(); }
      else alert(data.error || "Erro ao enviar");
    } catch { alert("Erro ao enviar"); }
    setEnviando(null);
  }

  async function verPreview() {
    if (!adAccountId) { alert("Selecione uma conta de anúncio"); return; }
    setPreviewLoading(true);
    setShowPreview(true);

    const agId = await getAgenciaId();
    let relId = editando?.id;

    if (!relId) {
      const { data } = await supabase.from("relatorios").insert({
        agencia_id: agId, nome: nome || "Preview", nome_cliente: nomeCliente || "Cliente",
        ad_account_id: adAccountId, meta_token: conexao?.meta_token || null, template, periodo, frequencia: "manual", ativo: false,
      }).select("id").single();
      relId = data?.id;
    } else {
      await supabase.from("relatorios").update({
        nome_cliente: nomeCliente, ad_account_id: adAccountId,
        meta_token: conexao?.meta_token || null, template, periodo,
      }).eq("id", relId);
    }

    if (!relId) { setPreviewLoading(false); alert("Erro"); return; }

    try {
      const res = await fetch("/api/relatorios/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatorio_id: relId, preview: true }),
      });
      const data = await res.json();
      setPreviewMsg(data.mensagem || data.error || "Erro");
    } catch { setPreviewMsg("Erro ao conectar"); }

    if (!editando) await supabase.from("relatorios").delete().eq("id", relId);
    setPreviewLoading(false);
  }

  async function duplicar(rel: Relatorio) {
    const agId = await getAgenciaId();
    const { id, created_at, ultimo_envio, ...rest } = rel;
    await supabase.from("relatorios").insert({ ...rest, agencia_id: agId, nome: `${rel.nome} (cópia)`, ativo: false });
    carregarTudo();
  }

  const filtrados = relatorios.filter(r => {
    if (busca && !r.nome.toLowerCase().includes(busca.toLowerCase()) && !r.nome_cliente.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroStatus === "ativo" && !r.ativo) return false;
    if (filtroStatus === "pausado" && r.ativo) return false;
    if (filtroFreq && r.frequencia !== filtroFreq) return false;
    return true;
  });

  const fmtData = (d?: string) => {
    if (!d) return "—";
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")} - ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };

  const semConexao = !conexao?.meta_token;
  const semWhatsApp = !conexao?.evolution_url || !conexao?.whatsapp_instancia;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span className="current">Relatórios Meta</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Relatórios</h1>
        <button className="btn-primary" onClick={() => abrirModal()} disabled={semConexao}
          style={{ cursor: semConexao ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: semConexao ? 0.5 : 1 }}>
          <Plus size={14} /> Criar Relatório
        </button>
      </div>

      {/* Alerta sem conexão */}
      {semConexao && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: "10px", padding: "16px 20px", marginBottom: "20px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <AlertCircle size={18} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>Configure suas conexões primeiro</p>
            <p style={{ fontSize: "12px", color: "#a0a0a0" }}>
              Acesse <a href="/relatorios-meta/conexoes" style={{ color: "#29ABE2", textDecoration: "underline" }}>Conexões</a> para conectar o Facebook e o WhatsApp antes de criar relatórios.
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
          <input className="form-input" placeholder="Pesquisar..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: "34px" }} />
        </div>
        <select className="form-input" style={{ width: "160px" }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="pausado">Pausados</option>
        </select>
        <select className="form-input" style={{ width: "160px" }} value={filtroFreq} onChange={e => setFiltroFreq(e.target.value)}>
          <option value="">Todas frequências</option>
          {FREQUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <span style={{ fontSize: "12px", color: "#606060" }}>{filtrados.length} registro(s)</span>
      </div>

      {/* Tabela */}
      {loading ? (
        <p style={{ color: "#606060", fontSize: "13px" }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <FileText size={32} style={{ color: "#3a3a3a", margin: "0 auto 12px" }} />
          <p style={{ color: "#606060", fontSize: "14px" }}>Nenhum relatório criado ainda.</p>
          {!semConexao && (
            <button className="btn-primary" onClick={() => abrirModal()} style={{ cursor: "pointer", marginTop: "12px" }}>
              <Plus size={14} /> Criar primeiro relatório
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2e2e2e" }}>
                {["Status", "Criação", "Nome", "Cliente", "Destino", "Frequência", "Período", "Último envio", "Ações"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", color: "#606060", fontWeight: "600" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(rel => (
                <tr key={rel.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: rel.ativo ? "#22c55e" : "#ef4444" }} />
                  </td>
                  <td style={{ padding: "10px 14px", color: "#606060", fontSize: "12px" }}>{fmtData(rel.created_at)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: "600", color: "#f0f0f0" }}>{rel.nome}</td>
                  <td style={{ padding: "10px 14px", color: "#a0a0a0" }}>
                    {rel.nome_cliente}
                    <br /><span style={{ fontSize: "11px", color: "#606060" }}>{rel.ad_account_id}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#a0a0a0", fontSize: "12px" }}>{rel.grupo_nome || rel.contato_numero || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
                      background: rel.frequencia === "diario" ? "rgba(41,171,226,0.1)" : rel.frequencia === "semanal" ? "rgba(245,158,11,0.1)" : "rgba(160,160,160,0.1)",
                      color: rel.frequencia === "diario" ? "#29ABE2" : rel.frequencia === "semanal" ? "#f59e0b" : "#a0a0a0",
                    }}>{FREQUENCIAS.find(f => f.value === rel.frequencia)?.label || rel.frequencia}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#a0a0a0", fontSize: "12px" }}>{PERIODOS.find(p => p.value === rel.periodo)?.label || rel.periodo}</td>
                  <td style={{ padding: "10px 14px", color: "#606060", fontSize: "12px" }}>{fmtData(rel.ultimo_envio)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => enviarAgora(rel)} disabled={enviando === rel.id} title="Enviar agora"
                        style={{ background: "rgba(41,171,226,0.1)", border: "1px solid rgba(41,171,226,0.2)", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#29ABE2" }}>
                        {enviando === rel.id ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
                      </button>
                      <button onClick={() => router.push(`/relatorios-meta/dashboard?id=${rel.id}`)} title="Dashboard"
                        style={{ background: "rgba(41,171,226,0.1)", border: "1px solid rgba(41,171,226,0.2)", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#29ABE2" }}>
                        <BarChart2 size={13} />
                      </button>
                      <button onClick={() => abrirModal(rel)} title="Editar"
                        style={{ background: "rgba(160,160,160,0.1)", border: "1px solid #2e2e2e", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#a0a0a0" }}>
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => toggleAtivo(rel)} title={rel.ativo ? "Pausar" : "Ativar"}
                        style={{ background: "rgba(160,160,160,0.1)", border: "1px solid #2e2e2e", borderRadius: "6px", padding: "6px", cursor: "pointer", color: rel.ativo ? "#f59e0b" : "#22c55e" }}>
                        {rel.ativo ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                      <button onClick={() => duplicar(rel)} title="Duplicar"
                        style={{ background: "rgba(160,160,160,0.1)", border: "1px solid #2e2e2e", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#a0a0a0" }}>
                        <Copy size={13} />
                      </button>
                      <button onClick={() => deletar(rel.id)} title="Deletar"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#ef4444" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999,
          display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 20px", overflowY: "auto",
        }}>
          <div style={{
            background: "#141414", border: "1px solid #2e2e2e", borderRadius: "12px",
            width: "100%", maxWidth: "900px", padding: "28px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600" }}>{editando ? "Editar Relatório" : "Criar Relatório"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#606060" }}><X size={20} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div className="form-group">
                <label className="form-label">Nome do relatório</label>
                <input className="form-input" placeholder="Ex: RELATÓRIO FULANA" value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Nome do cliente</label>
                <input className="form-input" placeholder="Ex: Adriana - Tráfego Pago" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
              </div>
            </div>

            {/* Conta de anúncio — já puxa do Facebook conectado */}
            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label className="form-label">Conta de Anúncio</label>
              {loadingContas ? (
                <p style={{ fontSize: "12px", color: "#606060" }}>Carregando contas do Facebook...</p>
              ) : contas.length === 0 ? (
                <div>
                  <input className="form-input" placeholder="act_1234567890" value={adAccountId} onChange={e => setAdAccountId(e.target.value)} />
                  <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Nenhuma conta encontrada. Verifique a conexão em <a href="/relatorios-meta/conexoes" style={{ color: "#29ABE2" }}>Conexões</a>.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                  {contas.map(c => (
                    <button key={c.id} onClick={() => setAdAccountId(c.id)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 14px", background: adAccountId === c.id ? "rgba(41,171,226,0.1)" : "#1a1a1a",
                        border: `1px solid ${adAccountId === c.id ? "#29ABE2" : "#2e2e2e"}`,
                        borderRadius: "8px", cursor: "pointer", textAlign: "left", color: "#f0f0f0", fontSize: "12px",
                      }}>
                      <span style={{ fontWeight: adAccountId === c.id ? "600" : "400" }}>{c.name}</span>
                      <span style={{ color: "#606060", fontSize: "11px" }}>{c.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destino WhatsApp — puxa grupos da conexão */}
            <div style={{ marginBottom: "20px" }}>
              <label className="form-label">Enviar para</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <button onClick={() => setDestinoTipo("grupo")} style={{
                  padding: "6px 16px", borderRadius: "6px", fontSize: "12px", cursor: "pointer",
                  background: destinoTipo === "grupo" ? "rgba(41,171,226,0.15)" : "#1a1a1a",
                  border: `1px solid ${destinoTipo === "grupo" ? "#29ABE2" : "#2e2e2e"}`, color: destinoTipo === "grupo" ? "#29ABE2" : "#a0a0a0",
                }}><MessageCircle size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} /> Grupo</button>
                <button onClick={() => setDestinoTipo("contato")} style={{
                  padding: "6px 16px", borderRadius: "6px", fontSize: "12px", cursor: "pointer",
                  background: destinoTipo === "contato" ? "rgba(41,171,226,0.15)" : "#1a1a1a",
                  border: `1px solid ${destinoTipo === "contato" ? "#29ABE2" : "#2e2e2e"}`, color: destinoTipo === "contato" ? "#29ABE2" : "#a0a0a0",
                }}>Contato</button>
              </div>

              {destinoTipo === "grupo" ? (
                loadingGrupos ? (
                  <p style={{ fontSize: "12px", color: "#606060" }}>Carregando grupos...</p>
                ) : grupos.length === 0 ? (
                  <div>
                    {semWhatsApp ? (
                      <p style={{ fontSize: "12px", color: "#f59e0b" }}>
                        WhatsApp não conectado. Conecte em <a href="/relatorios-meta/conexoes" style={{ color: "#29ABE2", textDecoration: "underline" }}>Conexões</a> primeiro.
                      </p>
                    ) : (
                      <>
                        <input className="form-input" placeholder="ID do grupo" value={grupoId} onChange={e => setGrupoId(e.target.value)} />
                        <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Nenhum grupo encontrado. Verifique a conexão em <a href="/relatorios-meta/conexoes" style={{ color: "#29ABE2" }}>Conexões</a>.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                    {grupos.map(g => (
                      <button key={g.id} onClick={() => { setGrupoId(g.id); setGrupoNome(g.subject); }}
                        style={{
                          display: "flex", justifyContent: "space-between", padding: "10px 14px",
                          background: grupoId === g.id ? "rgba(41,171,226,0.1)" : "#1a1a1a",
                          border: `1px solid ${grupoId === g.id ? "#29ABE2" : "#2e2e2e"}`,
                          borderRadius: "8px", cursor: "pointer", textAlign: "left", color: "#f0f0f0", fontSize: "12px",
                        }}>
                        <span style={{ fontWeight: grupoId === g.id ? "600" : "400" }}>{g.subject}</span>
                        <span style={{ color: "#606060", fontSize: "11px" }}>{g.size} membros</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <input className="form-input" placeholder="5511999999999" value={contatoNumero} onChange={e => setContatoNumero(e.target.value)} />
              )}
            </div>

            {/* Agendamento */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div className="form-group">
                <label className="form-label">Período dos dados</label>
                <select className="form-input" value={periodo} onChange={e => setPeriodo(e.target.value)}>
                  {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequência de envio</label>
                <select className="form-input" value={frequencia} onChange={e => setFrequencia(e.target.value)}>
                  {FREQUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Horário de envio</label>
                <input className="form-input" type="time" value={horarioEnvio} onChange={e => setHorarioEnvio(e.target.value)} />
              </div>
            </div>

            {frequencia === "semanal" && (
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label">Dia da semana</label>
                <select className="form-input" style={{ width: "200px" }} value={diaSemana} onChange={e => setDiaSemana(Number(e.target.value))}>
                  {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}

            {/* Template */}
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label className="form-label">Template da mensagem</label>
              <textarea className="form-input" rows={16} value={template} onChange={e => setTemplate(e.target.value)}
                style={{ resize: "vertical", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.6" }} />
            </div>

            {/* Variáveis */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "#a0a0a0", marginBottom: "8px" }}>Variáveis (clique para inserir):</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {VARIAVEIS.map(v => (
                  <button key={v.var} onClick={() => setTemplate(t => t + v.var)} title={v.desc}
                    style={{
                      padding: "3px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer",
                      background: "rgba(41,171,226,0.1)", border: "1px solid rgba(41,171,226,0.2)",
                      color: "#29ABE2", fontFamily: "monospace",
                    }}>{v.var}</button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div style={{ background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: "8px", padding: "16px", marginBottom: "20px", maxHeight: "300px", overflowY: "auto" }}>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#29ABE2", marginBottom: "8px" }}>Preview:</p>
                {previewLoading ? (
                  <p style={{ color: "#606060", fontSize: "12px" }}>Gerando...</p>
                ) : (
                  <pre style={{ fontSize: "12px", color: "#d0d0d0", whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: "1.6", margin: 0 }}>{previewMsg}</pre>
                )}
              </div>
            )}

            {/* Ações */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setModal(false)} style={{ cursor: "pointer" }}>Cancelar</button>
              <button className="btn-secondary" onClick={verPreview} disabled={previewLoading} style={{ cursor: "pointer" }}>
                <Eye size={13} /> Preview
              </button>
              <button className="btn-primary" onClick={salvar} disabled={salvando} style={{ cursor: "pointer" }}>
                <Check size={14} /> {salvando ? "Salvando..." : editando ? "Salvar" : "Criar relatório"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
