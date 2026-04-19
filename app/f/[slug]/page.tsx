"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Pergunta {
  id: string;
  tipo: "text" | "select" | "phone" | "email" | "textarea" | "radio" | "welcome" | "video";
  label: string;
  descricao?: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[];
  videoUrl?: string;
  imagemUrl?: string;
  botaoTexto?: string;
}

export default function FormularioPublico() {
  const params = useParams();
  const slug = params.slug as string;
  const [form, setForm] = useState<any>(null);
  const [logo, setLogo] = useState("");
  const [nomeAgencia, setNomeAgencia] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("formularios").select("*, agencias(logo_url, nome)").eq("slug", slug).eq("ativo", true).single();
      if (data) {
        setForm(data);
        setLogo(data.agencias?.logo_url || "");
        setNomeAgencia(data.agencias?.nome || "");
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [step]);

  const perguntas: Pergunta[] = form?.perguntas || [];
  const current = perguntas[step];
  const cor = form?.cor_primaria || "#29ABE2";
  const fundo = form?.cor_fundo || "#0a0a0a";
  const total = perguntas.length;
  const progresso = total > 0 ? ((step) / total) * 100 : 0;

  const isInputStep = current && !["welcome", "video"].includes(current.tipo);
  const canProceed = () => {
    if (!current) return false;
    if (current.tipo === "welcome" || current.tipo === "video") return true;
    if (!current.obrigatorio) return true;
    return !!respostas[current.id]?.trim();
  };

  const next = () => {
    if (!canProceed()) { setErro(`Preencha o campo "${current.label}"`); return; }
    setErro("");
    if (step < total - 1) { setDir(1); setStep(s => s + 1); }
    else handleSubmit();
  };

  const prev = () => { if (step > 0) { setDir(-1); setStep(s => s - 1); setErro(""); } };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && current?.tipo !== "textarea") { e.preventDefault(); next(); }
  };

  const handleSubmit = async () => {
    setEnviando(true);
    try {
      await supabase.from("formularios_respostas").insert({
        formulario_id: form.id, agencia_id: form.agencia_id,
        respostas, created_at: new Date().toISOString(),
      });
      const phoneField = perguntas.find(p => p.tipo === "phone");
      const emailField = perguntas.find(p => p.tipo === "email");
      const nameField = perguntas.find(p => p.tipo === "text");
      await supabase.from("leads").insert({
        agencia_id: form.agencia_id,
        nome: nameField ? respostas[nameField.id] || "Lead" : "Lead Formulário",
        telefone: phoneField ? respostas[phoneField.id] || null : null,
        email: emailField ? respostas[emailField.id] || null : null,
        etapa: "novo",
        whatsapp_mensagem_inicial: `Formulário: ${form.nome}`,
      });
      setEnviado(true);
      if (form.redirecionar_whatsapp && form.whatsapp_numero) {
        const msg = encodeURIComponent(form.whatsapp_mensagem || "Olá!");
        setTimeout(() => { window.location.href = `https://wa.me/${form.whatsapp_numero}?text=${msg}`; }, 2500);
      } else if (form.redirecionar_url) {
        setTimeout(() => { window.location.href = form.redirecionar_url; }, 2500);
      }
    } catch { setErro("Erro ao enviar."); }
    setEnviando(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #1a1a1a", borderTop: `3px solid ${cor}`, animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!form) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#404040", fontSize: 18 }}>
      Formulário não encontrado.
    </div>
  );

  // Tela de sucesso
  if (enviado) return (
    <div style={{ minHeight: "100vh", background: fundo, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}} @keyframes scaleIn{from{transform:scale(0)}to{transform:scale(1)}}`}</style>
      <div style={{ textAlign: "center", animation: "fadeUp 0.6s ease" }}>
        {logo && <img src={logo} alt="" style={{ width: 70, marginBottom: 24, borderRadius: 12 }} />}
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${cor}15`, border: `2px solid ${cor}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "scaleIn 0.5s ease 0.3s both" }}>
          <span style={{ fontSize: 36, color: cor }}>✓</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 12 }}>{form.msg_sucesso}</h1>
        {form.redirecionar_whatsapp && <p style={{ color: "#606060", fontSize: 14 }}>Redirecionando para o WhatsApp...</p>}
      </div>
    </div>
  );

  // Input styles
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "transparent", border: "none", borderBottom: `2px solid #2e2e2e`,
    padding: "14px 0", color: "#f0f0f0", fontSize: 22, fontWeight: 300, outline: "none",
    transition: "border-color 0.3s", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: fundo, display: "flex", flexDirection: "column" }} onKeyDown={handleKey}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:translateY(0)}}
        input::placeholder,textarea::placeholder{color:#404040}
        input:focus,textarea:focus{border-bottom-color:${cor}!important}
        .option-btn:hover{background:${cor}18!important;border-color:${cor}!important}
      `}</style>

      {/* Barra de progresso */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "#1a1a1a", zIndex: 100 }}>
        <div style={{ height: "100%", width: `${progresso}%`, background: cor, transition: "width 0.5s ease" }} />
      </div>

      {/* Logo top-left */}
      {logo && (
        <div style={{ position: "fixed", top: 20, left: 24, zIndex: 50 }}>
          <img src={logo} alt="" style={{ height: 36, borderRadius: 6 }} />
        </div>
      )}

      {/* Step counter */}
      <div style={{ position: "fixed", top: 20, right: 24, zIndex: 50, fontSize: 12, color: "#404040" }}>
        {step + 1} / {total}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px 120px" }}>
        <div key={step} style={{ width: "100%", maxWidth: 600, animation: `${dir > 0 ? "fadeUp" : "fadeDown"} 0.5s ease` }}>

          {/* Welcome */}
          {current?.tipo === "welcome" && (
            <div style={{ textAlign: "center" }}>
              {current.imagemUrl && <img src={current.imagemUrl} alt="" style={{ maxWidth: 200, marginBottom: 32, borderRadius: 16 }} />}
              <h1 style={{ fontSize: 36, fontWeight: 700, color: "#f0f0f0", marginBottom: 16, lineHeight: 1.2 }}>{current.label}</h1>
              {current.descricao && <p style={{ fontSize: 18, color: "#808080", lineHeight: 1.6, marginBottom: 32 }}>{current.descricao}</p>}
              <button onClick={next} style={{
                padding: "16px 48px", borderRadius: 8, border: "none", background: cor,
                color: "#000", fontSize: 18, fontWeight: 700, cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 8px 30px ${cor}40`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}>
                {current.botaoTexto || "Começar"}
              </button>
            </div>
          )}

          {/* Video */}
          {current?.tipo === "video" && (
            <div style={{ textAlign: "center" }}>
              {current.label && <h2 style={{ fontSize: 24, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>{current.label}</h2>}
              {current.descricao && <p style={{ fontSize: 16, color: "#808080", marginBottom: 24 }}>{current.descricao}</p>}
              {current.videoUrl && (
                <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 24, border: "1px solid #2e2e2e" }}>
                  <iframe
                    src={current.videoUrl.includes("youtube") ? current.videoUrl.replace("watch?v=", "embed/") : current.videoUrl}
                    style={{ width: "100%", height: 320, border: "none" }}
                    allowFullScreen
                  />
                </div>
              )}
              <button onClick={next} style={{
                padding: "14px 40px", borderRadius: 8, border: "none", background: cor,
                color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer",
              }}>
                {current.botaoTexto || "Continuar"}
              </button>
            </div>
          )}

          {/* Text / Phone / Email */}
          {(current?.tipo === "text" || current?.tipo === "phone" || current?.tipo === "email") && (
            <div>
              <p style={{ fontSize: 14, color: cor, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                {step + 1} →
              </p>
              <h2 style={{ fontSize: 28, fontWeight: 600, color: "#f0f0f0", marginBottom: 8, lineHeight: 1.3 }}>
                {current.label} {current.obrigatorio && <span style={{ color: cor }}>*</span>}
              </h2>
              {current.descricao && <p style={{ fontSize: 15, color: "#606060", marginBottom: 20 }}>{current.descricao}</p>}
              <input
                ref={inputRef as any}
                type={current.tipo === "email" ? "email" : current.tipo === "phone" ? "tel" : "text"}
                placeholder={current.placeholder || "Digite sua resposta..."}
                value={respostas[current.id] || ""}
                onChange={e => setRespostas({ ...respostas, [current.id]: e.target.value })}
                style={inputStyle}
              />
            </div>
          )}

          {/* Textarea */}
          {current?.tipo === "textarea" && (
            <div>
              <p style={{ fontSize: 14, color: cor, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{step + 1} →</p>
              <h2 style={{ fontSize: 28, fontWeight: 600, color: "#f0f0f0", marginBottom: 8 }}>
                {current.label} {current.obrigatorio && <span style={{ color: cor }}>*</span>}
              </h2>
              {current.descricao && <p style={{ fontSize: 15, color: "#606060", marginBottom: 20 }}>{current.descricao}</p>}
              <textarea
                ref={inputRef as any}
                placeholder={current.placeholder || "Digite sua resposta..."}
                value={respostas[current.id] || ""}
                onChange={e => setRespostas({ ...respostas, [current.id]: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: "none", borderBottom: `2px solid #2e2e2e` }}
              />
            </div>
          )}

          {/* Select */}
          {current?.tipo === "select" && (
            <div>
              <p style={{ fontSize: 14, color: cor, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{step + 1} →</p>
              <h2 style={{ fontSize: 28, fontWeight: 600, color: "#f0f0f0", marginBottom: 24 }}>
                {current.label} {current.obrigatorio && <span style={{ color: cor }}>*</span>}
              </h2>
              {current.descricao && <p style={{ fontSize: 15, color: "#606060", marginBottom: 20 }}>{current.descricao}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(current.opcoes || []).map((o, i) => {
                  const sel = respostas[current.id] === o;
                  return (
                    <button key={i} className="option-btn" onClick={() => { setRespostas({ ...respostas, [current.id]: o }); setTimeout(next, 300); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
                        background: sel ? `${cor}15` : "transparent", border: `1px solid ${sel ? cor : "#2e2e2e"}`,
                        borderRadius: 10, cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                      }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 6, border: `2px solid ${sel ? cor : "#3a3a3a"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: sel ? "#000" : "#606060",
                        background: sel ? cor : "transparent",
                      }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span style={{ fontSize: 17, color: "#f0f0f0" }}>{o}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Radio */}
          {current?.tipo === "radio" && (
            <div>
              <p style={{ fontSize: 14, color: cor, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{step + 1} →</p>
              <h2 style={{ fontSize: 28, fontWeight: 600, color: "#f0f0f0", marginBottom: 24 }}>
                {current.label} {current.obrigatorio && <span style={{ color: cor }}>*</span>}
              </h2>
              {current.descricao && <p style={{ fontSize: 15, color: "#606060", marginBottom: 20 }}>{current.descricao}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(current.opcoes || []).map((o, i) => {
                  const sel = respostas[current.id] === o;
                  return (
                    <button key={i} className="option-btn" onClick={() => { setRespostas({ ...respostas, [current.id]: o }); setTimeout(next, 300); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
                        background: sel ? `${cor}15` : "transparent", border: `1px solid ${sel ? cor : "#2e2e2e"}`,
                        borderRadius: 10, cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                      }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel ? cor : "#3a3a3a"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {sel && <div style={{ width: 12, height: 12, borderRadius: "50%", background: cor }} />}
                      </div>
                      <span style={{ fontSize: 17, color: "#f0f0f0" }}>{o}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && <p style={{ color: "#ef4444", fontSize: 14, marginTop: 16 }}>{erro}</p>}
        </div>
      </div>

      {/* Bottom navigation */}
      {current?.tipo !== "welcome" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(transparent, ${fundo})` }}>
          <button onClick={prev} disabled={step === 0}
            style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #2e2e2e", background: "transparent", color: step === 0 ? "#2e2e2e" : "#808080", fontSize: 14, cursor: step === 0 ? "default" : "pointer" }}>
            ↑ Voltar
          </button>

          {isInputStep && current?.tipo !== "select" && current?.tipo !== "radio" && (
            <button onClick={next} disabled={enviando}
              style={{
                padding: "12px 32px", borderRadius: 8, border: "none", background: cor,
                color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                opacity: enviando ? 0.7 : 1,
              }}>
              {step === total - 1 ? (enviando ? "Enviando..." : "Enviar") : "OK ✓"}
            </button>
          )}

          {current?.tipo === "video" && (
            <button onClick={next}
              style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: cor, color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Continuar →
            </button>
          )}
        </div>
      )}

      <p style={{ position: "fixed", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "#1a1a1a" }}>
        Powered by SALX Convert
      </p>
    </div>
  );
}
