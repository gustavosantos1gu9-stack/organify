"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Instagram, Phone, DollarSign, Users, Edit2, Plus, Save, X, MessageCircle, TrendingDown } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface Cliente {
  id: string; nome: string; telefone?: string; email?: string;
  status_recorrencia?: string; instagram?: string; consultor?: string;
  gestor?: string; squad?: string; investimento_mensal?: number;
  motivo_churn?: string; feedback?: string; created_at: string;
  categoria?: string; origem?: string;
}

interface Anotacao {
  id: string; cliente_nome: string; usuario: string;
  conteudo: string; created_at: string;
}

const STATUS_CORES: Record<string, string> = {
  ativo: "#29ABE2", saiu: "#ef4444", pausado: "#f59e0b",
  pendencia: "#f59e0b", prospecto: "#8b5cf6",
};

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente|null>(null);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaAnotacao, setNovaAnotacao] = useState("");
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});

  const carregar = async () => {
    const agId = await getAgenciaId();
    const { data: c } = await supabase.from("clientes").select("*")
      .eq("id", params.id).eq("agencia_id", agId!).single();
    if (c) { setCliente(c); setForm(c); }

    // Buscar anotações pelo nome ou id do cliente
    const { data: an } = await supabase.from("anotacoes")
      .select("*").eq("agencia_id", agId!)
      .or(`cliente_id.eq.${params.id},cliente_nome.ilike.%${c?.nome || ""}%`)
      .order("created_at", { ascending: false });
    setAnotacoes(an || []);
    setLoading(false);
  };

  const salvarAnotacao = async () => {
    if (!novaAnotacao.trim() || salvandoAnotacao) return;
    setSalvandoAnotacao(true);
    try {
      const agId = await getAgenciaId();
      const { data: user } = await supabase.auth.getUser();
      const nomeUsuario = user?.user?.user_metadata?.nome || user?.user?.email?.split("@")[0] || "Usuário";
      await supabase.from("anotacoes").insert({
        agencia_id: agId, cliente_id: params.id,
        cliente_nome: cliente?.nome, usuario: nomeUsuario,
        conteudo: novaAnotacao.trim(), created_at: new Date().toISOString(),
      });
      setNovaAnotacao("");
      await carregar();
    } catch(e) { console.error(e); }
    finally { setSalvandoAnotacao(false); }
  };

  const salvarEdicao = async () => {
    const agId = await getAgenciaId();
    await supabase.from("clientes").update({
      instagram: form.instagram, consultor: form.consultor,
      gestor: form.gestor, squad: form.squad,
      investimento_mensal: form.investimento_mensal,
      motivo_churn: form.motivo_churn, feedback: form.feedback,
    }).eq("id", params.id as string);
    setEditando(false);
    await carregar();
  };

  useEffect(() => { carregar(); }, [params.id]);

  if (loading) return <div style={{ padding:"40px", color:"#606060", fontSize:"13px" }}>Carregando...</div>;
  if (!cliente) return <div style={{ padding:"40px", color:"#606060" }}>Cliente não encontrado.</div>;

  const statusCor = STATUS_CORES[cliente.status_recorrencia || "ativo"] || "#606060";

  return (
    <div className="animate-in" style={{ maxWidth:"900px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px" }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding:"8px", cursor:"pointer" }}>
          <ArrowLeft size={16}/>
        </button>
        <div style={{ flex:1 }}>
          <div className="breadcrumb">
            <a href="/">Início</a><span>›</span>
            <a href="/clientes">Clientes</a><span>›</span>
            <span className="current">{cliente.nome}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <h1 style={{ fontSize:"22px", fontWeight:"600" }}>{cliente.nome}</h1>
            <span style={{ fontSize:"12px", padding:"3px 10px", borderRadius:"20px", background:`${statusCor}18`, color:statusCor, border:`1px solid ${statusCor}30` }}>
              {cliente.status_recorrencia === "ativo" ? "Cliente Ativo" :
               cliente.status_recorrencia === "saiu" ? "Churn" :
               cliente.status_recorrencia === "pausado" ? "Pausado" :
               cliente.status_recorrencia || "Ativo"}
            </span>
          </div>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          {cliente.telefone && (
            <a href={`https://wa.me/${cliente.telefone}`} target="_blank" rel="noreferrer"
              className="btn-secondary" style={{ textDecoration:"none", fontSize:"12px", padding:"7px 12px" }}>
              <MessageCircle size={13}/> WhatsApp
            </a>
          )}
          <button onClick={() => setEditando(!editando)} className="btn-secondary" style={{ fontSize:"12px", padding:"7px 12px", cursor:"pointer" }}>
            <Edit2 size={13}/> {editando ? "Cancelar" : "Editar"}
          </button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>
        {/* Info principal */}
        <div className="card">
          <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"16px", paddingBottom:"10px", borderBottom:"1px solid #2e2e2e" }}>
            Informações do Cliente
          </h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {[
              { icon:<Phone size={14}/>, label:"Telefone", value:cliente.telefone || "—" },
              { icon:<Instagram size={14}/>, label:"Instagram", value:cliente.instagram || "—", link:cliente.instagram },
              { icon:<DollarSign size={14}/>, label:"Investimento Mensal", value:cliente.investimento_mensal ? `R$ ${Number(cliente.investimento_mensal).toLocaleString("pt-BR")}` : "—" },
            ].map(item => (
              <div key={item.label} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ color:"#606060", flexShrink:0 }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{item.label}</p>
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer" style={{ fontSize:"13px", color:"#29ABE2", textDecoration:"none" }}>
                      {item.value}
                    </a>
                  ) : (
                    <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0 }}>{item.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time */}
        <div className="card">
          <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"16px", paddingBottom:"10px", borderBottom:"1px solid #2e2e2e" }}>
            Time Responsável
          </h3>
          {editando ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {["consultor","gestor","squad"].map(campo => (
                <div key={campo} className="form-group">
                  <label className="form-label" style={{ textTransform:"capitalize" }}>{campo}</label>
                  <input className="form-input" value={(form as any)[campo] || ""}
                    onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))}/>
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Investimento Mensal (R$)</label>
                <input className="form-input" type="number" value={form.investimento_mensal || ""}
                  onChange={e => setForm(f => ({ ...f, investimento_mensal: Number(e.target.value) }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input className="form-input" value={form.instagram || ""}
                  onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}/>
              </div>
              <button onClick={salvarEdicao} className="btn-primary" style={{ cursor:"pointer" }}>
                <Save size={13}/> Salvar
              </button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              {[
                { label:"Consultor", value:cliente.consultor },
                { label:"Gestor", value:cliente.gestor },
                { label:"Squad", value:cliente.squad },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{item.label}</p>
                  <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0 }}>{item.value || "—"}</p>
                </div>
              ))}
              {cliente.status_recorrencia === "saiu" && cliente.motivo_churn && (
                <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:"8px", padding:"10px 12px" }}>
                  <p style={{ fontSize:"11px", color:"#ef4444", margin:"0 0 4px" }}>
                    <TrendingDown size={12} style={{ display:"inline", marginRight:"4px" }}/>Motivo do Churn
                  </p>
                  <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0 }}>{cliente.motivo_churn}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Anotações */}
      <div className="card">
        <h3 style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"16px", paddingBottom:"10px", borderBottom:"1px solid #2e2e2e" }}>
          Anotações da Equipe
          <span style={{ fontSize:"11px", color:"#606060", fontWeight:"400", marginLeft:"8px" }}>{anotacoes.length} anotações</span>
        </h3>

        {/* Nova anotação */}
        <div style={{ marginBottom:"20px" }}>
          <textarea className="form-input" placeholder="Adicionar anotação... (ex: Cliente pediu pausa, otimização realizada, feedback positivo)"
            value={novaAnotacao} onChange={e => setNovaAnotacao(e.target.value)}
            style={{ resize:"vertical", minHeight:"80px", marginBottom:"8px" }}/>
          <button onClick={salvarAnotacao} disabled={salvandoAnotacao || !novaAnotacao.trim()}
            className="btn-primary" style={{ cursor:"pointer", fontSize:"12px" }}>
            <Plus size={13}/> {salvandoAnotacao ? "Salvando..." : "Adicionar Anotação"}
          </button>
        </div>

        {/* Lista de anotações */}
        {!anotacoes.length ? (
          <p style={{ color:"#606060", fontSize:"13px", textAlign:"center", padding:"20px" }}>
            Nenhuma anotação ainda. Adicione a primeira!
          </p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {anotacoes.map(an => (
              <div key={an.id} style={{ background:"#1a1a1a", borderRadius:"8px", padding:"12px 14px", border:"1px solid #2e2e2e" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                  <span style={{ fontSize:"12px", fontWeight:"600", color:"#29ABE2" }}>{an.usuario}</span>
                  <span style={{ fontSize:"11px", color:"#606060" }}>
                    {new Date(an.created_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" })}
                  </span>
                </div>
                <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0, whiteSpace:"pre-wrap" }}>{an.conteudo}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
