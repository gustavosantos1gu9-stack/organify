"use client";

import { useState, useEffect } from "react";
import { Bot, Save, Power, Clock, MessageSquare, Zap, Brain, Plus, Trash2, Check, Send, Loader2, Calendar, Video, MapPin, Link2 } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

export default function SecretariaIAPage() {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [agId, setAgId] = useState("");
  const [nomeAgencia, setNomeAgencia] = useState("");

  // Config
  const [ativo, setAtivo] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [temperatura, setTemperatura] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [contexto, setContexto] = useState(10);
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");

  // Prompt estruturado
  const [nomeSecretaria, setNomeSecretaria] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [segmento, setSegmento] = useState("");
  const [servicos, setServicos] = useState<string[]>([""]);
  const [precos, setPrecos] = useState<string[]>([""]);
  const [horarioAtendimento, setHorarioAtendimento] = useState("");
  const [endereco, setEndereco] = useState("");
  const [regras, setRegras] = useState<string[]>([
    "Seja educada, simpática e profissional",
    "Nunca invente informações que não foram fornecidas",
    "Se não souber algo, diga que vai verificar com a equipe",
    "Tente sempre agendar um horário para o cliente",
    "Não envie links ou URLs",
  ]);
  const [objetivoPrincipal, setObjetivoPrincipal] = useState("agendamento");
  const [tom, setTom] = useState("profissional");
  const [instrucaoExtra, setInstrucaoExtra] = useState("");
  const [promptFinal, setPromptFinal] = useState("");

  // Agendamento
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);
  const [googleCalEmail, setGoogleCalEmail] = useState("");
  const [googleCalAtivo, setGoogleCalAtivo] = useState(false);
  const [reuniaoTipo, setReuniaoTipo] = useState("google_meet");
  const [reuniaoLinkCustom, setReuniaoLinkCustom] = useState("");
  const [reuniaoDuracao, setReuniaooDuracao] = useState(60);
  const [reuniaoHorarioInicio, setReuniaoHorarioInicio] = useState("09:00");
  const [reuniaoHorarioFim, setReuniaoHorarioFim] = useState("18:00");
  const [reuniaoDias, setReuniaDias] = useState([1,2,3,4,5]);
  const [reuniaoIntervalo, setReuniaoIntervalo] = useState(0);

  // Follow-up
  const [followupAtivo, setFollowupAtivo] = useState(false);
  const [followupEtapas, setFollowupEtapas] = useState<{
    id?: string; ordem: number; nome: string; delay_minutos: number;
    tipo_mensagem: string; texto_template: string; prompt_ia: string;
    midia_url: string; midia_tipo: string; ativo: boolean;
  }[]>([]);
  const [salvandoFollowup, setSalvandoFollowup] = useState(false);

  // Chat de teste
  const [testMsgs, setTestMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  const [promptEditadoManualmente, setPromptEditadoManualmente] = useState(false);

  useEffect(() => { carregar(); }, []);

  // Gerar prompt automaticamente quando os campos mudam (só se não editou manualmente)
  useEffect(() => {
    if (promptEditadoManualmente) return;
    const prompt = gerarPrompt();
    setPromptFinal(prompt);
  }, [nomeSecretaria, nomeEmpresa, segmento, servicos, precos, horarioAtendimento, endereco, regras, objetivoPrincipal, tom, instrucaoExtra]);

  function gerarPrompt() {
    const obj: Record<string, string> = {
      agendamento: "Seu objetivo principal é agendar horários para os clientes. Sempre tente conduzir a conversa para um agendamento.",
      qualificacao: "Seu objetivo principal é qualificar o lead. Faça perguntas para entender o que ele precisa e se o serviço é adequado.",
      atendimento: "Seu objetivo principal é atender o cliente, responder dúvidas e fornecer informações sobre os serviços.",
      vendas: "Seu objetivo principal é vender. Destaque os benefícios, tire objeções e conduza para o fechamento.",
    };
    const tons: Record<string, string> = {
      profissional: "Use um tom profissional e cordial.",
      informal: "Use um tom informal e descontraído, como se fosse uma amiga.",
      formal: "Use um tom formal e respeitoso.",
      entusiasmado: "Use um tom entusiasmado e animado, transmitindo energia positiva.",
    };

    let p = `Você é ${nomeSecretaria || "a secretária virtual"} da ${nomeEmpresa || "empresa"}`;
    if (segmento) p += `, especializada em ${segmento}`;
    p += ".\n\n";

    p += `${tons[tom] || tons.profissional}\n`;
    p += `${obj[objetivoPrincipal] || obj.agendamento}\n\n`;

    const servicosValidos = servicos.filter(s => s.trim());
    if (servicosValidos.length) {
      p += "SERVIÇOS OFERECIDOS:\n";
      servicosValidos.forEach(s => { p += `- ${s}\n`; });
      p += "\n";
    }

    const precosValidos = precos.filter(s => s.trim());
    if (precosValidos.length) {
      p += "PREÇOS/VALORES:\n";
      precosValidos.forEach(s => { p += `- ${s}\n`; });
      p += "\n";
    }

    if (horarioAtendimento) p += `HORÁRIO DE ATENDIMENTO: ${horarioAtendimento}\n\n`;
    if (endereco) p += `ENDEREÇO/LOCAL: ${endereco}\n\n`;

    const regrasValidas = regras.filter(s => s.trim());
    if (regrasValidas.length) {
      p += "REGRAS IMPORTANTES:\n";
      regrasValidas.forEach(s => { p += `- ${s}\n`; });
      p += "\n";
    }

    if (instrucaoExtra) p += `INSTRUÇÕES ADICIONAIS:\n${instrucaoExtra}\n`;

    return p.trim();
  }

  async function carregar() {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);
    const { data } = await supabase.from("agencias").select("*").eq("id", id).single();
    if (data) {
      setNomeAgencia(data.nome || "");
      setAtivo(data.openai_ativo || false);
      setApiKey(data.openai_key || "");
      setModelo(data.openai_modelo || "gpt-4o-mini");
      setTemperatura(Number(data.openai_temperatura) || 0.7);
      setMaxTokens(data.openai_max_tokens || 500);
      setContexto(data.openai_contexto_mensagens || 10);
      setHorarioInicio(data.openai_horario_inicio || "");
      setHorarioFim(data.openai_horario_fim || "");

      // Se já tem prompt salvo, usar ele e marcar como editado manualmente
      const prompt = data.openai_prompt_sistema || "";
      if (prompt) {
        setPromptFinal(prompt);
        setPromptEditadoManualmente(true);
        const matchNome = prompt.match(/Você é (.+?) da /);
        if (matchNome) setNomeSecretaria(matchNome[1]);
        const matchEmpresa = prompt.match(/da (.+?)[\.,\n]/);
        if (matchEmpresa) setNomeEmpresa(matchEmpresa[1]);
      }
      setFollowupAtivo(data.followup_ativo || false);
      setAgendamentoAtivo(data.agendamento_ativo || false);
      setGoogleCalEmail(data.google_calendar_email || "");
      setGoogleCalAtivo(data.google_calendar_ativo || false);
      setReuniaoTipo(data.reuniao_tipo || "google_meet");
      setReuniaoLinkCustom(data.reuniao_link_customizado || "");
      setReuniaooDuracao(data.reuniao_duracao_minutos || 60);
      setReuniaoHorarioInicio(data.reuniao_horario_inicio || "09:00");
      setReuniaoHorarioFim(data.reuniao_horario_fim || "18:00");
      setReuniaDias(data.reuniao_dias_semana || [1,2,3,4,5]);
      setReuniaoIntervalo(data.reuniao_intervalo_minutos || 0);

      // Detectar retorno do Google OAuth
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("google_success") === "true") {
          setGoogleCalAtivo(true);
          window.history.replaceState({}, "", "/secretaria-ia");
        }
      }
    }
    // Carregar etapas de follow-up
    const { data: etapas } = await supabase.from("followup_etapas")
      .select("*").eq("agencia_id", id).order("ordem", { ascending: true });
    if (etapas?.length) setFollowupEtapas(etapas.map((e: any) => ({
      id: e.id, ordem: e.ordem, nome: e.nome || "", delay_minutos: e.delay_minutos,
      tipo_mensagem: e.tipo_mensagem || "template", texto_template: e.texto_template || "",
      prompt_ia: e.prompt_ia || "", midia_url: e.midia_url || "", midia_tipo: e.midia_tipo || "",
      ativo: e.ativo,
    })));
    setLoading(false);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await supabase.from("agencias").update({
        openai_key: apiKey, openai_ativo: ativo, openai_modelo: modelo,
        openai_prompt_sistema: promptFinal,
        openai_max_tokens: maxTokens, openai_temperatura: temperatura,
        openai_contexto_mensagens: contexto,
        openai_horario_inicio: horarioInicio || null, openai_horario_fim: horarioFim || null,
        agendamento_ativo: agendamentoAtivo,
        reuniao_tipo: reuniaoTipo,
        reuniao_link_customizado: reuniaoLinkCustom || null,
        reuniao_duracao_minutos: reuniaoDuracao,
        reuniao_horario_inicio: reuniaoHorarioInicio,
        reuniao_horario_fim: reuniaoHorarioFim,
        reuniao_dias_semana: reuniaoDias,
        reuniao_intervalo_minutos: reuniaoIntervalo,
      }).eq("id", agId);
      alert("Secretária IA salva!");
    } catch { alert("Erro ao salvar"); }
    setSalvando(false);
  }

  async function salvarFollowup() {
    setSalvandoFollowup(true);
    try {
      await supabase.from("agencias").update({ followup_ativo: followupAtivo }).eq("id", agId);
      // Deletar etapas antigas e inserir novas
      await supabase.from("followup_etapas").delete().eq("agencia_id", agId);
      if (followupEtapas.length) {
        await supabase.from("followup_etapas").insert(
          followupEtapas.map((e, i) => ({
            agencia_id: agId, ordem: i + 1, nome: e.nome,
            delay_minutos: e.delay_minutos, tipo_mensagem: e.tipo_mensagem,
            texto_template: e.texto_template || null, prompt_ia: e.prompt_ia || null,
            midia_url: e.midia_url || null, midia_tipo: e.midia_tipo || null,
            ativo: e.ativo,
          }))
        );
      }
      alert("Follow-up salvo!");
    } catch { alert("Erro ao salvar follow-up"); }
    setSalvandoFollowup(false);
  }

  function addEtapa() {
    setFollowupEtapas(prev => [...prev, {
      ordem: prev.length + 1, nome: `Follow-up ${prev.length + 1}`,
      delay_minutos: prev.length === 0 ? 120 : 1440,
      tipo_mensagem: "template", texto_template: "", prompt_ia: "",
      midia_url: "", midia_tipo: "", ativo: true,
    }]);
  }

  function removeEtapa(idx: number) {
    setFollowupEtapas(prev => prev.filter((_, i) => i !== idx));
  }

  function updateEtapa(idx: number, campo: string, valor: any) {
    setFollowupEtapas(prev => prev.map((e, i) => i === idx ? { ...e, [campo]: valor } : e));
  }

  function fmtDelay(min: number) {
    if (min < 60) return `${min}min`;
    if (min < 1440) return `${(min / 60).toFixed(0)}h`;
    return `${(min / 1440).toFixed(0)}d`;
  }

  async function testar() {
    if (!testInput.trim() || !apiKey) { if (!apiKey) alert("Preencha a API Key primeiro"); return; }
    const userMsg = testInput.trim();
    setTestInput("");
    const novasMsgs = [...testMsgs, { role: "user" as const, content: userMsg }];
    setTestMsgs(novasMsgs);
    setTestLoading(true);
    try {
      const isAnthropic = apiKey.startsWith("sk-ant-");
      let resposta = "";

      if (isAnthropic) {
        const chatMsgs = novasMsgs.map(m => ({ role: m.role, content: m.content }));
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: modelo, system: promptFinal, messages: chatMsgs,
            max_tokens: maxTokens, temperature: temperatura,
          }),
        });
        const data = await res.json();
        if (data.error) { alert("Erro: " + data.error.message); setTestLoading(false); return; }
        resposta = data.content?.[0]?.text?.trim() || "Sem resposta";
      } else {
        const messages = [
          { role: "system", content: promptFinal },
          ...novasMsgs.map(m => ({ role: m.role, content: m.content })),
        ];
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelo, messages, max_tokens: maxTokens, temperature: temperatura }),
        });
        const data = await res.json();
        if (data.error) { alert("Erro: " + data.error.message); setTestLoading(false); return; }
        resposta = data.choices?.[0]?.message?.content?.trim() || "Sem resposta";
      }
      setTestMsgs([...novasMsgs, { role: "assistant", content: resposta }]);
    } catch (e: any) { alert("Erro: " + e.message); }
    setTestLoading(false);
  }

  const addItem = (arr: string[], set: (v: string[]) => void) => set([...arr, ""]);
  const updateItem = (arr: string[], set: (v: string[]) => void, idx: number, val: string) => { const n = [...arr]; n[idx] = val; set(n); };
  const removeItem = (arr: string[], set: (v: string[]) => void, idx: number) => set(arr.filter((_, i) => i !== idx));

  const inputStyle: React.CSSProperties = { background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "9px 12px", color: "#f0f0f0", fontSize: 13, width: "100%", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "#a0a0a0", marginBottom: 4, display: "block" };
  const cardStyle: React.CSSProperties = { background: "#141414", border: "1px solid #2e2e2e", borderRadius: 12, padding: 20, marginBottom: 16 };

  if (loading) return <div style={{ padding: 40, color: "#606060" }}>Carregando...</div>;

  return (
    <div className="animate-in" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span className="current">Secretária IA</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Secretária IA</h1>
          <p style={{ fontSize: 13, color: "#606060", margin: "4px 0 0" }}>{nomeAgencia}</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, padding: "8px 14px", borderRadius: 8, background: ativo ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${ativo ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, color: ativo ? "#22c55e" : "#ef4444" }}>
            <Power size={14} />
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} style={{ display: "none" }} />
            {ativo ? "Ativa" : "Desativada"}
          </label>
          <button onClick={salvar} disabled={salvando} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, border: "none", background: "#29ABE2", color: "#000", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Save size={14} /> {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Coluna esquerda — Configuração */}
        <div>
          {/* Identidade */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <Bot size={16} color="#29ABE2" /> Identidade
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nome da secretária</label>
                <input style={inputStyle} placeholder="Ex: Sofia, Ana, Bia..." value={nomeSecretaria} onChange={e => setNomeSecretaria(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Nome da empresa</label>
                <input style={inputStyle} placeholder="Ex: Studio Maria Beauty" value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Segmento</label>
                <input style={inputStyle} placeholder="Ex: micropigmentação, estética facial, remoção a laser" value={segmento} onChange={e => setSegmento(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Objetivo principal</label>
                  <select style={inputStyle} value={objetivoPrincipal} onChange={e => setObjetivoPrincipal(e.target.value)}>
                    <option value="agendamento">Agendar horários</option>
                    <option value="qualificacao">Qualificar leads</option>
                    <option value="atendimento">Atendimento geral</option>
                    <option value="vendas">Vendas</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tom de voz</label>
                  <select style={inputStyle} value={tom} onChange={e => setTom(e.target.value)}>
                    <option value="profissional">Profissional</option>
                    <option value="informal">Informal / Amiga</option>
                    <option value="formal">Formal</option>
                    <option value="entusiasmado">Entusiasmado</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Serviços e Preços */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={16} color="#f59e0b" /> Serviços e Preços
            </h3>
            <label style={labelStyle}>Serviços oferecidos</label>
            {servicos.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Ex: Micropigmentação labial" value={s} onChange={e => updateItem(servicos, setServicos, i, e.target.value)} />
                {servicos.length > 1 && <button onClick={() => removeItem(servicos, setServicos, i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>}
              </div>
            ))}
            <button onClick={() => addItem(servicos, setServicos)} style={{ background: "none", border: "1px dashed #2e2e2e", borderRadius: 6, padding: "6px 12px", color: "#606060", fontSize: 12, cursor: "pointer", width: "100%", marginBottom: 16 }}><Plus size={12} /> Adicionar serviço</button>

            <label style={labelStyle}>Preços / Valores</label>
            {precos.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Ex: Micropigmentação labial: R$ 800" value={s} onChange={e => updateItem(precos, setPrecos, i, e.target.value)} />
                {precos.length > 1 && <button onClick={() => removeItem(precos, setPrecos, i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>}
              </div>
            ))}
            <button onClick={() => addItem(precos, setPrecos)} style={{ background: "none", border: "1px dashed #2e2e2e", borderRadius: 6, padding: "6px 12px", color: "#606060", fontSize: 12, cursor: "pointer", width: "100%" }}><Plus size={12} /> Adicionar preço</button>
          </div>

          {/* Info */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color="#22c55e" /> Informações
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Horário de atendimento</label>
                <input style={inputStyle} placeholder="Ex: Segunda a sexta, 9h às 18h" value={horarioAtendimento} onChange={e => setHorarioAtendimento(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Endereço / Local</label>
                <input style={inputStyle} placeholder="Ex: Rua das Flores, 123 - Centro" value={endereco} onChange={e => setEndereco(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Regras */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <Brain size={16} color="#8b5cf6" /> Regras de Comportamento
            </h3>
            {regras.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Ex: Nunca fale mal de concorrentes" value={s} onChange={e => updateItem(regras, setRegras, i, e.target.value)} />
                <button onClick={() => removeItem(regras, setRegras, i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => addItem(regras, setRegras)} style={{ background: "none", border: "1px dashed #2e2e2e", borderRadius: 6, padding: "6px 12px", color: "#606060", fontSize: 12, cursor: "pointer", width: "100%", marginBottom: 12 }}><Plus size={12} /> Adicionar regra</button>

            <label style={labelStyle}>Instruções extras (opcional)</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} placeholder="Qualquer instrução adicional..." value={instrucaoExtra} onChange={e => setInstrucaoExtra(e.target.value)} />
          </div>
        </div>

        {/* Coluna direita — Preview e Config técnica */}
        <div>
          {/* Preview do prompt */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare size={16} color="#29ABE2" /> Preview do Prompt
            </h3>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 300, fontSize: 12, lineHeight: "1.6", fontFamily: "monospace" }}
              value={promptFinal} onChange={e => { setPromptFinal(e.target.value); setPromptEditadoManualmente(true); }} />
            <p style={{ fontSize: 11, color: "#606060", marginTop: 6 }}>Este é o prompt enviado para a IA. Edite diretamente se quiser ajustar.</p>
          </div>

          {/* Chat de teste */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={16} color="#22c55e" /> Testar Secretária
              </h3>
              {testMsgs.length > 0 && (
                <button onClick={() => setTestMsgs([])} style={{ background: "none", border: "none", color: "#606060", fontSize: 11, cursor: "pointer" }}>Limpar</button>
              )}
            </div>

            <div style={{ background: "#0d0d0d", borderRadius: 8, border: "1px solid #1e1e1e", minHeight: 200, maxHeight: 300, overflowY: "auto", padding: 12, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {testMsgs.length === 0 && (
                <p style={{ color: "#404040", fontSize: 12, textAlign: "center", margin: "auto 0" }}>Envie uma mensagem para testar a secretária</p>
              )}
              {testMsgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: "1.5",
                    background: m.role === "user" ? "#29ABE2" : "#1e1e1e",
                    color: m.role === "user" ? "#000" : "#f0f0f0",
                    borderBottomRightRadius: m.role === "user" ? 4 : 12,
                    borderBottomLeftRadius: m.role === "assistant" ? 4 : 12,
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {testLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#606060", fontSize: 12 }}>
                  <Loader2 size={14} className="spin" /> Digitando...
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Digite como se fosse um lead..."
                value={testInput} onChange={e => setTestInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !testLoading && testar()}
                disabled={testLoading} />
              <button onClick={testar} disabled={testLoading || !testInput.trim()}
                style={{ background: testInput.trim() ? "#29ABE2" : "#2e2e2e", border: "none", borderRadius: 8, padding: "0 14px", cursor: testInput.trim() ? "pointer" : "default", color: testInput.trim() ? "#000" : "#606060" }}>
                <Send size={14} />
              </button>
            </div>
            {!apiKey && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>Preencha a API Key para testar</p>}
          </div>

          {/* Config técnica */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 16px" }}>Configuração Técnica</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>API Key (OpenAI ou Anthropic)</label>
                <input style={inputStyle} type="password" placeholder="sk-... ou sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Modelo</label>
                  <select style={inputStyle} value={modelo} onChange={e => setModelo(e.target.value)}>
                    <optgroup label="OpenAI">
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                    </optgroup>
                    <optgroup label="Claude (Anthropic)">
                      <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (mais barato)</option>
                      <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Temperatura ({temperatura})</label>
                  <input type="range" min="0" max="1" step="0.1" value={temperatura} onChange={e => setTemperatura(Number(e.target.value))} style={{ width: "100%", accentColor: "#29ABE2", marginTop: 8 }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Max Tokens</label>
                  <input style={inputStyle} type="number" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>Contexto (msgs)</label>
                  <input style={inputStyle} type="number" value={contexto} onChange={e => setContexto(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>

          {/* Horário da IA */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color="#f59e0b" /> Horário da IA
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Início</label>
                <input style={inputStyle} type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Fim</label>
                <input style={inputStyle} type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#606060", marginTop: 8 }}>Se vazio, responde 24h. A IA pausa automaticamente quando um humano responde.</p>
          </div>

          {/* Agendamento Automático */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={16} color="#29ABE2" /> Agendamento Automático
              </h3>
              <button onClick={() => setAgendamentoAtivo(!agendamentoAtivo)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: agendamentoAtivo ? "#22c55e" : "#333", position: "relative", transition: "background 0.2s",
                }}>
                <span style={{
                  position: "absolute", top: 3, left: agendamentoAtivo ? 23 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s",
                }} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#606060", marginBottom: 16 }}>
              A IA consulta sua agenda e agenda reuniões automaticamente quando o lead quiser marcar.
            </p>

            {/* Google Calendar */}
            <div style={{ background: "#0d0d0d", borderRadius: 8, border: "1px solid #1e1e1e", padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={14} color={googleCalAtivo ? "#22c55e" : "#606060"} />
                  <span style={{ fontSize: 13, color: "#f0f0f0" }}>Google Calendar</span>
                  {googleCalAtivo && googleCalEmail && (
                    <span style={{ fontSize: 11, color: "#22c55e" }}>({googleCalEmail})</span>
                  )}
                </div>
                {googleCalAtivo ? (
                  <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 12, background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>Conectado</span>
                ) : (
                  <button onClick={() => window.location.href = `/api/auth/google?agencia_id=${agId}`}
                    style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid #29ABE2", background: "rgba(41,171,226,0.1)", color: "#29ABE2", cursor: "pointer" }}>
                    Conectar
                  </button>
                )}
              </div>
            </div>

            {/* Tipo de reunião */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Tipo de reunião</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {([
                  { key: "google_meet", label: "Google Meet", icon: <Video size={13} /> },
                  { key: "zoom", label: "Zoom", icon: <Video size={13} /> },
                  { key: "presencial", label: "Presencial", icon: <MapPin size={13} /> },
                  { key: "link_customizado", label: "Link personalizado", icon: <Link2 size={13} /> },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setReuniaoTipo(t.key)} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                    border: `1px solid ${reuniaoTipo === t.key ? "#29ABE2" : "#2e2e2e"}`,
                    background: reuniaoTipo === t.key ? "rgba(41,171,226,0.1)" : "#1a1a1a",
                    color: reuniaoTipo === t.key ? "#29ABE2" : "#a0a0a0",
                  }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {reuniaoTipo === "link_customizado" && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Link da reunião</label>
                <input style={inputStyle} placeholder="https://..." value={reuniaoLinkCustom} onChange={e => setReuniaoLinkCustom(e.target.value)} />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Duração</label>
                <select style={inputStyle} value={reuniaoDuracao} onChange={e => setReuniaooDuracao(Number(e.target.value))}>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Início</label>
                <input style={inputStyle} type="time" value={reuniaoHorarioInicio} onChange={e => setReuniaoHorarioInicio(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Fim</label>
                <input style={inputStyle} type="time" value={reuniaoHorarioFim} onChange={e => setReuniaoHorarioFim(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Dias disponíveis</label>
              <div style={{ display: "flex", gap: 4 }}>
                {(["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]).map((d, i) => (
                  <button key={i} onClick={() => setReuniaDias(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 500,
                      border: `1px solid ${reuniaoDias.includes(i) ? "#29ABE2" : "#2e2e2e"}`,
                      background: reuniaoDias.includes(i) ? "rgba(41,171,226,0.15)" : "#1a1a1a",
                      color: reuniaoDias.includes(i) ? "#29ABE2" : "#606060",
                    }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Intervalo entre reuniões</label>
              <select style={inputStyle} value={reuniaoIntervalo} onChange={e => setReuniaoIntervalo(Number(e.target.value))}>
                <option value={0}>Sem intervalo</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
              </select>
            </div>
          </div>

          {/* Follow-up Automático */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} color="#f59e0b" /> Follow-up Automático
              </h3>
              <button onClick={() => setFollowupAtivo(!followupAtivo)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: followupAtivo ? "#22c55e" : "#333", position: "relative", transition: "background 0.2s",
                }}>
                <span style={{
                  position: "absolute", top: 3, left: followupAtivo ? 23 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s",
                }} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#606060", marginBottom: 16 }}>
              Envia mensagens automaticamente quando o lead não responde. Para quando receber resposta.
            </p>

            {followupEtapas.map((etapa, idx) => (
              <div key={idx} style={{ background: "#0d0d0d", borderRadius: 8, border: "1px solid #1e1e1e", padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#a0a0a0" }}>Etapa {idx + 1}</span>
                  <button onClick={() => removeEtapa(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Nome (opcional)</label>
                    <input style={inputStyle} placeholder="Ex: Primeiro lembrete" value={etapa.nome} onChange={e => updateEtapa(idx, "nome", e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Carência ({fmtDelay(etapa.delay_minutos)})</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input style={{ ...inputStyle, width: 70 }} type="number" min="1"
                        value={etapa.delay_minutos < 60 ? etapa.delay_minutos : etapa.delay_minutos < 1440 ? etapa.delay_minutos / 60 : etapa.delay_minutos / 1440}
                        onChange={e => {
                          const v = Number(e.target.value) || 1;
                          const unit = etapa.delay_minutos < 60 ? 1 : etapa.delay_minutos < 1440 ? 60 : 1440;
                          updateEtapa(idx, "delay_minutos", v * unit);
                        }} />
                      <select style={{ ...inputStyle, width: 80 }}
                        value={etapa.delay_minutos < 60 ? "min" : etapa.delay_minutos < 1440 ? "h" : "d"}
                        onChange={e => {
                          const curr = etapa.delay_minutos;
                          const currVal = curr < 60 ? curr : curr < 1440 ? curr / 60 : curr / 1440;
                          const mult = e.target.value === "min" ? 1 : e.target.value === "h" ? 60 : 1440;
                          updateEtapa(idx, "delay_minutos", Math.round(currVal * mult));
                        }}>
                        <option value="min">min</option>
                        <option value="h">horas</option>
                        <option value="d">dias</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Tipo</label>
                  <select style={inputStyle} value={etapa.tipo_mensagem} onChange={e => updateEtapa(idx, "tipo_mensagem", e.target.value)}>
                    <option value="template">Mensagem fixa</option>
                    <option value="ia">IA gera a mensagem</option>
                  </select>
                </div>

                {etapa.tipo_mensagem === "template" ? (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Mensagem (use {"{nome}"} e {"{empresa}"})</label>
                    <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60, fontSize: 12 }}
                      placeholder="Olá {nome}! Vi que você se interessou pelos nossos serviços..."
                      value={etapa.texto_template} onChange={e => updateEtapa(idx, "texto_template", e.target.value)} />
                  </div>
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Prompt para a IA</label>
                    <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60, fontSize: 12 }}
                      placeholder="Envie um follow-up amigável perguntando se o lead tem mais dúvidas..."
                      value={etapa.prompt_ia} onChange={e => updateEtapa(idx, "prompt_ia", e.target.value)} />
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Mídia (URL da imagem ou vídeo — opcional)</label>
                    <input style={inputStyle} placeholder="https://..." value={etapa.midia_url} onChange={e => updateEtapa(idx, "midia_url", e.target.value)} />
                  </div>
                  {etapa.midia_url && (
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Tipo</label>
                      <select style={inputStyle} value={etapa.midia_tipo || "image"} onChange={e => updateEtapa(idx, "midia_tipo", e.target.value)}>
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button onClick={addEtapa}
              style={{ width: "100%", background: "#1e1e1e", border: "1px dashed #333", borderRadius: 8, padding: "10px 0", color: "#606060", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
              <Plus size={14} /> Adicionar etapa
            </button>

            <button onClick={salvarFollowup} disabled={salvandoFollowup}
              style={{ width: "100%", background: "#f59e0b", border: "none", borderRadius: 8, padding: "10px 0", color: "#000", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: salvandoFollowup ? 0.6 : 1 }}>
              {salvandoFollowup ? "Salvando..." : "Salvar Follow-up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
