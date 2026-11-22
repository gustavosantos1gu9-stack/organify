"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function injectFbq(pixelId: string) {
  if (typeof window === "undefined" || (window as any).fbqLoaded) return;
  const s = document.createElement("script");
  s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`;
  document.head.appendChild(s);
  (window as any).fbqLoaded = true;
}
function fbqTrack(event: string, params?: Record<string, any>, eventId?: string) {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", event, params || {}, eventId ? { eventID: eventId } : undefined);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Pergunta {
  id: string;
  tipo: "text" | "select" | "phone" | "email" | "textarea" | "radio" | "welcome" | "video" | "obrigado" | "galeria";
  label: string;
  descricao?: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[];
  opcoesIrPara?: Record<string, string>;
  irPara?: string;
  videoUrl?: string;
  imagemUrl?: string;
  imagemFundoUrl?: string;
  imagensGaleria?: string[];
  botaoTexto?: string;
  redirectUrl?: string;
  whatsappNumero?: string;
  whatsappMensagem?: string;
  semDisparo?: boolean;
}

export default function FormularioPublico() {
  const params = useParams();
  const slug = params.slug as string;
  const [form, setForm] = useState<any>(null);
  const [logo, setLogo] = useState("");
  const [fundoLoading, setFundoLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`form_bg_${window.location.pathname}`) || "#0a0a0a";
    }
    return "#0a0a0a";
  });
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [loadingOption, setLoadingOption] = useState<string | null>(null);
  const [galeriaIdx, setGaleriaIdx] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [submittedViaObrigado, setSubmittedViaObrigado] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    async function load() {
      const t0 = Date.now();

      // Query leve: só logo + cor de fundo — atualiza a tela de loading imediatamente
      const { data: preview } = await supabase
        .from("formularios")
        .select("cliente_externo_id, cor_fundo, agencias(logo_url), clientes_externos(logo_url)")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();

      if (preview) {
        const logoUrl = preview.cliente_externo_id
          ? ((preview.clientes_externos as any)?.logo_url || "")
          : ((preview.agencias as any)?.logo_url || "");
        const corFundo = preview.cor_fundo || "#0a0a0a";
        setLogo(logoUrl);
        setFundoLoading(corFundo);
        if (typeof document !== "undefined") {
          document.body.style.background = corFundo;
          document.documentElement.style.background = corFundo;
        }
        try { localStorage.setItem(`form_bg_${window.location.pathname}`, corFundo); } catch {}
      }

      // Query completa: carrega tudo mais (perguntas, pixel, config)
      const { data } = await supabase
        .from("formularios")
        .select("*, agencias(logo_url, nome, meta_pixel_id), clientes_externos(meta_pixel_id, meta_access_token, whatsapp_notificacao, logo_url)")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();

      if (data) {
        // Formulário de cliente: usa só logo do cliente (sem fallback pra agência)
        // Formulário da agência (SALX): usa logo da agência
        const logoUrl = data.cliente_externo_id
          ? (data.clientes_externos?.logo_url || "")
          : (data.agencias?.logo_url || "");
        const corFundo = data.cor_fundo || "#0a0a0a";
        setForm(data);
        setLogo(logoUrl);
        setFundoLoading(corFundo);
        // Cache para eliminar o flash preto e logo ausente em visitas futuras
        try { localStorage.setItem(`form_bg_${window.location.pathname}`, corFundo); } catch {}
        // Aplica cor de fundo no body para eliminar o preto global
        if (typeof document !== "undefined") {
          document.body.style.background = corFundo;
          document.documentElement.style.background = corFundo;
        }

        const pixelId = data.clientes_externos?.meta_pixel_id || data.agencias?.meta_pixel_id;
        if (pixelId) {
          injectFbq(pixelId);
          const sp = new URLSearchParams(window.location.search);
          const fbpCookieLoad = document.cookie.split(";").map(c => c.trim())
            .find(c => c.startsWith("_fbp="))?.split("=")[1] || undefined;
          fetch("/api/pixel/evento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id: data.agencia_id,
              event_name: "ViewContent",
              source_url: window.location.href,
              formulario_id: data.id,
              fbclid: sp.get("fbclid") || undefined,
              fbp: fbpCookieLoad,
              utm_source: sp.get("utm_source") || undefined,
              utm_medium: sp.get("utm_medium") || undefined,
              utm_campaign: sp.get("utm_campaign") || undefined,
              utm_content: sp.get("utm_content") || undefined,
              ...(data.cliente_externo_id ? { cliente_externo_id: data.cliente_externo_id } : {}),
            }),
          }).catch(() => {});
        }

        // Espera mínimo para não piscar: logo já apareceu desde o início
        const elapsed = Date.now() - t0;
        const minTime = 300;
        if (elapsed < minTime) await new Promise(r => setTimeout(r, minTime - elapsed));
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  // Foco no input ao trocar de step
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [step]);

  // Auto-submit + pixel ao chegar numa tela de obrigado intermediária
  useEffect(() => {
    const q = (form?.perguntas || [])[step];
    if (!form || q?.tipo !== "obrigado" || enviado || enviando || submittedViaObrigado) return;
    setSubmittedViaObrigado(true);
    // Se semDisparo=true: salva e notifica sem disparar pixel (não é desqualificado)
    if (q.semDisparo) { handleSubmit(false, true); return; }
    // Dispara pixel Lead
    try {
      const perguntas = form.perguntas || [];
      const pfPhone = perguntas.find((p: Pergunta) => p.tipo === "phone");
      const pfEmail = perguntas.find((p: Pergunta) => p.tipo === "email" || (p.label || "").toLowerCase().includes("email") || (p.label || "").toLowerCase().includes("e-mail"));
      const pfName  = perguntas.find((p: Pergunta) => p.tipo === "text" && ((p.label || "").toLowerCase().includes("nome") || (p.label || "").toLowerCase().includes("name")));
      const pixelId = form.clientes_externos?.meta_pixel_id || form.agencias?.meta_pixel_id;
      if (pixelId) {
        const evId = `form_obrigado_${form.id}_${step}_${Date.now()}`;
        const sp = new URLSearchParams(window.location.search);
        const fbclid = sp.get("fbclid") || undefined;
        const fbpCookie = document.cookie.split(";").map((c: string) => c.trim()).find((c: string) => c.startsWith("_fbp="))?.split("=")[1] || undefined;
        fbqTrack("Lead", {}, evId);
        fetch("/api/pixel/evento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agencia_id: form.agencia_id, event_name: "Lead",
            phone: pfPhone ? respostas[pfPhone.id] || undefined : undefined,
            email: pfEmail ? respostas[pfEmail.id] || undefined : undefined,
            contato_nome: pfName ? respostas[pfName.id] || undefined : undefined,
            event_id: evId, source_url: window.location.href,
            formulario_id: form.id, fbclid, fbp: fbpCookie,
            utm_source: sp.get("utm_source") || undefined,
            utm_medium: sp.get("utm_medium") || undefined,
            utm_campaign: sp.get("utm_campaign") || undefined,
            utm_content: sp.get("utm_content") || undefined,
            ...(form.cliente_externo_id ? { cliente_externo_id: form.cliente_externo_id } : {}),
          }),
        }).catch(() => {});
      }
    } catch {}
    // Salva o lead no banco — skipPixel=true pois já disparou acima
    handleSubmit(false, true);
  }, [step, form]);

  // Limpa resposta de select/radio ao mudar step + reset animações
  useEffect(() => {
    const q = (form?.perguntas || [])[step];
    if (q && (q.tipo === "select" || q.tipo === "radio")) {
      setRespostas(prev => { const n = { ...prev }; delete n[q.id]; return n; });
    }
    setTransitioning(false);
    setLoadingOption(null);
    setGaleriaIdx(0);
  }, [step]);


  const perguntas: Pergunta[] = form?.perguntas || [];
  const current = perguntas[step];
  const cor = form?.cor_botao || form?.cor_primaria || "#29ABE2";
  const fundo = form?.cor_fundo || "#0a0a0a";
  const total = perguntas.length;
  const progresso = total > 0 ? (step / total) * 100 : 0;

  const isPhone = (t: string) => t === "phone" || t === "telefone" || t === "tel";
  const hexLuma = (hex: string) => {
    try { const h = hex.replace("#", ""); return 0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16); }
    catch { return 0; }
  };
  const isLight = hexLuma(fundo) > 140;
  const tx1 = form?.cor_titulo || form?.cor_texto || (isLight ? "#1a1a1a" : "#f0f0f0");
  const tx2 = form?.cor_subtitulo || (form?.cor_texto ? `${form.cor_texto}bb` : (isLight ? "#555555" : "#888888"));
  const tx3 = form?.cor_texto ? `${form.cor_texto}66` : (isLight ? "#aaaaaa" : "#444444");
  const bd  = isLight ? "#d8d4cc" : "#2a2a2a";
  const ibg = isLight ? "#ffffff" : "#111111";
  const osel = `${cor}18`;

  const isSelectOrRadio = current?.tipo === "select" || current?.tipo === "radio";
  const isInputStep = current && !["welcome", "video", "obrigado", "galeria"].includes(current.tipo);
  const showOkBtn = isInputStep && !isSelectOrRadio && current?.tipo !== "video";

  const canProceed = (forcedValue?: string) => {
    if (!current) return false;
    if (current.tipo === "welcome" || current.tipo === "video" || current.tipo === "obrigado" || current.tipo === "galeria") return true;
    if (!current.obrigatorio) return true;
    const val = forcedValue !== undefined ? forcedValue : respostas[current.id];
    return !!(val?.trim());
  };

  const doNavigate = (opcaoSelecionada?: string) => {
    const resposta = opcaoSelecionada || respostas[current?.id];
    if (resposta && current?.opcoesIrPara?.[resposta]) {
      const destino = current.opcoesIrPara[resposta];
      if (destino === "__fim__") {
        const obrigadoIdx = perguntas.findIndex((p: any) => p.tipo === "obrigado");
        if (obrigadoIdx >= 0) { setDir(1); setStep(obrigadoIdx); }
        else handleSubmit();
        return;
      }
      const idx = perguntas.findIndex(p => p.id === destino);
      if (idx >= 0) { setDir(1); setStep(idx); return; }
    }
    if (current?.irPara) {
      if (current.irPara === "__fim__") {
        const obrigadoIdx = perguntas.findIndex((p: any) => p.tipo === "obrigado");
        if (obrigadoIdx >= 0) { setDir(1); setStep(obrigadoIdx); }
        else handleSubmit();
        return;
      }
      const idx = perguntas.findIndex(p => p.id === current.irPara);
      if (idx >= 0) { setDir(1); setStep(idx); return; }
    }
    if (step < total - 1) { setDir(1); setStep(s => s + 1); }
    else handleSubmit();
  };

  const next = (opcaoSelecionada?: string) => {
    if (transitioning || enviando) return;
    if (!canProceed(opcaoSelecionada)) { setErro(`Preencha o campo "${current.label}"`); return; }
    setErro("");
    setTransitioning(true);
    setTimeout(() => {
      doNavigate(opcaoSelecionada);
    }, 380);
  };

  const prev = () => {
    if (transitioning || enviando) return;
    if (step > 0) { setDir(-1); setStep(s => s - 1); setErro(""); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && current?.tipo !== "textarea") { e.preventDefault(); next(); }
  };

  const handleSubmit = async (desqualificado = false, skipPixel = false) => {
    setEnviando(true);
    try {
      const sp = new URLSearchParams(window.location.search);
      const utmSource   = sp.get("utm_source")   || undefined;
      const utmMedium   = sp.get("utm_medium")   || undefined;
      const utmCampaign = sp.get("utm_campaign") || undefined;
      const utmContent  = sp.get("utm_content")  || undefined;
      const utmTerm     = sp.get("utm_term")      || undefined;
      const fbclid      = sp.get("fbclid")        || undefined;
      const fbp         = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("_fbp="))?.split("=")[1] || undefined;

      const phoneField = perguntas.find(p => p.tipo === "phone");
      const emailField = perguntas.find(p =>
        p.tipo === "email" || (p.label || "").toLowerCase().includes("e-mail") || (p.label || "").toLowerCase().includes("email")
      );
      const nameField  = perguntas.find(p =>
        p.tipo === "text" && ((p.label || "").toLowerCase().includes("nome") || (p.label || "").toLowerCase().includes("name"))
      );
      const telefone   = phoneField ? respostas[phoneField.id] || null : null;
      const email      = emailField ? respostas[emailField.id] || null : null;
      const nomeResp   = nameField  ? respostas[nameField.id]  || null : null;

      // Tudo server-side: respostas + lead + rastreamento pendente
      await fetch("/api/formularios/resposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formulario_id: form.id,
          agencia_id: form.agencia_id,
          respostas,
          nome: nomeResp,
          telefone,
          email,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
          fbclid,
          fbp,
          form_nome: form.nome,
          desqualificado: desqualificado || undefined,
          ...(form.cliente_externo_id ? { cliente_externo_id: form.cliente_externo_id } : {}),
        }),
      });

      setEnviado(true);
      try {
        const pfPhone = perguntas.find(p => p.tipo === "phone");
        const pfEmail = perguntas.find(p =>
          p.tipo === "email" || (p.label || "").toLowerCase().includes("e-mail") || (p.label || "").toLowerCase().includes("email")
        );
        const pfName  = perguntas.find(p =>
          p.tipo === "text" && ((p.label || "").toLowerCase().includes("nome") || (p.label || "").toLowerCase().includes("name"))
        );
        const pixelId = form.clientes_externos?.meta_pixel_id || form.agencias?.meta_pixel_id;
        if (pixelId && !desqualificado && !skipPixel) {
          const evId = `form_lead_${form.id}_${Date.now()}`;
          // Capturar _fbp do cookie do browser para deduplicação correta no Meta
          const fbpCookie = document.cookie.split(";").map(c => c.trim())
            .find(c => c.startsWith("_fbp="))?.split("=")[1] || undefined;
          fbqTrack("Lead", {}, evId);
          fetch("/api/pixel/evento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id: form.agencia_id, event_name: "Lead",
              phone: pfPhone ? respostas[pfPhone.id] || undefined : undefined,
              email: pfEmail ? respostas[pfEmail.id] || undefined : undefined,
              contato_nome: pfName ? respostas[pfName.id] || undefined : undefined,
              event_id: evId, source_url: window.location.href,
              formulario_id: form.id,
              fbclid,
              fbp: fbpCookie,
              utm_source: utmSource,
              utm_medium: utmMedium,
              utm_campaign: utmCampaign,
              utm_content: utmContent,
              ...(form.cliente_externo_id ? { cliente_externo_id: form.cliente_externo_id } : {}),
            }),
          }).catch(() => {});
        }
      } catch {}
    } catch { setErro("Erro ao enviar."); }
    setEnviando(false);
  };

  // ── Tela de carregamento ──────────────────────────────────────────────────
  if (loading) {
    const isLoadingLight = hexLuma(fundoLoading) > 140;
    return (
      <div style={{
        minHeight: "100vh", background: fundoLoading,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28,
        fontFamily: "'Poppins', 'DM Sans', system-ui, sans-serif",
        transition: "background 0.4s ease",
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
          @keyframes loadbar { from { width: 8% } to { width: 88% } }
          @keyframes dotpulse { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        `}</style>
        {logo && (
          <img
            src={logo}
            alt=""
            style={{ height: 72, objectFit: "contain", maxWidth: 200, display: "block" }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 200, height: 3, background: isLoadingLight ? "#00000015" : "#ffffff15", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", background: isLoadingLight ? "#333" : "#fff", borderRadius: 99, animation: "loadbar 2s ease-out forwards" }} />
          </div>
          <p style={{ fontSize: 13, color: isLoadingLight ? "#666" : "#888", margin: 0, letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: 6 }}>
            Carregando formulário
            <span style={{ display: "inline-flex", gap: 3, marginLeft: 2 }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: isLoadingLight ? "#666" : "#888", display: "inline-block", animation: `dotpulse 1.2s ${d}s infinite` }} />
              ))}
            </span>
          </p>
        </div>
      </div>
    );
  }

  if (!form) return (
    <div style={{ minHeight: "100vh", background: "#f5f2ec", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 16, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      Formulário não encontrado.
    </div>
  );

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  const formTemObrigado = perguntas.some(p => p.tipo === "obrigado");
  if (enviado && !formTemObrigado) {
    const temBotao = form.redirecionar_whatsapp || form.redirecionar_url;
    const botaoTexto = form.subtitulo || (form.redirecionar_whatsapp ? "Falar no WhatsApp" : "Continuar");
    // Passar UTMs e fbclid para a página de destino para manter rastreio
    const buildRedirectUrl = (base: string) => {
      if (!base || base === "#") return base;
      const sp = new URLSearchParams(window.location.search);
      const params = new URLSearchParams();
      ["fbclid","utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(k => {
        const v = sp.get(k); if (v) params.set(k, v);
      });
      const qs = params.toString();
      return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
    };
    const botaoHref = form.redirecionar_whatsapp && form.whatsapp_numero
      ? `https://wa.me/${form.whatsapp_numero}?text=${encodeURIComponent(form.whatsapp_mensagem || "Olá!")}`
      : buildRedirectUrl(form.redirecionar_url || "#");
    return (
      <div style={{ minHeight: "100vh", background: fundo, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Poppins', 'DM Sans', system-ui, sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
          @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
          @keyframes scaleIn{from{transform:scale(0)}to{transform:scale(1)}}
        `}</style>
        <div style={{ textAlign: "center", animation: "fadeUp 0.5s ease", maxWidth: 500, width: "100%" }}>
          <img src={logo || "/logo.png"} alt="" style={{ height: 68, objectFit: "contain", maxWidth: 235, display: "block", margin: "0 auto 32px", mixBlendMode: form?.cliente_externo_id ? "multiply" : undefined }} />
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${cor}18`, border: `2px solid ${cor}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "scaleIn 0.4s ease 0.2s both" }}>
            <span style={{ fontSize: 28, color: cor }}>✓</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.1rem, 4vw, 1.4rem)", fontWeight: 500, color: tx1, margin: "0 0 24px", lineHeight: 1.3, letterSpacing: "-0.01em", whiteSpace: "pre-line" }}>{form.msg_sucesso}</h1>
          {temBotao && (
            <a href={botaoHref}
              target={form.redirecionar_url && !form.redirecionar_whatsapp ? "_blank" : "_self"}
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "13px 24px",
                borderRadius: 16, border: "none", background: cor, color: "#fff",
                fontSize: "1rem", fontWeight: 700,
                textDecoration: "none", boxShadow: `0 4px 20px ${cor}40`, cursor: "pointer",
              }}
            >
              {form.redirecionar_whatsapp && <span style={{ fontSize: 18 }}>💬</span>}
              {botaoTexto}
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Tela de obrigado — auto-submete o form e dispara pixel ──────────────
  if (current?.tipo === "obrigado") {
    const waNumero = current.whatsappNumero || form?.whatsapp_numero || "";
    const waMensagem = current.whatsappMensagem || form?.whatsapp_mensagem || "Olá!";
    const waHref = waNumero
      ? `https://wa.me/${waNumero.replace(/\D/g, "")}?text=${encodeURIComponent(waMensagem)}`
      : current.redirectUrl || "";
    const temBotao = !!(waHref || current.redirectUrl);
    const textoBtn = current.botaoTexto || (waNumero ? "Falar no WhatsApp" : "Continuar");
    return (
      <div style={{ minHeight: "100vh", background: fundo, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Poppins', 'DM Sans', system-ui, sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
          @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
          @keyframes scaleIn{from{transform:scale(0)}to{transform:scale(1)}}
        `}</style>
        <div style={{ textAlign: "center", animation: "fadeUp 0.5s ease", maxWidth: 500, width: "100%" }}>
          <img src={logo || "/logo.png"} alt="" style={{ height: 68, objectFit: "contain", maxWidth: 235, display: "block", margin: "0 auto 32px", mixBlendMode: form?.cliente_externo_id ? "multiply" : undefined }} />
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${cor}18`, border: `2px solid ${cor}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "scaleIn 0.4s ease 0.2s both" }}>
            <span style={{ fontSize: 28, color: cor }}>✓</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.1rem, 4vw, 1.4rem)", fontWeight: 500, color: tx1, margin: "0 0 16px", lineHeight: 1.3, letterSpacing: "-0.01em", whiteSpace: "pre-line" }}>
            {current.label || "Obrigado!"}
          </h1>
          {current.descricao && (
            <p style={{ fontSize: "1rem", fontWeight: 400, color: tx2, lineHeight: 1.55, margin: "0 0 28px", whiteSpace: "pre-line" }}>{current.descricao}</p>
          )}
          {temBotao && (
            <a href={waHref || current.redirectUrl || "#"}
              target={waNumero ? "_self" : "_blank"}
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "13px 24px",
                borderRadius: 16, border: "none", background: cor, color: "#fff",
                fontSize: "1rem", fontWeight: 700,
                textDecoration: "none", boxShadow: `0 4px 20px ${cor}40`, cursor: "pointer",
              }}>
              {waNumero && <span style={{ fontSize: 18 }}>💬</span>}
              {textoBtn}
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Spinner inline ────────────────────────────────────────────────────────
  const Spinner = () => (
    <span style={{ display: "inline-block", animation: "spin 0.6s linear infinite", fontSize: 14 }}>⟳</span>
  );

  // ── Estilos compartilhados ────────────────────────────────────────────────
  const iStyle: React.CSSProperties = {
    width: "100%", background: "transparent", border: "none", outline: "none",
    padding: "12px 0", color: tx1, fontSize: "clamp(18px,3vw,22px)", fontWeight: 400,
    transition: "border-color 0.2s", fontFamily: "inherit",
  };
  const qTitle = (label: string, obrigatorio: boolean) => (
    <h2 style={{ fontSize: "clamp(22px,5vw,36px)", fontWeight: 700, color: tx1, margin: "0 0 8px", lineHeight: 1.18, letterSpacing: "-0.01em", whiteSpace: "pre-line" }}>
      {label}{obrigatorio && <span style={{ color: cor }}> *</span>}
    </h2>
  );
  const qDesc = (desc?: string) => desc
    ? <p style={{ fontSize: 15, color: tx2, margin: "0 0 24px", lineHeight: 1.6, whiteSpace: "pre-line" }}>{desc}</p>
    : <div style={{ height: 16 }} />;
  const qNum = (n: number) => (
    <p style={{ fontSize: 13, color: tx3, fontWeight: 600, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ background: cor, color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{n}</span>
      <span>→</span>
    </p>
  );

  // Botões de navegação (↑↓)
  const NavButtons = ({ inline }: { inline: boolean }) => (
    <div style={{
      ...(inline ? {} : {
        position: "fixed", right: 16, bottom: 16, zIndex: 150,
        boxShadow: isLight ? "0 2px 16px rgba(0,0,0,0.10)" : "0 2px 16px rgba(0,0,0,0.45)",
      }),
      display: "flex", flexDirection: "row", gap: 2,
      background: isLight ? "#ffffff" : "#1e1e1e",
      borderRadius: 12, padding: 6,
      ...(inline ? { marginTop: 20 } : {}),
    }}>
      <button onClick={prev} disabled={step === 0 || transitioning} style={{
        width: 40, height: 40, borderRadius: 8, border: "none",
        background: "transparent", color: step === 0 ? tx3 : tx1,
        fontSize: 17, opacity: step === 0 ? 0.3 : 1, cursor: step === 0 ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>↑</button>
      <button onClick={() => {
        if (isSelectOrRadio) next(respostas[current?.id]);
        else next();
      }} disabled={transitioning || enviando} style={{
        width: 40, height: 40, borderRadius: 8, border: "none",
        background: "transparent", color: tx1, fontSize: 17,
        opacity: (transitioning || enviando) ? 0.5 : 1, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {transitioning ? <Spinner /> : "↓"}
      </button>
    </div>
  );

  // Botão OK (text, email, phone, textarea + select/radio)
  const OkButton = ({ inline }: { inline: boolean }) => (
    <button
      onClick={() => isSelectOrRadio ? next(respostas[current?.id]) : next()}
      disabled={transitioning || enviando}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "11px 24px", borderRadius: 10, border: "none",
        background: cor, color: "#fff", fontSize: 14, fontWeight: 700,
        boxShadow: `0 3px 12px ${cor}35`,
        opacity: (transitioning || enviando) ? 0.7 : 1, cursor: "pointer",
        ...(inline ? { marginTop: 20 } : {
          position: "fixed", bottom: 16, left: 20, zIndex: 150,
        }),
      }}
    >
      {transitioning ? <Spinner /> : step === total - 1 ? (enviando ? "Enviando..." : "Enviar ✓") : "OK ✓"}
    </button>
  );

  const isHeroWelcome = current?.tipo === "welcome" && !!current?.imagemFundoUrl;

  // ── Render principal ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: fundo, fontFamily: "'Poppins', 'DM Sans', system-ui, sans-serif" }} onKeyDown={handleKey}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fu{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fd{from{opacity:0;transform:translateY(-22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input::placeholder,textarea::placeholder{color:${tx3}!important}
        .si:focus-within .si-line{border-bottom-color:${cor}!important}
        .pw:focus-within{border-color:${cor}!important}
        .ob{transition:border-color 0.15s,background 0.15s;cursor:pointer;-webkit-tap-highlight-color:transparent}
        @media(hover:hover){.ob:hover{border-color:${cor}!important;background:${osel}!important}}
        .sb{transition:opacity 0.2s;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .sb:hover{opacity:0.85}
        .sb:active{opacity:0.7}
      `}</style>

      {/* Barra de progresso */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 200 }}>
        <div style={{ height: "100%", width: `${progresso}%`, background: cor, transition: "width 0.5s ease" }} />
      </div>

      {/* Header fixo com fundo sólido — evita conteúdo sobrepor a logo ao rolar */}
      {!isHeroWelcome && current?.tipo !== "galeria" && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0,
          background: fundo, zIndex: 149,
          padding: "14px 24px 10px",
        }}>
          <img src={logo || "/logo.png"} alt="" style={{ height: 64, objectFit: "contain", maxWidth: 220, display: "block", mixBlendMode: form?.cliente_externo_id ? "multiply" : undefined }} />
        </div>
      )}

      {/* Conteúdo centralizado — não renderiza quando galeria (tem layout próprio) */}
      {current?.tipo !== "galeria" && <div style={{ paddingTop: isHeroWelcome ? 0 : 100, paddingBottom: isMobile ? 100 : 120, paddingLeft: isHeroWelcome ? 0 : 24, paddingRight: isHeroWelcome ? 0 : 24 }}>
        <div style={{ maxWidth: isHeroWelcome ? "100%" : 620, width: "100%", margin: "0 auto" }}>
          <div key={step} style={{ animation: `${dir > 0 ? "fu" : "fd"} 0.35s ease` }}>

            {/* Welcome */}
            {current?.tipo === "welcome" && (
              isHeroWelcome ? (
                /* ── Hero: imagem + degradê ── */
                <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
                  {/* Bloco da imagem com gradiente */}
                  <div style={{ position: "relative", width: "100%", height: "58vh", flexShrink: 0 }}>
                    <img
                      src={current.imagemFundoUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {/* Gradiente de baixo pra cima: cor de fundo → transparente */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: "70%",
                      background: `linear-gradient(to bottom, transparent, ${fundo})`,
                    }} />
                    {/* Logo centralizado sobre o gradiente */}
                    {logo && (
                      <img src={logo} alt="" style={{
                        position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                        height: 64, objectFit: "contain", maxWidth: 200, display: "block",
                      }} />
                    )}
                  </div>
                  {/* Conteúdo abaixo da imagem */}
                  <div style={{ flex: 1, background: fundo, padding: "8px 24px 40px" }}>
                    <h1 style={{
                      fontSize: "clamp(1.8rem, 6.5vw, 2.4rem)", fontWeight: 800, color: tx1,
                      margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "-0.02em",
                      textAlign: "center", whiteSpace: "pre-line", textTransform: "uppercase",
                    }}>
                      {current.label}
                    </h1>
                    {current.descricao && (
                      <p style={{
                        fontSize: "1rem", fontWeight: 400, color: tx2, lineHeight: 1.6,
                        margin: "0 0 32px", textAlign: "center", whiteSpace: "pre-line",
                      }}>
                        {current.descricao}
                      </p>
                    )}
                    <button className="sb" onClick={() => next()} disabled={transitioning} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", padding: "15px 24px",
                      borderRadius: 16, border: "none", background: cor, color: "#fff",
                      fontSize: "1rem", fontWeight: 700, boxShadow: `0 4px 20px ${cor}50`,
                      opacity: transitioning ? 0.7 : 1,
                    }}>
                      {transitioning ? <Spinner /> : <>{current.botaoTexto || "Começar"} →</>}
                    </button>
                    {current.descricao === undefined && (
                      <p style={{ fontSize: 13, color: tx3, textAlign: "center", margin: "16px 0 0" }} />
                    )}
                  </div>
                </div>
              ) : (
                /* ── Welcome sem imagem de fundo ── */
                <div style={{ marginTop: -8 }}>
                  {current.imagemUrl && <img src={current.imagemUrl} alt="" style={{ width: 64, borderRadius: 14, objectFit: "cover", marginBottom: 28, display: "block" }} />}
                  <h1 style={{ fontSize: "clamp(1.75rem, 6.2vw, 2.2rem)", fontWeight: 500, color: tx1, margin: "0 0 24px", lineHeight: 1.18, letterSpacing: "-0.02em", maxWidth: "86%", whiteSpace: "pre-line" }}>
                    {current.label}
                  </h1>
                  {current.descricao && <p style={{ fontSize: "1rem", fontWeight: 400, color: tx2, lineHeight: 1.55, margin: "0 0 32px", whiteSpace: "pre-line" }}>{current.descricao}</p>}
                  <button className="sb" onClick={() => next()} disabled={transitioning} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: "13px 24px",
                    borderRadius: 16, border: "none", background: cor, color: "#fff",
                    fontSize: "1rem", fontWeight: 700, boxShadow: `0 4px 16px ${cor}38`,
                    opacity: transitioning ? 0.7 : 1,
                  }}>
                    {transitioning ? <Spinner /> : <>{current.botaoTexto || "Começar"} →</>}
                  </button>
                </div>
              )
            )}

            {/* Video */}
            {current?.tipo === "video" && (
              <div>
                {logo && <img src={logo} alt="" style={{ height: 52, objectFit: "contain", maxWidth: 180, display: "block", margin: "0 auto 24px", mixBlendMode: form?.cliente_externo_id ? "multiply" : undefined }} />}
                {qNum(step + 1)}
                {current.label && qTitle(current.label, false)}
                {qDesc(current.descricao)}
                {current.videoUrl && (
                  <div style={{
                    borderRadius: 14, overflow: "hidden", marginBottom: 28,
                    border: `1px solid ${bd}`,
                    aspectRatio: "9/16",
                    maxHeight: "70vh",
                    margin: "0 auto 28px",
                    maxWidth: 360,
                  }}>
                    <iframe
                      src={current.videoUrl.includes("youtube") ? current.videoUrl.replace("watch?v=", "embed/") : current.videoUrl}
                      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                )}
                <button className="sb" onClick={() => next()} disabled={transitioning} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 10, border: "none", background: cor, color: "#fff", fontSize: 15, fontWeight: 700, opacity: transitioning ? 0.7 : 1 }}>
                  {transitioning ? <Spinner /> : <>{current.botaoTexto || "Continuar"} →</>}
                </button>
              </div>
            )}

            {/* Text / Phone / Email */}
            {(current?.tipo === "text" || isPhone(current?.tipo || "") || current?.tipo === "email") && (
              <div>
                {qNum(step + 1)}
                {qTitle(current.label, current.obrigatorio)}
                {qDesc(current.descricao)}
                {isPhone(current.tipo) ? (
                  <div className="pw" style={{ display: "flex", alignItems: "center", border: `2px solid ${bd}`, borderRadius: 12, background: ibg, overflow: "hidden", transition: "border-color 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderRight: `1px solid ${bd}`, height: 58, flexShrink: 0 }}>
                      <span style={{ fontSize: 22 }}>🇧🇷</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: tx2 }}>+55</span>
                    </div>
                    <input ref={inputRef as any} type="tel" inputMode="numeric"
                      placeholder={current.placeholder || "(11) 99999-9999"}
                      value={respostas[current.id] || ""}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                        let f = d;
                        if (d.length > 10) f = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
                        else if (d.length > 6) f = `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
                        else if (d.length > 2) f = `(${d.slice(0,2)}) ${d.slice(2)}`;
                        else if (d.length > 0) f = `(${d}`;
                        setRespostas({ ...respostas, [current.id]: f });
                      }}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "0 16px", height: 58, fontSize: 20, color: tx1, fontFamily: "inherit" }}
                    />
                  </div>
                ) : (
                  <div className="si">
                    <div className="si-line" style={{ borderBottom: `2px solid ${bd}`, transition: "border-color 0.2s" }}>
                      <input ref={inputRef as any}
                        type={current.tipo === "email" ? "email" : "text"}
                        placeholder={current.placeholder || "Digite sua resposta..."}
                        value={respostas[current.id] || ""}
                        onChange={e => setRespostas({ ...respostas, [current.id]: e.target.value })}
                        style={{ ...iStyle, borderBottom: "none" }}
                      />
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 12, color: tx3, margin: "10px 0 0" }}>Pressione <strong>Enter ↵</strong> para continuar</p>
                {isMobile && <div style={{ marginTop: 20 }}><OkButton inline /></div>}
              </div>
            )}

            {/* Textarea */}
            {current?.tipo === "textarea" && (
              <div>
                {qNum(step + 1)}
                {qTitle(current.label, current.obrigatorio)}
                {qDesc(current.descricao)}
                <div className="si">
                  <div className="si-line" style={{ borderBottom: `2px solid ${bd}`, transition: "border-color 0.2s" }}>
                    <textarea ref={inputRef as any}
                      placeholder={current.placeholder || "Digite sua resposta..."}
                      value={respostas[current.id] || ""}
                      onChange={e => setRespostas({ ...respostas, [current.id]: e.target.value })}
                      onKeyDown={e => e.stopPropagation()}
                      rows={4}
                      style={{ ...iStyle, borderBottom: "none", resize: "none", display: "block" }}
                    />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: tx3, margin: "10px 0 0" }}>Pressione <strong>Shift+Enter</strong> para nova linha</p>
                {isMobile && <div style={{ marginTop: 20 }}><OkButton inline /></div>}
              </div>
            )}

            {/* Select */}
            {current?.tipo === "select" && (
              <div>
                {qNum(step + 1)}
                {qTitle(current.label, current.obrigatorio)}
                {qDesc(current.descricao)}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(current.opcoes || []).map((o, i) => {
                    const sel = respostas[current.id] === o;
                    const isLoading = loadingOption === o;
                    return (
                      <button key={i} className="ob"
                        onClick={() => {
                          if (transitioning) return;
                          setRespostas({ ...respostas, [current.id]: o });
                          setLoadingOption(o);
                          setTimeout(() => next(o), 10);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: sel ? osel : ibg, border: `2px solid ${sel ? cor : bd}`, borderRadius: 12, textAlign: "left" }}>
                        <span style={{ minWidth: 30, height: 30, borderRadius: 8, border: `2px solid ${sel ? cor : bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isLoading ? 16 : 12, fontWeight: 800, color: sel ? "#fff" : tx3, background: sel ? cor : "transparent", flexShrink: 0, animation: isLoading ? "spin 0.6s linear infinite" : "none" }}>
                          {isLoading ? "⟳" : String.fromCharCode(65 + i)}
                        </span>
                        <span style={{ fontSize: 16, color: tx1, fontWeight: 500 }}>{o}</span>
                      </button>
                    );
                  })}
                </div>
                {isMobile && <div style={{ marginTop: 20 }}><OkButton inline /></div>}
              </div>
            )}

            {/* Radio */}
            {current?.tipo === "radio" && (
              <div>
                {qNum(step + 1)}
                {qTitle(current.label, current.obrigatorio)}
                {qDesc(current.descricao)}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(current.opcoes || []).map((o, i) => {
                    const sel = respostas[current.id] === o;
                    const isLoading = loadingOption === o;
                    return (
                      <button key={i} className="ob"
                        onClick={() => {
                          if (transitioning) return;
                          setRespostas({ ...respostas, [current.id]: o });
                          setLoadingOption(o);
                          setTimeout(() => next(o), 10);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: sel ? osel : ibg, border: `2px solid ${sel ? cor : bd}`, borderRadius: 12, textAlign: "left" }}>
                        <div style={{ minWidth: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? cor : bd}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: isLoading ? "spin 0.6s linear infinite" : "none", fontSize: isLoading ? 14 : "inherit", color: cor }}>
                          {isLoading ? "⟳" : sel ? <div style={{ width: 10, height: 10, borderRadius: "50%", background: cor }} /> : null}
                        </div>
                        <span style={{ fontSize: 16, color: tx1, fontWeight: 500 }}>{o}</span>
                      </button>
                    );
                  })}
                </div>
                {isMobile && <div style={{ marginTop: 20 }}><OkButton inline /></div>}
              </div>
            )}

            {/* Erro */}
            {erro && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, padding: "10px 14px", borderRadius: 8, background: "#ef444412", border: "1px solid #ef444428" }}>
                <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 500 }}>⚠ {erro}</span>
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* Galeria — fora do container animado para position:fixed funcionar corretamente */}
      {current?.tipo === "galeria" && (() => {
        const imgs = current.imagensGaleria || [];
        const n = imgs.length;
        const irAnterior = () => setGaleriaIdx(i => (i - 1 + n) % n);
        const irProximo  = () => setGaleriaIdx(i => (i + 1) % n);
        const slideW = "74vw";
        const gap = 10;
        return (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: fundo, display: "flex", flexDirection: "column",
            zIndex: 50, fontFamily: "'Poppins', 'DM Sans', system-ui, sans-serif",
          }}>
            {logo && (
              <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
                <img src={logo} alt="" style={{ height: 56, objectFit: "contain", maxWidth: 180, display: "block", mixBlendMode: form?.cliente_externo_id ? "multiply" : undefined }} />
              </div>
            )}
            {current.label && (
              <div style={{ padding: "16px 28px 0", textAlign: "center", flexShrink: 0 }}>
                <h2 style={{
                  fontSize: "clamp(1.1rem, 4.5vw, 1.6rem)", fontWeight: 700, color: tx1,
                  margin: 0, lineHeight: 1.25, letterSpacing: "-0.01em", whiteSpace: "pre-line",
                }}>
                  {current.label}
                </h2>
              </div>
            )}
            <div
              style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", minHeight: 0, marginTop: 20 }}
              onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
              onTouchEnd={e => {
                if (touchStartX === null) return;
                const diff = touchStartX - e.changedTouches[0].clientX;
                if (diff > 40) irProximo();
                else if (diff < -40) irAnterior();
                setTouchStartX(null);
              }}
              onMouseDown={e => setTouchStartX(e.clientX)}
              onMouseUp={e => {
                if (touchStartX === null) return;
                const diff = touchStartX - e.clientX;
                if (diff > 40) irProximo();
                else if (diff < -40) irAnterior();
                setTouchStartX(null);
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: `${gap}px`,
                transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
                transform: `translateX(calc(13vw - ${galeriaIdx} * (${slideW} + ${gap}px)))`,
                willChange: "transform", userSelect: "none",
              }}>
                {imgs.map((url, gi) => {
                  const ativo = gi === galeriaIdx;
                  const dist = Math.abs(gi - galeriaIdx);
                  return (
                    <div key={gi}
                      onClick={() => { if (gi < galeriaIdx) irAnterior(); else if (gi > galeriaIdx) irProximo(); }}
                      style={{
                        flexShrink: 0, width: slideW,
                        transition: "transform 0.4s ease, opacity 0.4s ease",
                        transform: ativo ? "scale(1)" : "scale(0.9)",
                        opacity: dist === 0 ? 1 : dist === 1 ? 0.5 : 0.2,
                        cursor: ativo ? "default" : "pointer",
                      }}
                    >
                      <img src={url} alt="" draggable={false} style={{
                        width: "100%", height: "100%", maxHeight: "52vh",
                        objectFit: "cover", borderRadius: 18, display: "block", pointerEvents: "none",
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
            {n > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "14px 0 0", flexShrink: 0 }}>
                {imgs.map((_, gi) => (
                  <button key={gi} onClick={() => setGaleriaIdx(gi)} style={{
                    width: gi === galeriaIdx ? 20 : 7, height: 7, borderRadius: 99, border: "none",
                    background: gi === galeriaIdx ? cor : tx3, transition: "all 0.3s ease", cursor: "pointer", padding: 0,
                  }} />
                ))}
              </div>
            )}
            <div style={{ padding: "14px 24px 32px", flexShrink: 0 }}>
              <button className="sb" onClick={() => next()} disabled={transitioning} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "15px 24px", borderRadius: 16, border: "none",
                background: cor, color: "#fff", fontSize: "1rem", fontWeight: 700,
                boxShadow: `0 4px 20px ${cor}50`, opacity: transitioning ? 0.7 : 1,
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                {transitioning ? "..." : <>{current.botaoTexto || "Continuar"} →</>}
              </button>
              <p style={{ fontSize: 10, color: tx3, textAlign: "center", margin: "10px 0 0", opacity: 0.4 }}>
                Powered by SALX Convert
              </p>
            </div>
          </div>
        );
      })()}

      {/* Setas fixas no canto inferior direito — mobile e desktop */}
      {current?.tipo !== "welcome" && current?.tipo !== "galeria" && (
        <NavButtons inline={false} />
      )}

      {/* Botão OK fixo inferior esquerdo — só desktop */}
      {!isMobile && (showOkBtn || isSelectOrRadio) && (
        <OkButton inline={false} />
      )}

      <p style={{ position: "fixed", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: tx3, whiteSpace: "nowrap", zIndex: 99, opacity: 0.4 }}>
        Powered by SALX Convert
      </p>
    </div>
  );
}
