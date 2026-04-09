"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, Check, X } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Time { id: string; nome: string; }
interface AgenciaFilha { id: string; nome: string; }
interface Usuario { id: string; nome: string; cpf?: string; email: string; time_id?: string; ativo: boolean; times?: { nome: string }; }

function UsuarioModal({ item, times, agenciasFilhas, onClose, onSave }: { item?: Usuario; times: Time[]; agenciasFilhas: AgenciaFilha[]; onClose:()=>void; onSave:()=>void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    nome: item?.nome || "",
    cpf: item?.cpf || "",
    email: item?.email || "",
    time_id: item?.time_id || "",
    ativo: item?.ativo ?? true,
  });
  const [acessoFilhas, setAcessoFilhas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string|boolean) => setForm(f=>({...f,[k]:v}));

  // Carregar acessos existentes ao editar
  useEffect(() => {
    if (isEdit && item) {
      supabase.from("usuarios_agencias").select("agencia_id").eq("usuario_id", item.id)
        .then(({ data }) => setAcessoFilhas((data || []).map(d => d.agencia_id)));
    }
  }, [item]);

  const [erro, setErro] = useState("");

  const handleSave = async () => {
    if (!form.nome.trim()||!form.email.trim()) { setErro("Preencha nome e e-mail"); return; }
    setLoading(true);
    setErro("");
    try {
      const agId = await getAgenciaId();
      const payload = { nome:form.nome, cpf:form.cpf||undefined, email:form.email, time_id:form.time_id||undefined, ativo:form.ativo };
      let userId = item?.id;
      if (isEdit) {
        await supabase.from("usuarios").update(payload).eq("id", item!.id);
      } else {
        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, agencia_id: agId }),
        });
        const data = await res.json();
        if (!res.ok) { setErro(data.error || "Erro ao criar usuário"); setLoading(false); return; }
        userId = data.id;
      }
      // Salvar acessos a agências filhas
      if (userId) {
        await supabase.from("usuarios_agencias").delete().eq("usuario_id", userId);
        if (acessoFilhas.length > 0) {
          await supabase.from("usuarios_agencias").insert(
            acessoFilhas.map(agId => ({ usuario_id: userId, agencia_id: agId }))
          );
        }
      }
      onSave(); onClose();
    } catch(e: any) { console.error(e); setErro(e.message || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{maxWidth:"480px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h2 style={{fontSize:"17px",fontWeight:"600"}}>{isEdit?"Editar":"Novo"} usuário</h2>
          <button onClick={onClose} className="btn-ghost" style={{padding:"6px",cursor:"pointer"}}><X size={16}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" placeholder="Nome completo" value={form.nome} onChange={e=>set("nome",e.target.value)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div className="form-group">
              <label className="form-label">CPF</label>
              <input className="form-input" placeholder="000.000.000-00" value={form.cpf} onChange={e=>set("cpf",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">E-mail *</label>
              <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e=>set("email",e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Time</label>
            <select className="form-input" value={form.time_id} onChange={e=>set("time_id",e.target.value)}>
              <option value="">Selecione</option>
              {times.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <div style={{display:"flex",gap:"8px"}}>
              {[{v:true,l:"Ativo"},{v:false,l:"Inativo"}].map(s=>(
                <button key={String(s.v)} onClick={()=>set("ativo",s.v)} style={{
                  flex:1,padding:"8px",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"500",
                  border:`1px solid ${form.ativo===s.v?"#f0f0f0":"#2e2e2e"}`,
                  background:form.ativo===s.v?"rgba(41,171,226,0.1)":"#222",
                  color:form.ativo===s.v?"#f0f0f0":"#a0a0a0",
                }}>{s.l}</button>
              ))}
            </div>
          </div>
          {agenciasFilhas.length > 0 && (
            <div className="form-group">
              <label className="form-label">Acesso a Agências (clientes)</label>
              <div style={{display:"flex",flexDirection:"column",gap:"6px",maxHeight:"160px",overflowY:"auto"}}>
                {agenciasFilhas.map(ag => (
                  <button key={ag.id} onClick={() => setAcessoFilhas(prev => prev.includes(ag.id) ? prev.filter(x=>x!==ag.id) : [...prev, ag.id])}
                    style={{
                      display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",
                      background: acessoFilhas.includes(ag.id) ? "rgba(41,171,226,0.1)" : "#1a1a1a",
                      border: `1px solid ${acessoFilhas.includes(ag.id) ? "#29ABE2" : "#2e2e2e"}`,
                      borderRadius:"8px",cursor:"pointer",textAlign:"left",color:"#f0f0f0",fontSize:"13px",width:"100%",
                    }}>
                    <div style={{width:"18px",height:"18px",borderRadius:"4px",border:`2px solid ${acessoFilhas.includes(ag.id)?"#29ABE2":"#606060"}`,display:"flex",alignItems:"center",justifyContent:"center",background:acessoFilhas.includes(ag.id)?"#29ABE2":"transparent",flexShrink:0}}>
                      {acessoFilhas.includes(ag.id) && <Check size={12} color="#fff"/>}
                    </div>
                    {ag.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {erro && (
          <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"8px", padding:"10px 14px", fontSize:"13px", color:"#ef4444", marginTop:"12px" }}>{erro}</div>
        )}
        {!isEdit && (
          <p style={{ fontSize:"11px", color:"#606060", marginTop:"12px" }}>O usuário receberá um email de convite para definir sua senha e acessar a plataforma.</p>
        )}
        <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"24px"}}>
          <button className="btn-secondary" onClick={onClose} style={{cursor:"pointer"}}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{cursor:"pointer"}}>
            <Check size={14}/> {loading?"Salvando...":"Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const [items, setItems] = useState<Usuario[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [agenciasFilhas, setAgenciasFilhas] = useState<AgenciaFilha[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Usuario|null>(null);
  const carregar = async () => {
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      const [{ data: usuarios }, { data: ts }, { data: filhas }] = await Promise.all([
        supabase.from("usuarios").select("*, times!usuarios_time_id_fkey(nome)").eq("agencia_id", agId!).order("nome"),
        supabase.from("times").select("id,nome").eq("agencia_id", agId!).order("nome"),
        supabase.from("agencias").select("id,nome").eq("parent_id", agId!).order("nome"),
      ]);
      setItems(usuarios || []);
      setTimes(ts || []);
      setAgenciasFilhas(filhas || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = items.filter(u=>u.nome.toLowerCase().includes(busca.toLowerCase())||u.email.toLowerCase().includes(busca.toLowerCase()));

  const remover = async (id: string) => {
    if (!confirm("Remover este usuário?")) return;
    await supabase.from("usuarios").delete().eq("id", id);
    carregar();
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span style={{color:"#a0a0a0"}}>Configurações</span><span>›</span>
        <span className="current">Usuários</span>
      </div>
      <h1 style={{fontSize:"22px",fontWeight:"600",marginBottom:"24px"}}>Usuários</h1>
      <div className="table-wrapper">
        <div style={{padding:"16px",display:"flex",gap:"12px",borderBottom:"1px solid #2e2e2e"}}>
          <div style={{position:"relative",flex:1}}>
            <Search size={14} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#606060"}}/>
            <input className="search-input" placeholder="Buscar usuários..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
          <button className="btn-primary" onClick={()=>setShowModal(true)} style={{cursor:"pointer"}}>
            <Plus size={14}/> Novo usuário
          </button>
        </div>
        <table>
          <thead><tr><th>NOME</th><th>CPF</th><th>E-MAIL</th><th>TIME</th><th>STATUS</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{textAlign:"center",color:"#606060",padding:"40px"}}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={6} style={{textAlign:"center",color:"#606060",padding:"40px"}}>Nenhum usuário encontrado.</td></tr>
            ) : filtrados.map(u=>(
              <tr key={u.id}>
                <td style={{fontWeight:"500"}}>{u.nome}</td>
                <td style={{color:"#a0a0a0"}}>{u.cpf||"—"}</td>
                <td style={{color:"#a0a0a0"}}>{u.email}</td>
                <td><span className="badge badge-gray">{u.times?.nome||"—"}</span></td>
                <td>
                  <span style={{
                    padding:"3px 10px",borderRadius:"20px",fontSize:"12px",fontWeight:"500",
                    background:u.ativo?"rgba(41,171,226,0.15)":"rgba(96,96,96,0.15)",
                    color:u.ativo?"#f0f0f0":"#606060"
                  }}>{u.ativo?"Ativo":"Inativo"}</span>
                </td>
                <td>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button className="btn-secondary" style={{padding:"5px 10px",fontSize:"12px",cursor:"pointer"}} onClick={()=>setEditando(u)}>
                      <Edit2 size={12}/> Editar
                    </button>
                    <button className="btn-danger" style={{padding:"5px 10px",fontSize:"12px",cursor:"pointer"}} onClick={()=>remover(u.id)}>
                      <Trash2 size={12}/> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <UsuarioModal times={times} agenciasFilhas={agenciasFilhas} onClose={()=>setShowModal(false)} onSave={carregar}/>}
      {editando && <UsuarioModal item={editando} times={times} agenciasFilhas={agenciasFilhas} onClose={()=>setEditando(null)} onSave={carregar}/>}
    </div>
  );
}
