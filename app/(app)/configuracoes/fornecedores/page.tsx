"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, Check, X, User, Building2 } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Fornecedor {
  id: string; nome: string; tipo: "fisica"|"juridica"; documento?: string;
  email?: string; telefone?: string; created_at: string;
}

function FornecedorModal({ item, onClose, onSave }: { item?: Fornecedor; onClose:()=>void; onSave:()=>void }) {
  const isEdit = !!item;
  const [tipo, setTipo] = useState<"fisica"|"juridica">(item?.tipo || "juridica");
  const [form, setForm] = useState({
    nome: item?.nome || "",
    documento: item?.documento || "",
    email: item?.email || "",
    telefone: item?.telefone || "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { alert("Preencha o nome"); return; }
    setLoading(true);
    try {
      const agenciaId = await getAgenciaId();
      if (isEdit) {
        await supabase.from("fornecedores").update({ tipo, ...form }).eq("id", item!.id);
      } else {
        await supabase.from("fornecedores").insert({ agencia_id: agenciaId, tipo, ...form });
      }
      onSave(); onClose();
    } catch(e) { console.error(e); alert("Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{maxWidth:"480px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h2 style={{fontSize:"17px",fontWeight:"600"}}>{isEdit?"Editar":"Novo"} fornecedor</h2>
          <button onClick={onClose} className="btn-ghost" style={{padding:"6px",cursor:"pointer"}}><X size={16}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div className="form-group">
            <label className="form-label">Tipo de pessoa</label>
            <div style={{display:"flex",gap:"8px"}}>
              {(["fisica","juridica"] as const).map(t=>(
                <button key={t} onClick={()=>setTipo(t)} style={{
                  flex:1,padding:"10px",borderRadius:"8px",cursor:"pointer",
                  border:`1px solid ${tipo===t?"#f0f0f0":"#2e2e2e"}`,
                  background:tipo===t?"rgba(41,171,226,0.1)":"#222",
                  color:tipo===t?"#f0f0f0":"#a0a0a0",
                  fontSize:"13px",fontWeight:"500",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"
                }}>
                  {t==="fisica"?<User size={14}/>:<Building2 size={14}/>}
                  {t==="fisica"?"Pessoa física":"Pessoa jurídica"}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" placeholder="Nome do fornecedor" value={form.nome} onChange={e=>set("nome",e.target.value)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div className="form-group">
              <label className="form-label">{tipo==="fisica"?"CPF":"CNPJ"}</label>
              <input className="form-input" placeholder={tipo==="fisica"?"000.000.000-00":"00.000.000/0000-00"} value={form.documento} onChange={e=>set("documento",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" placeholder="(00) 00000-0000" value={form.telefone} onChange={e=>set("telefone",e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e=>set("email",e.target.value)}/>
          </div>
        </div>
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

export default function FornecedoresPage() {
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Fornecedor|null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      let q = supabase.from("fornecedores").select("*").eq("agencia_id", agId!).order("nome");
      if (busca) q = q.ilike("nome", `%${busca}%`);
      const { data } = await q;
      setItems(data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [busca]);

  const remover = async (id: string) => {
    if (!confirm("Remover este fornecedor?")) return;
    await supabase.from("fornecedores").delete().eq("id", id);
    carregar();
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span style={{color:"#a0a0a0"}}>Configurações</span><span>›</span>
        <span className="current">Fornecedores</span>
      </div>
      <h1 style={{fontSize:"22px",fontWeight:"600",marginBottom:"24px"}}>Fornecedores</h1>
      <div className="table-wrapper">
        <div style={{padding:"16px",display:"flex",gap:"12px",borderBottom:"1px solid #2e2e2e"}}>
          <div style={{position:"relative",flex:1}}>
            <Search size={14} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#606060"}}/>
            <input className="search-input" placeholder="Buscar fornecedores..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
          <button className="btn-primary" onClick={()=>setShowModal(true)} style={{cursor:"pointer"}}>
            <Plus size={14}/> Novo fornecedor
          </button>
        </div>
        <table>
          <thead><tr><th>TIPO</th><th>NOME</th><th>CNPJ/CPF</th><th>E-MAIL</th><th>TELEFONE</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{textAlign:"center",color:"#606060",padding:"40px"}}>Carregando...</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={6} style={{textAlign:"center",color:"#606060",padding:"40px"}}>Nenhum fornecedor encontrado.</td></tr>
            ) : items.map(f=>(
              <tr key={f.id}>
                <td><span className="badge badge-gray">{f.tipo==="fisica"?"Pessoa física":"Pessoa jurídica"}</span></td>
                <td style={{fontWeight:"500"}}>{f.nome}</td>
                <td style={{color:"#a0a0a0"}}>{f.documento||"—"}</td>
                <td style={{color:"#a0a0a0"}}>{f.email||"—"}</td>
                <td style={{color:"#a0a0a0"}}>{f.telefone||"—"}</td>
                <td>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button className="btn-secondary" style={{padding:"5px 10px",fontSize:"12px",cursor:"pointer"}} onClick={()=>setEditando(f)}>
                      <Edit2 size={12}/> Editar
                    </button>
                    <button className="btn-danger" style={{padding:"5px 10px",fontSize:"12px",cursor:"pointer"}} onClick={()=>remover(f.id)}>
                      <Trash2 size={12}/> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <FornecedorModal onClose={()=>setShowModal(false)} onSave={carregar}/>}
      {editando && <FornecedorModal item={editando} onClose={()=>setEditando(null)} onSave={carregar}/>}
    </div>
  );
}
