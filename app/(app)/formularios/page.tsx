"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, Save, Eye, Copy, CopyPlus, GripVertical, ChevronDown, ChevronRight, X, FileText, ExternalLink, List } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import { APP_URL } from "@/lib/config";

interface Pergunta {
  id: string;
  tipo: "text" | "select" | "phone" | "email" | "textarea" | "radio" | "welcome" | "video" | "obrigado" | "galeria";
  label: string;
  descricao?: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[];
  opcoesIrPara?: Record<string, string>; // opcao -> pergunta_id | "__fim__"
  irPara?: string;                        // pulo incondicional -> pergunta_id | "__fim__"
  videoUrl?: string;
  imagemUrl?: string;
  imagemFundoUrl?: string;
  imagensGaleria?: string[];
  botaoTexto?: string;
  redirectUrl?: string;
  whatsappNumero?: string;
  whatsappMensagem?: string;
  semDisparo?: boolean;
}

interface Formulario {
  id: string;
  agencia_id: string;
  nome: string;
  slug: string;
  titulo: string;
  subtitulo: string;
  perguntas: Pergunta[];
  cor_primaria: string;
  cor_fundo: string;
  cor_texto: string;
  cor_titulo: string;
  cor_subtitulo: string;
  cor_botao: string;
  msg_sucesso: string;
  redirecionar_url: string;
  redirecionar_whatsapp: boolean;
  whatsapp_numero: string;
  whatsapp_mensagem: string;
  ativo: boolean;
  created_at: string;
  cliente_externo_id?: string | null;
}

const TIPOS_PERGUNTA = [
  { value: "welcome", label: "Tela de boas-vindas" },
  { value: "obrigado", label: "Tela de obrigado" },
  { value: "text", label: "Texto curto" },
  { value: "phone", label: "Telefone/WhatsApp" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Texto longo" },
  { value: "select", label: "Seleção (opções)" },
  { value: "radio", label: "Múltipla escolha" },
  { value: "video", label: "Vídeo / Depoimento" },
  { value: "galeria", label: "Galeria de imagens" },
];

function gerarId() { return Math.random().toString(36).slice(2, 10); }
function gerarSlug(nome: string) { return nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "formulario"; }

function FormulariosPageInner() {
  const searchParams = useSearchParams();
  const clienteIdParam = searchParams.get("cliente_id");
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [agId, setAgId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clientesExternos, setClientesExternos] = useState<{ id: string; nome: string }[]>([]);
  const [verRespostas, setVerRespostas] = useState<Formulario | null>(null);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [loadingRespostas, setLoadingRespostas] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [modalModelo, setModalModelo] = useState(false);
  const [todosFormularios, setTodosFormularios] = useState<(Formulario & { cliente_nome?: string })[]>([]);
  const [loadingModelos, setLoadingModelos] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);
    let q = supabase.from("formularios").select("*").eq("agencia_id", id).order("created_at", { ascending: false });
    if (clienteIdParam) {
      q = q.eq("cliente_externo_id", clienteIdParam);
    } else {
      q = q.is("cliente_externo_id", null);
    }
    const { data } = await q;
    setFormularios(data || []);
    if (clienteIdParam) {
      const { data: c } = await supabase.from("clientes_externos").select("nome").eq("id", clienteIdParam).single();
      if (c) setClienteNome(c.nome);
    }
    const { data: clist } = await supabase.from("clientes_externos").select("id, nome").eq("agencia_id", id).eq("ativo", true).order("nome");
    setClientesExternos(clist || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const duplicar = async (f: Formulario) => {
    const novoNome = `${f.nome} (cópia)`;
    const novoSlug = `${f.slug}-copia`;
    const { data, error } = await supabase.from("formularios").insert({
      agencia_id: f.agencia_id,
      nome: novoNome,
      slug: novoSlug,
      titulo: f.titulo,
      subtitulo: f.subtitulo,
      perguntas: f.perguntas,
      cor_primaria: f.cor_primaria,
      cor_fundo: f.cor_fundo,
      cor_texto: f.cor_texto || "",
      cor_titulo: f.cor_titulo || "",
      cor_subtitulo: f.cor_subtitulo || "",
      cor_botao: f.cor_botao || "",
      msg_sucesso: f.msg_sucesso,
      redirecionar_url: f.redirecionar_url,
      redirecionar_whatsapp: f.redirecionar_whatsapp,
      whatsapp_numero: f.whatsapp_numero,
      whatsapp_mensagem: f.whatsapp_mensagem,
      ativo: f.ativo,
      cliente_externo_id: f.cliente_externo_id || null,
    }).select().single();
    if (error) { alert("Erro ao duplicar"); return; }
    await carregar();
    setEditando(data);
  };

  const novoFormulario = async (modelo?: Formulario) => {
    let waNumero = "";
    let logoUrl = "";
    if (clienteIdParam) {
      const { data: c } = await supabase.from("clientes_externos").select("whatsapp_notificacao, logo_url").eq("id", clienteIdParam).single();
      waNumero = c?.whatsapp_notificacao || "";
      logoUrl = c?.logo_url || "";
    }

    if (modelo) {
      // Copia estrutura do modelo, reaplica IDs novos nas perguntas e ajusta logo/whatsapp da nova cliente
      const pergsCopiadas = modelo.perguntas.map((p, i) => {
        const novosId = { ...p, id: gerarId(), opcoesIrPara: undefined, irPara: undefined };
        // Atualiza logo na tela de welcome se houver logo da nova cliente
        if (i === 0 && p.tipo === "welcome" && logoUrl) novosId.imagemUrl = logoUrl;
        return novosId;
      });
      setEditando({
        ...modelo,
        id: "", slug: "", nome: `Cópia de ${modelo.nome}`, created_at: "",
        agencia_id: agId,
        cliente_externo_id: clienteIdParam || null,
        perguntas: pergsCopiadas,
        whatsapp_numero: waNumero || modelo.whatsapp_numero,
        redirecionar_whatsapp: waNumero ? true : modelo.redirecionar_whatsapp,
        whatsapp_mensagem: modelo.whatsapp_mensagem,
      });
      setModalModelo(false);
      return;
    }

    setEditando({
      id: "", agencia_id: agId, nome: "", slug: "", titulo: "Preencha seus dados", subtitulo: "Falar no WhatsApp",
      perguntas: [
        { id: gerarId(), tipo: "welcome", label: "Bem-vindo!", descricao: "Responda algumas perguntas rápidas", obrigatorio: false, botaoTexto: "Começar" },
        { id: gerarId(), tipo: "text", label: "Qual seu nome?", placeholder: "Seu nome completo", obrigatorio: true },
        { id: gerarId(), tipo: "phone", label: "Qual seu WhatsApp?", placeholder: "(00) 00000-0000", obrigatorio: true },
      ],
      cor_primaria: "#1C6CA6", cor_fundo: "#FFFFFF", cor_texto: "", cor_titulo: "", cor_subtitulo: "", cor_botao: "", msg_sucesso: "Obrigado! Entraremos em contato em breve.",
      redirecionar_url: "", redirecionar_whatsapp: true, whatsapp_numero: waNumero, whatsapp_mensagem: "Olá! Preenchi o formulário e gostaria de mais informações.",
      ativo: true, created_at: "", cliente_externo_id: clienteIdParam || null,
    });
  };

  const abrirModalModelo = async () => {
    setModalModelo(true);
    setLoadingModelos(true);
    const { data } = await supabase
      .from("formularios")
      .select("*, clientes_externos(nome)")
      .eq("agencia_id", agId)
      .order("created_at", { ascending: false });
    const lista = (data || []).map((f: any) => ({
      ...f,
      cliente_nome: f.clientes_externos?.nome || "Master",
    }));
    setTodosFormularios(lista);
    setLoadingModelos(false);
  };

  const onClienteExternoChange = async (clienteId: string) => {
    if (!editando) return;
    let update: Partial<Formulario> = { cliente_externo_id: clienteId || null };
    if (clienteId) {
      const { data: c } = await supabase.from("clientes_externos").select("whatsapp_notificacao, logo_url").eq("id", clienteId).single();
      if (c?.whatsapp_notificacao && !editando.whatsapp_numero) {
        update.whatsapp_numero = c.whatsapp_notificacao;
        update.redirecionar_whatsapp = true;
      }
      if (c?.logo_url) {
        const pergs = editando.perguntas.map((p, i) => i === 0 && p.tipo === "welcome" ? { ...p, imagemUrl: c.logo_url } : p);
        update = { ...update, perguntas: pergs };
      }
    }
    setEditando({ ...editando, ...update });
  };

  const salvar = async () => {
    if (!editando) return;
    if (!editando.nome) { alert("Preencha o nome do formulário"); return; }
    setSalvando(true);
    try {
      const slug = editando.slug || gerarSlug(editando.nome);
      const dados = {
        agencia_id: agId, nome: editando.nome, slug,
        titulo: editando.titulo, subtitulo: editando.subtitulo,
        perguntas: editando.perguntas, cor_primaria: editando.cor_primaria,
        cor_fundo: editando.cor_fundo,
        ...(editando.cor_texto ? { cor_texto: editando.cor_texto } : {}),
        cor_titulo: editando.cor_titulo || "",
        cor_subtitulo: editando.cor_subtitulo || "",
        cor_botao: editando.cor_botao || "",
        msg_sucesso: editando.msg_sucesso,
        redirecionar_url: editando.redirecionar_url,
        redirecionar_whatsapp: editando.redirecionar_whatsapp,
        whatsapp_numero: editando.whatsapp_numero,
        whatsapp_mensagem: editando.whatsapp_mensagem,
        ativo: editando.ativo,
        cliente_externo_id: editando.cliente_externo_id || null,
      };
      if (editando.id) {
        const { error } = await supabase.from("formularios").update(dados).eq("id", editando.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("formularios").insert(dados);
        if (error) throw new Error(error.message);
      }
      setEditando(null);
      await carregar();
      alert("Formulário salvo!");
    } catch (e: any) { console.error(e); alert("Erro ao salvar: " + e.message); }
    setSalvando(false);
  };

  const remover = async (id: string) => {
    if (!confirm("Remover formulário?")) return;
    await supabase.from("formularios").delete().eq("id", id);
    await carregar();
  };

  const addPergunta = () => {
    if (!editando) return;
    setEditando({
      ...editando,
      perguntas: [...editando.perguntas, { id: gerarId(), tipo: "text", label: "", placeholder: "", obrigatorio: false }],
    });
  };

  const updatePergunta = (idx: number, field: string, value: any) => {
    if (!editando) return;
    const pergs = [...editando.perguntas];
    (pergs[idx] as any)[field] = value;
    setEditando({ ...editando, perguntas: pergs });
  };

  const removePergunta = (idx: number) => {
    if (!editando) return;
    setEditando({ ...editando, perguntas: editando.perguntas.filter((_, i) => i !== idx) });
  };

  const reorderPerguntas = (from: number, to: number) => {
    if (!editando || from === to) return;
    const pergs = [...editando.perguntas];
    const [moved] = pergs.splice(from, 1);
    pergs.splice(to, 0, moved);
    setEditando({ ...editando, perguntas: pergs });
  };

  const addOpcao = (idx: number) => {
    if (!editando) return;
    const pergs = [...editando.perguntas];
    pergs[idx].opcoes = [...(pergs[idx].opcoes || []), ""];
    setEditando({ ...editando, perguntas: pergs });
  };

  const updateOpcao = (pIdx: number, oIdx: number, val: string) => {
    if (!editando) return;
    const pergs = [...editando.perguntas];
    const opts = [...(pergs[pIdx].opcoes || [])];
    opts[oIdx] = val;
    pergs[pIdx].opcoes = opts;
    setEditando({ ...editando, perguntas: pergs });
  };

  const removeOpcao = (pIdx: number, oIdx: number) => {
    if (!editando) return;
    const pergs = [...editando.perguntas];
    pergs[pIdx].opcoes = (pergs[pIdx].opcoes || []).filter((_, i) => i !== oIdx);
    setEditando({ ...editando, perguntas: pergs });
  };

  const abrirRespostas = async (f: Formulario) => {
    setVerRespostas(f);
    setLoadingRespostas(true);
    const { data } = await supabase
      .from("formularios_respostas")
      .select("id, respostas, created_at")
      .eq("formulario_id", f.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setRespostas(data || []);
    setLoadingRespostas(false);
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${APP_URL}/f/${slug}`);
    alert("Link copiado!");
  };

  const inp: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 8, padding: "9px 12px", color: "#0A1826", fontSize: 13, width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "#4A5B6C", marginBottom: 4, display: "block" };

  return (
    <div className="animate-in">
      <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">{clienteIdParam ? `Formulários — ${clienteNome}` : "Formulários Master"}</span></div>

      {clienteIdParam && clienteNome && (
        <div style={{ background: "#E8F1F9", border: "1px solid #1a3a5a", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#4a9aba" }}>
          Criando formulário para cliente: <strong style={{ color: "#1C6CA6" }}>{clienteNome}</strong>
          <a href="/formularios" style={{ marginLeft: 12, fontSize: 12, color: "#4A5B6C", textDecoration: "underline" }}>Ver todos</a>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>{clienteIdParam ? `Formulários — ${clienteNome}` : "Formulários Master"}</h1>
        <button className="btn-primary" onClick={abrirModalModelo}><Plus size={14} /> Novo Formulário</button>
      </div>

      {/* Lista */}
      {!editando && !verRespostas && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Slug</th><th>Perguntas</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#4A5B6C", padding: 40 }}>Carregando...</td></tr>
              ) : !formularios.length ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#4A5B6C", padding: 40 }}>Nenhum formulário. Crie o primeiro!</td></tr>
              ) : formularios.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 500 }}>{f.nome}</td>
                  <td style={{ color: "#1C6CA6", fontSize: 12 }}>/f/{f.slug}</td>
                  <td style={{ color: "#4A5B6C" }}>{f.perguntas?.length || 0} campos</td>
                  <td>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: f.ativo ? "rgba(30,107,82,0.1)" : "rgba(180,35,24,0.1)", color: f.ativo ? "#1E6B52" : "#B42318" }}>
                      {f.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={() => copyLink(f.slug)} title="Copiar link"><Copy size={13} /></button>
                      <a href={`${baseUrl}/f/${f.slug}`} target="_blank" className="btn-ghost" style={{ padding: "5px 8px", textDecoration: "none", display: "flex", alignItems: "center" }} title="Visualizar"><Eye size={13} /></a>
                      <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={() => duplicar(f)} title="Duplicar"><CopyPlus size={13} /></button>
                      <button className="btn-ghost" style={{ padding: "5px 8px", color: "#1C6CA6" }} onClick={() => abrirRespostas(f)} title="Ver respostas"><List size={13} /></button>
                      <button className="btn-secondary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setEditando(f)}>Editar</button>
                      <button className="btn-danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => remover(f.id)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Respostas */}
      {!editando && verRespostas && (() => {
        const perguntas = verRespostas.perguntas.filter(p => !["welcome", "video", "obrigado"].includes(p.tipo));
        const idToLabel: Record<string, string> = {};
        for (const p of perguntas) idToLabel[p.id] = p.label;
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => { setVerRespostas(null); setRespostas([]); }}>
                  <X size={14} /> Voltar
                </button>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0A1826" }}>Respostas — {verRespostas.nome}</h2>
              <span style={{ fontSize: 13, color: "#4A5B6C" }}>{loadingRespostas ? "Carregando..." : `${respostas.length} respostas`}</span>
            </div>

            {loadingRespostas ? (
              <div style={{ textAlign: "center", color: "#4A5B6C", padding: 60 }}>Carregando respostas...</div>
            ) : !respostas.length ? (
              <div style={{ textAlign: "center", color: "#4A5B6C", padding: 60 }}>Nenhuma resposta ainda.</div>
            ) : (
              <div className="table-wrapper" style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: "nowrap" }}>Data</th>
                      {perguntas.map(p => (
                        <th key={p.id} style={{ whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.label.length > 30 ? p.label.slice(0, 30) + "…" : p.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {respostas.map(r => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#4A5B6C" }}>
                          {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        {perguntas.map(p => (
                          <td key={p.id} style={{ maxWidth: 200, fontSize: 13 }}>
                            {r.respostas?.[p.id] || <span style={{ color: "#7E93A8" }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Editor */}
      {editando && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button className="btn-ghost" onClick={() => setEditando(null)} style={{ padding: "6px 12px", fontSize: 13 }}>
              <X size={14} /> Cancelar
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {editando.slug && (
                <a href={`${baseUrl}/f/${editando.slug}`} target="_blank" className="btn-secondary" style={{ textDecoration: "none", fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4 }}>
                  <ExternalLink size={12} /> Preview
                </a>
              )}
              <button className="btn-primary" onClick={salvar} disabled={salvando}>
                <Save size={14} /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Config geral */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A1826", marginBottom: 16 }}>Configuração</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={lbl}>Nome do formulário (interno)</label>
                    <input style={inp} value={editando.nome} onChange={e => { setEditando({ ...editando, nome: e.target.value, slug: editando.id ? editando.slug : gerarSlug(e.target.value) }); }} placeholder="Ex: Captação Micropigmentação" />
                  </div>
                  {clienteIdParam && clientesExternos.length > 0 && (
                    <div>
                      <label style={lbl}>Cliente Externo</label>
                      <select style={{ ...inp }} value={editando.cliente_externo_id || ""} onChange={e => onClienteExternoChange(e.target.value)}>
                        <option value="">— Nenhum —</option>
                        {clientesExternos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={lbl}>Slug (URL)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#4A5B6C", fontSize: 12 }}>/f/</span>
                      <input style={{ ...inp, flex: 1 }} value={editando.slug} onChange={e => setEditando({ ...editando, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Título (interno)</label>
                    <input style={inp} value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={lbl}>Cor primária</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="color" value={editando.cor_primaria} onChange={e => setEditando({ ...editando, cor_primaria: e.target.value })} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer" }} />
                        <input style={{ ...inp, flex: 1 }} value={editando.cor_primaria} onChange={e => setEditando({ ...editando, cor_primaria: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Cor de fundo</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="color" value={editando.cor_fundo} onChange={e => setEditando({ ...editando, cor_fundo: e.target.value })} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer" }} />
                        <input style={{ ...inp, flex: 1 }} value={editando.cor_fundo} onChange={e => setEditando({ ...editando, cor_fundo: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={lbl}>Cor do título</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="color" value={editando.cor_titulo || "#0A1826"} onChange={e => setEditando({ ...editando, cor_titulo: e.target.value })} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }} />
                        <input style={{ ...inp, flex: 1 }} placeholder="Auto" value={editando.cor_titulo || ""} onChange={e => setEditando({ ...editando, cor_titulo: e.target.value })} />
                        {editando.cor_titulo && <button onClick={() => setEditando({ ...editando, cor_titulo: "" })} style={{ background: "none", border: "none", color: "#4A5B6C", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>}
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Cor do subtítulo</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="color" value={editando.cor_subtitulo || "#6B7A89"} onChange={e => setEditando({ ...editando, cor_subtitulo: e.target.value })} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }} />
                        <input style={{ ...inp, flex: 1 }} placeholder="Auto" value={editando.cor_subtitulo || ""} onChange={e => setEditando({ ...editando, cor_subtitulo: e.target.value })} />
                        {editando.cor_subtitulo && <button onClick={() => setEditando({ ...editando, cor_subtitulo: "" })} style={{ background: "none", border: "none", color: "#4A5B6C", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>}
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Cor do botão</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="color" value={editando.cor_botao || editando.cor_primaria || "#1C6CA6"} onChange={e => setEditando({ ...editando, cor_botao: e.target.value })} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }} />
                        <input style={{ ...inp, flex: 1 }} placeholder="= Cor primária" value={editando.cor_botao || ""} onChange={e => setEditando({ ...editando, cor_botao: e.target.value })} />
                        {editando.cor_botao && <button onClick={() => setEditando({ ...editando, cor_botao: "" })} style={{ background: "none", border: "none", color: "#4A5B6C", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Após envio */}
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A1826", marginBottom: 16 }}>Após envio</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={lbl}>Mensagem de sucesso</label>
                    <input style={inp} value={editando.msg_sucesso} onChange={e => setEditando({ ...editando, msg_sucesso: e.target.value })} />
                  </div>

                  {/* Botão final */}
                  <div style={{ background: "#F6F9FC", border: "1px solid #FFFFFF", borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#4A5B6C", margin: "0 0 10px" }}>Botão na tela final</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* Tipo do botão */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setEditando({ ...editando, redirecionar_whatsapp: true, redirecionar_url: "" })}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${editando.redirecionar_whatsapp ? "#1C6CA6" : "#E6EBF0"}`, background: editando.redirecionar_whatsapp ? "#1C6CA615" : "transparent", color: editando.redirecionar_whatsapp ? "#1C6CA6" : "#4A5B6C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >WhatsApp</button>
                        <button
                          onClick={() => setEditando({ ...editando, redirecionar_whatsapp: false })}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${!editando.redirecionar_whatsapp && editando.redirecionar_url !== undefined ? "#1C6CA6" : "#E6EBF0"}`, background: !editando.redirecionar_whatsapp ? "#1C6CA615" : "transparent", color: !editando.redirecionar_whatsapp ? "#1C6CA6" : "#4A5B6C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >Link personalizado</button>
                      </div>
                      {/* Texto do botão */}
                      <div>
                        <label style={lbl}>Texto do botão</label>
                        <input style={inp} placeholder={editando.redirecionar_whatsapp ? "Falar no WhatsApp" : "Continuar"} value={editando.subtitulo || ""} onChange={e => setEditando({ ...editando, subtitulo: e.target.value })} />
                      </div>
                      {/* WhatsApp fields */}
                      {editando.redirecionar_whatsapp && (
                        <>
                          <div>
                            <label style={lbl}>Número WhatsApp</label>
                            <input style={inp} placeholder="5551999999999" value={editando.whatsapp_numero} onChange={e => setEditando({ ...editando, whatsapp_numero: e.target.value })} />
                          </div>
                          <div>
                            <label style={lbl}>Mensagem pré-preenchida</label>
                            <input style={inp} value={editando.whatsapp_mensagem} onChange={e => setEditando({ ...editando, whatsapp_mensagem: e.target.value })} />
                          </div>
                        </>
                      )}
                      {/* URL personalizada */}
                      {!editando.redirecionar_whatsapp && (
                        <div>
                          <label style={lbl}>URL de destino</label>
                          <input style={inp} placeholder="https://..." value={editando.redirecionar_url} onChange={e => setEditando({ ...editando, redirecionar_url: e.target.value })} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Perguntas */}
            <div>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A1826", margin: 0 }}>Perguntas ({editando.perguntas.length})</h3>
                  <button onClick={addPergunta} style={{ background: "none", border: "1px dashed #1C6CA6", borderRadius: 6, padding: "4px 12px", color: "#1C6CA6", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Plus size={12} /> Adicionar
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {editando.perguntas.map((p, idx) => {
                    const temLogica = !!p.irPara || Object.keys(p.opcoesIrPara || {}).some(k => !!p.opcoesIrPara![k]);
                    const isDragging = dragIdx === idx;
                    const isDragOver = dragOverIdx === idx && dragIdx !== idx;
                    return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                      onDrop={() => { reorderPerguntas(dragIdx!, idx); setDragIdx(null); setDragOverIdx(null); }}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      style={{
                        background: "#F6F9FC",
                        border: `1px solid ${isDragOver ? "#1C6CA6" : temLogica ? "#1C6CA630" : "#FFFFFF"}`,
                        borderRadius: 10,
                        padding: 14,
                        opacity: isDragging ? 0.4 : 1,
                        transition: "border-color 0.15s, opacity 0.15s",
                        cursor: "grab",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <GripVertical size={14} style={{ color: "#7E93A8", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "#4A5B6C", fontWeight: 600 }}>CAMPO {idx + 1}</span>
                          {temLogica && <span style={{ fontSize: 10, background: "#1C6CA615", color: "#1C6CA6", padding: "2px 6px", borderRadius: 6, fontWeight: 600 }}>Lógica</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {p.tipo !== "welcome" && p.tipo !== "obrigado" && p.tipo !== "video" && (
                            <label style={{ fontSize: 11, color: "#4A5B6C", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              <input type="checkbox" checked={p.obrigatorio} onChange={e => updatePergunta(idx, "obrigatorio", e.target.checked)} style={{ width: 12, height: 12 }} />
                              Obrigatório
                            </label>
                          )}
                          <button onClick={() => removePergunta(idx)} style={{ background: "none", border: "none", color: "#B42318", cursor: "pointer", padding: 2 }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
                        <textarea
                          style={{ ...inp, fontSize: 12, resize: "vertical", minHeight: 38, lineHeight: "1.4" }}
                          placeholder="Pergunta/Label (Enter = nova linha)"
                          value={p.label}
                          rows={2}
                          onChange={e => updatePergunta(idx, "label", e.target.value)}
                        />
                        <select style={{ ...inp, fontSize: 12 }} value={p.tipo} onChange={e => {
                          const tipo = e.target.value;
                          const placeholders: Record<string, string> = {
                            text: "Sua resposta...",
                            phone: "(55) 99999-9999",
                            email: "seu@email.com",
                            textarea: "Descreva com detalhes...",
                            select: "",
                            radio: "",
                            welcome: "",
                            video: "",
                            obrigado: "",
                          };
                          const pergs = [...editando!.perguntas];
                          pergs[idx] = { ...pergs[idx], tipo: tipo as any, placeholder: placeholders[tipo] ?? "" };
                          setEditando({ ...editando!, perguntas: pergs });
                        }}>
                          {TIPOS_PERGUNTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <textarea
                        style={{ ...inp, fontSize: 12, marginTop: 6, resize: "vertical", minHeight: 38, lineHeight: "1.4" }}
                        placeholder="Descrição/Subtítulo (Enter = nova linha)"
                        value={p.descricao || ""}
                        rows={2}
                        onChange={e => updatePergunta(idx, "descricao", e.target.value)}
                      />

                      {!["welcome", "video", "obrigado"].includes(p.tipo) && (
                        <input style={{ ...inp, fontSize: 12, marginTop: 6 }} placeholder="Placeholder (opcional)" value={p.placeholder || ""} onChange={e => updatePergunta(idx, "placeholder", e.target.value)} />
                      )}

                      {(p.tipo === "welcome" || p.tipo === "video") && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                          <input style={{ ...inp, fontSize: 12 }} placeholder="Texto do botão (ex: Começar)" value={p.botaoTexto || ""} onChange={e => updatePergunta(idx, "botaoTexto", e.target.value)} />
                          {p.tipo === "welcome" && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input
                                style={{ ...inp, fontSize: 12, flex: 1 }}
                                placeholder="URL da imagem de fundo (hero com degradê)"
                                value={p.imagemFundoUrl || ""}
                                onChange={e => updatePergunta(idx, "imagemFundoUrl", e.target.value)}
                              />
                              <label style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "7px 10px", borderRadius: 7, border: "1px dashed #E6EBF0",
                                color: "#4A5B6C", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                whiteSpace: "nowrap", flexShrink: 0,
                              }}>
                                Anexar
                                <input type="file" accept="image/*" style={{ display: "none" }}
                                  onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    updatePergunta(idx, "imagemFundoUrl", "⏳ enviando...");
                                    const fd = new FormData();
                                    fd.append("file", file);
                                    fd.append("pasta", `formularios/${agId}`);
                                    const res = await fetch("/api/upload-imagem", { method: "POST", body: fd });
                                    const json = await res.json();
                                    updatePergunta(idx, "imagemFundoUrl", json.url || "");
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              {p.imagemFundoUrl && !p.imagemFundoUrl.startsWith("⏳") && (
                                <img src={p.imagemFundoUrl} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                              )}
                            </div>
                          )}
                          {p.tipo === "video" && (
                            <input style={{ ...inp, fontSize: 12 }} placeholder="URL do vídeo (YouTube, Vimeo...)" value={p.videoUrl || ""} onChange={e => updatePergunta(idx, "videoUrl", e.target.value)} />
                          )}
                        </div>
                      )}

                      {p.tipo === "obrigado" && (
                        <div style={{ marginTop: 8, background: "#F6F9FC", border: "1px solid #FFFFFF", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#4A5B6C", margin: 0 }}>Botão na tela de obrigado</p>
                          {/* Toggle WhatsApp / Link */}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => { updatePergunta(idx, "whatsappNumero", p.whatsappNumero || ""); updatePergunta(idx, "redirectUrl", ""); }}
                              style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${p.whatsappNumero !== undefined && p.whatsappNumero !== null && !p.redirectUrl ? "#1C6CA6" : "#E6EBF0"}`, background: (p.whatsappNumero !== undefined && !p.redirectUrl) ? "#1C6CA615" : "transparent", color: (p.whatsappNumero !== undefined && !p.redirectUrl) ? "#1C6CA6" : "#4A5B6C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            >WhatsApp</button>
                            <button
                              onClick={() => { updatePergunta(idx, "redirectUrl", p.redirectUrl || ""); updatePergunta(idx, "whatsappNumero", undefined as any); updatePergunta(idx, "whatsappMensagem", undefined as any); }}
                              style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${p.redirectUrl ? "#1C6CA6" : "#E6EBF0"}`, background: p.redirectUrl ? "#1C6CA615" : "transparent", color: p.redirectUrl ? "#1C6CA6" : "#4A5B6C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            >Link personalizado</button>
                          </div>
                          {/* Texto do botão */}
                          <div>
                            <label style={lbl}>Texto do botão</label>
                            <input style={{ ...inp, fontSize: 12 }} placeholder={p.redirectUrl ? "Continuar" : "Falar no WhatsApp"} value={p.botaoTexto || ""} onChange={e => updatePergunta(idx, "botaoTexto", e.target.value)} />
                          </div>
                          {/* WhatsApp fields */}
                          {!p.redirectUrl && (
                            <>
                              <div>
                                <label style={lbl}>Número WhatsApp</label>
                                <input style={{ ...inp, fontSize: 12 }} placeholder="5551999999999" value={p.whatsappNumero || ""} onChange={e => updatePergunta(idx, "whatsappNumero", e.target.value)} />
                              </div>
                              <div>
                                <label style={lbl}>Mensagem pré-preenchida</label>
                                <textarea style={{ ...inp, fontSize: 12, resize: "vertical", minHeight: 52 }} value={p.whatsappMensagem || ""} onChange={e => updatePergunta(idx, "whatsappMensagem", e.target.value)} />
                              </div>
                            </>
                          )}
                          {/* URL personalizada */}
                          {p.redirectUrl !== undefined && p.redirectUrl !== null && (
                            <div>
                              <label style={lbl}>URL de destino</label>
                              <input style={{ ...inp, fontSize: 12 }} placeholder="https://..." value={p.redirectUrl || ""} onChange={e => updatePergunta(idx, "redirectUrl", e.target.value)} />
                            </div>
                          )}
                          {/* Toggle: não disparar Lead (leads desqualificados) */}
                          <button
                            onClick={() => updatePergunta(idx, "semDisparo", !p.semDisparo)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                              borderRadius: 8, border: `1px solid ${p.semDisparo ? "#B42318" : "#E6EBF0"}`,
                              background: p.semDisparo ? "#ef444415" : "transparent",
                              color: p.semDisparo ? "#B42318" : "#4A5B6C",
                              fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", width: "100%",
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{p.semDisparo ? "" : ""}</span>
                            {p.semDisparo ? "Não dispara Lead nem salva no banco" : "Disparar Lead ao chegar aqui"}
                          </button>
                          <p style={{ fontSize: 10, color: "#7E93A8", margin: 0 }}>
                            {p.semDisparo
                              ? "Lead desqualificado — não será salvo nem contabilizado."
                              : "O pixel Lead dispara automaticamente ao chegar nesta tela."}
                          </p>
                        </div>
                      )}

                      {/* Galeria de imagens */}
                      {p.tipo === "galeria" && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <label style={{ ...lbl, marginBottom: 0 }}>Imagens da galeria</label>
                            <label style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "5px 10px", borderRadius: 7, border: "1px dashed #1C6CA6",
                              color: "#1C6CA6", fontSize: 11, fontWeight: 600, cursor: "pointer",
                            }}>
                              Anexar imagem
                              <input type="file" accept="image/*" multiple style={{ display: "none" }}
                                onChange={async e => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  const atual = p.imagensGaleria || [];
                                  const placeholders = files.map((_, i) => `⏳${i}`);
                                  updatePergunta(idx, "imagensGaleria", [...atual, ...placeholders]);
                                  const urls: string[] = [];
                                  for (const file of files) {
                                    const fd = new FormData();
                                    fd.append("file", file);
                                    fd.append("pasta", `formularios/${agId}/galeria`);
                                    const res = await fetch("/api/upload-imagem", { method: "POST", body: fd });
                                    const json = await res.json();
                                    urls.push(json.url || "");
                                  }
                                  updatePergunta(idx, "imagensGaleria", [...atual, ...urls.filter(Boolean)]);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                          <input style={{ ...inp, fontSize: 12, marginBottom: 6 }} placeholder="Texto do botão (ex: É isso que eu quero!)" value={p.botaoTexto || ""} onChange={e => updatePergunta(idx, "botaoTexto", e.target.value)} />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(p.imagensGaleria || []).map((url, gi) => (
                              <div key={gi} style={{ position: "relative", width: 56, height: 56 }}>
                                {url.startsWith("⏳") ? (
                                  <div style={{ width: 56, height: 56, borderRadius: 6, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⏳</div>
                                ) : (
                                  <img src={url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
                                )}
                                <button
                                  onClick={() => {
                                    const novas = (p.imagensGaleria || []).filter((_, i) => i !== gi);
                                    updatePergunta(idx, "imagensGaleria", novas);
                                  }}
                                  style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: "50%", background: "#B42318", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                                >×</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Opções para select/radio com lógica condicional por opção */}
                      {(p.tipo === "select" || p.tipo === "radio") && (
                        <div style={{ marginTop: 8 }}>
                          <label style={{ ...lbl, fontSize: 11 }}>Opções</label>
                          {(p.opcoes || []).map((o, oi) => {
                            const rotaOpcao = p.opcoesIrPara?.[o] || "";
                            return (
                            <div key={oi} style={{ marginBottom: 6 }}>
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input style={{ ...inp, flex: 1, fontSize: 12 }} placeholder={`Opção ${oi + 1}`} value={o} onChange={e => updateOpcao(idx, oi, e.target.value)} />
                                <button onClick={() => removeOpcao(idx, oi)} style={{ background: "none", border: "none", color: "#B42318", cursor: "pointer", padding: 2 }}><Trash2 size={12} /></button>
                              </div>
                              {/* Lógica condicional por opção */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, marginLeft: 4 }}>
                                <span style={{ fontSize: 10, color: "#7E93A8" }}>Se escolher esta opção →</span>
                                <select
                                  style={{ ...inp, flex: 1, fontSize: 11, color: rotaOpcao ? "#1C6CA6" : "#6B7A89", padding: "5px 8px" }}
                                  value={rotaOpcao}
                                  onChange={e => {
                                    const pergs = [...editando!.perguntas];
                                    if (!pergs[idx].opcoesIrPara) pergs[idx].opcoesIrPara = {};
                                    if (e.target.value) pergs[idx].opcoesIrPara![o] = e.target.value;
                                    else delete pergs[idx].opcoesIrPara![o];
                                    setEditando({ ...editando!, perguntas: pergs });
                                  }}>
                                  <option value="">Próxima pergunta</option>
                                  {editando!.perguntas.filter((_, pi) => pi !== idx).map((pDest, pdi) => (
                                    <option key={pDest.id} value={pDest.id}>
                                      {pDest.tipo === "obrigado" ? "✓ Obrigado: " : "Ir para: "}{pDest.label?.slice(0, 25) || `Campo ${pdi + 1}`}
                                    </option>
                                  ))}
                                  <option value="__fim__">Enviar formulário agora</option>
                                </select>
                              </div>
                            </div>
                            );
                          })}
                          <button onClick={() => addOpcao(idx)} style={{ background: "none", border: "1px dashed #E6EBF0", borderRadius: 4, padding: "3px 8px", color: "#4A5B6C", fontSize: 11, cursor: "pointer", width: "100%" }}>+ Opção</button>
                        </div>
                      )}

                      {/* Lógica incondicional: pular para (qualquer tipo exceto welcome/obrigado) */}
                      {p.tipo !== "welcome" && p.tipo !== "obrigado" && (
                        <div style={{ marginTop: 10, padding: "8px 10px", background: "#FFFFFF", borderRadius: 6, border: "1px solid #FFFFFF" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "#6B7A89", whiteSpace: "nowrap" }}>Após responder →</span>
                            <select
                              style={{ ...inp, flex: 1, fontSize: 11, color: p.irPara ? "#1C6CA6" : "#6B7A89", padding: "5px 8px" }}
                              value={p.irPara || ""}
                              onChange={e => updatePergunta(idx, "irPara", e.target.value || undefined)}>
                              <option value="">Próxima pergunta</option>
                              {editando!.perguntas.filter((_, pi) => pi !== idx).map((pDest, pdi) => (
                                <option key={pDest.id} value={pDest.id}>
                                  {pDest.tipo === "obrigado" ? "✓ Obrigado: " : "Pular para: "}{pDest.label?.slice(0, 25) || `Campo ${pdi + 1}`}
                                </option>
                              ))}
                              <option value="__fim__">Enviar formulário agora</option>
                            </select>
                          </div>
                          {p.tipo === "select" || p.tipo === "radio" ? (
                            <p style={{ fontSize: 10, color: "#E6EBF0", margin: "4px 0 0" }}>Esta lógica só aplica se a opção escolhida não tiver rota específica.</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: escolher modelo */}
      {modalModelo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setModalModelo(false)}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #FFFFFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0A1826" }}>Novo Formulário</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4A5B6C" }}>Comece do zero ou use um formulário existente como base</p>
              </div>
              <button onClick={() => setModalModelo(false)} style={{ background: "none", border: "none", color: "#4A5B6C", cursor: "pointer", padding: 4 }}><X size={18} /></button>
            </div>

            {/* Começar em branco */}
            <div style={{ padding: "16px 24px 12px" }}>
              <button
                onClick={() => { setModalModelo(false); novoFormulario(); }}
                style={{ width: "100%", background: "#FFFFFF", border: "1px dashed #1C6CA6", borderRadius: 10, padding: "14px 16px", color: "#1C6CA6", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              >
                <Plus size={16} />
                Começar em branco
              </button>
            </div>

            <p style={{ margin: "0 24px 8px", fontSize: 11, fontWeight: 600, color: "#7E93A8", textTransform: "uppercase", letterSpacing: 1 }}>Usar como modelo</p>

            {/* Lista de formulários */}
            <div style={{ overflowY: "auto", padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {loadingModelos ? (
                <p style={{ color: "#7E93A8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Carregando...</p>
              ) : todosFormularios.length === 0 ? (
                <p style={{ color: "#7E93A8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Nenhum formulário encontrado.</p>
              ) : todosFormularios.map(f => (
                <button
                  key={f.id}
                  onClick={() => novoFormulario(f)}
                  style={{ background: "#F6F9FC", border: "1px solid #FFFFFF", borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "#1C6CA6")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#FFFFFF")}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#0A1826" }}>{f.nome}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "#4A5B6C" }}>{f.cliente_nome} · {f.perguntas?.length || 0} campos</p>
                  </div>
                  <span style={{ fontSize: 11, color: "#1C6CA6", background: "#1C6CA615", padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>Usar modelo</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormulariosPage() {
  return (
    <Suspense>
      <FormulariosPageInner />
    </Suspense>
  );
}
