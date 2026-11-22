"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/supabase";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      const { error } = await signIn(email, senha);
      if (error) {
        setErro(error.message.includes("Invalid login") ? "E-mail ou senha incorretos." : error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErro("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 60% 30%, rgba(28,108,166,0.18) 0%, var(--navy) 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "40px" }}>
          <img src="/logo-salx.png" alt="SALX Convert" style={{ width: "80px", height: "72px", objectFit: "contain" }}/>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontSize: "22px", fontWeight: "800", color: "#0A1826", letterSpacing: "-0.5px" }}>
              SALX <span style={{ color: "var(--brand)" }}>Convert</span>
            </span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textAlign: "center", letterSpacing: "0.05em", marginTop: "3px" }}>
              acelerador de vendas
            </span>
          </div>
        </div>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "16px", padding: "32px", boxShadow: "var(--shadow-modal)" }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {erro && (
              <div style={{ background: "var(--alert-bg)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--alert-text)" }}>
                <AlertCircle size={14} />{erro}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <div style={{ position: "relative" }}>
                <input className="form-input" type={showSenha ? "text" : "password"} placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ paddingRight: "40px" }} />
                <button type="button" onClick={() => setShowSenha(!showSenha)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
                  {showSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "-8px" }}>
              <Link href="/redefinir-senha" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>Alterar senha</Link>
              <Link href="/redefinir-senha" style={{ fontSize: "12px", color: "var(--brand)", textDecoration: "none" }}>Esqueceu a senha?</Link>
            </div>
            <button type="submit" className="btn-primary" style={{ justifyContent: "center", padding: "12px", opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
        <p style={{ textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "24px" }}>© 2026 SALX Digital. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}
