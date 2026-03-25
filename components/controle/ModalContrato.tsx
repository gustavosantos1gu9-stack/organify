"use client";

import { useState } from "react";
import { X, FileText, Copy, Check } from "lucide-react";

interface Props {
  clienteId: string;
  nome: string;
  email: string;
  cnpj: string;
  cpf: string;
  rg: string;
  endereco_empresa: string;
  endereco_pessoal: string;
  onClose: () => void;
}

export default function ModalContrato({ clienteId, nome, email, cnpj, cpf, rg, endereco_empresa, endereco_pessoal, onClose }: Props) {
  const [investimento, setInvestimento] = useState("");
  const [servicos, setServicos] = useState("");
  const [vigencia, setVigencia] = useState("12 meses");
  const [copiado, setCopiado] = useState(false);

  const dataHoje = new Date().toLocaleDateString("pt-BR");

  const textoContrato = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE:
Nome/Razão Social: ${nome}
${cnpj ? `CNPJ: ${cnpj}` : ""}${cpf ? `\nCPF: ${cpf}` : ""}${rg ? `\nRG: ${rg}` : ""}
${endereco_empresa ? `Endereço Empresa: ${endereco_empresa}` : ""}${endereco_pessoal ? `\nEndereço Pessoal: ${endereco_pessoal}` : ""}
Email: ${email}

OBJETO DO CONTRATO:
${servicos || "(descrever serviços)"}

INVESTIMENTO MENSAL:
${investimento || "(definir valor)"}

VIGÊNCIA:
${vigencia}

Data: ${dataHoje}

_______________________________
${nome}
CONTRATANTE

_______________________________
CONTRATADA`;

  const copiar = () => {
    navigator.clipboard.writeText(textoContrato);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#141414", border:"1px solid #2e2e2e", borderRadius:"12px", width:"560px", maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 12px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ padding:"14px 16px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", gap:"10px" }}>
          <FileText size={18} color="#29ABE2"/>
          <span style={{ flex:1, fontSize:"14px", fontWeight:"600", color:"#f0f0f0" }}>Gerar Contrato — {nome}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={16}/></button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <label style={{ fontSize:"11px", color:"#606060", textTransform:"uppercase", marginBottom:"4px", display:"block" }}>Serviços</label>
            <textarea value={servicos} onChange={e=>setServicos(e.target.value)} placeholder="Ex: Gestão de tráfego, criação de conteúdo..."
              style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"8px 10px", color:"#f0f0f0", fontSize:"13px", minHeight:"60px", resize:"vertical", boxSizing:"border-box" }}/>
          </div>
          <div style={{ display:"flex", gap:"12px" }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:"11px", color:"#606060", textTransform:"uppercase", marginBottom:"4px", display:"block" }}>Investimento Mensal</label>
              <input value={investimento} onChange={e=>setInvestimento(e.target.value)} placeholder="R$ 0,00"
                style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"8px 10px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" }}/>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:"11px", color:"#606060", textTransform:"uppercase", marginBottom:"4px", display:"block" }}>Vigência</label>
              <input value={vigencia} onChange={e=>setVigencia(e.target.value)}
                style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"8px 10px", color:"#f0f0f0", fontSize:"13px", boxSizing:"border-box" }}/>
            </div>
          </div>

          <div>
            <label style={{ fontSize:"11px", color:"#606060", textTransform:"uppercase", marginBottom:"4px", display:"block" }}>Prévia do Contrato</label>
            <pre style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"6px", padding:"12px", color:"#f0f0f0", fontSize:"12px", whiteSpace:"pre-wrap", lineHeight:"1.6", maxHeight:"300px", overflowY:"auto", margin:0 }}>
              {textoContrato}
            </pre>
          </div>
        </div>

        <div style={{ padding:"12px 16px", borderTop:"1px solid #2e2e2e", display:"flex", justifyContent:"flex-end", gap:"8px" }}>
          <button onClick={onClose} style={{ background:"#2e2e2e", border:"none", borderRadius:"8px", padding:"8px 16px", cursor:"pointer", color:"#f0f0f0", fontSize:"13px" }}>Cancelar</button>
          <button onClick={copiar} style={{ background:"#29ABE2", border:"none", borderRadius:"8px", padding:"8px 16px", cursor:"pointer", color:"#000", fontWeight:"600", fontSize:"13px", display:"flex", alignItems:"center", gap:"6px" }}>
            {copiado ? <><Check size={14}/> Copiado!</> : <><Copy size={14}/> Copiar Contrato</>}
          </button>
        </div>
      </div>
    </div>
  );
}
