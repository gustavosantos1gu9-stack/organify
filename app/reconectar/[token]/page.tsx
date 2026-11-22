"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { use } from "react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ReconectarPage({ params }: PageProps) {
  const { token } = use(params);

  const [agenciaNome, setAgenciaNome] = useState("");
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingMode, setPairingMode] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [reconectando, setReconectando] = useState(false);

  const reconexaoIniciadaRef = useRef(false);

  const api = useCallback(async (acao: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`/api/reconexao/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, ...extra }),
    });
    return res.json() as Promise<Record<string, unknown>>;
  }, [token]);

  // Carregar dados iniciais
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/reconexao/${token}`);
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok || data.error) {
          setErro((data.error as string) || "Link inválido ou expirado.");
          setCarregando(false);
          return;
        }
        setAgenciaNome((data.agencia_nome as string) || "");
        if (data.whatsapp_conectado) {
          setConectado(true);
          setCarregando(false);
          return;
        }
        setConectado(false);
        setCarregando(false);
      } catch {
        setErro("Erro ao carregar. Verifique sua conexão.");
        setCarregando(false);
      }
    }
    init();
  }, [token]);

  // Iniciar reconexão automaticamente quando desconectado
  useEffect(() => {
    if (conectado === false && !reconexaoIniciadaRef.current && !pairingMode) {
      reconexaoIniciadaRef.current = true;
      iniciarReconexao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado, pairingMode]);

  async function iniciarReconexao(numero?: string) {
    setReconectando(true);
    setErro("");
    setMensagem("");
    setQr(null);
    setPairingCode(null);

    try {
      const extra: Record<string, unknown> = {};
      if (numero) extra.numero = numero;

      const data = await api("reconectar", extra);

      if (data.ja_conectado) {
        setConectado(true);
        setReconectando(false);
        return;
      }
      if (data.em_andamento) {
        setMensagem((data.mensagem as string) || "Reconexão em andamento. Aguarde...");
        setReconectando(false);
        return;
      }
      if (data.qr) {
        setQr(data.qr as string);
        setReconectando(false);
        return;
      }
      if (data.pairing_code) {
        setPairingCode(data.pairing_code as string);
        setReconectando(false);
        return;
      }
      if (data.error) {
        setErro((data.error as string) || "Erro ao reconectar.");
        setReconectando(false);
        return;
      }
      setErro("Resposta inesperada. Tente novamente.");
      setReconectando(false);
    } catch {
      setErro("Erro de conexão. Verifique e tente novamente.");
      setReconectando(false);
    }
  }

  // Polling de status a cada 5s enquanto QR estiver visível
  useEffect(() => {
    if (!qr && !pairingCode) return;
    if (conectado) return;
    const interval = setInterval(async () => {
      try {
        const data = await api("status");
        if (data.whatsapp_conectado) {
          setConectado(true);
          setQr(null);
          setPairingCode(null);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [qr, pairingCode, conectado, api]);

  // Auto-refresh do QR a cada 25s (só connect, sem recriar)
  useEffect(() => {
    if (!qr || conectado) return;
    const interval = setInterval(async () => {
      try {
        const data = await api("qr");
        if (data.qr) setQr(data.qr as string);
      } catch {}
    }, 25000);
    return () => clearInterval(interval);
  }, [qr, conectado, api]);

  async function conectarComCodigo() {
    const num = telefone.replace(/\D/g, "");
    if (num.length < 10) {
      setErro("Digite um número válido com DDD (ex: 11999999999)");
      return;
    }
    reconexaoIniciadaRef.current = true;
    await iniciarReconexao(num);
  }

  // ── Render ──

  if (carregando) {
    return (
      <Wrapper>
        <p style={{ color: "#4A5B6C", fontSize: 15 }}>Carregando...</p>
      </Wrapper>
    );
  }

  if (erro && !qr && !pairingCode && !reconectando) {
    return (
      <Wrapper>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#ef4444", fontSize: 15, textAlign: "center", maxWidth: 320 }}>{erro}</p>
        <button onClick={() => { setErro(""); reconexaoIniciadaRef.current = false; iniciarReconexao(); }}
          style={btnStyle}>Tentar novamente</button>
      </Wrapper>
    );
  }

  if (conectado) {
    return (
      <Wrapper>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: "#22c55e", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
          Tudo certo!
        </h2>
        <p style={{ color: "#4A5B6C", fontSize: 15, textAlign: "center", maxWidth: 300 }}>
          Seu WhatsApp está conectado{agenciaNome ? ` a ${agenciaNome}` : ""}.
        </p>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
        <h1 style={{ color: "#0A1826", fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
          Conectar WhatsApp
        </h1>
        {agenciaNome && (
          <p style={{ color: "#4A5B6C", fontSize: 13, margin: 0 }}>{agenciaNome}</p>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #E6EBF0", marginBottom: 24, width: "100%", maxWidth: 360 }}>
        <TabBtn active={!pairingMode} onClick={() => { setPairingMode(false); setErro(""); }}>QR Code</TabBtn>
        <TabBtn active={pairingMode} onClick={() => { setPairingMode(true); setErro(""); setQr(null); }}>Código</TabBtn>
      </div>

      {/* Mensagem de andamento */}
      {mensagem && (
        <div style={{ background: "rgba(41,171,226,0.08)", border: "1px solid rgba(41,171,226,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, maxWidth: 320, width: "100%" }}>
          <p style={{ color: "#1C6CA6", fontSize: 13, margin: 0, textAlign: "center" }}>{mensagem}</p>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16, textAlign: "center", maxWidth: 320 }}>{erro}</p>
      )}

      {!pairingMode ? (
        // QR Code tab
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {reconectando ? (
            <div style={{ width: 220, height: 220, background: "#FFFFFF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#4A5B6C", fontSize: 13 }}>Gerando QR...</p>
            </div>
          ) : qr ? (
            <img
              src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
              alt="QR Code WhatsApp"
              style={{ width: 220, height: 220, borderRadius: 12, background: "#fff", padding: 8 }}
            />
          ) : (
            <div style={{ width: 220, height: 220, background: "#FFFFFF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#4A5B6C", fontSize: 13, textAlign: "center", padding: 16 }}>
                {mensagem || "Aguardando QR..."}
              </p>
            </div>
          )}

          {/* Instruções */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 10, padding: "14px 16px", maxWidth: 320, width: "100%" }}>
            <p style={{ color: "#4A5B6C", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>COMO CONECTAR:</p>
            {[
              "Abra o WhatsApp no celular",
              "Toque nos 3 pontos (⋮) ou em Configurações",
              "Toque em Aparelhos conectados",
              "Toque em Conectar aparelho",
              "Aponte a câmera para o QR Code acima",
            ].map((passo, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 4 ? 8 : 0 }}>
                <span style={{ color: "#1C6CA6", fontSize: 12, fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
                <span style={{ color: "#4A5B6C", fontSize: 12 }}>{passo}</span>
              </div>
            ))}
          </div>

          {qr && (
            <p style={{ color: "#4A5B6C", fontSize: 11, margin: 0 }}>
              O QR expira em ~30s. Ele se atualiza automaticamente.
            </p>
          )}
        </div>
      ) : (
        // Código tab
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 320 }}>
          <p style={{ color: "#4A5B6C", fontSize: 13, textAlign: "center", margin: 0 }}>
            Digite o número do WhatsApp que você quer conectar.
          </p>
          <input
            type="tel"
            placeholder="Ex: 11999999999"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", background: "#FFFFFF",
              border: "1px solid #E6EBF0", borderRadius: 8, color: "#0A1826",
              fontSize: 16, outline: "none", boxSizing: "border-box",
            }}
          />
          <button
            onClick={conectarComCodigo}
            disabled={reconectando}
            style={{ ...btnStyle, width: "100%", opacity: reconectando ? 0.6 : 1, cursor: reconectando ? "not-allowed" : "pointer" }}
          >
            {reconectando ? "Aguarde..." : "Receber código"}
          </button>

          {pairingCode && (
            <div style={{ background: "#FFFFFF", border: "1px solid #1C6CA6", borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
              <p style={{ color: "#4A5B6C", fontSize: 12, marginBottom: 8 }}>Código de pareamento:</p>
              <p style={{ color: "#0A1826", fontSize: 28, fontWeight: 700, letterSpacing: 4, margin: 0 }}>{pairingCode}</p>
              <p style={{ color: "#4A5B6C", fontSize: 11, marginTop: 8 }}>Digite este código no WhatsApp → Aparelhos conectados → Conectar com número de telefone</p>
            </div>
          )}

          {/* Instruções código */}
          {!pairingCode && (
            <div style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 10, padding: "14px 16px", width: "100%" }}>
              <p style={{ color: "#4A5B6C", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>COMO USAR O CÓDIGO:</p>
              {[
                "Abra o WhatsApp no celular",
                "Toque em Aparelhos conectados",
                "Toque em Conectar com número de telefone",
                "Digite o código que aparecer aqui",
              ].map((passo, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
                  <span style={{ color: "#1C6CA6", fontSize: 12, fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
                  <span style={{ color: "#4A5B6C", fontSize: 12 }}>{passo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#FFFFFF",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 0", background: "none", border: "none",
        borderBottom: active ? "2px solid #1C6CA6" : "2px solid transparent",
        color: active ? "#1C6CA6" : "#4A5B6C",
        fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
        transition: "color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#25d366", color: "#000", border: "none",
  borderRadius: 8, padding: "12px 24px", fontSize: 14,
  fontWeight: 600, cursor: "pointer",
};
