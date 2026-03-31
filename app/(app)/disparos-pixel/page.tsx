"use client";

import { useState, useEffect } from "react";
import { Search, MousePointer } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface DisparoPixel {
  id: string;
  lead_id: string;
  telefone: string;
  etapa: string;
  evento: string;
  plataforma: string;
  retorno: boolean;
  created_at: string;
  leads?: { nome: string };
}

const ETAPA_CORES: Record<string, string> = {
  novo: "#3b82f6",
  em_contato: "#f59e0b",
  qualificado: "#8b5cf6",
  reuniao_agendada: "#06b6d4",
  proposta_enviada: "#ec4899",
  ganho: "#22c55e",
  perdido: "#ef4444",
};

const EVENTO_CORES: Record<string, string> = {
  Lead: "#3b82f6",
  Contact: "#22c55e",
  CompleteRegistration: "#8b5cf6",
  Schedule: "#f59e0b",
  Purchase: "#ec4899",
};

export default function DisparosPixelPage() {
  const [items, setItems] = useState<DisparoPixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregar() {
      const agId = await getAgenciaId();
      // Buscar leads com histórico de etapas (simulando disparos de pixel)
      const { data } = await supabase
        .from("leads_historico")
        .select("id, lead_id, etapa_anterior, etapa_nova, created_at, leads!leads_historico_lead_id_fkey(nome, telefone)")
        .eq("agencia_id", agId!)
        .order("created_at", { ascending: false })
        .limit(200);

      setItems((data || []).map((h: any) => {
        const etapa = h.etapa_nova || "";
        let evento = "Contact";
        if (etapa === "novo") evento = "Lead";
        else if (etapa === "reuniao_agendada") evento = "Schedule";
        else if (etapa === "ganho") evento = "Purchase";
        else if (etapa === "qualificado") evento = "CompleteRegistration";

        return {
          id: h.id,
          lead_id: h.lead_id,
          telefone: h.leads?.telefone || "",
          etapa: etapa.replace(/_/g, " "),
          evento,
          plataforma: "Meta Ads",
          retorno: true,
          created_at: h.created_at,
          leads: { nome: h.leads?.nome || "" },
        };
      }));
      setLoading(false);
    }
    carregar();
  }, []);

  const filtrados = items.filter(d =>
    d.telefone.includes(busca) || (d.leads?.nome || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Dashboard</a><span>›</span>
        <span className="current">Disparos de Pixel</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Disparos de Pixel</h1>

      <div className="table-wrapper">
        <div style={{ padding: "16px", borderBottom: "1px solid #2e2e2e" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar por telefone ou nome..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>DATA DE DISPARO</th>
              <th>CONVERSA</th>
              <th>RETORNO</th>
              <th>ETAPA DA JORNADA</th>
              <th>EVENTO DA PLATAFORMA</th>
              <th>PLATAFORMA</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Nenhum disparo encontrado.</td></tr>
            ) : filtrados.map(d => (
              <tr key={d.id}>
                <td style={{ fontSize: "12px", color: "#a0a0a0", whiteSpace: "nowrap" }}>
                  {new Date(d.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ fontSize: "13px", color: "#f0f0f0" }}>{d.telefone || d.leads?.nome || "—"}</td>
                <td>
                  {d.retorno ? (
                    <span style={{ color: "#22c55e", fontSize: "16px" }}>&#x2705;</span>
                  ) : (
                    <span style={{ color: "#ef4444", fontSize: "16px" }}>&#x274c;</span>
                  )}
                </td>
                <td>
                  <span style={{
                    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "500",
                    color: ETAPA_CORES[d.etapa.replace(/ /g, "_")] || "#a0a0a0",
                    textTransform: "capitalize",
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
                <td style={{ fontSize: "12px", color: "#a0a0a0" }}>{d.plataforma}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
