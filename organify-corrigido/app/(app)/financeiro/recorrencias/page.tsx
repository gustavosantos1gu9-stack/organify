"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, X, Check } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

interface Recorrencia {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  periodicidade: string;
  dia_vencimento: number;
  ativo: boolean;
}

const PERIODICIDADES = ["mensal","quinzenal","trimestral","semestral","anual"];

function NovaRecModal({ onClose, onSave }: { onClose:()=>void; onSave:()=>void }) {
  const [form, setForm] = useState({ tipo:"entrada", descricao:"", valor:"", periodicidade:"mensal", dia_vencimento:"1" });
  const [loading, setLoading] = useState(false);
  const set = (k:string,v:string)=>setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if(!form.descricao||!form.valor){alert("Preencha descrição e valor");return;}
    setLoading(true);
    try {
      const agenciaId = await getAgenciaId();
      await supabase.from("recorrencias").insert({
        agencia_id: agenciaId,
        tipo: form.tipo,
        descricao: form.descricao,
        valor: parseFloat(form.valor.replace(",",".")),
        periodicidade: form.periodicidade,
        dia_vencimento: parseInt(form.dia_vencimento)||1,
        ativo: true,
      });
      onSave();
      onClose();
    } catch(e){ console.error(e); alert("Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h2 style={{fontSize:"17px",fontWeight:"600"}}>Nova recorrência</h2>
          <button onClick={onClose} className="btn-ghost" style={{padding:"6px"}}><X size={16}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div style={{display:"flex",gap:"8px"}}>
              {(["entrada","saida"] as const).map(t=>(
                <button key={t} onClick={()=>set("tipo",t)} style={{
                  flex:1,padding:"10px",borderRadius:"8px",cursor:"pointer",
                  border:`1px solid ${form.tipo===t?(t==="entrada"?"#22c55e":"#ef4444"):"#2e2e2e"}`,
                  background:form.tipo===t?(t==="entrada"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)"):"#222",
                  color:form.tipo===t?(t==="entrada"?"#22c55e":"#ef4444"):"#a0a0a0",
                  fontSize:"13px",fontWeight:"500"
                }}>
                  {t==="entrada"?"Entrada":"Saída"}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <input className="form-input" placeholder="Ex: Mensalidade software" value={form.descricao} onChange={e=>set("descricao",e.target.value)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div className="form-group">
              <label className="form-label">Valor *</label>
              <input className="form-input" placeholder="0,00" value={form.valor} onChange={e=>set("valor",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Dia do vencimento</label>
              <input type="number" className="form-input" min="1" max="31" value={form.dia_vencimento} onChange={e=>set("dia_vencimento",e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Periodicidade</label>
            <select className="form-input" value={form.periodicidade} onChange={e=>set("periodicidade",e.target.value)}>
              {PERIODICIDADES.map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"24px"}}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            <Check size={14}/> {loading?"Salvando...":"Salvar"}
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

  const carregar = async () => {
    setLoading(true);
    try {
      const agenciaId = await getAgenciaId();
      let q = supabase
        .from("recorrencias")
        .select("*")
        .eq("agencia_id", agenciaId!)
        .order("created_at", { ascending: false });
      if (busca) q = q.ilike("descricao", `%${busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      setRecs(data || []);
    } catch(e) {
      console.error("Erro ao carregar recorrências:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [busca]);

  const remover = async (id: string) => {
    if (!confirm("Remover esta recorrência?")) return;
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
        <span style={{color:"#a0a0a0"}}>Financeiro</span><span>›</span>
        <span className="current">Recorrências</span>
      </div>
      <h1 style={{fontSize:"22px",fontWeight:"600",marginBottom:"24px"}}>Recorrências</h1>

      <div className="table-wrapper">
        <div style={{padding:"16px",display:"flex",gap:"12px",borderBottom:"1px solid #2e2e2e"}}>
          <div style={{position:"relative",flex:1}}>
            <Search size={14} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#606060"}}/>
            <input className="search-input" placeholder="Buscar recorrências..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
          <button className="btn-primary" onClick={()=>setShowModal(true)}><Plus size={14}/> Nova recorrência</button>
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
              <tr><td colSpan={7} style={{textAlign:"center",color:"#606060",padding:"40px"}}>Carregando...</td></tr>
            ) : !recs.length ? (
              <tr><td colSpan={7} style={{textAlign:"center",color:"#606060",padding:"48px"}}>Nenhuma recorrência encontrada.</td></tr>
            ) : recs.map(r=>(
              <tr key={r.id}>
                <td><span className={`badge ${r.tipo==="entrada"?"badge-green":"badge-red"}`}>{r.tipo==="entrada"?"Entrada":"Saída"}</span></td>
                <td style={{fontWeight:"500"}}>{r.descricao}</td>
                <td><span className="badge badge-gray" style={{textTransform:"capitalize"}}>{r.periodicidade}</span></td>
                <td style={{color:"#a0a0a0"}}>Dia {r.dia_vencimento}</td>
                <td style={{color:r.tipo==="entrada"?"#22c55e":"#ef4444",fontWeight:"600"}}>{formatCurrency(r.valor)}</td>
                <td>
                  <button onClick={()=>toggleAtivo(r.id,r.ativo)} style={{
                    padding:"4px 10px",borderRadius:"20px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"500",
                    background:r.ativo?"rgba(34,197,94,0.15)":"rgba(96,96,96,0.15)",
                    color:r.ativo?"#22c55e":"#606060"
                  }}>
                    {r.ativo?"Ativo":"Inativo"}
                  </button>
                </td>
                <td>
                  <button className="btn-danger" style={{padding:"5px 10px",fontSize:"12px"}} onClick={()=>remover(r.id)}>
                    <Trash2 size={12}/> Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NovaRecModal onClose={()=>setShowModal(false)} onSave={carregar}/>}
    </div>
  );
}
