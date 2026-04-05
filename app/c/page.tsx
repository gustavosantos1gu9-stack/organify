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
  // Server-side redirect (como Tintim) — evita problemas de encoding no client
  const waUrl = isMobile
    ? `/whatsapp?wa=${wa}&msg=${encodeURIComponent(msg)}`
    : `https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(msg)}`;

  const origem = utm_source
    ? (["facebook","ig","fb"].some(s => utm_source.toLowerCase().includes(s)) ? "Meta Ads"
      : utm_source.toLowerCase().includes("google") ? "Google Ads" : "Outras Origens")
    : "Não Rastreada";

  // Carregar Pixel da agência e injetar script
  useEffect(() => {
    if (!wa) return;
    fetch(`/api/pixel-id?wa=${wa}`).then(r => r.json()).then(data => {
      if (data.pixel_id) {
        // Injetar Meta Pixel script
        const script = document.createElement("script");
        script.innerHTML = `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${data.pixel_id}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(script);
      }
    }).catch(() => {});
  }, [wa]);

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
        {contador > 0 ? (
          <>
            <div style={{ width:"48px", height:"48px" }}>
              <div style={{ width:"48px", height:"48px", borderRadius:"50%", border:"3px solid #ddd", borderTopColor:"#25d366", animation:"spin 1s linear infinite" }}/>
            </div>
            <div style={{ textAlign:"center" }}>
              <h1 style={{ fontSize:"18px", fontWeight:"600", color:"#444", marginBottom:"8px" }}>{titulo}</h1>
              <p style={{ fontSize:"14px", color:"#888" }}>{desc}</p>
            </div>
          </>
        ) : (
          <>
            <div style={{ width:"56px", height:"56px", background:"#25d366", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <div style={{ textAlign:"center" }}>
              <h1 style={{ fontSize:"18px", fontWeight:"600", color:"#444", marginBottom:"8px" }}>Toque no botão abaixo para iniciar a conversa</h1>
              <p style={{ fontSize:"14px", color:"#888" }}>Se o WhatsApp não abriu automaticamente, toque no botão</p>
            </div>
            <a href={waUrl} style={{
              padding:"16px 40px", background:"#25d366", color:"#fff",
              borderRadius:"28px", textDecoration:"none", fontWeight:"600", fontSize:"16px",
              display:"flex", alignItems:"center", gap:"8px",
              boxShadow:"0 4px 12px rgba(37,211,102,0.3)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.937 11.937 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.386 0-4.597-.842-6.32-2.244l-.44-.368-3.258 1.092 1.092-3.258-.368-.44A9.957 9.957 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
              Abrir WhatsApp
            </a>
          </>
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
