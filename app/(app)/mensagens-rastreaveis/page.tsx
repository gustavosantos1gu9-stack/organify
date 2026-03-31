"use client";

import { useState, useEffect } from "react";
import { Search, Mail } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface MensagemRastreavel {
  id: string;
  lead_id: string;
  telefone: string;
  mensagem: string;
  utm_source: string;
  utm_campaign: string;
  rastreada: boolean;
  created_at: string;
  leads?: { nome: string; etapa: string };
}

export default function MensagensRastreavesPage() {
  const [items, setItems] = useState<MensagemRastreavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregar() {
      const agId = await getAgenciaId();
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, whatsapp_mensagem_inicial, utm_source, utm_campaign, etapa, created_at")
        .eq("agencia_id", agId!)
        .not("whatsapp_mensagem_inicial", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      setItems((data || []).map((l: any) => ({
        id: l.id,
        lead_id: l.id,
        telefone: l.telefone || "",
        mensagem: l.whatsapp_mensagem_inicial || "",
        utm_source: l.utm_source || "Não rastreada",
        utm_campaign: l.utm_campaign || "",
        rastreada: !!l.utm_source,
        created_at: l.created_at,
        leads: { nome: l.nome, etapa: l.etapa },
      })));
      setLoading(false);
    }
    carregar();
  }, []);

  const filtrados = items.filter(m =>
    m.telefone.includes(busca) || m.mensagem.toLowerCase().includes(busca.toLowerCase()) ||
    (m.leads?.nome || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Dashboard</a><span>›</span>
        <span className="current">Mensagens Rastreáveis</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Mensagens Rastreáveis</h1>

      <div className="table-wrapper">
        <div style={{ padding: "16px", borderBottom: "1px solid #2e2e2e" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar por telefone, nome ou mensagem..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>DATA</th>
              <th>CONTATO</th>
              <th>MENSAGEM</th>
              <th>ORIGEM</th>
              <th>CAMPANHA</th>
              <th>RASTREADA</th>
              <th>ETAPA</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Carregando...</td></tr>
            ) : !filtrados.length ? (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#606060", padding: "48px" }}>Nenhuma mensagem encontrada.</td></tr>
            ) : filtrados.map(m => (
              <tr key={m.id}>
                <td style={{ fontSize: "12px", color: "#a0a0a0", whiteSpace: "nowrap" }}>
                  {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>
                  <p style={{ fontSize: "13px", fontWeight: "500", color: "#f0f0f0", margin: 0 }}>{m.leads?.nome || "—"}</p>
                  <p style={{ fontSize: "11px", color: "#606060", margin: 0 }}>{m.telefone}</p>
                </td>
                <td style={{ fontSize: "12px", color: "#a0a0a0", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.mensagem || "—"}
                </td>
                <td><span className="badge badge-gray">{m.utm_source}</span></td>
                <td style={{ fontSize: "12px", color: "#a0a0a0" }}>{m.utm_campaign || "—"}</td>
                <td>
                  <span style={{
                    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "500",
                    background: m.rastreada ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                    color: m.rastreada ? "#22c55e" : "#ef4444",
                  }}>
                    {m.rastreada ? "Sim" : "Não"}
                  </span>
                </td>
                <td>
                  <span style={{
                    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "500",
                    background: "rgba(41,171,226,0.15)", color: "#29ABE2",
                    textTransform: "capitalize",
                  }}>
                    {(m.leads?.etapa || "novo").replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
