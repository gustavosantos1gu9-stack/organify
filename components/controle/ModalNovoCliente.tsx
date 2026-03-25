"use client";

import { useState } from "react";
import { X, UserCircle2, Search } from "lucide-react";
import { supabase } from "@/lib/hooks";

interface Cadastro {
  id: string; nome: string; email: string; cnpj: string; cpf: string;
  investimento_anuncios: string; faturamento_medio: string; regiao_anunciar: string;
}

interface Props {
  agId: string;
  cadastros: Cadastro[];
  onClose: () => void;
  onSave: () => void;
}

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function ModalNovoCliente({ agId, cadastros, onClose, onSave }: Props) {
  const [nome, setNome] = useState("");
  const [dataEntrada, setDataEntrada] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  });
  const [investimento, setInvestimento] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [cadastroVinculado, setCadastroVinculado] = useState<Cadastro|null>(null);
  const [buscaCadastro, setBuscaCadastro] = useState("");
  const [mostraBusca, setMostraBusca] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const cadastrosFiltrados = cadastros.filter(c =>
    c.nome.toLowerCase().includes(buscaCadastro.toLowerCase())
  );

  const vincular = (c: Cadastro) => {
    setCadastroVinculado(c);
    setMostraBusca(false);
    setBuscaCadastro("");
    if (!nome) setNome(c.nome);
    if (!faturamento) setFaturamento(c.faturamento_medio || "");
    if (!investimento) setInvestimento(c.investimento_anuncios || "");
  };

  const salvar = async () => {
    if (!nome.trim()) { setErro("Nome obrigatório."); return; }
    setSalvando(true);
    setErro("");
    try {
      const { error } = await supabase.from("controle_clientes").insert({
        agencia_id: agId,
        nome: nome.trim(),
        status: "entrada",
        data_entrada: dataEntrada,
        faturamento_medio: faturamento,
        investimento_mensal: Number(investimento.replace(/\D/g,"")) || 0,
        instagram: "", data_inicio_campanha: "", agendamentos: "",
        progresso_gestor: "", progresso_consultor: "", feed: "", feedback: "",
        sdr: "", head_squad: "", consultor: "", gestor: "", squad: "",
        ultimo_aumento: "", acao: "", acao_feita: "", otimizacoes: "",
        tarefas: "", datas_otimizacoes: "", motivo: "",
        razao_nome: cadastroVinculado?.cnpj || "",
        grupo: "",
        cadastro_id: cadastroVinculado?.id || null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      onSave();
    } catch(e: any) {
      setErro(e.message || "Erro ao criar cliente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200 }}/>
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", background:"#141414", border:"1px solid #2e2e2e", borderRadius:"12px", width:"480px", zIndex:201, boxShadow:"0 20px 60px rgba(0,0,0,0.8)", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <p style={{ fontSize:"15px", fontWeight:"700", color:"#f0f0f0", margin:0 }}>Novo Cliente</p>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={16}/></button>
        </div>

        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:"16px" }}>
          {/* Vincular cadastro */}
          <div style={{ padding:"12px 14px", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"10px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: mostraBusca || cadastroVinculado ? "10px" : "0" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <UserCircle2 size={15} color={cadastroVinculado ? "#29ABE2" : "#606060"}/>
                <span style={{ fontSize:"13px", color: cadastroVinculado ? "#f0f0f0" : "#606060", fontWeight: cadastroVinculado ? "600" : "400" }}>
                  {cadastroVinculado ? cadastroVinculado.nome : "Vincular formulário de cadastro"}
                </span>
                {cadastroVinculado && <span style={{ fontSize:"11px", color:"#22c55e", background:"#052e16", padding:"2px 6px", borderRadius:"8px" }}>vinculado</span>}
              </div>
              <div style={{ display:"flex", gap:"6px" }}>
                {cadastroVinculado && (
                  <button onClick={() => setCadastroVinculado(null)} style={{ background:"none", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"4px 8px", cursor:"pointer", color:"#606060", fontSize:"11px" }}>
                    Remover
                  </button>
                )}
                <button onClick={() => setMostraBusca(v => !v)}
                  style={{ background: mostraBusca ? "#29ABE220" : "none", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"4px 8px", cursor:"pointer", color:"#a0a0a0", fontSize:"11px", display:"flex", alignItems:"center", gap:"4px" }}>
                  <Search size={11}/> {cadastroVinculado ? "Trocar" : "Buscar"}
                </button>
              </div>
            </div>

            {cadastroVinculado && !mostraBusca && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
                {[
                  { label:"CNPJ/CPF", value: cadastroVinculado.cnpj || cadastroVinculado.cpf },
                  { label:"Investimento", value: cadastroVinculado.investimento_anuncios },
                  { label:"Faturamento", value: cadastroVinculado.faturamento_medio },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontSize:"10px", color:"#606060", margin:"0 0 2px" }}>{item.label}</p>
                    <p style={{ fontSize:"12px", color:"#f0f0f0", margin:0 }}>{item.value || "—"}</p>
                  </div>
                ))}
              </div>
            )}

            {mostraBusca && (
              <div>
                <input value={buscaCadastro} onChange={e => setBuscaCadastro(e.target.value)}
                  placeholder="Buscar por nome..." autoFocus
                  style={{ width:"100%", background:"#0f0f0f", border:"1px solid #3a3a3a", borderRadius:"6px", padding:"7px 10px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" as const, outline:"none" }}/>
                <div style={{ maxHeight:"150px", overflowY:"auto", marginTop:"4px", border:"1px solid #2e2e2e", borderRadius:"6px", background:"#0f0f0f" }}>
                  {cadastrosFiltrados.length === 0 ? (
                    <p style={{ color:"#606060", fontSize:"12px", padding:"10px 12px", margin:0 }}>Nenhum cadastro encontrado.</p>
                  ) : cadastrosFiltrados.map(c => (
                    <button key={c.id} onClick={() => vincular(c)}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", color:"#f0f0f0", fontSize:"13px", textAlign:"left" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}>
                      <span>{c.nome}</span>
                      <span style={{ fontSize:"11px", color:"#606060" }}>{c.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Campos */}
          <div>
            <label style={{ display:"block", fontSize:"12px", color:"#606060", marginBottom:"6px" }}>Nome completo *</label>
            <input value={nome} onChange={e => setNome(e.target.value)}
              style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" as const, outline:"none" }}/>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            <div>
              <label style={{ display:"block", fontSize:"12px", color:"#606060", marginBottom:"6px" }}>Data de Entrada</label>
              <input value={dataEntrada} onChange={e => setDataEntrada(e.target.value)}
                placeholder="dd/mm/yyyy"
                style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" as const, outline:"none" }}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:"12px", color:"#606060", marginBottom:"6px" }}>Investimento (R$)</label>
              <input value={investimento} onChange={e => setInvestimento(e.target.value)}
                style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" as const, outline:"none" }}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:"12px", color:"#606060", marginBottom:"6px" }}>Faturamento médio</label>
              <input value={faturamento} onChange={e => setFaturamento(e.target.value)}
                style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" as const, outline:"none" }}/>
            </div>
          </div>

          {erro && <p style={{ color:"#ef4444", fontSize:"13px", margin:0 }}>{erro}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #2e2e2e", display:"flex", justifyContent:"flex-end", gap:"8px" }}>
          <button onClick={onClose} style={{ background:"#2a2a2a", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", color:"#f0f0f0", fontSize:"13px" }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            style={{ background:"#29ABE2", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", color:"#000", fontWeight:"700", fontSize:"13px", opacity: salvando ? 0.7 : 1 }}>
            {salvando ? "Criando..." : "Criar Cliente"}
          </button>
        </div>
      </div>
    </>
  );
}
