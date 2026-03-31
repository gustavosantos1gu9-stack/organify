"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface DisparoPixel {
  id: string;
  conversa_id: string;
  etapa: string;
  evento: string;
  status: string;
  retorno: string;
  created_at: string;
  contato_nome?: string;
  contato_numero?: string;
}

const ETAPA_CORES: Record<string, string> = {
  "Entrou em contato": "#3b82f6",
  "Fez Contato": "#3b82f6",
  "Qualificado": "#8b5cf6",
  "Agendou": "#f59e0b",
  "Compareceu": "#06b6d4",
  "Comprou": "#22c55e",
  "Fechou": "#22c55e",
  "Perdido": "#ef4444",
};

const EVENTO_CORES: Record<string, string> = {
  Lead: "#3b82f6",
  Contact: "#22c55e",
  CompleteRegistration: "#8b5cf6",
  Schedule: "#f59e0b",
  Purchase: "#ec4899",
  InitiateCheckout: "#06b6d4",
};

export default function DisparosPixelPage() {
  const [items, setItems] = useState<DisparoPixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    setLoading(true);
    const agId = await getAgenciaId();

    // Buscar disparos reais da tabela pixel_disparos
    const { data: disparos } = await supabase
      .from("pixel_disparos")
      .select("id, conversa_id, etapa, evento, status, retorno, created_at")
      .eq("agencia_id", agId!)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!disparos?.length) { setItems([]); setLoading(false); return; }

    // Buscar dados das conversas (nome e número)
    const conversaIds = Array.from(new Set(disparos.map(d => d.conversa_id).filter(Boolean)));
    const conversaMap = new Map<string, { nome: string; numero: string }>();

    if (conversaIds.length > 0) {
      const { data: conversas } = await supabase
        .from("conversas")
        .select("id, contato_nome, contato_numero")
        .in("id", conversaIds);
      if (conversas) {
        for (const c of conversas) {
          conversaMap.set(c.id, { nome: c.contato_nome || "", numero: c.contato_numero || "" });
        }
      }
    }

    setItems(disparos.map(d => {
      const conversa = conversaMap.get(d.conversa_id) || { nome: "", numero: "" };
      return {
        ...d,
        contato_nome: conversa.nome,
        contato_numero: conversa.numero,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);
  // Auto-refresh a cada 30s
  useEffect(() => { const i = setInterval(carregar, 30000); return () => clearInterval(i); }, []);

  const filtrados = items.filter(d =>
    (d.contato_numero || "").includes(busca) ||
    (d.contato_nome || "").toLowerCase().includes(busca.toLowerCase()) ||
    (d.etapa || "").toLowerCase().includes(busca.toLowerCase()) ||
    (d.evento || "").toLowerCase().includes(busca.toLowerCase())
  );

  const sucessos = items.filter(d => d.status === "sucesso").length;
  const erros = items.filter(d => d.status === "erro").length;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Dashboard</a><span>›</span>
        <span className="current">Disparos de Pixel</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "600" }}>Disparos de Pixel</h1>
        <button onClick={carregar} className="btn-secondary" style={{ cursor: "pointer", fontSize: "12px", padding: "7px 12px" }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
        <div className="card" style={{ padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#606060", marginBottom: "4px" }}>Total de disparos</p>
          <p style={{ fontSize: "24px", fontWeight: "700", color: "#f0f0f0" }}>{items.length}</p>
        </div>
        <div className="card" style={{ padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#606060", marginBottom: "4px" }}>Sucesso</p>
          <p style={{ fontSize: "24px", fontWeight: "700", color: "#22c55e" }}>{sucessos}</p>
        </div>
        <div className="card" style={{ padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#606060", marginBottom: "4px" }}>Erro</p>
          <p style={{ fontSize: "24px", fontWeight: "700", color: erros > 0 ? "#ef4444" : "#404040" }}>{erros}</p>
        </div>
      </div>

      <div className="table-wrapper">
        <div style={{ padding: "16px", borderBottom: "1px solid #2e2e2e" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar por nome, numero, etapa ou evento..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>DATA / HORA</th>
              <th>CONTATO</th>
              <th>ETAPA</th>
              <th>EVENTO</th>
              <th>STATUS</th>
              <th>RETORNO</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Nenhum disparo de pixel registrado.</td></tr>
            ) : filtrados.map(d => (
              <tr key={d.id}>
                <td style={{ fontSize: "12px", color: "#a0a0a0", whiteSpace: "nowrap" }}>
                  {new Date(d.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </td>
                <td>
                  <div>
                    <p style={{ fontSize: "13px", color: "#f0f0f0", margin: 0, fontWeight: "500" }}>{d.contato_nome || "—"}</p>
                    <p style={{ fontSize: "11px", color: "#606060", margin: 0 }}>{d.contato_numero || "—"}</p>
                  </div>
                </td>
                <td>
                  <span style={{
                    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "500",
                    background: `${ETAPA_CORES[d.etapa] || "#606060"}18`,
                    color: ETAPA_CORES[d.etapa] || "#a0a0a0",
                  }}>
                    {d.etapa}
                  </span>
                </td>
                <td>
                  <span style={{
                    padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
                    background: (EVENTO_CORES[d.evento] || "#606060") + "20",
                    color: EVENTO_CORES[d.evento] || "#a0a0a0",
                  }}>
                    {d.evento}
                  </span>
                </td>
                <td>
                  {d.status === "sucesso" ? (
                    <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: "600" }}>Sucesso</span>
                  ) : (
                    <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: "600" }}>Erro</span>
                  )}
                </td>
                <td style={{ fontSize: "11px", color: "#606060", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.retorno || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
