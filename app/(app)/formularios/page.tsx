"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Eye, Copy, GripVertical, ChevronDown, ChevronRight, X, FileText, ExternalLink } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Pergunta {
  id: string;
  tipo: "text" | "select" | "phone" | "email" | "textarea" | "radio" | "welcome" | "video";
  label: string;
  descricao?: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[];
  opcoesIrPara?: Record<string, string>; // opcao -> pergunta_id
  videoUrl?: string;
  imagemUrl?: string;
  botaoTexto?: string;
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
  msg_sucesso: string;
  redirecionar_url: string;
  redirecionar_whatsapp: boolean;
  whatsapp_numero: string;
  whatsapp_mensagem: string;
  ativo: boolean;
  created_at: string;
}

const TIPOS_PERGUNTA = [
  { value: "welcome", label: "Tela de boas-vindas" },
  { value: "text", label: "Texto curto" },
  { value: "phone", label: "Telefone/WhatsApp" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Texto longo" },
  { value: "select", label: "Seleção (opções)" },
  { value: "radio", label: "Múltipla escolha" },
  { value: "video", label: "Vídeo / Depoimento" },
];

function gerarId() { return Math.random().toString(36).slice(2, 10); }
function gerarSlug(nome: string) { return nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "formulario"; }

export default function FormulariosPage() {
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [agId, setAgId] = useState("");

  const carregar = async () => {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);
    const { data } = await supabase.from("formularios").select("*").eq("agencia_id", id).order("created_at", { ascending: false });
    setFormularios(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const novoFormulario = () => {
    setEditando({
      id: "", agencia_id: agId, nome: "", slug: "", titulo: "Preencha seus dados", subtitulo: "Entraremos em contato em breve",
      perguntas: [
        { id: gerarId(), tipo: "welcome", label: "Bem-vindo!", descricao: "Responda algumas perguntas rápidas", obrigatorio: false, botaoTexto: "Começar" },
        { id: gerarId(), tipo: "text", label: "Qual seu nome?", placeholder: "Seu nome completo", obrigatorio: true },
        { id: gerarId(), tipo: "phone", label: "Qual seu WhatsApp?", placeholder: "(00) 00000-0000", obrigatorio: true },
      ],
      cor_primaria: "#29ABE2", cor_fundo: "#0f0f0f", msg_sucesso: "Obrigado! Entraremos em contato em breve.",
      redirecionar_url: "", redirecionar_whatsapp: false, whatsapp_numero: "", whatsapp_mensagem: "Olá! Preenchi o formulário e gostaria de mais informações.",
      ativo: true, created_at: "",
    });
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
        cor_fundo: editando.cor_fundo, msg_sucesso: editando.msg_sucesso,
        redirecionar_url: editando.redirecionar_url,
        redirecionar_whatsapp: editando.redirecionar_whatsapp,
        whatsapp_numero: editando.whatsapp_numero,
        whatsapp_mensagem: editando.whatsapp_mensagem,
        ativo: editando.ativo,
      };
      if (editando.id) {
        await supabase.from("formularios").update(dados).eq("id", editando.id);
      } else {
        await supabase.from("formularios").insert(dados);
      }
      setEditando(null);
      await carregar();
      alert("Formulário salvo!");
    } catch (e) { console.error(e); alert("Erro ao salvar"); }
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

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    alert("Link copiado!");
  };

  const inp: React.CSSProperties = { background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "9px 12px", color: "#f0f0f0", fontSize: 13, width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "#a0a0a0", marginBottom: 4, display: "block" };

  return (
    <div className="animate-in">
      <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Formulários</span></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Formulários</h1>
        <button className="btn-primary" onClick={novoFormulario}><Plus size={14} /> Novo Formulário</button>
      </div>

      {/* Lista */}
      {!editando && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>NOME</th><th>SLUG</th><th>PERGUNTAS</th><th>STATUS</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: 40 }}>Carregando...</td></tr>
              ) : !formularios.length ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: 40 }}>Nenhum formulário. Crie o primeiro!</td></tr>
              ) : formularios.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 500 }}>{f.nome}</td>
                  <td style={{ color: "#29ABE2", fontSize: 12 }}>/f/{f.slug}</td>
                  <td style={{ color: "#a0a0a0" }}>{f.perguntas?.length || 0} campos</td>
                  <td>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: f.ativo ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: f.ativo ? "#22c55e" : "#ef4444" }}>
                      {f.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={() => copyLink(f.slug)} title="Copiar link"><Copy size={13} /></button>
                      <a href={`/f/${f.slug}`} target="_blank" className="btn-ghost" style={{ padding: "5px 8px", textDecoration: "none", display: "flex", alignItems: "center" }} title="Visualizar"><Eye size={13} /></a>
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

      {/* Editor */}
      {editando && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button className="btn-ghost" onClick={() => setEditando(null)} style={{ padding: "6px 12px", fontSize: 13 }}>
              <X size={14} /> Cancelar
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {editando.slug && (
                <a href={`/f/${editando.slug}`} target="_blank" className="btn-secondary" style={{ textDecoration: "none", fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4 }}>
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
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>Configuração</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={lbl}>Nome do formulário (interno)</label>
                    <input style={inp} value={editando.nome} onChange={e => { setEditando({ ...editando, nome: e.target.value, slug: editando.id ? editando.slug : gerarSlug(e.target.value) }); }} placeholder="Ex: Captação Micropigmentação" />
                  </div>
                  <div>
                    <label style={lbl}>Slug (URL)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#606060", fontSize: 12 }}>/f/</span>
                      <input style={{ ...inp, flex: 1 }} value={editando.slug} onChange={e => setEditando({ ...editando, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={lbl}>Título</label>
                      <input style={inp} value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} />
                    </div>
                    <div>
                      <label style={lbl}>Subtítulo</label>
                      <input style={inp} value={editando.subtitulo} onChange={e => setEditando({ ...editando, subtitulo: e.target.value })} />
                    </div>
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
                </div>
              </div>

              {/* Após envio */}
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>Após envio</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={lbl}>Mensagem de sucesso</label>
                    <input style={inp} value={editando.msg_sucesso} onChange={e => setEditando({ ...editando, msg_sucesso: e.target.value })} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#a0a0a0" }}>
                    <input type="checkbox" checked={editando.redirecionar_whatsapp} onChange={e => setEditando({ ...editando, redirecionar_whatsapp: e.target.checked })} style={{ width: 14, height: 14 }} />
                    Redirecionar para WhatsApp após envio
                  </label>
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
                  {!editando.redirecionar_whatsapp && (
                    <div>
                      <label style={lbl}>URL de redirecionamento (opcional)</label>
                      <input style={inp} placeholder="https://..." value={editando.redirecionar_url} onChange={e => setEditando({ ...editando, redirecionar_url: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Perguntas */}
            <div>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Perguntas ({editando.perguntas.length})</h3>
                  <button onClick={addPergunta} style={{ background: "none", border: "1px dashed #29ABE2", borderRadius: 6, padding: "4px 12px", color: "#29ABE2", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Plus size={12} /> Adicionar
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {editando.perguntas.map((p, idx) => (
                    <div key={p.id} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: "#606060", fontWeight: 600 }}>CAMPO {idx + 1}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <label style={{ fontSize: 11, color: "#a0a0a0", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={p.obrigatorio} onChange={e => updatePergunta(idx, "obrigatorio", e.target.checked)} style={{ width: 12, height: 12 }} />
                            Obrigatório
                          </label>
                          <button onClick={() => removePergunta(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
                        <input style={{ ...inp, fontSize: 12 }} placeholder="Pergunta/Label" value={p.label} onChange={e => updatePergunta(idx, "label", e.target.value)} />
                        <select style={{ ...inp, fontSize: 12 }} value={p.tipo} onChange={e => updatePergunta(idx, "tipo", e.target.value)}>
                          {TIPOS_PERGUNTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <input style={{ ...inp, fontSize: 12, marginTop: 6 }} placeholder="Descrição (opcional)" value={p.descricao || ""} onChange={e => updatePergunta(idx, "descricao", e.target.value)} />

                      {!["welcome", "video"].includes(p.tipo) && (
                        <input style={{ ...inp, fontSize: 12, marginTop: 6 }} placeholder="Placeholder (opcional)" value={p.placeholder || ""} onChange={e => updatePergunta(idx, "placeholder", e.target.value)} />
                      )}

                      {(p.tipo === "welcome" || p.tipo === "video") && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                          <input style={{ ...inp, fontSize: 12 }} placeholder="Texto do botão (ex: Começar)" value={p.botaoTexto || ""} onChange={e => updatePergunta(idx, "botaoTexto", e.target.value)} />
                          {p.tipo === "welcome" && (
                            <input style={{ ...inp, fontSize: 12 }} placeholder="URL da imagem (opcional)" value={p.imagemUrl || ""} onChange={e => updatePergunta(idx, "imagemUrl", e.target.value)} />
                          )}
                          {p.tipo === "video" && (
                            <input style={{ ...inp, fontSize: 12 }} placeholder="URL do vídeo (YouTube, Vimeo...)" value={p.videoUrl || ""} onChange={e => updatePergunta(idx, "videoUrl", e.target.value)} />
                          )}
                        </div>
                      )}

                      {(p.tipo === "select" || p.tipo === "radio") && (
                        <div style={{ marginTop: 8 }}>
                          <label style={{ ...lbl, fontSize: 11 }}>Opções e rotas</label>
                          {(p.opcoes || []).map((o, oi) => (
                            <div key={oi} style={{ display: "flex", gap: 4, marginBottom: 6, alignItems: "center" }}>
                              <input style={{ ...inp, flex: 1, fontSize: 12 }} placeholder={`Opção ${oi + 1}`} value={o} onChange={e => updateOpcao(idx, oi, e.target.value)} />
                              <select style={{ ...inp, width: 120, fontSize: 11, color: (p.opcoesIrPara?.[o]) ? "#29ABE2" : "#606060" }}
                                value={p.opcoesIrPara?.[o] || ""}
                                onChange={e => {
                                  const pergs = [...editando!.perguntas];
                                  if (!pergs[idx].opcoesIrPara) pergs[idx].opcoesIrPara = {};
                                  if (e.target.value) pergs[idx].opcoesIrPara![o] = e.target.value;
                                  else delete pergs[idx].opcoesIrPara![o];
                                  setEditando({ ...editando!, perguntas: pergs });
                                }}>
                                <option value="">Próxima →</option>
                                {editando!.perguntas.filter((_, pi) => pi !== idx).map((pDest) => (
                                  <option key={pDest.id} value={pDest.id}>
                                    Ir p/ {pDest.label?.slice(0, 20) || `Campo ${editando!.perguntas.indexOf(pDest) + 1}`}
                                  </option>
                                ))}
                                <option value="__fim__">Enviar formulário</option>
                              </select>
                              <button onClick={() => removeOpcao(idx, oi)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}><Trash2 size={12} /></button>
                            </div>
                          ))}
                          <button onClick={() => addOpcao(idx)} style={{ background: "none", border: "1px dashed #2e2e2e", borderRadius: 4, padding: "3px 8px", color: "#606060", fontSize: 11, cursor: "pointer", width: "100%" }}>+ Opção</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
