"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, Check, X } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Time { id: string; nome: string; permissoes: Record<string, string[]>; created_at: string; }

const MODULOS = [
  { key:"inicio", label:"Início", perms:["Visualizar"] },
  { key:"clientes", label:"Clientes", perms:["Criar","Remover","Editar","Listar","Visualizar"] },
  { key:"inbox", label:"Inbox WhatsApp", perms:["Visualizar","Enviar"] },
  { key:"crm", label:"CRM", perms:["Criar","Remover","Editar","Listar","Visualizar"] },
  { key:"controle_clientes", label:"Controle de Clientes", perms:["Criar","Remover","Editar","Listar","Visualizar"] },
  { key:"cadastros", label:"Cadastros", perms:["Criar","Remover","Editar","Listar","Visualizar"] },
  { key:"reunioes", label:"Reuniões", perms:["Criar","Remover","Editar","Listar","Visualizar"] },
  { key:"gerador_de_leads", label:"Gerador de Leads", perms:["Visualizar","Criar"] },
  { key:"relatorios_meta", label:"Relatórios Meta", perms:["Visualizar"] },
  { key:"escala_ester", label:"Escala Ester", perms:["Visualizar","Editar"] },
  { key:"escala_nicolas", label:"Escala Nicolas", perms:["Visualizar","Editar"] },
  { key:"churn", label:"Churn", perms:["Visualizar"] },
  { key:"links_campanhas", label:"Links & Campanhas", perms:["Criar","Remover","Editar","Visualizar"] },
  { key:"configurar_campanha", label:"Configurar Campanha", perms:["Criar","Remover","Editar","Visualizar"] },
  { key:"gerador_links", label:"Gerador de Links", perms:["Criar","Visualizar"] },
  { key:"jornada", label:"Jornada de Compra", perms:["Visualizar","Editar"] },
  { key:"dre", label:"DRE", perms:["Visualizar"] },
  { key:"metas", label:"Metas", perms:["Criar","Remover","Editar","Listar","Visualizar"] },
  { key:"vivian_ia", label:"Vivian IA", perms:["Visualizar"] },
  { key:"lancamentos", label:"Lançamentos Futuros", perms:["Criar","Remover","Editar","Exportar","Listar","Visualizar"] },
  { key:"movimentacoes", label:"Movimentações", perms:["Criar","Remover","Editar","Exportar","Listar","Visualizar"] },
  { key:"recorrencias", label:"Recorrências", perms:["Criar","Remover","Editar","Exportar","Listar","Visualizar"] },
  { key:"universidade", label:"Universidade", perms:["Visualizar"] },
  { key:"configuracoes", label:"Configurações", perms:["Visualizar","Editar"] },
];

function TimeModal({ item, onClose, onSave }: { item?: Time; onClose:()=>void; onSave:()=>void }) {
  const isEdit = !!item;
  const [nome, setNome] = useState(item?.nome || "");
  const [permissoes, setPermissoes] = useState<Record<string, string[]>>(item?.permissoes || {});
  const [loading, setLoading] = useState(false);

  const togglePerm = (modulo: string, perm: string) => {
    setPermissoes(prev => {
      const atual = prev[modulo] || [];
      const novo = atual.includes(perm) ? atual.filter(p=>p!==perm) : [...atual, perm];
      return { ...prev, [modulo]: novo };
    });
  };

  const handleSave = async () => {
    if (!nome.trim()) { alert("Preencha o nome"); return; }
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      if (isEdit) {
        await supabase.from("times").update({ nome, permissoes }).eq("id", item!.id);
      } else {
        await supabase.from("times").insert({ agencia_id: agId, nome, permissoes });
      }
      onSave(); onClose();
    } catch(e) { console.error(e); alert("Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{maxWidth:"600px",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h2 style={{fontSize:"17px",fontWeight:"600"}}>{isEdit?"Editar":"Novo"} time</h2>
          <button onClick={onClose} className="btn-ghost" style={{padding:"6px",cursor:"pointer"}}><X size={16}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
          <div className="form-group">
            <label className="form-label">Nome do time *</label>
            <input className="form-input" placeholder="Ex: Vendas, Financeiro..." value={nome} onChange={e=>setNome(e.target.value)}/>
          </div>
          <div>
            <label className="form-label" style={{marginBottom:"12px",display:"block"}}>Permissões por módulo</label>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {MODULOS.map(m=>(
                <div key={m.key} style={{background:"#1a1a1a",borderRadius:"8px",padding:"12px 16px",border:"1px solid #2e2e2e"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
                    <span style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0",minWidth:"130px"}}>{m.label}</span>
                    <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                      {m.perms.map(p=>{
                        const ativo = (permissoes[m.key]||[]).includes(p);
                        return (
                          <button key={p} onClick={()=>togglePerm(m.key,p)} style={{
                            padding:"4px 10px",borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:"500",
                            border:`1px solid ${ativo?"#29ABE2":"#3a3a3a"}`,
                            background:ativo?"rgba(41,171,226,0.15)":"#222",
                            color:ativo?"#f0f0f0":"#606060",
                          }}>{p}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

export default function TimesPage() {
  const [items, setItems] = useState<Time[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Time|null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      let q = supabase.from("times").select("*").eq("agencia_id", agId!).order("nome");
      if (busca) q = q.ilike("nome", `%${busca}%`);
      const { data } = await q;
      setItems(data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [busca]);

  const remover = async (id: string) => {
    if (!confirm("Remover este time?")) return;
    await supabase.from("times").delete().eq("id", id);
    carregar();
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span style={{color:"#a0a0a0"}}>Configurações</span><span>›</span>
        <span className="current">Times</span>
      </div>
      <h1 style={{fontSize:"22px",fontWeight:"600",marginBottom:"24px"}}>Times</h1>
      <div className="table-wrapper">
        <div style={{padding:"16px",display:"flex",gap:"12px",borderBottom:"1px solid #2e2e2e"}}>
          <div style={{position:"relative",flex:1}}>
            <Search size={14} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#606060"}}/>
            <input className="search-input" placeholder="Buscar times..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
          <button className="btn-primary" onClick={()=>setShowModal(true)} style={{cursor:"pointer"}}>
            <Plus size={14}/> Novo time
          </button>
        </div>
        <table>
          <thead><tr><th>NOME</th><th>MÓDULOS COM ACESSO</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{textAlign:"center",color:"#606060",padding:"40px"}}>Carregando...</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={3} style={{textAlign:"center",color:"#606060",padding:"40px"}}>Nenhum time encontrado.</td></tr>
            ) : items.map(t=>{
              const modulos = Object.keys(t.permissoes||{}).filter(k=>(t.permissoes[k]||[]).length>0);
              return (
                <tr key={t.id}>
                  <td style={{fontWeight:"500"}}>{t.nome}</td>
                  <td>
                    <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                      {modulos.slice(0,4).map(m=>(
                        <span key={m} className="badge badge-gray" style={{textTransform:"capitalize"}}>{m}</span>
                      ))}
                      {modulos.length>4&&<span className="badge badge-gray">+{modulos.length-4}</span>}
                      {modulos.length===0&&<span style={{color:"#606060",fontSize:"12px"}}>Sem permissões</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{display:"flex",gap:"6px"}}>
                      <button className="btn-secondary" style={{padding:"5px 10px",fontSize:"12px",cursor:"pointer"}} onClick={()=>setEditando(t)}>
                        <Edit2 size={12}/> Editar
                      </button>
                      <button className="btn-danger" style={{padding:"5px 10px",fontSize:"12px",cursor:"pointer"}} onClick={()=>remover(t.id)}>
                        <Trash2 size={12}/> Remover
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showModal && <TimeModal onClose={()=>setShowModal(false)} onSave={carregar}/>}
      {editando && <TimeModal item={editando} onClose={()=>setEditando(null)} onSave={carregar}/>}
    </div>
  );
}
