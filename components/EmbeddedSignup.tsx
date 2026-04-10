"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { getAgenciaId } from "@/lib/hooks";

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

interface Props {
  onSuccess?: (data: any) => void;
}

export default function EmbeddedSignup({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "2021280612132547";

  useEffect(() => {
    // Carregar SDK do Facebook
    if (typeof window === "undefined") return;
    if (window.FB) {
      setSdkReady(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      setSdkReady(true);
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);

    // Listener pra receber dados do Embedded Signup
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP") {
          console.log("Embedded Signup data:", data);
        }
      } catch {}
    };
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [APP_ID]);

  const connectWhatsApp = () => {
    if (!sdkReady || !window.FB) {
      alert("SDK do Facebook ainda carregando, aguarde...");
      return;
    }

    setLoading(true);

    let signupData: any = null;
    const msgListener = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          signupData = data.data;
        }
      } catch {}
    };
    window.addEventListener("message", msgListener);

    window.FB.login(
      async (response: any) => {
        window.removeEventListener("message", msgListener);

        if (response.authResponse && response.authResponse.code) {
          const code = response.authResponse.code;
          const phone_number_id = signupData?.phone_number_id;
          const waba_id = signupData?.waba_id;

          if (!phone_number_id || !waba_id) {
            alert("Não foi possível obter as informações do número. Tente novamente.");
            setLoading(false);
            return;
          }

          const agenciaId = await getAgenciaId();
          const res = await fetch("/api/auth/meta/whatsapp-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              phone_number_id,
              waba_id,
              agencia_id: agenciaId,
            }),
          });
          const result = await res.json();

          if (result.ok) {
            alert(`WhatsApp conectado: ${result.nome || result.display_phone}`);
            onSuccess?.(result);
          } else {
            alert("Erro ao conectar: " + (result.error || "desconhecido"));
          }
        } else {
          console.log("User cancelled or failed login");
        }
        setLoading(false);
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID || undefined,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      }
    );
  };

  return (
    <button
      onClick={connectWhatsApp}
      disabled={loading || !sdkReady}
      style={{
        width: "100%", padding: "14px", borderRadius: "10px", cursor: loading ? "wait" : "pointer",
        background: "#25d366", color: "#fff", border: "none",
        fontSize: "15px", fontWeight: "600",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        opacity: loading || !sdkReady ? 0.7 : 1,
      }}
    >
      <MessageCircle size={18} />
      {loading ? "Conectando..." : !sdkReady ? "Carregando..." : "Conectar WhatsApp (Oficial)"}
    </button>
  );
}
