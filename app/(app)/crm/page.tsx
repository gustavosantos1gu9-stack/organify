"use client";

import { useState, useRef } from "react";
import { Search, Plus, Trash2, Flame, DollarSign, Percent, Edit2, Upload } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import Filtros from "@/components/ui/Filtros";
import NovoLeadModal from "@/components/crm/NovoLeadModal";
import ConverterLeadModal from "@/components/crm/ConverterLeadModal";
import EditarLeadModal from "@/components/crm/EditarLeadModal";
import { useLeads, criarLead, removerLead, atualizarEtapaLead, Lead } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const ETAPAS = [
  { key:"nao_respondeu", label:"Não respondeu", color:"#a0a0a0" },
  { key:"em_contato", label:"Em contato", color:"#3b82f6" },
  { key:"qualificado", label:"Qualificado", color:"#06b6d4" },
  { key:"reuniao_agendada", label:"Reunião agendada", color:"#f59e0b" },
  { key:"proposta_enviada", label:"Proposta enviada", color:"#8b5cf6" },
  { key:"ganho", label:"Ganho", color:"#29ABE2" },
  { key:"perdido", label:"Perdido", color:"#ef4444" },
];

function getQualificacao(etapa: string): { label: string; color: string; bg: string } {
  if (etapa === "nao_respondeu" || etapa === "novo" || etapa === "em_contato") {
    return { label: "Frio", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
  }
  if (etapa === "qualificado" || etapa === "reuniao_agendada") {
    return { label: "Morno", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  }
  if (etapa === "proposta_enviada" || etapa === "ganho") {
    return { label: "Quente", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
  }
  return { label: "—", color: "#606060", bg: "rgba(96,96,96,0.1)" };
}

const FILTROS_GRUPOS = [
  { label:"Etapa", key:"etapa", opcoes: ETAPAS.map((e)=>({ label:e.label, value:e.key })) },
  { label:"Origem", key:"origem", opcoes:[
    { label:"Facebook", value:"Facebook" },
    { label:"Instagram", value:"Instagram" },
    { label:"Google", value:"Google" },
    { label:"LinkedIn", value:"LinkedIn" },
  ]},
  { label:"Data", key:"data", tipo:"date-range" as const, opcoes:[] },
];

function EtapaBadge({ etapa }: { etapa: string }) {
  const e = ETAPAS.find((x)=>x.key===etapa)||ETAPAS[0];
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", padding:"3px 10px",
      borderRadius:"20px", fontSize:"12px", fontWeight:"500",
      background:`${e.color}18`, color:e.color
    }}>{e.label}</span>
  );
}

function KanbanBoard({ leads, onEtapaChange, onRemover, onConverter, onEditar }: {
  leads: Lead[];
  onEtapaChange:(id:string, etapa:string)=>void;
  onRemover:(id:string)=>void;
  onConverter:(lead:Lead)=>void;
  onEditar:(lead:Lead)=>void;
}) {
  const dragId = useRef<string|null>(null);
  const [dragOver, setDragOver] = useState<string|null>(null);
  const [menuAberto, setMenuAberto] = useState<string|null>(null);

  return (
    <div style={{ display:"flex", gap:"0", overflowX:"auto", minHeight:"500px" }}>
      {ETAPAS.map((etapa, idx) => {
        const cards = leads.filter((l)=>etapa.key==="nao_respondeu" ? (l.etapa===etapa.key||l.etapa==="novo") : l.etapa===etapa.key);
        const isOver = dragOver===etapa.key;
        const total = cards.reduce((a,b)=>a+(b.valor||0),0);
        return (
          <div key={etapa.key}
            style={{ minWidth:"220px", flex:"0 0 220px", borderRight: idx < ETAPAS.length-1 ? "1px solid #2e2e2e" : "none" }}
            onDragOver={(e)=>{ e.preventDefault(); setDragOver(etapa.key); }}
            onDragLeave={()=>setDragOver(null)}
            onDrop={(e)=>{ e.preventDefault(); if(dragId.current){ onEtapaChange(dragId.current,etapa.key); dragId.current=null; } setDragOver(null); }}
          >
            {/* Header da coluna */}
            <div style={{
              padding:"12px 14px", borderBottom:"1px solid #2e2e2e",
              background: isOver ? `${etapa.color}08` : "transparent",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:etapa.color, flexShrink:0 }}/>
                  <span style={{ fontSize:"12px", fontWeight:"600", color:"#f0f0f0" }}>{etapa.label}</span>
                  <span style={{ fontSize:"11px", background:"#2a2a2a", color:"#606060", padding:"1px 7px", borderRadius:"10px" }}>{cards.length}</span>
                </div>
              </div>
              <p style={{ fontSize:"12px", color: total > 0 ? "#29ABE2" : "#404040", fontWeight:"600", paddingLeft:"14px" }}>
                {formatCurrency(total)}
              </p>
            </div>

            {/* Cards */}
            <div style={{ padding:"8px", display:"flex", flexDirection:"column", gap:"6px", minHeight:"300px", background: isOver ? `${etapa.color}05` : "transparent" }}>
              {cards.map((lead)=>(
                <div key={lead.id} draggable
                  onDragStart={()=>{ dragId.current=lead.id; }}
                  onDragEnd={()=>{ dragId.current=null; setDragOver(null); }}
                  style={{
                    background:"#1e1e1e", border:"1px solid #2e2e2e",
                    borderRadius:"8px", padding:"10px 12px",
                    cursor:"grab", userSelect:"none",
                    transition:"border-color 0.1s",
                    position:"relative",
                  }}
                  onMouseEnter={(e)=>{ (e.currentTarget as HTMLElement).style.borderColor="#3a3a3a"; }}
                  onMouseLeave={(e)=>{ (e.currentTarget as HTMLElement).style.borderColor="#2e2e2e"; }}
                >
                  {/* Topo do card */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px", flex:1, minWidth:0 }}>
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%", background: getQualificacao(lead.etapa).color, flexShrink:0 }}/>
                      <span style={{ fontSize:"13px", fontWeight:"500", color:"#f0f0f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lead.nome}</span>
                    </div>
                    <button onClick={(e)=>{ e.stopPropagation(); setMenuAberto(menuAberto===lead.id?null:lead.id); }}
                      style={{ background:"none", border:"none", color:"#606060", cursor:"pointer", padding:"0 0 0 6px", lineHeight:1, flexShrink:0, fontSize:"18px", letterSpacing:"1px" }}>
                      ···
                    </button>
                    {menuAberto===lead.id && (
                      <div style={{ position:"absolute", right:"8px", top:"32px", background:"#1e1e1e", border:"1px solid #3a3a3a", borderRadius:"8px", overflow:"hidden", zIndex:100, minWidth:"140px", boxShadow:"0 4px 12px rgba(0,0,0,0.4)" }}>
                        <button onClick={(e)=>{ e.stopPropagation(); setMenuAberto(null); onEditar(lead); }}
                          style={{ width:"100%", padding:"10px 14px", background:"none", border:"none", color:"#f0f0f0", cursor:"pointer", fontSize:"13px", textAlign:"left", display:"flex", alignItems:"center", gap:"8px" }}
                          onMouseEnter={(e)=>(e.currentTarget.style.background="#2a2a2a")}
                          onMouseLeave={(e)=>(e.currentTarget.style.background="none")}>
                          ✏️ Editar lead
                        </button>
                        <button onClick={(e)=>{ e.stopPropagation(); setMenuAberto(null); onRemover(lead.id); }}
                          style={{ width:"100%", padding:"10px 14px", background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:"13px", textAlign:"left", display:"flex", alignItems:"center", gap:"8px" }}
                          onMouseEnter={(e)=>(e.currentTarget.style.background="#2a2a2a")}
                          onMouseLeave={(e)=>(e.currentTarget.style.background="none")}>
                          🗑️ Remover
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Valor */}
                  <div style={{ background:"#252525", borderRadius:"4px", padding:"4px 8px", marginBottom:"8px", textAlign:"center" }}>
                    <span style={{ fontSize:"12px", color: lead.valor ? "#29ABE2" : "#404040", fontWeight:"600" }}>
                      {lead.valor ? formatCurrency(lead.valor) : "R$ 0,00"}
                    </span>
                  </div>

                  {/* Infos UTM */}
                  {lead.utm_campaign && (
                    <p style={{ fontSize:"11px", color:"#606060", marginBottom:"2px" }}>📣 {lead.utm_campaign}</p>
                  )}
                  {lead.utm_content && (
                    <p style={{ fontSize:"11px", color:"#606060", marginBottom:"6px" }}>👥 {lead.utm_content}</p>
                  )}

                  {/* Botões Ganho / Perda */}
                  <div style={{ display:"flex", gap:"6px", marginBottom:"6px" }}>
                    <button
                      onClick={()=>{ if(lead.convertido_cliente_id){ return; } onConverter(lead); }}
                      style={{
                        flex:1, padding:"5px 0", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"500",
                        border:"none",
                        background: lead.convertido_cliente_id ? "rgba(41,171,226,0.2)" : "rgba(41,171,226,0.15)",
                        color:"#29ABE2",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:"4px",
                      }}
                    >
                      ✓ {lead.convertido_cliente_id ? "Cliente" : "Ganho"}
                    </button>
                    <button
                      onClick={()=>onEtapaChange(lead.id,"perdido")}
                      style={{
                        flex:1, padding:"5px 0", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"500",
                        border:"none",
                        background:"rgba(239,68,68,0.15)",
                        color:"#ef4444",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:"4px",
                      }}
                    >
                      ✕ Perda
                    </button>
                  </div>

                  {/* Data */}
                  <p style={{ fontSize:"10px", color:"#404040", textAlign:"right" }}>
                    {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}

              {cards.length===0 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"80px" }}>
                  <p style={{ fontSize:"12px", color:"#303030", textAlign:"center" }}>Sem leads</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CRMPage() {
  const [view, setView] = useState<"table"|"kanban">("kanban");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Record<string,string>>({});
  const [showModal, setShowModal] = useState(false);
  const [convertendo, setConvertendo] = useState<Lead|null>(null);
  const [editando, setEditando] = useState<Lead|null>(null);
  const { data: leads, loading, refresh } = useLeads(busca, filtros.etapa||"");

  const filtrados = (leads??[]).filter((l)=>{
    if (filtros.origem && l.origens?.nome!==filtros.origem) return false;
    if (filtros.data_de && l.created_at<filtros.data_de) return false;
    if (filtros.data_ate && l.created_at>filtros.data_ate+"T23:59:59") return false;
    return true;
  });

  const totalPipeline = filtrados.reduce((a,b)=>a+(b.valor||0),0);
  const leadsQuentes = filtrados.filter((l)=>l.etapa==="reuniao_agendada"||l.etapa==="proposta_enviada").length;
  const ganhos = filtrados.filter((l)=>l.etapa==="ganho").length;
  const taxaConversao = filtrados.length ? Math.round(ganhos/filtrados.length*100) : 0;

  const handleSalvar = async (data: Record<string,unknown>) => {
    try {
      await criarLead({
        nome: data.nome as string,
        email: data.email as string||undefined,
        telefone: data.telefone as string||undefined,
        etapa: data.etapa as string,
        valor: parseFloat((data.valor as string)?.replace(/[^0-9,]/g,"").replace(",","."))||0,
        utm_source: data.utm_source as string||undefined,
        utm_medium: data.utm_medium as string||undefined,
        utm_campaign: data.utm_campaign as string||undefined,
        utm_content: data.utm_content as string||undefined,
        utm_term: data.utm_term as string||undefined,
        observacoes: data.observacoes as string||undefined,
      });
      refresh();
    } catch(e){ console.error(e); alert("Erro ao salvar lead"); }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">CRM</span></div>
      <h1 style={{ fontSize:"22px", fontWeight:"600", marginBottom:"24px" }}>CRM</h1>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"28px" }}>
        <KPICard label="Taxa de conversão" value={`${taxaConversao}%`} change={0} icon={<Percent size={16}/>} iconBg="amber"/>
        <KPICard label="Leads quentes" value={leadsQuentes} change={0} icon={<Flame size={16}/>} iconBg="red"/>
        <KPICard label="Pipeline total" value={formatCurrency(totalPipeline)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
      </div>

      <div className="table-wrapper">
        {/* Toggle + botões topo */}
        <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px", borderBottom:"1px solid #2e2e2e", flexWrap:"wrap" }}>
          <label className="toggle">
            <input type="checkbox" checked={view==="kanban"} onChange={(e)=>setView(e.target.checked?"kanban":"table")}/>
            <span className="toggle-slider"/>
          </label>
          <span style={{ fontSize:"13px", color:"#a0a0a0" }}>
            {view==="kanban" ? "Visualização em Kanban" : "Visualização em Tabela"}
          </span>
          <div style={{ marginLeft:"auto", display:"flex", gap:"8px" }}>
            <button className="btn-ghost" style={{ fontSize:"12px" }}>Campanhas</button>
            <a href="/crm/dashboard" className="btn-ghost" style={{ fontSize:"12px", textDecoration:"none" }}>Dashboard</a>
          </div>
        </div>

        {/* Barra de busca e filtros */}
        <div style={{ padding:"12px 16px", display:"flex", gap:"10px", borderBottom:"1px solid #2e2e2e", flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:"200px" }}>
            <Search size={14} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar leads..." value={busca} onChange={(e)=>setBusca(e.target.value)}/>
          </div>
          <Filtros grupos={FILTROS_GRUPOS} valores={filtros} onChange={(k,v)=>setFiltros((f)=>({...f,[k]:v}))} onLimpar={()=>setFiltros({})}/>
          <button className="btn-primary" onClick={()=>setShowModal(true)}><Plus size={14}/> Novo lead</button>
        </div>

        {/* Botões importar (apenas tabela) */}
        {view==="table" && (
          <div style={{ padding:"10px 16px", display:"flex", gap:"8px", borderBottom:"1px solid #2e2e2e" }}>
            <button className="btn-secondary" style={{ fontSize:"12px" }}><Upload size={13}/> Importar leads</button>
            <button className="btn-secondary" style={{ fontSize:"12px" }}><Upload size={13}/> Modelo de importação</button>
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <div style={{ padding:"48px", textAlign:"center", color:"#606060" }}>Carregando...</div>
        ) : view==="kanban" ? (
          <KanbanBoard
            leads={filtrados}
            onEtapaChange={async(id,e)=>{ await atualizarEtapaLead(id,e); refresh(); }}
            onRemover={async(id)=>{ if(confirm("Remover este lead?")){ await removerLead(id); refresh(); }}}
            onConverter={setConvertendo}
            onEditar={setEditando}
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width:"40px" }}></th>
                <th style={{ width:"40px" }}></th>
                <th style={{ width:"60px" }}>STATUS</th>
                <th>NOME</th>
                <th>EMPRESA</th>
                <th>ETAPA</th>
                <th>ORIGEM</th>
                <th>TELEFONE</th>
                <th>CRIADO EM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!filtrados.length ? (
                <tr><td colSpan={10} style={{ textAlign:"center",color:"#606060",padding:"48px" }}>Nenhum lead encontrado.</td></tr>
              ) : filtrados.map((l, idx)=>(
                <tr key={l.id}>
                  <td style={{ color:"#606060", fontSize:"12px" }}>{idx+1}</td>
                  <td>
                    <input type="checkbox" style={{ width:"14px",height:"14px" }}/>
                  </td>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%", background: getQualificacao(l.etapa).color, flexShrink:0 }}/>
                      <span style={{ fontSize:"11px", color: getQualificacao(l.etapa).color, background: getQualificacao(l.etapa).bg, padding:"2px 8px", borderRadius:"10px" }}>
                        {getQualificacao(l.etapa).label}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontWeight:"500" }}>{l.nome}</td>
                  <td style={{ color:"#a0a0a0",fontSize:"12px" }}>—</td>
                  <td><EtapaBadge etapa={l.etapa}/></td>
                  <td><span className="badge badge-gray">{l.origens?.nome||"—"}</span></td>
                  <td style={{ color:"#a0a0a0",fontSize:"12px" }}>{l.telefone||"—"}</td>
                  <td style={{ color:"#606060",fontSize:"12px" }}>{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <div style={{ display:"flex",gap:"6px" }}>
                      <button className="btn-secondary" style={{ padding:"5px 10px",fontSize:"12px" }} onClick={()=>setEditando(l)}>
                        <Edit2 size={12}/> Editar
                      </button>
                      <button className="btn-danger" style={{ padding:"5px 10px",fontSize:"12px" }}
                        onClick={async()=>{ if(confirm("Remover?")){ await removerLead(l.id); refresh();}}}>
                        <Trash2 size={12}/> Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <NovoLeadModal onClose={()=>setShowModal(false)} onSave={handleSalvar}/>}
      {convertendo && <ConverterLeadModal lead={convertendo} onClose={()=>setConvertendo(null)} onSave={()=>{ setConvertendo(null); refresh(); }}/>}
      {editando && <EditarLeadModal lead={editando} onClose={()=>setEditando(null)} onSave={()=>{ setEditando(null); refresh(); }}/>}
    </div>
  );
}
