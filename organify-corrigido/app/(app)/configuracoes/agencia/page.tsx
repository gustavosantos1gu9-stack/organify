"use client";

import { useState, useEffect } from "react";
import { useAgencia, atualizarAgencia } from "@/lib/hooks";
import { CheckCircle } from "lucide-react";

export default function ConfigAgenciaPage() {
  const { data: agencia, loading, refresh } = useAgencia();
  const [geral, setGeral] = useState({ nome: "", cnpj: "" });
  const [contato, setContato] = useState({ telefone: "", email: "" });
  const [end, setEnd] = useState({ cep:"",estado:"",cidade:"",logradouro:"",numero:"",complemento:"",bairro:"" });
  const [saved, setSaved] = useState<string|null>(null);

  useEffect(() => {
    if (agencia) {
      setGeral({ nome: agencia.nome??"", cnpj: agencia.cnpj??"" });
      setContato({ telefone: agencia.telefone??"", email: agencia.email??"" });
      setEnd({ cep:agencia.cep??"",estado:agencia.estado??"",cidade:agencia.cidade??"",logradouro:agencia.logradouro??"",numero:agencia.numero??"",complemento:agencia.complemento??"",bairro:agencia.bairro??"" });
    }
  }, [agencia]);

  const salvar = async (secao: string, payload: Record<string,string>) => {
    if (!agencia) return;
    try {
      await atualizarAgencia(agencia.id, payload);
      setSaved(secao);
      setTimeout(() => setSaved(null), 2500);
      refresh();
    } catch { alert("Erro ao salvar"); }
  };

  if (loading) return <div style={{ padding:"40px",color:"#606060" }}>Carregando...</div>;

  return (
    <div className="animate-in">
      <div className="breadcrumb"><a href="/">Início</a><span>›</span><a href="#">Configurações</a><span>›</span><span className="current">Agência</span></div>
      <h1 style={{ fontSize:"22px",fontWeight:"600",marginBottom:"28px" }}>Agência</h1>

      {["geral","contato","endereco"].map((secao) => (
        <div key={secao} className="card" style={{ marginBottom:"20px" }}>
          <h2 style={{ fontSize:"16px",fontWeight:"600",marginBottom:"4px",textTransform:"capitalize" }}>{secao === "endereco" ? "Endereço" : secao.charAt(0).toUpperCase()+secao.slice(1)}</h2>
          <p style={{ fontSize:"13px",color:"#606060",marginBottom:"20px" }}>
            {secao==="geral"?"Atualize as informações gerais da sua agência.":secao==="contato"?"Atualize as informações de contato.":"Atualize o endereço da sua agência."}
          </p>
          {secao==="geral" && (
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"16px" }}>
              <div className="form-group"><label className="form-label">Nome da agência</label><input className="form-input" value={geral.nome} onChange={(e)=>setGeral(g=>({...g,nome:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">CNPJ</label><input className="form-input" placeholder="99.999.999/9999-99" value={geral.cnpj} onChange={(e)=>setGeral(g=>({...g,cnpj:e.target.value}))}/></div>
            </div>
          )}
          {secao==="contato" && (
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"16px" }}>
              <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" placeholder="(99) 99999-9999" value={contato.telefone} onChange={(e)=>setContato(c=>({...c,telefone:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" type="email" value={contato.email} onChange={(e)=>setContato(c=>({...c,email:e.target.value}))}/></div>
            </div>
          )}
          {secao==="endereco" && (
            <>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"16px",marginBottom:"16px" }}>
                <div className="form-group"><label className="form-label">CEP</label><input className="form-input" placeholder="99999-999" value={end.cep} onChange={(e)=>setEnd(x=>({...x,cep:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Estado</label><input className="form-input" value={end.estado} onChange={(e)=>setEnd(x=>({...x,estado:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Cidade</label><input className="form-input" value={end.cidade} onChange={(e)=>setEnd(x=>({...x,cidade:e.target.value}))}/></div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:"16px",marginBottom:"16px" }}>
                <div className="form-group"><label className="form-label">Logradouro</label><input className="form-input" placeholder="Rua, Avenida..." value={end.logradouro} onChange={(e)=>setEnd(x=>({...x,logradouro:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Número</label><input className="form-input" value={end.numero} onChange={(e)=>setEnd(x=>({...x,numero:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Complemento</label><input className="form-input" value={end.complemento} onChange={(e)=>setEnd(x=>({...x,complemento:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Bairro</label><input className="form-input" value={end.bairro} onChange={(e)=>setEnd(x=>({...x,bairro:e.target.value}))}/></div>
              </div>
            </>
          )}
          <div style={{ display:"flex",justifyContent:"flex-end",alignItems:"center",gap:"12px" }}>
            {saved===secao && <span style={{ fontSize:"13px",color:"#22c55e",display:"flex",alignItems:"center",gap:"6px" }}><CheckCircle size={14}/> Salvo!</span>}
            <button className="btn-primary" onClick={() => {
              const payload = secao==="geral"?geral:secao==="contato"?contato:end;
              salvar(secao, payload as Record<string,string>);
            }}>Salvar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
