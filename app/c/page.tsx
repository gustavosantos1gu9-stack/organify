"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CaptureContent() {
  const params = useSearchParams();
  const [contador, setContador] = useState(5);

  const wa = params.get("wa") || "";
  const msg = params.get("msg") || "Olá! Vim pelo link e gostaria de mais informações.";
  const tipo = params.get("tipo") || "web";
  const titulo = params.get("titulo") || "Por favor, aguarde alguns segundos.";
  const desc = params.get("desc") || "Estamos localizando um atendente disponível...";

  // UTMs e rastreamento
  const utm_source = params.get("utm_source") || "";
  const utm_medium = params.get("utm_medium") || "";
  const utm_campaign = params.get("utm_campaign") || "";
  const utm_content = params.get("utm_content") || "";
  const utm_term = params.get("utm_term") || "";
  const fbclid = params.get("fbclid") || "";
  const link_id = params.get("link_id") || "";

  const waUrl = tipo === "web"
    ? `https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(msg)}`
    : `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

  useEffect(() => {
    if (!wa) return;

    // Salvar UTMs no sessionStorage para o webhook cruzar depois
    const trackingData = {
      wa_numero: wa,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, link_id,
      origem: utm_source ? (utm_source.includes("facebook") || utm_source.includes("ig") || utm_source.includes("fb") ? "Meta Ads" : utm_source.includes("google") ? "Google Ads" : "Outras Origens") : "Não Rastreada",
      timestamp: new Date().toISOString(),
      url_completa: window.location.href,
      referrer: document.referrer,
    };
    sessionStorage.setItem("salx_tracking", JSON.stringify(trackingData));

    // Salvar na API para cruzar com webhook
    fetch("/api/captura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trackingData),
    }).catch(() => {});

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
  }, [wa, waUrl]);

  // Determinar origem para mostrar badge
  const origemLabel = utm_source
    ? (utm_source.includes("facebook") || utm_source.includes("ig") || utm_source.includes("fb")
      ? "Meta Ads" : utm_source.includes("google") ? "Google Ads" : utm_source)
    : null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f0f0f",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "20px", padding: "24px",
    }}>
      <img src="/logo.png" alt="Logo" style={{ width: "72px", height: "72px", objectFit: "contain" }}/>

      {origemLabel && (
        <span style={{ fontSize:"11px", background:"rgba(41,171,226,0.1)", color:"#29ABE2", border:"1px solid rgba(41,171,226,0.2)", padding:"3px 10px", borderRadius:"20px" }}>
          {origemLabel === "Meta Ads" ? "🔷" : origemLabel === "Google Ads" ? "🔺" : "🌐"} {origemLabel}
        </span>
      )}

      <div style={{
        width: "48px", height: "48px", borderRadius: "50%",
        border: "3px solid #2e2e2e", borderTop: "3px solid #29ABE2",
        animation: "spin 1s linear infinite",
      }}/>

      <div style={{
        width: "56px", height: "56px", borderRadius: "50%",
        background: "rgba(41,171,226,0.1)", border: "2px solid #29ABE2",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "22px", fontWeight: "700", color: "#29ABE2",
      }}>{contador}</div>

      <div style={{ textAlign: "center", maxWidth: "360px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "600", color: "#f0f0f0", marginBottom: "8px" }}>{titulo}</h1>
        <p style={{ fontSize: "14px", color: "#606060" }}>{desc}</p>
      </div>

      {contador === 0 && (
        <a href={waUrl} style={{
          padding: "12px 24px", background: "#29ABE2", color: "#000",
          borderRadius: "8px", textDecoration: "none", fontWeight: "600", fontSize: "14px",
        }}>
          Clique aqui para continuar →
        </a>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:"48px", height:"48px", borderRadius:"50%", border:"3px solid #2e2e2e", borderTop:"3px solid #29ABE2", animation:"spin 1s linear infinite" }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <CaptureContent/>
    </Suspense>
  );
}
