"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit2, X, Check, Search, GripVertical,
  MessageSquare, Image, Mic, Video, ChevronUp, ChevronDown, Power,
} from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

/* ─── types ─── */
interface Etapa {
  id?: string;
  ordem: number;
  nome: string;
  delay_minutos: number;
  tipo_conteudo: "text" | "audio" | "image" | "video";
  texto: string;
  midia_url: string;
  ativo: boolean;
}

interface Funil {
  id: string;
  agencia_id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
  etapas: Etapa[];
}

/* ─── helpers ─── */
function fmtDelay(min: number) {
  if (min === 0) return "imediato";
  if (min < 60) return `${min}min`;
  if (min < 1440) return `${(min / 60).toFixed(0)}h`;
  return `${(min / 1440).toFixed(0)}d`;
}

function delayToUnit(min: number): { valor: number; unidade: "min" | "h" | "d" } {
  if (min >= 1440 && min % 1440 === 0) return { valor: min / 1440, unidade: "d" };
  if (min >= 60 && min % 60 === 0) return { valor: min / 60, unidade: "h" };
  return { valor: min, unidade: "min" };
}

function unitToMin(valor: number, unidade: "min" | "h" | "d") {
  if (unidade === "h") return valor * 60;
  if (unidade === "d") return valor * 1440;
  return valor;
}

const tipoIcon: Record<string, React.ReactNode> = {
  text: <MessageSquare size={14} />,
  audio: <Mic size={14} />,
  image: <Image size={14} />,
  video: <Video size={14} />,
};

const tipoLabel: Record<string, string> = {
  text: "Texto",
  audio: "Audio",
  image: "Imagem",
  video: "Video",
};

/* ─── styles ─── */
const inputStyle: React.CSSProperties = {
  background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8,
  padding: "9px 12px", color: "#f0f0f0", fontSize: 13, width: "100%",
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "#a0a0a0", marginBottom: 4, display: "block",
};
const cardStyle: React.CSSProperties = {
  background: "#141414", border: "1px solid #2e2e2e", borderRadius: 12,
  padding: 20, marginBottom: 16,
};
const btnPrimary: React.CSSProperties = {
  background: "#29ABE2", color: "#fff", border: "none", borderRadius: 8,
  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
};
const btnGhost: React.CSSProperties = {
  background: "transparent", color: "#a0a0a0", border: "1px solid #2e2e2e",
  borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 4,
};
const btnDanger: React.CSSProperties = {
  background: "transparent", color: "#f87171", border: "1px solid #3b1c1c",
  borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 4,
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: "none" as const, paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

/* ─── component ─── */
export default function FunisPage() {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [agId, setAgId] = useState("");
  const [funis, setFunis] = useState<Funil[]>([]);
  const [busca, setBusca] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);

  // delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);

    const { data: funisData } = await supabase
      .from("funis")
      .select("*")
      .eq("agencia_id", id)
      .order("created_at", { ascending: false });

    const funisArr: Funil[] = [];
    for (const f of funisData || []) {
      const { data: etapasData } = await supabase
        .from("funil_etapas")
        .select("*")
        .eq("funil_id", f.id)
        .order("ordem", { ascending: true });
      funisArr.push({ ...f, etapas: etapasData || [] });
    }
    setFunis(funisArr);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setNome("");
    setDescricao("");
    setEtapas([]);
    setModalOpen(true);
  }

  function openEdit(f: Funil) {
    setEditId(f.id);
    setNome(f.nome);
    setDescricao(f.descricao || "");
    setEtapas(f.etapas.map(e => ({ ...e })));
    setModalOpen(true);
  }

  function addEtapa() {
    setEtapas(prev => [
      ...prev,
      {
        ordem: prev.length + 1,
        nome: "",
        delay_minutos: prev.length === 0 ? 0 : 60,
        tipo_conteudo: "text",
        texto: "",
        midia_url: "",
        ativo: true,
      },
    ]);
  }

  function updateEtapa(idx: number, patch: Partial<Etapa>) {
    setEtapas(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function removeEtapa(idx: number) {
    setEtapas(prev => prev.filter((_, i) => i !== idx));
  }

  function moveEtapa(idx: number, dir: -1 | 1) {
    setEtapas(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  async function salvar() {
    if (!nome.trim()) { alert("Nome obrigatório"); return; }
    setSalvando(true);
    try {
      let funilId = editId;
      if (editId) {
        await supabase.from("funis").update({ nome, descricao }).eq("id", editId);
      } else {
        const { data } = await supabase.from("funis").insert({
          agencia_id: agId, nome, descricao, ativo: true,
        }).select("id").single();
        funilId = data?.id;
      }
      if (!funilId) throw new Error("Falha ao salvar funil");

      // delete all etapas and re-insert
      await supabase.from("funil_etapas").delete().eq("funil_id", funilId);
      if (etapas.length) {
        await supabase.from("funil_etapas").insert(
          etapas.map((e, i) => ({
            funil_id: funilId,
            agencia_id: agId,
            ordem: i + 1,
            nome: e.nome || null,
            delay_minutos: e.delay_minutos,
            tipo_conteudo: e.tipo_conteudo,
            texto: e.texto || null,
            midia_url: e.midia_url || null,
            ativo: e.ativo,
          }))
        );
      }
      setModalOpen(false);
      await carregar();
    } catch (err: any) {
      alert("Erro ao salvar: " + (err?.message || "erro desconhecido"));
    }
    setSalvando(false);
  }

  async function deletar(id: string) {
    await supabase.from("funil_etapas").delete().eq("funil_id", id);
    await supabase.from("funis").delete().eq("id", id);
    setDeleteId(null);
    await carregar();
  }

  async function toggleAtivo(f: Funil) {
    await supabase.from("funis").update({ ativo: !f.ativo }).eq("id", f.id);
    setFunis(prev => prev.map(x => (x.id === f.id ? { ...x, ativo: !x.ativo } : x)));
  }

  const filtrados = funis.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.descricao || "").toLowerCase().includes(busca.toLowerCase())
  );

  /* ─── render ─── */
  return (
    <div className="animate-in" style={{ padding: 0 }}>
      {/* breadcrumb */}
      <div className="breadcrumb">
        <a href="/">Inicio</a><span>›</span>
        <span className="current">Funis</span>
      </div>

      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Funis</h1>
        <button style={btnPrimary} onClick={openNew}><Plus size={15} /> Novo Funil</button>
      </div>

      {/* search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
        <input
          style={{ ...inputStyle, paddingLeft: 34 }}
          placeholder="Buscar funis..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* loading */}
      {loading && <p style={{ color: "#666", fontSize: 13 }}>Carregando...</p>}

      {/* empty */}
      {!loading && filtrados.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", color: "#666", padding: 48 }}>
          <MessageSquare size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 14 }}>Nenhum funil encontrado</p>
          <button style={{ ...btnPrimary, marginTop: 12 }} onClick={openNew}><Plus size={14} /> Criar primeiro funil</button>
        </div>
      )}

      {/* list */}
      {filtrados.map(f => {
        const expanded = expandedId === f.id;
        return (
          <div key={f.id} style={{ ...cardStyle, transition: "border-color 0.15s", borderColor: expanded ? "#29ABE2" : "#2e2e2e" }}>
            {/* card header */}
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => setExpandedId(expanded ? null : f.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>{f.nome}</span>
                  {f.descricao && (
                    <span style={{
                      fontSize: 11, background: "#1e1e1e", border: "1px solid #2e2e2e",
                      borderRadius: 6, padding: "2px 8px", color: "#888",
                    }}>{f.descricao}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#666" }}>
                  <span>{f.etapas.length} etapa{f.etapas.length !== 1 ? "s" : ""}</span>
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {Array.from(new Set(f.etapas.map(e => e.tipo_conteudo))).map(t => (
                      <span key={t} title={tipoLabel[t]} style={{ color: "#888" }}>{tipoIcon[t]}</span>
                    ))}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
                {/* toggle ativo */}
                <button
                  style={{
                    ...btnGhost,
                    color: f.ativo ? "#29ABE2" : "#666",
                    borderColor: f.ativo ? "#29ABE233" : "#2e2e2e",
                  }}
                  title={f.ativo ? "Desativar" : "Ativar"}
                  onClick={() => toggleAtivo(f)}
                >
                  <Power size={14} />
                </button>
                {/* edit */}
                <button style={btnGhost} onClick={() => openEdit(f)} title="Editar"><Edit2 size={14} /></button>
                {/* delete */}
                <button style={btnDanger} onClick={() => setDeleteId(f.id)} title="Excluir"><Trash2 size={14} /></button>
              </div>
            </div>

            {/* expanded etapas preview */}
            {expanded && f.etapas.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #2e2e2e", paddingTop: 16 }}>
                {f.etapas.map((e, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "10px 0", borderBottom: i < f.etapas.length - 1 ? "1px solid #1e1e1e" : "none",
                  }}>
                    <div style={{
                      minWidth: 28, height: 28, borderRadius: "50%", background: "#1e1e1e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: "#888", fontWeight: 600,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ color: "#888" }}>{tipoIcon[e.tipo_conteudo]}</span>
                        <span style={{ fontSize: 13, color: "#ccc", fontWeight: 500 }}>
                          {e.nome || `Etapa ${i + 1}`}
                        </span>
                        <span style={{
                          fontSize: 11, background: "#1a1a1a", borderRadius: 4,
                          padding: "1px 6px", color: "#666",
                        }}>{fmtDelay(e.delay_minutos)}</span>
                      </div>
                      {e.texto && (
                        <p style={{ fontSize: 12, color: "#777", margin: 0, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                          {e.texto.length > 120 ? e.texto.slice(0, 120) + "..." : e.texto}
                        </p>
                      )}
                      {e.midia_url && e.tipo_conteudo !== "text" && (
                        <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
                          Midia: {e.midia_url.length > 60 ? e.midia_url.slice(0, 60) + "..." : e.midia_url}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {expanded && f.etapas.length === 0 && (
              <p style={{ marginTop: 16, color: "#555", fontSize: 12, borderTop: "1px solid #2e2e2e", paddingTop: 16 }}>
                Nenhuma etapa configurada.{" "}
                <span style={{ color: "#29ABE2", cursor: "pointer" }} onClick={() => openEdit(f)}>Editar funil</span>
              </p>
            )}
          </div>
        );
      })}

      {/* delete confirmation modal */}
      {deleteId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setDeleteId(null)}>
          <div style={{ ...cardStyle, width: 400, maxWidth: "90vw", margin: 0 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginTop: 0, marginBottom: 12 }}>Confirmar exclusao</h3>
            <p style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>
              Tem certeza que deseja excluir este funil e todas as suas etapas? Esta acao nao pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setDeleteId(null)}>Cancelar</button>
              <button
                style={{ ...btnDanger, background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
                onClick={() => deletar(deleteId)}
              >
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* create / edit modal */}
      {modalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          overflowY: "auto", padding: "40px 16px",
        }} onClick={() => setModalOpen(false)}>
          <div style={{
            background: "#0f0f0f", border: "1px solid #2e2e2e", borderRadius: 16,
            width: 680, maxWidth: "100%", padding: 28,
          }} onClick={e => e.stopPropagation()}>
            {/* modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>
                {editId ? "Editar Funil" : "Novo Funil"}
              </h2>
              <button
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}
                onClick={() => setModalOpen(false)}
              ><X size={20} /></button>
            </div>

            {/* nome */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nome *</label>
              <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Boas-vindas" />
            </div>

            {/* descricao */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Descricao</label>
              <input style={inputStyle} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve descricao do funil" />
            </div>

            {/* etapas header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>
                Etapas ({etapas.length})
              </span>
              <button style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12 }} onClick={addEtapa}>
                <Plus size={13} /> Adicionar
              </button>
            </div>

            {/* etapas list */}
            {etapas.length === 0 && (
              <p style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                Nenhuma etapa. Clique em Adicionar para comecar.
              </p>
            )}

            {etapas.map((etapa, idx) => {
              const du = delayToUnit(etapa.delay_minutos);
              return (
                <div key={idx} style={{
                  background: "#141414", border: "1px solid #2e2e2e", borderRadius: 10,
                  padding: 16, marginBottom: 12,
                }}>
                  {/* step header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <GripVertical size={14} style={{ color: "#444" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#888" }}>#{idx + 1}</span>
                    <div style={{ flex: 1 }} />
                    <button
                      style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 2 }}
                      onClick={() => moveEtapa(idx, -1)}
                      disabled={idx === 0}
                      title="Mover para cima"
                    ><ChevronUp size={16} /></button>
                    <button
                      style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 2 }}
                      onClick={() => moveEtapa(idx, 1)}
                      disabled={idx === etapas.length - 1}
                      title="Mover para baixo"
                    ><ChevronDown size={16} /></button>
                    <button
                      style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 2 }}
                      onClick={() => removeEtapa(idx)}
                      title="Remover etapa"
                    ><Trash2 size={14} /></button>
                  </div>

                  {/* row 1: nome + delay + tipo */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 60px 120px", gap: 8, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Nome (opcional)</label>
                      <input
                        style={inputStyle}
                        value={etapa.nome}
                        onChange={e => updateEtapa(idx, { nome: e.target.value })}
                        placeholder="Ex: Mensagem inicial"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Delay</label>
                      <input
                        style={{ ...inputStyle, textAlign: "right" }}
                        type="number"
                        min={0}
                        value={du.valor}
                        onChange={e => {
                          const v = parseInt(e.target.value) || 0;
                          updateEtapa(idx, { delay_minutos: unitToMin(v, du.unidade) });
                        }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>&nbsp;</label>
                      <select
                        style={{ ...selectStyle, padding: "9px 8px" }}
                        value={du.unidade}
                        onChange={e => {
                          const u = e.target.value as "min" | "h" | "d";
                          updateEtapa(idx, { delay_minutos: unitToMin(du.valor, u) });
                        }}
                      >
                        <option value="min">min</option>
                        <option value="h">h</option>
                        <option value="d">d</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo</label>
                      <select
                        style={selectStyle}
                        value={etapa.tipo_conteudo}
                        onChange={e => updateEtapa(idx, { tipo_conteudo: e.target.value as any })}
                      >
                        <option value="text">Texto</option>
                        <option value="audio">Audio</option>
                        <option value="image">Imagem</option>
                        <option value="video">Video</option>
                      </select>
                    </div>
                  </div>

                  {/* texto */}
                  <div style={{ marginBottom: etapa.tipo_conteudo !== "text" ? 10 : 0 }}>
                    <label style={labelStyle}>Texto</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
                      value={etapa.texto}
                      onChange={e => updateEtapa(idx, { texto: e.target.value })}
                      placeholder="Conteudo da mensagem..."
                    />
                  </div>

                  {/* midia_url - shown for non-text types */}
                  {etapa.tipo_conteudo !== "text" && (
                    <div>
                      <label style={labelStyle}>URL da midia ({tipoLabel[etapa.tipo_conteudo]})</label>
                      <input
                        style={inputStyle}
                        value={etapa.midia_url}
                        onChange={e => updateEtapa(idx, { midia_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* save */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={btnGhost} onClick={() => setModalOpen(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={salvar} disabled={salvando}>
                <Check size={14} /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
