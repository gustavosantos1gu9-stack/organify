"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/supabase";
import { SalxLogo } from "@/components/layout/SalxLogo";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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

    const { error } = await signIn(email, senha);

    if (error) {
      setErro("E-mail ou senha inválidos.");
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(41,171,226,0.12) 0%, #050505 60%)",
        backgroundColor: "#050505",
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          backgroundColor: "#0d0d0d",
          border: "1px solid #1e1e1e",
          boxShadow: "0 0 60px rgba(41,171,226,0.08)",
        }}
      >
        <div className="flex justify-center mb-8">
          <SalxLogo size="lg" />
        </div>

        <h2 className="text-center text-sm mb-6" style={{ color: "#555", letterSpacing: "0.05em" }}>
          Acesse sua conta
        </h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "#666" }}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
              style={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", color: "#fff" }}
              onFocus={e => (e.target.style.borderColor = "#29ABE2")}
              onBlur={e => (e.target.style.borderColor = "#2a2a2a")}
            />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: "#666" }}>Senha</label>
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 rounded-lg text-sm outline-none transition-all"
                style={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", color: "#fff" }}
                onFocus={e => (e.target.style.borderColor = "#29ABE2")}
                onBlur={e => (e.target.style.borderColor = "#2a2a2a")}
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#555" }}
              >
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {erro && (
            <p className="text-xs text-center px-3 py-2 rounded-lg" style={{ color: "#ff6b6b", backgroundColor: "rgba(255,68,68,0.08)" }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-bold tracking-wide transition-all mt-2 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#29ABE2", color: "#fff", opacity: loading ? 0.7 : 1 }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = "#1d9acc"; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = "#29ABE2"; }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "#333" }}>
          SALX Convert © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
