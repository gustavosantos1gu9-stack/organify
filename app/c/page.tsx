"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CaptureContent() {
  const params = useSearchParams();
  const [contador, setContador] = useState(5);
  const [sessionId] = useState(() => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`);

  const wa = params.get("wa") || "";
  const msg = params.get("msg") || "Olá! Vim pelo link e gostaria de mais informações.";
  const tipo = params.get("tipo") || "app";
  const titulo = params.get("titulo") || "Por favor, aguarde alguns segundos.";
  const desc = params.get("desc") || "Estamos localizando um atendente disponível...";

  const utm_source = params.get("utm_source") || "";
  const utm_medium = params.get("utm_medium") || "";
  const utm_campaign = params.get("utm_campaign") || "";
  const utm_content = params.get("utm_content") || "";
  const utm_term = params.get("utm_term") || "";
  const fbclid = params.get("fbclid") || "";
  const link_id = params.get("link_id") || "";

  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const waUrl = isMobile || tipo !== "web"
    ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
    : `https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(msg)}`;

  const origem = utm_source
    ? (["facebook","ig","fb"].some(s => utm_source.toLowerCase().includes(s)) ? "Meta Ads"
      : utm_source.toLowerCase().includes("google") ? "Google Ads" : "Outras Origens")
    : "Não Rastreada";

  useEffect(() => {
    if (!wa) return;

    // Salvar rastreamento — sem wa_numero do lead (ainda não sabemos quem é)
    // Usamos session_id para cruzar depois via mensagem de saudação
    const trackingData = {
      session_id: sessionId,
      wa_destino: wa, // número de destino (seu número)
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, link_id, origem,
      url_completa: window.location.href,
      created_at: new Date().toISOString(),
    };

    // Salvar no sessionStorage — quando o lead abrir o WhatsApp e mandar msg,
    // o fbclid/utm ficam na URL e o webhook captura via rastreamentos_pendentes
    sessionStorage.setItem("salx_tracking", JSON.stringify(trackingData));

    // A mensagem enviada ao WhatsApp vai conter o session_id embutido
    // para cruzar quando chegar no webhook
    fetch("/api/captura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trackingData),
    }).catch(() => {});

    // Salvar também com fbclid como chave de cruzamento (se tiver)
    if (fbclid) {
      fetch("/api/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...trackingData, chave: "fbclid", valor: fbclid }),
      }).catch(() => {});
    }

    const timer = setInterval(() => {
      setContador(c => {
        if (c <= 1) {
          clearInterval(timer);
          window.location.href = waUrl;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [wa, waUrl, sessionId]);

  const origemLabel = utm_source
    ? (["facebook","ig","fb"].some(s => utm_source.toLowerCase().includes(s)) ? "Meta Ads"
      : utm_source.toLowerCase().includes("google") ? "Google Ads" : utm_source)
    : null;

  return (
    <div style={{
      minHeight:"100vh",
      background:"#EFEAE2",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"24px",
      fontFamily:"'Open Sans', sans-serif",
    }}>
      <div style={{
        background:"#fff",
        borderRadius:"16px",
        padding:"48px",
        maxWidth:"90vw",
        width:"420px",
        boxShadow:"0 1px 3px rgba(0,0,0,0.02)",
        display:"flex", flexDirection:"column", alignItems:"center",
        gap:"32px",
      }}>
        <div style={{ width:"48px", height:"48px" }}>
          <div style={{ width:"48px", height:"48px", borderRadius:"50%", border:"3px solid #ddd", borderTopColor:"#25d366", animation:"spin 1s linear infinite" }}/>
        </div>

        <div style={{ textAlign:"center" }}>
          <h1 style={{ fontSize:"18px", fontWeight:"600", color:"#444", marginBottom:"8px" }}>{titulo}</h1>
          <p style={{ fontSize:"14px", color:"#888" }}>{desc}</p>
        </div>

        {contador === 0 && (
          <a href={waUrl} style={{
            padding:"12px 28px", background:"#25d366", color:"#fff",
            borderRadius:"24px", textDecoration:"none", fontWeight:"600", fontSize:"14px",
          }}>
            Abrir WhatsApp
          </a>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap');
      `}</style>
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh", background:"#EFEAE2", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:"48px", height:"48px", borderRadius:"50%", border:"3px solid #ddd", borderTopColor:"#25d366", animation:"spin 1s linear infinite" }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <CaptureContent/>
    </Suspense>
  );
}
