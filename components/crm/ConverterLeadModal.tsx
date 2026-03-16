"use client";

import { useState } from "react";
import { X, UserCheck } from "lucide-react";
import { Lead, criarCliente, supabase } from "@/lib/hooks";

interface ConverterLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onSave: () => void;
}

export default function ConverterLeadModal({ lead, onClose, onSave }: ConverterLeadModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    valor_oportunidade: lead.valor?.toString() || "",
    faturamento: "",
    empresa: "",
    observacoes: "",
  });

  const handleConverter = async () => {
    setLoading(true);
    try {
      // Criar cliente baseado no lead
      const cliente = await criarCliente({
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        tipo: "fisica",
        status: "ativo",
        valor_oportunidade: parseFloat(form.valor_oportunidade) || 0,
        faturamento: parseFloat(form.faturamento) || 0,
        empresa: form.empresa || undefined,
        observacoes: form.observacoes || undefined,
        // Preservar UTMs do lead
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_content: lead.utm_content,
        utm_term: lead.utm_term,
      });

      // Marcar lead como ganho e vinculado ao cliente
      await supabase.from("leads").update({
        etapa: "ganho",
        convertido_cliente_id: cliente.id,
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);

      onSave();
      onClose();
      alert(`✅ ${lead.nome} convertido em cliente com sucesso!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao converter lead em cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={16} color="#22c55e" />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "600" }}>Converter em cliente</h2>
              <p style={{ fontSize: "12px", color: "#606060" }}>{lead.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px" }}><X size={16} /></button>
        </div>

        <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "8px", padding: "12px 14px", marginBottom: "20px", fontSize: "13px", color: "#a0a0a0" }}>
          Este lead será convertido em cliente e marcado como <strong style={{ color: "#22c55e" }}>Ganho</strong> no CRM. Os dados de UTM serão preservados.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Valor da oportunidade</label>
              <input className="form-input" placeholder="0,00" value={form.valor_oportunidade}
                onChange={(e) => setForm((f) => ({ ...f, valor_oportunidade: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Faturamento mensal</label>
              <input className="form-input" placeholder="0,00" value={form.faturamento}
                onChange={(e) => setForm((f) => ({ ...f, faturamento: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Empresa</label>
            <input className="form-input" placeholder="Nome da empresa" value={form.empresa}
              onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-input" placeholder="Observações..." value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={3} style={{ resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleConverter} disabled={loading}>
            <UserCheck size={14} />
            {loading ? "Convertendo..." : "Converter em cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}
