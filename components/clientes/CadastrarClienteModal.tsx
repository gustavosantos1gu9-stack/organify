"use client";

import { useState } from "react";
import { X, User, Building2, ChevronRight, ChevronLeft, Check, MessageCircle } from "lucide-react";
import InputValor from "@/components/ui/InputValor";

interface CadastrarClienteModalProps {
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

const STEP_LABELS = ["Informações Básicas", "Endereço", "Informações Adicionais"];
const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const ORIGENS = ["Facebook","Instagram","Google","LinkedIn","Indicação","Outro"];

export default function CadastrarClienteModal({ onClose, onSave }: CadastrarClienteModalProps) {
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<"fisica"|"juridica">("juridica");
  const [form, setForm] = useState({
    nome:"", documento:"", email:"", telefone:"", whatsapp:false,
    instagram:"", valor_oportunidade:"", faturamento:"", empresa:"",
    cep:"", estado:"", cidade:"", logradouro:"", numero:"", complemento:"", bairro:"",
    responsavel:"", origem:"", categorias:"", observacoes:"",
    servico:"mentoria", frequencia:"mensal", status_recorrencia:"ativo",
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
          <h2 style={{ fontSize:"17px", fontWeight:"600" }}>Cadastrar cliente</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding:"6px", cursor:"pointer" }}><X size={16}/></button>
        </div>

        {/* Steps */}
        <div style={{ display:"flex", alignItems:"center", marginBottom:"28px" }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const isDone = n < step;
            const isActive = n === step;
            return (
              <div key={label} style={{ display:"flex", alignItems:"center", flex: i < 2 ? 1 : undefined }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                  <div className={`step-circle ${isDone?"done":isActive?"active":"pending"}`}
                    style={{ cursor: isDone ? "pointer" : "default" }}
                    onClick={() => isDone && setStep(n)}>
                    {isDone ? <Check size={14}/> : n}
                  </div>
                  <span style={{ fontSize:"11px", color: isActive?"#22c55e":isDone?"#22c55e":"#606060", whiteSpace:"nowrap" }}>{label}</span>
                </div>
                {i < 2 && <div className={`step-line ${isDone?"done":""}`} style={{ marginBottom:"20px" }}/>}
              </div>
            );
          })}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div className="form-group">
              <label className="form-label">Tipo de pessoa</label>
              <div style={{ display:"flex", gap:"8px" }}>
                {(["fisica","juridica"] as const).map((t) => (
                  <button key={t} onClick={() => setTipo(t)} style={{
                    flex:1, padding:"10px", borderRadius:"8px", cursor:"pointer",
                    border:`1px solid ${tipo===t?"#22c55e":"#2e2e2e"}`,
                    background:tipo===t?"rgba(34,197,94,0.1)":"#222",
                    color:tipo===t?"#22c55e":"#a0a0a0",
                    fontSize:"13px", fontWeight:"500",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:"6px"
                  }}>
                    {t==="fisica"?<User size={14}/>:<Building2 size={14}/>}
                    {t==="fisica"?"Pessoa física":"Pessoa jurídica"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              <div className="form-group">
                <label className="form-label">{tipo==="juridica"?"Razão social":"Nome completo"} *</label>
                <input className="form-input" value={form.nome} onChange={(e)=>set("nome",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{tipo==="juridica"?"CNPJ":"CPF"}</label>
                <input className="form-input" value={form.documento} onChange={(e)=>set("documento",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" value={form.email} onChange={(e)=>set("email",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <div style={{ display:"flex", gap:"6px" }}>
                  <input className="form-input" value={form.telefone} onChange={(e)=>set("telefone",e.target.value)} style={{ flex:1 }}/>
                  <button onClick={()=>set("whatsapp",!form.whatsapp)} style={{
                    width:"38px", height:"38px", borderRadius:"8px", cursor:"pointer", flexShrink:0,
                    border:`1px solid ${form.whatsapp?"#22c55e":"#2e2e2e"}`,
                    background:form.whatsapp?"rgba(34,197,94,0.1)":"#222",
                    color:form.whatsapp?"#22c55e":"#606060",
                    display:"flex", alignItems:"center", justifyContent:"center"
                  }}><MessageCircle size={15}/></button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Valor da oportunidade</label>
                <InputValor value={form.valor_oportunidade} onChange={(v)=>set("valor_oportunidade",v)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input className="form-input" placeholder="@exemplo" value={form.instagram} onChange={(e)=>set("instagram",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Faturamento</label>
                <InputValor value={form.faturamento} onChange={(v)=>set("faturamento",v)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <input className="form-input" value={form.empresa} onChange={(e)=>set("empresa",e.target.value)}/>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <h3 style={{ fontSize:"15px", fontWeight:"600" }}>Endereço</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
              <div className="form-group">
                <label className="form-label">CEP</label>
                <input className="form-input" placeholder="99999-999" value={form.cep} onChange={(e)=>set("cep",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-input" value={form.estado} onChange={(e)=>set("estado",e.target.value)}>
                  <option value="">Selecione</option>
                  {ESTADOS.map((e)=><option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input className="form-input" value={form.cidade} onChange={(e)=>set("cidade",e.target.value)}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Logradouro</label>
              <input className="form-input" placeholder="Rua, Avenida..." value={form.logradouro} onChange={(e)=>set("logradouro",e.target.value)}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
              <div className="form-group">
                <label className="form-label">Número</label>
                <input className="form-input" value={form.numero} onChange={(e)=>set("numero",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Complemento</label>
                <input className="form-input" value={form.complemento} onChange={(e)=>set("complemento",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Bairro</label>
                <input className="form-input" value={form.bairro} onChange={(e)=>set("bairro",e.target.value)}/>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <h3 style={{ fontSize:"15px", fontWeight:"600" }}>Informações Adicionais</h3>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              <div className="form-group">
                <label className="form-label">Responsável</label>
                <select className="form-input" value={form.responsavel} onChange={(e)=>set("responsavel",e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="gustavo">Gustavo</option>
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

            {/* Status */}
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display:"flex", gap:"8px" }}>
                {[
                  { value:"ativo", label:"Ativo", color:"#22c55e" },
                  { value:"pendencia", label:"Pendência", color:"#f59e0b" },
                  { value:"saiu", label:"Saiu", color:"#ef4444" },
                ].map((s) => (
                  <button key={s.value} onClick={()=>set("status_recorrencia",s.value)} style={{
                    flex:1, padding:"8px", borderRadius:"8px", cursor:"pointer",
                    border:`1px solid ${form.status_recorrencia===s.value?s.color:"#2e2e2e"}`,
                    background:form.status_recorrencia===s.value?`${s.color}18`:"#222",
                    color:form.status_recorrencia===s.value?s.color:"#a0a0a0",
                    fontSize:"13px", fontWeight:"500",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* Tipo de serviço */}
            <div className="form-group">
              <label className="form-label">Tipo de serviço</label>
              <div style={{ display:"flex", gap:"8px" }}>
                {[
                  { value:"mentoria", label:"Mentoria" },
                  { value:"assessoria", label:"Assessoria" },
                ].map((s) => (
                  <button key={s.value} onClick={()=>set("servico",s.value)} style={{
                    flex:1, padding:"10px", borderRadius:"8px", cursor:"pointer",
                    border:`1px solid ${form.servico===s.value?"#22c55e":"#2e2e2e"}`,
                    background:form.servico===s.value?"rgba(34,197,94,0.1)":"#222",
                    color:form.servico===s.value?"#22c55e":"#a0a0a0",
                    fontSize:"13px", fontWeight:"500",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* Frequência — só assessoria */}
            {form.servico === "assessoria" && (
              <div className="form-group">
                <label className="form-label">Frequência de cobrança</label>
                <div style={{ display:"flex", gap:"8px" }}>
                  {[
                    { value:"mensal", label:"Mensal", desc:"1x por mês" },
                    { value:"quinzenal", label:"Quinzenal", desc:"2x por mês" },
                    { value:"trimestral", label:"Trimestral", desc:"1x a cada 3 meses" },
                  ].map((f) => (
                    <button key={f.value} onClick={()=>set("frequencia",f.value)} style={{
                      flex:1, padding:"10px 8px", borderRadius:"8px", cursor:"pointer",
                      border:`1px solid ${form.frequencia===f.value?"#22c55e":"#2e2e2e"}`,
                      background:form.frequencia===f.value?"rgba(34,197,94,0.1)":"#222",
                      color:form.frequencia===f.value?"#22c55e":"#a0a0a0",
                      fontSize:"12px", fontWeight:"500",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:"2px",
                    }}>
                      <span style={{ fontWeight:"600" }}>{f.label}</span>
                      <span style={{ fontSize:"10px", opacity:0.7 }}>{f.desc}</span>
                    </button>
                  ))}
                </div>
                {form.valor_oportunidade && (
                  <div style={{ marginTop:"10px", background:"rgba(34,197,94,0.06)", border:"1px solid rgba(34,197,94,0.15)", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#a0a0a0" }}>
                    {(() => {
                      const v = parseFloat(form.valor_oportunidade.replace(/[^0-9,]/g,"").replace(",",".")) || 0;
                      if (form.frequencia === "mensal") return <span>💰 Será cobrado <strong style={{color:"#22c55e"}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v)}</strong> por mês</span>;
                      if (form.frequencia === "quinzenal") return <span>💰 Será cobrado <strong style={{color:"#22c55e"}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v/2)}</strong> a cada 15 dias</span>;
                      if (form.frequencia === "trimestral") return <span>💰 Será cobrado <strong style={{color:"#22c55e"}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v*3)}</strong> a cada 3 meses</span>;
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-input" placeholder="Digite suas observações aqui..."
                value={form.observacoes} onChange={(e)=>set("observacoes",e.target.value)}
                rows={3} style={{ resize:"vertical" }}/>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:"24px" }}>
          {step > 1 ? (
            <button className="btn-secondary" onClick={()=>setStep((s)=>s-1)} style={{ cursor:"pointer" }}>
              <ChevronLeft size={14}/> Anterior
            </button>
          ) : <div/>}
          {step < 3 ? (
            <button className="btn-primary" onClick={()=>setStep((s)=>s+1)} style={{ cursor:"pointer" }}>
              Próximo <ChevronRight size={14}/>
            </button>
          ) : (
            <button className="btn-primary" onClick={()=>{ onSave({tipo,...form}); onClose(); }} style={{ cursor:"pointer" }}>
              Cadastrar cliente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
