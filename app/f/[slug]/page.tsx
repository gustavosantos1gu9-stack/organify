"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Pergunta {
  id: string;
  tipo: "text" | "select" | "phone" | "email" | "textarea" | "radio";
  label: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[];
}

export default function FormularioPublico() {
  const params = useParams();
  const slug = params.slug as string;
  const [form, setForm] = useState<any>(null);
  const [logo, setLogo] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("formularios").select("*, agencias(logo_url, nome)").eq("slug", slug).eq("ativo", true).single();
      if (data) {
        setForm(data);
        setLogo(data.agencias?.logo_url || "");
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validar obrigatórios
    for (const p of form.perguntas as Pergunta[]) {
      if (p.obrigatorio && !respostas[p.id]?.trim()) {
        setErro(`Preencha o campo "${p.label}"`);
        return;
      }
    }
    setErro("");
    setEnviando(true);

    try {
      // Salvar resposta
      await supabase.from("formularios_respostas").insert({
        formulario_id: form.id,
        agencia_id: form.agencia_id,
        respostas,
        ip: null,
        created_at: new Date().toISOString(),
      });

      // Criar lead no CRM
      const nome = Object.values(respostas)[0] || "Lead Formulário";
      const telefone = (form.perguntas as Pergunta[]).find(p => p.tipo === "phone");
      const email = (form.perguntas as Pergunta[]).find(p => p.tipo === "email");

      await supabase.from("leads").insert({
        agencia_id: form.agencia_id,
        nome: respostas[Object.keys(respostas)[0]] || nome,
        telefone: telefone ? respostas[telefone.id] || null : null,
        email: email ? respostas[email.id] || null : null,
        whatsapp_mensagem_inicial: `Formulário: ${form.nome}`,
        etapa: "novo",
      });

      setEnviado(true);

      // Redirecionar
      if (form.redirecionar_whatsapp && form.whatsapp_numero) {
        const msg = encodeURIComponent(form.whatsapp_mensagem || "Olá!");
        setTimeout(() => { window.location.href = `https://wa.me/${form.whatsapp_numero}?text=${msg}`; }, 2000);
      } else if (form.redirecionar_url) {
        setTimeout(() => { window.location.href = form.redirecionar_url; }, 2000);
      }
    } catch (err) { console.error(err); setErro("Erro ao enviar. Tente novamente."); }
    setEnviando(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #2e2e2e", borderTop: "3px solid #29ABE2", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!form) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#606060", fontSize: 16 }}>
        Formulário não encontrado.
      </div>
    );
  }

  const cor = form.cor_primaria || "#29ABE2";
  const fundo = form.cor_fundo || "#0f0f0f";
  const perguntas = form.perguntas as Pergunta[];

  if (enviado) {
    return (
      <div style={{ minHeight: "100vh", background: fundo, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          {logo && <img src={logo} alt="" style={{ width: 80, height: 80, objectFit: "contain", marginBottom: 24, borderRadius: 12 }} />}
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${cor}20`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", border: `2px solid ${cor}` }}>
            <span style={{ fontSize: 36 }}>✓</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 12 }}>{form.msg_sucesso}</h1>
          {form.redirecionar_whatsapp && <p style={{ color: "#606060", fontSize: 14 }}>Redirecionando para o WhatsApp...</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: fundo, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Logo */}
        {logo && (
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img src={logo} alt="" style={{ width: 100, height: 100, objectFit: "contain", borderRadius: 16 }} />
          </div>
        )}

        {/* Card */}
        <div style={{ background: "#141414", borderRadius: 20, border: "1px solid #2e2e2e", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${cor}15, ${cor}05)`, borderBottom: `1px solid ${cor}20`, padding: "28px 32px" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: "0 0 6px" }}>{form.titulo}</h1>
            {form.subtitulo && <p style={{ fontSize: 14, color: "#808080", margin: 0 }}>{form.subtitulo}</p>}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: "28px 32px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {perguntas.map((p) => (
                <div key={p.id}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "#d0d0d0", display: "block", marginBottom: 6 }}>
                    {p.label} {p.obrigatorio && <span style={{ color: cor }}>*</span>}
                  </label>

                  {p.tipo === "text" && (
                    <input type="text" placeholder={p.placeholder} value={respostas[p.id] || ""} onChange={e => setRespostas({ ...respostas, [p.id]: e.target.value })}
                      style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2e2e2e", borderRadius: 10, padding: "12px 16px", color: "#f0f0f0", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
                      onFocus={e => e.target.style.borderColor = cor} onBlur={e => e.target.style.borderColor = "#2e2e2e"} />
                  )}

                  {p.tipo === "phone" && (
                    <input type="tel" placeholder={p.placeholder || "(00) 00000-0000"} value={respostas[p.id] || ""} onChange={e => setRespostas({ ...respostas, [p.id]: e.target.value })}
                      style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2e2e2e", borderRadius: 10, padding: "12px 16px", color: "#f0f0f0", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = cor} onBlur={e => e.target.style.borderColor = "#2e2e2e"} />
                  )}

                  {p.tipo === "email" && (
                    <input type="email" placeholder={p.placeholder || "seu@email.com"} value={respostas[p.id] || ""} onChange={e => setRespostas({ ...respostas, [p.id]: e.target.value })}
                      style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2e2e2e", borderRadius: 10, padding: "12px 16px", color: "#f0f0f0", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = cor} onBlur={e => e.target.style.borderColor = "#2e2e2e"} />
                  )}

                  {p.tipo === "textarea" && (
                    <textarea placeholder={p.placeholder} value={respostas[p.id] || ""} onChange={e => setRespostas({ ...respostas, [p.id]: e.target.value })} rows={3}
                      style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2e2e2e", borderRadius: 10, padding: "12px 16px", color: "#f0f0f0", fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = cor} onBlur={e => e.target.style.borderColor = "#2e2e2e"} />
                  )}

                  {p.tipo === "select" && (
                    <select value={respostas[p.id] || ""} onChange={e => setRespostas({ ...respostas, [p.id]: e.target.value })}
                      style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2e2e2e", borderRadius: 10, padding: "12px 16px", color: respostas[p.id] ? "#f0f0f0" : "#606060", fontSize: 15, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                      <option value="">{p.placeholder || "Selecione..."}</option>
                      {(p.opcoes || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
                    </select>
                  )}

                  {p.tipo === "radio" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(p.opcoes || []).map((o, i) => (
                        <label key={i} onClick={() => setRespostas({ ...respostas, [p.id]: o })}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: respostas[p.id] === o ? `${cor}15` : "#0d0d0d", border: `1px solid ${respostas[p.id] === o ? cor : "#2e2e2e"}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s" }}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${respostas[p.id] === o ? cor : "#3a3a3a"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {respostas[p.id] === o && <div style={{ width: 10, height: 10, borderRadius: "50%", background: cor }} />}
                          </div>
                          <span style={{ fontSize: 14, color: "#f0f0f0" }}>{o}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {erro && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 16, textAlign: "center" }}>{erro}</p>}

            <button type="submit" disabled={enviando}
              style={{ width: "100%", marginTop: 24, padding: "14px", borderRadius: 12, border: "none", background: cor, color: "#000", fontSize: 16, fontWeight: 700, cursor: enviando ? "default" : "pointer", opacity: enviando ? 0.7 : 1, transition: "opacity 0.2s" }}>
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#303030", marginTop: 20 }}>
          Powered by SALX Convert
        </p>
      </div>
    </div>
  );
}
