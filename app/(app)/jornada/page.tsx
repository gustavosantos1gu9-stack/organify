"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, MoreVertical, Edit2, Trash2, X, Check, GripVertical } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import InputValor, { parsearValorBR } from "@/components/ui/InputValor";

interface Etapa {
  id: string;
  nome: string;
  evento_conversao: string;
  eh_venda: boolean;
  valor_padrao: number;
  eh_primeiro_contato: boolean;
  termo_chave: string;
  ordem: number;
  created_at: string;
}

const EVENTOS_META = [
  { value: "AddPaymentInfo", label: "AddPaymentInfo (Meta Ads)" },
  { value: "AddToCart", label: "AddToCart (Meta Ads)" },
  { value: "AddToWishlist", label: "AddToWishlist (Meta Ads)" },
  { value: "CompleteRegistration", label: "CompleteRegistration (Meta Ads)" },
  { value: "Contact", label: "Contact (Meta Ads)" },
  { value: "CustomizeProduct", label: "CustomizeProduct (Meta Ads)" },
  { value: "Donate", label: "Donate (Meta Ads)" },
  { value: "FindLocation", label: "FindLocation (Meta Ads)" },
  { value: "InitiateCheckout", label: "InitiateCheckout (Meta Ads)" },
  { value: "Lead", label: "Lead (Meta Ads)" },
  { value: "Purchase", label: "Purchase (Meta Ads)" },
  { value: "Schedule", label: "Schedule (Meta Ads)" },
  { value: "Search", label: "Search (Meta Ads)" },
  { value: "StartTrial", label: "StartTrial (Meta Ads)" },
  { value: "SubmitApplication", label: "SubmitApplication (Meta Ads)" },
  { value: "Subscribe", label: "Subscribe (Meta Ads)" },
  { value: "ViewContent", label: "ViewContent (Meta Ads)" },
];

function EtapaModal({ etapa, onClose, onSave }: { etapa?: Etapa; onClose: () => void; onSave: () => void }) {
  const isEdit = !!etapa;
  const [form, setForm] = useState({
    nome: etapa?.nome || "",
    evento_conversao: etapa?.evento_conversao || "",
    eh_venda: etapa?.eh_venda || false,
    valor_padrao: etapa?.valor_padrao ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(etapa.valor_padrao) : "",
    eh_primeiro_contato: etapa?.eh_primeiro_contato ?? true,
    termo_chave: etapa?.termo_chave || "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { alert("Preencha o nome da etapa"); return; }
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      const payload = {
        nome: form.nome,
        evento_conversao: form.evento_conversao || null,
        eh_venda: form.eh_venda,
        valor_padrao: parsearValorBR(form.valor_padrao),
        eh_primeiro_contato: form.eh_primeiro_contato,
        termo_chave: form.termo_chave || null,
      };
      if (isEdit) {
        await supabase.from("jornada_etapas").update(payload).eq("id", etapa!.id);
      } else {
        // Pegar próxima ordem
        const { data: ultimas } = await supabase.from("jornada_etapas").select("ordem").eq("agencia_id", agId!).order("ordem", { ascending: false }).limit(1);
        const proxOrdem = (ultimas?.[0]?.ordem || 0) + 1;
        await supabase.from("jornada_etapas").insert({ ...payload, agencia_id: agId, ordem: proxOrdem });
      }
      onSave();
      onClose();
    } catch(e) { console.error(e); alert("Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in" style={{ maxWidth: "540px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "600" }}>{isEdit ? "Editar" : "Nova"} etapa</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}><X size={16}/></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label">Nome da Etapa da Jornada *</label>
            <input className="form-input" placeholder="Nome da Etapa da Jornada"
              value={form.nome} onChange={e => set("nome", e.target.value)}/>
          </div>

          <div className="form-group">
            <label className="form-label">Evento de Conversão Associado a esta etapa</label>
            <select className="form-input" value={form.evento_conversao} onChange={e => set("evento_conversao", e.target.value)}>
              <option value="">Selecione um evento...</option>
              {EVENTOS_META.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>
              Selecione a qual evento de conversão esta etapa da jornada estará associado...
            </p>
          </div>

          <div style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: "10px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" checked={form.eh_venda} onChange={e => set("eh_venda", e.target.checked)}
                style={{ width: "15px", height: "15px", marginTop: "2px", cursor: "pointer" }}/>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "500", color: "#f0f0f0", marginBottom: "2px" }}>Etapa que representa uma venda?</p>
                <p style={{ fontSize: "11px", color: "#606060" }}>Marque esta opção caso esta etapa da jornada represente uma venda.</p>
              </div>
            </label>

            {form.eh_venda && (
              <div className="form-group" style={{ marginLeft: "25px" }}>
                <label className="form-label">Valor padrão da Venda em R$</label>
                <InputValor value={form.valor_padrao} onChange={v => set("valor_padrao", v)}/>
              </div>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" checked={form.eh_primeiro_contato} onChange={e => set("eh_primeiro_contato", e.target.checked)}
                style={{ width: "15px", height: "15px", marginTop: "2px", cursor: "pointer" }}/>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "500", color: "#f0f0f0", marginBottom: "2px" }}>Etapa que representa um primeiro contato?</p>
                <p style={{ fontSize: "11px", color: "#606060" }}>Marque esta opção caso esta etapa da jornada represente um primeiro contato com sua empresa.</p>
              </div>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Termo-chave para alterar esta etapa da jornada</label>
            <textarea className="form-input" placeholder="Ex: agendei, reunião marcada, fechou..."
              value={form.termo_chave} onChange={e => set("termo_chave", e.target.value)}
              rows={3} style={{ resize: "vertical" }}/>
            <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>
              Sempre que o sistema identificar que o termo-chave acima foi enviado pelo atendente, a conversa será ajustada para esta etapa da jornada.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          <button className="btn-secondary" onClick={onClose} style={{ cursor: "pointer" }}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ cursor: "pointer" }}>
            <Check size={14}/> {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdenarModal({ etapas, onClose, onSave }: { etapas: Etapa[]; onClose: () => void; onSave: (ordem: Etapa[]) => void }) {
  const [lista, setLista] = useState([...etapas].sort((a, b) => a.ordem - b.ordem));
  const dragIdx = useRef<number | null>(null);

  const handleDragStart = (i: number) => { dragIdx.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const nova = [...lista];
    const [item] = nova.splice(dragIdx.current, 1);
    nova.splice(i, 0, item);
    dragIdx.current = i;
    setLista(nova);
  };
  const handleDrop = () => { dragIdx.current = null; };

  const total = lista.length;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in" style={{ maxWidth: "480px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "600" }}>Ordenar Etapas do Funil</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}><X size={16}/></button>
        </div>
        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "24px" }}>Clique e arraste para ordenar as etapas do funil.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {lista.map((e, i) => {
            const largura = 100 - (i / total) * 40;
            return (
              <div key={e.id} draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={ev => handleDragOver(ev, i)}
                onDrop={handleDrop}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: "8px", padding: "10px 14px", cursor: "grab",
                  width: `${largura}%`, margin: "0 auto",
                  transition: "width 0.2s",
                }}>
                <GripVertical size={14} style={{ color: "#606060", flexShrink: 0 }}/>
                <span style={{ fontSize: "13px", fontWeight: "500", flex: 1 }}>{e.nome}</span>
                <span style={{ fontSize: "11px", color: "#606060" }}>#{i + 1}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          <button className="btn-secondary" onClick={onClose} style={{ cursor: "pointer" }}>Cancelar</button>
          <button className="btn-primary" onClick={() => onSave(lista)} style={{ cursor: "pointer" }}>
            <Check size={14}/> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JornadaPage() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showOrdenar, setShowOrdenar] = useState(false);
  const [editando, setEditando] = useState<Etapa | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      const { data } = await supabase.from("jornada_etapas").select("*").eq("agencia_id", agId!).order("ordem");
      setEtapas(data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const remover = async (id: string) => {
    if (!confirm("Remover esta etapa?")) return;
    await supabase.from("jornada_etapas").delete().eq("id", id);
    setMenuAberto(null);
    carregar();
  };

  const salvarOrdem = async (lista: Etapa[]) => {
    const updates = lista.map((e, i) => supabase.from("jornada_etapas").update({ ordem: i + 1 }).eq("id", e.id));
    await Promise.all(updates);
    setShowOrdenar(false);
    carregar();
  };

  const formatarData = (d: string) => new Date(d).toLocaleString("pt-BR");

  return (
    <div className="animate-in" onClick={() => setMenuAberto(null)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <div className="breadcrumb">
            <a href="/">Início</a><span>›</span><span className="current">Jornada de Compra</span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Jornada de Compra</h1>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
        <button className="btn-primary" onClick={() => setShowModal(true)} style={{ cursor: "pointer" }}>
          <Plus size={14}/> Adicionar Nova Etapa
        </button>
        <button className="btn-secondary" onClick={() => setShowOrdenar(true)} style={{ cursor: "pointer" }}>
          Ordenar Etapas do Funil
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>ORDEM NO FUNIL</th>
              <th>NOME DA ETAPA</th>
              <th>EVENTO DE CONVERSÃO</th>
              <th>CRIADO EM</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Carregando...</td></tr>
            ) : !etapas.length ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>
                Nenhuma etapa criada. Crie a primeira etapa da jornada!
              </td></tr>
            ) : etapas.map(e => (
              <tr key={e.id}>
                <td style={{ color: "#606060", fontSize: "12px", fontFamily: "monospace" }}>{e.id.slice(0,5).toUpperCase()}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(34,197,94,0.15)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600" }}>
                      {e.ordem}
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: "500" }}>{e.nome}</span>
                    {e.eh_venda && <span style={{ fontSize: "10px", background: "rgba(34,197,94,0.1)", color: "#22c55e", padding: "2px 6px", borderRadius: "4px" }}>Venda ✓</span>}
                    {e.eh_primeiro_contato && <span style={{ fontSize: "10px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", padding: "2px 6px", borderRadius: "4px" }}>1º Contato</span>}
                  </div>
                </td>
                <td>
                  {e.evento_conversao ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1877f2", display: "inline-block", flexShrink: 0 }}/>
                      <span style={{ fontSize: "12px", color: "#a0a0a0" }}>{e.evento_conversao}</span>
                      <span style={{ fontSize: "10px", color: "#606060" }}>(Meta Ads)</span>
                    </span>
                  ) : <span style={{ color: "#606060" }}>—</span>}
                </td>
                <td style={{ color: "#a0a0a0", fontSize: "12px" }}>{formatarData(e.created_at)}</td>
                <td onClick={ev => ev.stopPropagation()}>
                  <div style={{ position: "relative" }}>
                    <button className="btn-ghost" style={{ padding: "6px", cursor: "pointer" }}
                      onClick={() => setMenuAberto(menuAberto === e.id ? null : e.id)}>
                      <MoreVertical size={15}/>
                    </button>
                    {menuAberto === e.id && (
                      <div style={{ position: "absolute", right: 0, top: "100%", background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: "8px", overflow: "hidden", minWidth: "130px", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                        <button onClick={() => { setEditando(e); setMenuAberto(null); }} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#f0f0f0", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Edit2 size={13}/> Editar
                        </button>
                        <button onClick={() => remover(e.id)} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#ef4444", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Trash2 size={13}/> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <EtapaModal onClose={() => setShowModal(false)} onSave={carregar}/>}
      {editando && <EtapaModal etapa={editando} onClose={() => setEditando(null)} onSave={carregar}/>}
      {showOrdenar && <OrdenarModal etapas={etapas} onClose={() => setShowOrdenar(false)} onSave={salvarOrdem}/>}
    </div>
  );
}
