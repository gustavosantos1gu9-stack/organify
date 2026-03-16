"use client";

import { useState } from "react";
import { X, User, Building2, ChevronRight, ChevronLeft, Check, MessageCircle, Phone } from "lucide-react";

interface CadastrarClienteModalProps {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

const STEP_LABELS = ["Informações Básicas", "Endereço", "Informações Adicionais"];

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const ORIGENS = ["Facebook", "Instagram", "Google", "LinkedIn", "Indicação", "Outro"];

export default function CadastrarClienteModal({ onClose, onSave }: CadastrarClienteModalProps) {
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<"fisica" | "juridica">("juridica");
  const [form, setForm] = useState({
    nome: "", documento: "", email: "", telefone: "", whatsapp: false,
    instagram: "", valor_oportunidade: "", faturamento: "", empresa: "",
    cep: "", estado: "", cidade: "", logradouro: "", numero: "", complemento: "", bairro: "",
    responsavel: "", origem: "", categorias: "", observacoes: "",
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    onSave({ tipo, ...form });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "600" }}>Cadastrar cliente</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "6px", borderRadius: "6px" }}>
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "28px" }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const isDone = n < step;
            const isActive = n === step;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <div className={`step-circle ${isDone ? "done" : isActive ? "active" : "pending"}`}>
                    {isDone ? <Check size={14} /> : n}
                  </div>
                  <span style={{ fontSize: "11px", color: isActive ? "#22c55e" : "#606060", whiteSpace: "nowrap" }}>
                    {label}
                  </span>
                </div>
                {i < 2 && <div className={`step-line ${isDone ? "done" : ""}`} style={{ marginBottom: "20px" }} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Informações Básicas */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Tipo de pessoa</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["fisica", "juridica"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
                      border: `1px solid ${tipo === t ? "#22c55e" : "#2e2e2e"}`,
                      background: tipo === t ? "rgba(34,197,94,0.1)" : "#222",
                      color: tipo === t ? "#22c55e" : "#a0a0a0",
                      fontSize: "13px", fontWeight: "500",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    }}
                  >
                    {t === "fisica" ? <User size={14} /> : <Building2 size={14} />}
                    {t === "fisica" ? "Pessoa física" : "Pessoa jurídica"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">{tipo === "juridica" ? "Razão social" : "Nome completo"}</label>
                <input className="form-input" placeholder={tipo === "juridica" ? "Razão social" : "Nome"} value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{tipo === "juridica" ? "CNPJ" : "CPF"}</label>
                <input className="form-input" placeholder={tipo === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"} value={form.documento} onChange={(e) => set("documento", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="exemplo@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input className="form-input" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} style={{ flex: 1 }} />
                  <button
                    onClick={() => set("whatsapp", !form.whatsapp)}
                    style={{
                      width: "38px", height: "38px", borderRadius: "8px", cursor: "pointer", flexShrink: 0,
                      border: `1px solid ${form.whatsapp ? "#22c55e" : "#2e2e2e"}`,
                      background: form.whatsapp ? "rgba(34,197,94,0.1)" : "#222",
                      color: form.whatsapp ? "#22c55e" : "#606060",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="WhatsApp"
                  >
                    <MessageCircle size={15} />
                  </button>
                  <button style={{ width: "38px", height: "38px", borderRadius: "8px", cursor: "pointer", flexShrink: 0, border: "1px solid #2e2e2e", background: "#222", color: "#606060", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Phone size={15} />
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Valor da oportunidade</label>
                <input className="form-input" placeholder="R$ 0,00" value={form.valor_oportunidade} onChange={(e) => set("valor_oportunidade", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input className="form-input" placeholder="@exemplo" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Faturamento</label>
                <input className="form-input" placeholder="R$ 0,00" value={form.faturamento} onChange={(e) => set("faturamento", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <input className="form-input" placeholder="Nome da empresa" value={form.empresa} onChange={(e) => set("empresa", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Endereço */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600" }}>Endereço</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">CEP</label>
                <input className="form-input" placeholder="99999-999" value={form.cep} onChange={(e) => set("cep", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-input" value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                  <option value="">Selecione</option>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <select className="form-input" value={form.cidade} onChange={(e) => set("cidade", e.target.value)}>
                  <option value="">Selecione</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Logradouro</label>
              <input className="form-input" placeholder="Rua, Avenida, etc." value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Número</label>
                <input className="form-input" value={form.numero} onChange={(e) => set("numero", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Complemento</label>
                <input className="form-input" value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Bairro</label>
                <input className="form-input" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Informações Adicionais */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600" }}>Informações Adicionais</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Responsável</label>
                <select className="form-input" value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="gustavo">Gustavo</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Origem</label>
                <select className="form-input" value={form.origem} onChange={(e) => set("origem", e.target.value)}>
                  <option value="">Selecione</option>
                  {ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categorias/Tags</label>
              <input className="form-input" placeholder="Selecione as categorias..." value={form.categorias} onChange={(e) => set("categorias", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea
                className="form-input"
                placeholder="Digite suas observações aqui..."
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                rows={4}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
          {step > 1 ? (
            <button className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft size={14} /> Anterior
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Próximo <ChevronRight size={14} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSave}>
              Cadastrar cliente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
