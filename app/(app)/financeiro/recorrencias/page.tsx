"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, X, Check, Edit2 } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import InputValor, { parsearValorBR } from "@/components/ui/InputValor";
import { formatCurrency } from "@/lib/utils";

interface Recorrencia {
  id: string; tipo: string; descricao: string; valor: number;
  periodicidade: string; dia_vencimento: number; ativo: boolean;
  cliente_id?: string;
}

const PERIODICIDADES = ["mensal","quinzenal","trimestral","semestral","anual"];
const INTERVALO: Record<string, number> = { mensal:1, quinzenal:1, trimestral:3, semestral:6, anual:12 };
const QTDE: Record<string, number> = { mensal:12, quinzenal:24, trimestral:4, semestral:2, anual:1 };

function RecModal({ rec, onClose, onSave }: { rec?: Recorrencia; onClose:()=>void; onSave:()=>void }) {
  const isEdit = !!rec;
  const [form, setForm] = useState({
    tipo: rec?.tipo || "entrada",
    descricao: rec?.descricao || "",
    valor: rec ? formatCurrency(rec.valor) : "",
    periodicidade: rec?.periodicidade || "mensal",
    dia_vencimento: rec?.dia_vencimento?.toString() || "1",
    ativo: rec?.ativo ?? true,
    considerar_cac: (rec as any)?.considerar_cac ?? false,
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.descricao || !form.valor) { alert("Preencha descrição e valor"); return; }
    setLoading(true);
    try {
      const agenciaId = await getAgenciaId();
      const valor = parsearValorBR(form.valor);
      const dia = parseInt(form.dia_vencimento) || 1;

      if (isEdit) {
        const descAnterior = rec!.descricao;
        // Editar recorrência existente
        await supabase.from("recorrencias").update({
          tipo: form.tipo,
          descricao: form.descricao,
          valor,
          periodicidade: form.periodicidade,
          dia_vencimento: dia,
          ativo: form.ativo,
          considerar_cac: form.tipo === "saida" ? form.considerar_cac : false,
        }).eq("id", rec!.id);

        // Atualizar lançamentos futuros não pagos
        let q = supabase.from("lancamentos_futuros").update({
          valor, descricao: form.descricao, tipo: form.tipo,
        }).eq("pago", false).eq("descricao", descAnterior);
        if (rec!.cliente_id) q = q.eq("cliente_id", rec!.cliente_id);
        else q = q.eq("agencia_id", agenciaId!);
        await q;
      } else {
        // Criar nova recorrência
        await supabase.from("recorrencias").insert({
          agencia_id: agenciaId,
          tipo: form.tipo,
          descricao: form.descricao,
          valor,
          periodicidade: form.periodicidade,
          dia_vencimento: dia,
          ativo: true,
          considerar_cac: form.tipo === "saida" ? form.considerar_cac : false,
        });

        // Gerar lançamentos futuros
        const hoje = new Date();
        const qtde = QTDE[form.periodicidade] || 12;
        const intervalo = INTERVALO[form.periodicidade] || 1;
        const lancamentos = [];

        if (form.periodicidade === "quinzenal") {
          for (let i = 0; i < 24; i++) {
            const data = new Date(hoje);
            data.setDate(data.getDate() + i * 15);
            lancamentos.push({
              agencia_id: agenciaId,
              tipo: form.tipo,
              descricao: form.descricao,
              valor,
              data_vencimento: data.toISOString().split("T")[0],
              pago: false,
            });
          }
        } else {
          for (let i = 0; i < qtde; i++) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() + i * intervalo, dia);
            lancamentos.push({
              agencia_id: agenciaId,
              tipo: form.tipo,
              descricao: form.descricao,
              valor,
              data_vencimento: data.toISOString().split("T")[0],
              pago: false,
            });
          }
        }

        if (lancamentos.length > 0) {
          const { error } = await supabase.from("lancamentos_futuros").insert(lancamentos);
          if (error) console.error("Erro ao gerar lançamentos:", error);
        }
      }

      onSave();
      onClose();
    } catch (e) { console.error(e); alert("Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in" style={{ maxWidth:"480px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
          <h2 style={{ fontSize:"17px", fontWeight:"600" }}>{isEdit ? "Editar" : "Nova"} recorrência</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding:"6px", cursor:"pointer" }}><X size={16}/></button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div style={{ display:"flex", gap:"8px" }}>
              {(["entrada","saida"] as const).map(t => (
                <button key={t} onClick={() => set("tipo", t)} style={{
                  flex:1, padding:"10px", borderRadius:"8px", cursor:"pointer",
                  border:`1px solid ${form.tipo===t?(t==="entrada"?"#29ABE2":"#ef4444"):"#2e2e2e"}`,
                  background:form.tipo===t?(t==="entrada"?"rgba(41,171,226,0.1)":"rgba(239,68,68,0.1)"):"#222",
                  color:form.tipo===t?(t==="entrada"?"#29ABE2":"#ef4444"):"#a0a0a0",
                  fontSize:"13px", fontWeight:"500",
                }}>
                  {t === "entrada" ? "Entrada" : "Saída"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <input className="form-input" placeholder="Ex: Mensalidade software"
              value={form.descricao} onChange={e => set("descricao", e.target.value)}/>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div className="form-group">
              <label className="form-label">Valor *</label>
              <InputValor value={form.valor} onChange={v => set("valor", v)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Dia do vencimento</label>
              <input type="number" className="form-input" min="1" max="31"
                value={form.dia_vencimento} onChange={e => set("dia_vencimento", e.target.value)}/>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Periodicidade</label>
            <select className="form-input" value={form.periodicidade} onChange={e => set("periodicidade", e.target.value)}>
              {PERIODICIDADES.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Considerar no CAC — só para saídas */}
          {form.tipo === "saida" && (
            <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", background:"rgba(41,171,226,0.05)", border:"1px solid rgba(41,171,226,0.15)", borderRadius:"8px" }}>
              <input type="checkbox" id="cac" checked={form.considerar_cac as boolean}
                onChange={e => set("considerar_cac", e.target.checked)}
                style={{ width:"16px", height:"16px", cursor:"pointer", accentColor:"#29ABE2" }}/>
              <label htmlFor="cac" style={{ fontSize:"13px", color:"#f0f0f0", cursor:"pointer" }}>
                Considerar no CAC
                <span style={{ fontSize:"11px", color:"#606060", marginLeft:"6px" }}>
                  (inclui esse gasto no cálculo do Custo de Aquisição de Cliente)
                </span>
              </label>
            </div>
          )}

          {/* Preview de lançamentos */}
          {!isEdit && form.valor && (
            <div style={{ background:"rgba(41,171,226,0.06)", border:"1px solid rgba(41,171,226,0.15)", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#a0a0a0" }}>
              {form.periodicidade === "quinzenal"
                ? <>💰 Serão gerados <strong style={{color:"#29ABE2"}}>24 lançamentos</strong> a cada 15 dias de <strong style={{color:"#29ABE2"}}>{form.valor}</strong></>
                : <>💰 Serão gerados <strong style={{color:"#29ABE2"}}>{QTDE[form.periodicidade] || 12} lançamentos</strong> ({form.periodicidade}) de <strong style={{color:"#29ABE2"}}>{form.valor}</strong></>
              }
            </div>
          )}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:"8px", marginTop:"24px" }}>
          <button className="btn-secondary" onClick={onClose} style={{ cursor:"pointer" }}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ cursor:"pointer" }}>
            <Check size={14}/> {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecorrenciasPage() {
  const [recs, setRecs] = useState<Recorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Recorrencia | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const agenciaId = await getAgenciaId();
      let q = supabase.from("recorrencias").select("*").eq("agencia_id", agenciaId!).order("created_at", { ascending: false });
      if (busca) q = q.ilike("descricao", `%${busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      setRecs(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [busca]);

  const remover = async (id: string) => {
    if (!confirm("Remover esta recorrência e os lançamentos futuros não pagos?")) return;
    const rec = recs.find(r => r.id === id);
    if (rec) {
      const agId = await getAgenciaId();
      if (rec.cliente_id) {
        // Deletar por cliente_id (mais confiável que por descrição)
        await supabase.from("lancamentos_futuros").delete()
          .eq("cliente_id", rec.cliente_id).eq("pago", false);
      } else if (agId) {
        // Sem cliente — deletar por descrição + agencia
        await supabase.from("lancamentos_futuros").delete()
          .eq("descricao", rec.descricao).eq("pago", false).eq("agencia_id", agId);
      }
    }
    await supabase.from("recorrencias").delete().eq("id", id);
    carregar();
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("recorrencias").update({ ativo: !ativo }).eq("id", id);
    carregar();
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span style={{ color:"#a0a0a0" }}>Financeiro</span><span>›</span>
        <span className="current">Recorrências</span>
      </div>
      <h1 style={{ fontSize:"22px", fontWeight:"600", marginBottom:"24px" }}>Recorrências</h1>

      <div className="table-wrapper">
        <div style={{ padding:"16px", display:"flex", gap:"12px", borderBottom:"1px solid #2e2e2e" }}>
          <div style={{ position:"relative", flex:1 }}>
            <Search size={14} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar recorrências..." value={busca} onChange={e => setBusca(e.target.value)}/>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ cursor:"pointer" }}>
            <Plus size={14}/> Nova recorrência
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>TIPO</th>
              <th>DESCRIÇÃO</th>
              <th>PERIODICIDADE</th>
              <th>DIA VENC.</th>
              <th>VALOR</th>
              <th>STATUS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:"center", color:"#606060", padding:"40px" }}>Carregando...</td></tr>
            ) : !recs.length ? (
              <tr><td colSpan={7} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>Nenhuma recorrência encontrada.</td></tr>
            ) : recs.map(r => (
              <tr key={r.id}>
                <td><span className={`badge ${r.tipo==="entrada"?"badge-green":"badge-red"}`}>{r.tipo==="entrada"?"Entrada":"Saída"}</span></td>
                <td style={{ fontWeight:"500" }}>{r.descricao}</td>
                <td><span className="badge badge-gray" style={{ textTransform:"capitalize" }}>{r.periodicidade}</span></td>
                <td style={{ color:"#a0a0a0" }}>Dia {r.dia_vencimento}</td>
                <td style={{ color:r.tipo==="entrada"?"#29ABE2":"#ef4444", fontWeight:"600" }}>{formatCurrency(r.valor)}</td>
                <td>
                  <button onClick={() => toggleAtivo(r.id, r.ativo)} style={{
                    padding:"4px 10px", borderRadius:"20px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"500",
                    background:r.ativo?"rgba(41,171,226,0.15)":"rgba(96,96,96,0.15)",
                    color:r.ativo?"#29ABE2":"#606060",
                  }}>
                    {r.ativo ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button className="btn-secondary" style={{ padding:"5px 10px", fontSize:"12px", cursor:"pointer" }}
                      onClick={() => setEditando(r)}>
                      <Edit2 size={12}/> Editar
                    </button>
                    <button className="btn-danger" style={{ padding:"5px 10px", fontSize:"12px", cursor:"pointer" }}
                      onClick={() => remover(r.id)}>
                      <Trash2 size={12}/> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <RecModal onClose={() => setShowModal(false)} onSave={carregar}/>}
      {editando && <RecModal rec={editando} onClose={() => setEditando(null)} onSave={carregar}/>}
    </div>
  );
}
