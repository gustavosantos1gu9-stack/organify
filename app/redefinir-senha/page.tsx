"use client";

import { useState } from "react";
import { AlertCircle, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RedefinirSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar email");
      setEnviado(true);
    } catch(e: any) {
      setErro(e.message || "Erro ao enviar email");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"380px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", justifyContent:"center", marginBottom:"40px" }}>
          <img src="/logo.png" alt="SALX Convert" style={{ width:"48px", height:"48px", objectFit:"contain" }}/>
          <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
            <span style={{ fontSize:"20px", fontWeight:"800", color:"#0A1826", letterSpacing:"-0.5px" }}>SALX <span style={{ color:"#1C6CA6" }}>Convert</span></span>
          </div>
        </div>
        <div style={{ background:"#FFFFFF", border:"1px solid #E6EBF0", borderRadius:"16px", padding:"32px" }}>
          {enviado ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ width:"48px", height:"48px", background:"rgba(30,107,82,0.15)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                <Check size={24} style={{ color:"#1E6B52" }}/>
              </div>
              <h2 style={{ fontSize:"16px", fontWeight:"600", color:"#0A1826", marginBottom:"8px" }}>Email enviado!</h2>
              <p style={{ fontSize:"13px", color:"#4A5B6C", marginBottom:"20px" }}>
                Verifique sua caixa de entrada em <strong style={{ color:"#0A1826" }}>{email}</strong> e clique no link para redefinir sua senha.
              </p>
              <Link href="/login" style={{ fontSize:"13px", color:"#1E6B52", textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                <ArrowLeft size={13}/> Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleEnviar} style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
              <div>
                <h2 style={{ fontSize:"16px", fontWeight:"600", color:"#0A1826", marginBottom:"4px" }}>Redefinir senha</h2>
                <p style={{ fontSize:"13px", color:"#4A5B6C" }}>Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
              </div>
              {erro && (
                <div style={{ background:"rgba(180,35,24,0.1)", border:"1px solid rgba(180,35,24,0.25)", borderRadius:"8px", padding:"10px 14px", display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#B42318" }}>
                  <AlertCircle size={14}/>{erro}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent:"center", padding:"12px", opacity:loading?0.7:1 }} disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de redefinição"}
              </button>
              <Link href="/login" style={{ fontSize:"13px", color:"#4A5B6C", textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                <ArrowLeft size={13}/> Voltar para o login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
