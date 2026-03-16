"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface NovoLeadModalProps {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

const ORIGENS = ["Facebook","Instagram","Google","LinkedIn","Indicação","Outro"];
const ETAPAS = [
  { value:"novo", label:"Novo" },
  { value:"em_contato", label:"Em contato" },
  { value:"reuniao_agendada", label:"Reunião agendada" },
  { value:"proposta_enviada", label:"Proposta enviada" },
  { value:"ganho", label:"Ganho" },
  { value:"perdido", label:"Perdido" },
];

export default function NovoLeadModal({ onClose, onSave }: NovoLeadModalProps) {
  const [form, setForm] = useState({
    nome:"", email:"", telefone:"", whatsapp:false,
    etapa:"novo", valor:"", origem:"",
    utm_source:"", utm_medium:"", utm_campaign:"", utm_content:"", utm_term:"",
    observacoes:"",
  });
  const set = (k: string, v: string | boolean) => setForm((f)=>({...f,[k]:v}));

  return (
    <div className="modal-overlay" onClick={(e)=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{ maxWidth:"560px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
          <h2 style={{ fontSize:"17px", fontWeight:"600" }}>Novo lead</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding:"6px" }}><X size={16}/></button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className="form-input" placeholder="Nome do lead" value={form.nome} onChange={(e)=>set("nome",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e)=>set("telefone",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" value={form.email} onChange={(e)=>set("email",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Valor estimado</label>
              <input className="form-input" placeholder="R$ 0,00" value={form.valor} onChange={(e)=>set("valor",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Etapa</label>
              <select className="form-input" value={form.etapa} onChange={(e)=>set("etapa",e.target.value)}>
                {ETAPAS.map((e)=><option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Origem</label>
              <select className="form-input" value={form.origem} onChange={(e)=>set("origem",e.target.value)}>
                <option value="">Selecione</option>
                {ORIGENS.map((o)=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* UTMs */}
          <div style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"14px" }}>
            <p style={{ fontSize:"12px", fontWeight:"600", color:"#a0a0a0", marginBottom:"12px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Rastreamento UTM</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              <div className="form-group">
                <label className="form-label">utm_source</label>
                <input className="form-input" placeholder="ex: facebook" value={form.utm_source} onChange={(e)=>set("utm_source",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">utm_medium</label>
                <input className="form-input" placeholder="ex: cpc" value={form.utm_medium} onChange={(e)=>set("utm_medium",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">utm_campaign</label>
                <input className="form-input" placeholder="ex: black-friday" value={form.utm_campaign} onChange={(e)=>set("utm_campaign",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">utm_content (público)</label>
                <input className="form-input" placeholder="ex: mulheres-30-45" value={form.utm_content} onChange={(e)=>set("utm_content",e.target.value)}/>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-input" placeholder="Observações..." value={form.observacoes} onChange={(e)=>set("observacoes",e.target.value)} rows={3} style={{ resize:"vertical" }}/>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:"8px", marginTop:"24px" }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={()=>{ if(!form.nome.trim()){alert("Nome é obrigatório");return;} onSave(form); onClose(); }}>
            Criar lead
          </button>
        </div>
      </div>
    </div>
  );
}
