"use client";

import { useState } from "react";
import { X, User, Building2, ChevronRight, ChevronLeft, Check, MessageCircle } from "lucide-react";
import { Cliente, atualizarCliente, gerarLancamentosRecorrencia, supabase, useOrigens, useCategoriasClientes } from "@/lib/hooks";
import InputValor from "@/components/ui/InputValor";

interface EditarClienteModalProps {
  cliente: Cliente;
  onClose: () => void;
  onSave: () => void;
}

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const STEP_LABELS = ["Informações Básicas", "Endereço", "Informações Adicionais"];

export default function EditarClienteModal({ cliente, onClose, onSave }: EditarClienteModalProps) {
  const { data: origens } = useOrigens();
  const { data: categorias } = useCategoriasClientes();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"fisica"|"juridica">((cliente.tipo as "fisica"|"juridica") || "juridica");
  const [form, setForm] = useState({
    nome: cliente.nome || "",
    documento: cliente.documento || "",
    email: cliente.email || "",
    telefone: cliente.telefone || "",
    whatsapp: cliente.whatsapp || false,
    instagram: cliente.instagram || "",
    valor_oportunidade: cliente.valor_oportunidade ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cliente.valor_oportunidade) : "",
    faturamento: cliente.faturamento ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cliente.faturamento) : "",
    empresa: cliente.empresa || "",
    cep: cliente.cep || "",
    estado: cliente.estado || "",
    cidade: cliente.cidade || "",
    logradouro: cliente.logradouro || "",
    numero: cliente.numero || "",
    complemento: cliente.complemento || "",
    bairro: cliente.bairro || "",
    observacoes: cliente.observacoes || "",
    servico: cliente.servico ?? "mentoria",
    frequencia: cliente.frequencia ?? "mensal",
    status_recorrencia: cliente.status_recorrencia ?? "ativo",
    origem_id: cliente.origem_id || "",
    categoria_id: cliente.categoria_id || "",
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setLoading(true);
    try {
      // Parsear valor que pode estar formatado como R$ 1.000,00
      const parsearValor = (v: string) => {
        const limpo = v.replace(/[R$\s.]/g, "").replace(",", ".");
        return parseFloat(limpo) || 0;
      };

      const valorOportunidade = parsearValor(form.valor_oportunidade);
      const servicoAntes = cliente.servico;
      const frequenciaAntes = cliente.frequencia;

      await atualizarCliente(cliente.id, {
        tipo,
        nome: form.nome,
        documento: form.documento || undefined,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        whatsapp: form.whatsapp,
        instagram: form.instagram || undefined,
        empresa: form.empresa || undefined,
        valor_oportunidade: valorOportunidade,
        faturamento: parsearValor(form.faturamento),
        cep: form.cep || undefined,
        estado: form.estado || undefined,
        cidade: form.cidade || undefined,
        logradouro: form.logradouro || undefined,
        numero: form.numero || undefined,
        complemento: form.complemento || undefined,
        bairro: form.bairro || undefined,
        observacoes: form.observacoes || undefined,
        servico: form.servico,
        frequencia: form.frequencia,
        status_recorrencia: form.status_recorrencia,
        status: form.status_recorrencia === "saiu" ? "cancelado" :
                form.status_recorrencia === "pendencia" ? "inadimplente" : "ativo",
        origem_id: (form as any).origem_id || undefined,
        categoria_id: (form as any).categoria_id || undefined,
      });

      // Gerar lançamentos se assessoria (sempre que valor ou frequencia mudou)
      if (form.servico === "assessoria" && valorOportunidade > 0) {
        const mudou = servicoAntes !== "assessoria" ||
                      frequenciaAntes !== form.frequencia ||
                      valorOportunidade !== cliente.valor_oportunidade;
        if (mudou) {
          await gerarLancamentosRecorrencia({
            ...cliente,
            nome: form.nome,
            valor_oportunidade: valorOportunidade,
            servico: form.servico,
            frequencia: form.frequencia,
          });
        }
      }

      // Se saiu: remover lançamentos futuros não pagos
      if (form.status_recorrencia === "saiu") {
        await supabase
          .from("lancamentos_futuros")
          .delete()
          .eq("cliente_id", cliente.id)
          .eq("pago", false);
      }

      onSave();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
          <h2 style={{ fontSize:"17px", fontWeight:"600" }}>Editar cliente</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding:"6px" }}><X size={16}/></button>
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
                    style={{ cursor: isDone ? "pointer" : undefined }}
                    onClick={() => isDone && setStep(n)}>
                    {isDone ? <Check size={14}/> : n}
                  </div>
                  <span style={{ fontSize:"11px", color: isActive?"#f0f0f0":isDone?"#a0a0a0":"#606060", whiteSpace:"nowrap" }}>{label}</span>
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
                    border:`1px solid ${tipo===t?"#f0f0f0":"#2e2e2e"}`,
                    background:tipo===t?"rgba(41,171,226,0.1)":"#222",
                    color:tipo===t?"#f0f0f0":"#a0a0a0",
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
                    border:`1px solid ${form.whatsapp?"#f0f0f0":"#2e2e2e"}`,
                    background:form.whatsapp?"rgba(41,171,226,0.1)":"#222",
                    color:form.whatsapp?"#f0f0f0":"#606060",
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

            {/* Origem e Categoria */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              <div className="form-group">
                <label className="form-label">Origem</label>
                <select className="form-input" value={(form as any).origem_id || ""} onChange={(e)=>set("origem_id", e.target.value)}>
                  <option value="">Selecione</option>
                  {(origens||[]).map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" value={(form as any).categoria_id || ""} onChange={(e)=>set("categoria_id", e.target.value)}>
                  <option value="">Selecione</option>
                  {(categorias||[]).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Status da recorrência */}
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display:"flex", gap:"8px" }}>
                {[
                  { value:"ativo", label:"Ativo", color:"#29ABE2" },
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
                    border:`1px solid ${form.servico===s.value?"#f0f0f0":"#2e2e2e"}`,
                    background:form.servico===s.value?"rgba(41,171,226,0.1)":"#222",
                    color:form.servico===s.value?"#f0f0f0":"#a0a0a0",
                    fontSize:"13px", fontWeight:"500",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* Frequência — só para assessoria */}
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
                      border:`1px solid ${form.frequencia===f.value?"#f0f0f0":"#2e2e2e"}`,
                      background:form.frequencia===f.value?"rgba(41,171,226,0.1)":"#222",
                      color:form.frequencia===f.value?"#f0f0f0":"#a0a0a0",
                      fontSize:"12px", fontWeight:"500",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:"2px",
                    }}>
                      <span style={{ fontWeight:"600" }}>{f.label}</span>
                      <span style={{ fontSize:"10px", opacity:0.7 }}>{f.desc}</span>
                    </button>
                  ))}
                </div>
                {form.valor_oportunidade && (
                  <div style={{ marginTop:"10px", background:"rgba(41,171,226,0.06)", border:"1px solid rgba(41,171,226,0.15)", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#a0a0a0" }}>
                    {form.frequencia === "mensal" && (
                      <span>💰 Será cobrado <strong style={{color:"#29ABE2"}}>R$ {parseFloat(form.valor_oportunidade||"0").toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong> por mês</span>
                    )}
                    {form.frequencia === "quinzenal" && (
                      <span>💰 Será cobrado <strong style={{color:"#29ABE2"}}>R$ {(parseFloat(form.valor_oportunidade||"0")/2).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong> a cada 15 dias (2x/mês)</span>
                    )}
                    {form.frequencia === "trimestral" && (
                      <span>💰 Será cobrado <strong style={{color:"#29ABE2"}}>R$ {(parseFloat(form.valor_oportunidade||"0")*3).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong> a cada 3 meses</span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-input" placeholder="Digite suas observações aqui..."
                value={form.observacoes} onChange={(e)=>set("observacoes",e.target.value)}
                rows={4} style={{ resize:"vertical" }}/>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:"24px" }}>
          {step > 1 ? (
            <button className="btn-secondary" onClick={()=>setStep((s)=>s-1)}>
              <ChevronLeft size={14}/> Anterior
            </button>
          ) : <div/>}
          {step < 3 ? (
            <button className="btn-primary" onClick={()=>setStep((s)=>s+1)}>
              Próximo <ChevronRight size={14}/>
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Atualizar cliente"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
