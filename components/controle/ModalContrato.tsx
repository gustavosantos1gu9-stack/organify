"use client";

import { useState } from "react";
import { X, FileText, Send, Check, Loader2 } from "lucide-react";

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

const MODALIDADES = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Antecipado (3 meses)" },
  { value: "quinzenal", label: "Quinzenal (2x)" },
] as const;

export default function ModalContrato({ clienteId, nome, email, cnpj, cpf, rg, endereco_empresa, endereco_pessoal, onClose }: Props) {
  const [modalidade, setModalidade] = useState<"mensal"|"trimestral"|"quinzenal">("mensal");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async () => {
    if (!valor.trim()) { setErro("Informe o valor."); return; }
    if (!dataVencimento.trim()) { setErro("Informe a data de vencimento."); return; }
    if (!email.trim()) { setErro("Cliente sem email cadastrado."); return; }

    setEnviando(true);
    setErro("");

    try {
      const res = await fetch("/api/contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome, email, cnpj, cpf, rg,
          endereco_empresa, endereco_pessoal,
          modalidade, valor, data_vencimento: dataVencimento,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErro(data.error || "Erro ao enviar contrato.");
        return;
      }

      setSucesso(true);
    } catch (e: any) {
      setErro(e.message || "Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#FFFFFF", border:"1px solid #E6EBF0", borderRadius:"12px", width:"480px", maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 12px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ padding:"14px 16px", borderBottom:"1px solid #E6EBF0", display:"flex", alignItems:"center", gap:"10px" }}>
          <FileText size={18} color="#1C6CA6"/>
          <span style={{ flex:1, fontSize:"14px", fontWeight:"600", color:"#0A1826" }}>Enviar Contrato</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#4A5B6C" }}><X size={16}/></button>
        </div>

        {sucesso ? (
          <div style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ width:"56px", height:"56px", borderRadius:"50%", background:"#E3F2EC", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <Check size={28} color="#1E6B52"/>
            </div>
            <p style={{ fontSize:"16px", fontWeight:"600", color:"#0A1826", margin:"0 0 8px" }}>Contrato enviado!</p>
            <p style={{ fontSize:"13px", color:"#4A5B6C", margin:"0 0 24px" }}>
              O contrato foi enviado para <strong style={{ color:"#1C6CA6" }}>{email}</strong> via Autentique para assinatura.
            </p>
            <button onClick={onClose} style={{ background:"#1C6CA6", border:"none", borderRadius:"8px", padding:"10px 24px", cursor:"pointer", color:"#F3F5F7", fontWeight:"600", fontSize:"13px" }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:"14px" }}>
              <div style={{ background:"#FFFFFF", border:"1px solid #E6EBF0", borderRadius:"8px", padding:"12px" }}>
                <p style={{ fontSize:"13px", fontWeight:"600", color:"#0A1826", margin:"0 0 4px" }}>{nome}</p>
                <p style={{ fontSize:"11px", color:"#4A5B6C", margin:0 }}>{email || "Sem email"}</p>
                {cnpj && <p style={{ fontSize:"11px", color:"#4A5B6C", margin:"2px 0 0" }}>CNPJ: {cnpj}</p>}
              </div>

              <div>
                <label style={{ fontSize:"11px", color:"#4A5B6C", textTransform:"uppercase", marginBottom:"6px", display:"block" }}>Modalidade de Pagamento</label>
                <div style={{ display:"flex", gap:"8px" }}>
                  {MODALIDADES.map(m => (
                    <button key={m.value} onClick={()=>setModalidade(m.value)}
                      style={{
                        flex:1, padding:"10px 8px", borderRadius:"8px", cursor:"pointer", fontSize:"12px", fontWeight:"500",
                        background: modalidade === m.value ? "#1C6CA615" : "#FFFFFF",
                        border: modalidade === m.value ? "1px solid #1C6CA6" : "1px solid #E6EBF0",
                        color: modalidade === m.value ? "#1C6CA6" : "#808080",
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:"flex", gap:"12px" }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:"11px", color:"#4A5B6C", textTransform:"uppercase", marginBottom:"4px", display:"block" }}>
                    {modalidade === "trimestral" ? "Valor Total (3 meses)" : "Valor Mensal"}
                  </label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", fontSize:"13px", color:"#4A5B6C" }}>R$</span>
                    <input value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00"
                      style={{ width:"100%", background:"#FFFFFF", border:"1px solid #E6EBF0", borderRadius:"6px", padding:"8px 10px 8px 32px", color:"#0A1826", fontSize:"13px", boxSizing:"border-box" }}/>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:"11px", color:"#4A5B6C", textTransform:"uppercase", marginBottom:"4px", display:"block" }}>1o Vencimento</label>
                  <input value={dataVencimento} onChange={e=>setDataVencimento(e.target.value)} placeholder="dd/mm/aaaa"
                    style={{ width:"100%", background:"#FFFFFF", border:"1px solid #E6EBF0", borderRadius:"6px", padding:"8px 10px", color:"#0A1826", fontSize:"13px", boxSizing:"border-box" }}/>
                </div>
              </div>

              {erro && (
                <p style={{ color:"#B42318", fontSize:"12px", margin:0, background:"#FBE3E1", border:"1px solid #3a1a1a", borderRadius:"6px", padding:"8px 12px" }}>{erro}</p>
              )}
            </div>

            <div style={{ padding:"12px 16px", borderTop:"1px solid #E6EBF0", display:"flex", justifyContent:"flex-end", gap:"8px" }}>
              <button onClick={onClose} style={{ background:"#E6EBF0", border:"none", borderRadius:"8px", padding:"8px 16px", cursor:"pointer", color:"#0A1826", fontSize:"13px" }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando}
                style={{ background: enviando ? "#E8F1F9" : "#1C6CA6", border:"none", borderRadius:"8px", padding:"8px 20px", cursor: enviando ? "default" : "pointer", color:"#F3F5F7", fontWeight:"600", fontSize:"13px", display:"flex", alignItems:"center", gap:"6px", opacity: enviando ? 0.7 : 1 }}>
                {enviando ? <><Loader2 size={14} className="animate-spin"/> Enviando...</> : <><Send size={14}/> Enviar via Autentique</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
