"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/hooks";
import { Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

function NovaSenhaContent() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Parse hash tokens from Supabase recovery redirect
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (accessToken && type === "recovery") {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || "" })
        .then(({ error }) => {
          if (error) setErro("Link inválido ou expirado. Solicite um novo link.");
          else setSessionReady(true);
        });
    } else {
      // Check if already has a valid session (e.g. PKCE flow)
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setSessionReady(true);
        else setErro("Link inválido ou expirado. Solicite um novo link.");
      });
    }
  }, []);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmar) { setErro("As senhas não coincidem"); return; }
    if (senha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true);
    setErro("");
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setSucesso(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch(e: any) {
      setErro(e.message || "Erro ao atualizar senha");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"380px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", justifyContent:"center", marginBottom:"40px" }}>
          <img src="/logo.png" alt="SALX Convert" style={{ width:"48px", height:"48px", objectFit:"contain" }}/>
          <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
            <span style={{ fontSize:"20px", fontWeight:"800", color:"#f0f0f0", letterSpacing:"-0.5px" }}>SALX <span style={{ color:"#29ABE2" }}>Convert</span></span>
          </div>
        </div>
        <div style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"16px", padding:"32px" }}>
          {!sessionReady && !sucesso ? (
            <div style={{ textAlign:"center", color:"#606060", fontSize:"13px" }}>
              {erro ? (
                <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"8px", padding:"10px 14px", display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#ef4444" }}>
                  <AlertCircle size={14}/>{erro}
                </div>
              ) : "Verificando link..."}
            </div>
          ) : sucesso ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ width:"48px", height:"48px", background:"rgba(34,197,94,0.15)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                <Check size={24} style={{ color:"#22c55e" }}/>
              </div>
              <h2 style={{ fontSize:"16px", fontWeight:"600", color:"#f0f0f0", marginBottom:"8px" }}>Senha atualizada!</h2>
              <p style={{ fontSize:"13px", color:"#606060" }}>Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={handleSalvar} style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
              <div>
                <h2 style={{ fontSize:"16px", fontWeight:"600", color:"#f0f0f0", marginBottom:"4px" }}>Nova senha</h2>
                <p style={{ fontSize:"13px", color:"#606060" }}>Digite sua nova senha abaixo.</p>
              </div>
              {erro && (
                <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"8px", padding:"10px 14px", display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#ef4444" }}>
                  <AlertCircle size={14}/>{erro}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nova senha</label>
                <div style={{ position:"relative" }}>
                  <input className="form-input" type={showSenha?"text":"password"} placeholder="••••••••" value={senha} onChange={e=>setSenha(e.target.value)} required style={{ paddingRight:"40px" }}/>
                  <button type="button" onClick={()=>setShowSenha(!showSenha)} style={{ position:"absolute", right:"10px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#606060" }}>
                    {showSenha?<EyeOff size={15}/>:<Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar senha</label>
                <input className="form-input" type="password" placeholder="••••••••" value={confirmar} onChange={e=>setConfirmar(e.target.value)} required/>
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent:"center", padding:"12px", opacity:loading?0.7:1 }} disabled={loading}>
                {loading?"Salvando...":"Salvar nova senha"}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

export default function NovaSenhaPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#0f0f0f" }}/>}>
      <NovaSenhaContent/>
    </Suspense>
  );
}
