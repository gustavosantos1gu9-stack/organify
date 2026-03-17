"use client";

import { useState } from "react";
import { supabase } from "@/lib/hooks";
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nova-senha`,
      });
      if (error) throw error;
      setEnviado(true);
    } catch(e: any) {
      setErro(e.message || "Erro ao enviar email");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"380px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", justifyContent:"center", marginBottom:"40px" }}>
          <div style={{ width:"36px", height:"36px", background:"#22c55e", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:"18px", fontWeight:"800", color:"#000" }}>O</span>
          </div>
          <span style={{ fontSize:"20px", fontWeight:"700", color:"#f0f0f0" }}>ORGANIFY</span>
        </div>
        <div style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"16px", padding:"32px" }}>
          {enviado ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ width:"48px", height:"48px", background:"rgba(34,197,94,0.15)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                <Check size={24} style={{ color:"#22c55e" }}/>
              </div>
              <h2 style={{ fontSize:"16px", fontWeight:"600", color:"#f0f0f0", marginBottom:"8px" }}>Email enviado!</h2>
              <p style={{ fontSize:"13px", color:"#606060", marginBottom:"20px" }}>
                Verifique sua caixa de entrada em <strong style={{ color:"#f0f0f0" }}>{email}</strong> e clique no link para redefinir sua senha.
              </p>
              <Link href="/login" style={{ fontSize:"13px", color:"#22c55e", textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                <ArrowLeft size={13}/> Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleEnviar} style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
              <div>
                <h2 style={{ fontSize:"16px", fontWeight:"600", color:"#f0f0f0", marginBottom:"4px" }}>Redefinir senha</h2>
                <p style={{ fontSize:"13px", color:"#606060" }}>Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
              </div>
              {erro && (
                <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"8px", padding:"10px 14px", display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#ef4444" }}>
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
              <Link href="/login" style={{ fontSize:"13px", color:"#606060", textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                <ArrowLeft size={13}/> Voltar para o login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
