"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function embedUrl(url: string): string {
  if (!url) return "";
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

// Injeta fbq se pixel_id fornecido — usado para client-side tracking e deduplicação
function injectFbq(pixelId: string) {
  if (typeof window === "undefined" || !(window as any).fbqLoaded) {
    const script = document.createElement("script");
    script.innerHTML = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${pixelId}');
      fbq('track','PageView');
    `;
    document.head.appendChild(script);
    (window as any).fbqLoaded = true;
  }
}

function fbqTrack(event: string, params?: Record<string, any>, eventId?: string) {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", event, params || {}, eventId ? { eventID: eventId } : undefined);
  }
}

export default function LandingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [lp, setLp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("landing_pages")
        .select("*, logo_url, agencias(logo_url, nome, meta_pixel_id), clientes_externos(meta_pixel_id, meta_access_token)")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();
      setLp(data);
      setLoading(false);

      // Pixel: PageView + CAPI ViewContent
      const pixelId = data?.clientes_externos?.meta_pixel_id || data?.agencias?.meta_pixel_id;
      if (pixelId) {
        injectFbq(pixelId);

        const eventoVisita = data.evento_visita || "ViewContent";
        const eventId = `lp_view_${data.id}_${Date.now()}`;
        fbqTrack(eventoVisita, {}, eventId);
        fetch("/api/pixel/evento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agencia_id: data.agencia_id,
            event_name: eventoVisita,
            event_id: eventId,
            source_url: window.location.href,
            ...(data.cliente_externo_id ? { cliente_externo_id: data.cliente_externo_id } : {}),
          }),
        }).catch(() => {});
      }
    }
    load();
  }, [slug]);

  const handleCtaClick = useCallback(() => {
    if (!lp) return;
    const pixelId = lp.clientes_externos?.meta_pixel_id || lp.agencias?.meta_pixel_id;
    if (pixelId) {
      const eventId = `lp_lead_${lp.id}_${Date.now()}`;
      fbqTrack("Lead", {}, eventId);
      fetch("/api/pixel/evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencia_id: lp.agencia_id,
          event_name: "Lead",
          event_id: eventId,
          source_url: window.location.href,
          ...(lp.cliente_externo_id ? { cliente_externo_id: lp.cliente_externo_id } : {}),
        }),
      }).catch(() => {});
    }
  }, [lp]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #1a1a1a", borderTop: "3px solid #29ABE2", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!lp) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#404040", fontSize: 18 }}>
      Página não encontrada.
    </div>
  );

  const logo = lp.logo_url || lp.agencias?.logo_url || "";
  const embed = lp.video_url ? embedUrl(lp.video_url) : "";
  const waNumero = (lp.cta_whatsapp || "").replace(/\D/g, "");
  const waUrl = waNumero
    ? `https://wa.me/${waNumero.startsWith("55") ? waNumero : "55" + waNumero}${lp.cta_mensagem ? `?text=${encodeURIComponent(lp.cta_mensagem)}` : ""}`
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cta-btn:hover{transform:scale(1.04);box-shadow:0 8px 40px rgba(37,211,102,0.35)!important}
        .cta-btn:active{transform:scale(0.98)}
      `}</style>

      {logo && (
        <div style={{ width: "100%", padding: "20px 24px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "center" }}>
          <img src={logo} alt="" style={{ height: 40, objectFit: "contain" }} />
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 720, padding: "60px 24px 80px", animation: "fadeUp 0.6s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>

        {lp.titulo && (
          <h1 style={{ fontSize: "clamp(28px, 6vw, 48px)", fontWeight: 800, color: "#f0f0f0", textAlign: "center", lineHeight: 1.15, margin: 0 }}>
            {lp.titulo}
          </h1>
        )}

        {lp.subtitulo && (
          <p style={{ fontSize: "clamp(16px, 3vw, 20px)", color: "#808080", textAlign: "center", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
            {lp.subtitulo}
          </p>
        )}

        {embed && (
          <div style={{ width: "100%", maxWidth: 360, borderRadius: 16, overflow: "hidden", border: "1px solid #2e2e2e", background: "#111", aspectRatio: "9/16", maxHeight: "70vh", margin: "0 auto" }}>
            <iframe
              src={embed}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-btn"
            onClick={handleCtaClick}
            style={{
              display: "inline-flex", alignItems: "center", gap: 12,
              padding: "18px 48px", borderRadius: 12,
              background: "linear-gradient(135deg, #25D366, #128C7E)",
              color: "#fff", fontSize: 18, fontWeight: 700,
              textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s",
              boxShadow: "0 4px 24px rgba(37,211,102,0.2)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {lp.cta_texto || "Falar no WhatsApp"}
          </a>
        )}
      </div>

      <p style={{ position: "fixed", bottom: 8, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "#1a1a1a", whiteSpace: "nowrap" }}>
        Powered by SALX Convert
      </p>
    </div>
  );
}
