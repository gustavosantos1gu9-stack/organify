"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, Check, X } from "lucide-react";
import { useOrigens, criarOrigem, removerOrigem } from "@/lib/hooks";

export default function OrigensPage() {
  const { data: origens, loading, refresh } = useOrigens();
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  const filtradas = origens?.filter((o) => o.nome.toLowerCase().includes(busca.toLowerCase())) ?? [];

  const handleAdicionar = async () => {
    if (!nova.trim()) return;
    try { await criarOrigem(nova.trim()); setNova(""); setAdicionando(false); refresh(); }
    catch { alert("Erro ao criar origem"); }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><a href="#">Configurações</a><span>›</span><a href="#">Clientes</a><span>›</span>
        <span className="current">Origens</span>
      </div>
      <h1 style={{ fontSize:"22px",fontWeight:"600",marginBottom:"24px" }}>Origens</h1>

      <div className="table-wrapper">
        <div style={{ padding:"16px",display:"flex",gap:"12px",borderBottom:"1px solid #2e2e2e" }}>
          <div style={{ position:"relative",flex:1 }}>
            <Search size={14} style={{ position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar origens..." value={busca} onChange={(e)=>setBusca(e.target.value)}/>
          </div>
          <button className="btn-primary" onClick={()=>setAdicionando(true)}><Plus size={14}/> Nova origem</button>
        </div>

        {adicionando && (
          <div style={{ padding:"12px 16px",borderBottom:"1px solid #2e2e2e",display:"flex",gap:"8px" }}>
            <input className="form-input" placeholder="Nome da origem" value={nova} onChange={(e)=>setNova(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&handleAdicionar()} autoFocus style={{ flex:1 }}/>
            <button className="btn-primary" style={{ padding:"8px" }} onClick={handleAdicionar}><Check size={14}/></button>
            <button className="btn-ghost" style={{ padding:"8px" }} onClick={()=>{setAdicionando(false);setNova("");}}><X size={14}/></button>
          </div>
        )}

        <table>
          <thead><tr><th><input type="checkbox" style={{ width:"14px",height:"14px" }}/></th><th>TODOS</th><th>NOME</th><th>STATUS</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Nenhuma origem encontrada.</td></tr>
            ) : filtradas.map((o) => (
              <tr key={o.id}>
                <td><input type="checkbox" style={{ width:"14px",height:"14px" }}/></td>
                <td></td>
                <td style={{ fontWeight:"500" }}>{o.nome}</td>
                <td><span className={`badge ${o.ativo?"badge-green":"badge-gray"}`}>{o.ativo?"Ativo":"Inativo"}</span></td>
                <td>
                  <div style={{ display:"flex",gap:"6px" }}>
                    <button className="btn-secondary" style={{ padding:"5px 10px",fontSize:"12px" }}><Edit2 size={12}/> Editar</button>
                    <button className="btn-danger" style={{ padding:"5px 10px",fontSize:"12px" }} onClick={async()=>{ if(confirm("Remover?")){ await removerOrigem(o.id); refresh(); } }}><Trash2 size={12}/> Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
