"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface NovaMovimentacaoModalProps {
  tipo: "entrada" | "saida";
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

const CATEGORIAS_ENTRADA = ["Campanha De Marketing", "Consultoria De Seo", "Landing Page"];
const CATEGORIAS_SAIDA = ["Ferramentas", "Publicidade", "Salários", "Aluguel", "Outros"];

export default function NovaMovimentacaoModal({ tipo, onClose, onSave }: NovaMovimentacaoModalProps) {
  const [form, setForm] = useState({
    descricao: "", valor: "", data: new Date().toISOString().split("T")[0],
    categoria: "", cliente: "", observacoes: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const cats = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "600" }}>
            Nova {tipo === "entrada" ? "entrada" : "saída"}
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px" }}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" placeholder="Descrição da movimentação" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Valor</label>
              <input className="form-input" placeholder="R$ 0,00" value={form.valor} onChange={(e) => set("valor", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-input" value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
              <option value="">Selecione</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cliente (opcional)</label>
            <input className="form-input" placeholder="Vincular a um cliente" value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-input" placeholder="Observações..." value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} style={{ resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => { onSave({ tipo, ...form }); onClose(); }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
