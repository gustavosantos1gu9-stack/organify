"use client";

import { useState, useEffect, useEffect } from "react";
import { Check, Copy, Trash2, ExternalLink, Plus, ArrowLeft, Link2, BarChart2, Eye } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface LinkCampanha {
  id: string; nome: string; wa_mensagem: string; redirect_tipo: string;
  titulo_redirect: string; msg_redirect: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  link_gerado: string; cliques: number; created_at: string;
}

function CopiarBotao({ texto, label = "Copiar" }: { texto: string; label?: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <button onClick={copiar} style={{
      display:"flex", alignItems:"center", gap:"4px", padding:"6px 12px",
      borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222",
      color:copiado?"#f0f0f0":"#a0a0a0", cursor:"pointer", fontSize:"12px", flexShrink:0,
    }}>
      {copiado ? <Check size={12} color="#29ABE2"/> : <Copy size={12}/>}
      {copiado ? "Copiado!" : label}
    </button>
  );
}

function DetalhesLink({ link, onVoltar, waNumero, conversasPorLink }: { link: LinkCampanha; onVoltar: () => void; waNumero: string; conversasPorLink: Record<string,any[]> }) {
  const [conversasLink, setConversasLink] = useState<any[]>([]);

  useEffect(() => {
    async function buscarConversas() {
      const agId = await getAgenciaId();
      // Buscar todas as conversas deste link — por link_id, link_nome ou utm_campaign
      const utmNorm = link.nome.toLowerCase().replace(/\s+/g, "-");
      const { data } = await supabase.from("conversas")
        .select("id, contato_nome, etapa_jornada, link_id, link_nome, utm_campaign")
        .eq("agencia_id", agId!)
        .or(`link_id.eq.${link.id},link_nome.ilike.%${link.nome}%,utm_campaign.ilike.%${utmNorm}%`);
      setConversasLink(data || []);
    }
    buscarConversas();
  }, [link.id]);
  const linkMeta = link.link_gerado; // com countdown (para Meta Ads)
  const linkSite = link.link_gerado.replace("/c?", "/c/direto?"); // direto
  
  const utmSemExistentes = `utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{adset.name}}_{{ad.name}}`;
  const utmComExistentes = `utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{adset.name}}_{{ad.name}}`;

  const botaoFlutuante = `<a href="${linkSite}" target="_blank" style="position: fixed; z-index: 9999; right: 20px; bottom: 20px; width: 64px; height: 64px; display: flex; justify-content: center; align-items: center; background: #25D366; border-radius: 100%;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF" width="32" height="32"><path d="M7.25361 18.4944L7.97834 18.917C9.18909 19.623 10.5651 20 12.001 20C16.4193 20 20.001 16.4183 20.001 12C20.001 7.58172 16.4193 4 12.001 4C7.5827 4 4.00098 7.58172 4.00098 12C4.00098 13.4363 4.37821 14.8128 5.08466 16.0238L5.50704 16.7478L4.85355 19.1494L7.25361 18.4944ZM2.00516 22L3.35712 17.0315C2.49494 15.5536 2.00098 13.8345 2.00098 12C2.00098 6.47715 6.47813 2 12.001 2C17.5238 2 22.001 6.47715 22.001 12C22.001 17.5228 17.5238 22 12.001 22C10.1671 22 8.44851 21.5064 6.97086 20.6447L2.00516 22Z"/></svg></a>`;

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px" }}>
        <div>
          <div className="breadcrumb">
            <a href="/">Início</a><span>›</span>
            <button onClick={onVoltar} style={{ background:"none", border:"none", color:"#606060", cursor:"pointer", fontSize:"13px", padding:0 }}>
              Links Rastreáveis
            </button><span>›</span>
            <span className="current">{link.nome}</span>
          </div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>{link.nome}</h1>
        </div>
        <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#29ABE2", background:"rgba(41,171,226,0.1)", border:"1px solid rgba(41,171,226,0.2)", padding:"4px 10px", borderRadius:"20px" }}>
          <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#29ABE2", display:"inline-block" }}/>
          WhatsApp Conectado
        </span>
      </div>

      {/* KPIs — busca direta do banco */}
      {(() => {
        const agendamentos = conversasLink.filter(c => ["Agendou","Compareceu"].includes(c.etapa_jornada)).length;
        const vendas = conversasLink.filter(c => ["Comprou","Fechou"].includes(c.etapa_jornada)).length;
        const total = Math.max(conversasLink.length, link.cliques);
        return (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", marginBottom:"24px" }}>
            <div className="card" style={{ padding:"16px" }}>
              <p style={{ fontSize:"12px", color:"#606060", marginBottom:"4px" }}>Conversas</p>
              <p style={{ fontSize:"28px", fontWeight:"700", color:"#f0f0f0" }}>{total}</p>
              <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>{link.cliques} cliques · {conversasLink.length} no inbox</p>
            </div>
            <div className="card" style={{ padding:"16px" }}>
              <p style={{ fontSize:"12px", color:"#606060", marginBottom:"4px" }}>Agendamentos</p>
              <p style={{ fontSize:"28px", fontWeight:"700", color:"#f59e0b" }}>{agendamentos}</p>
            </div>
            <div className="card" style={{ padding:"16px" }}>
              <p style={{ fontSize:"12px", color:"#606060", marginBottom:"4px" }}>Vendas</p>
              <p style={{ fontSize:"28px", fontWeight:"700", color:"#22c55e" }}>{vendas}</p>
            </div>
          </div>
        );
      })()}

      {/* Info do link */}
      <div className="card" style={{ marginBottom:"20px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:"600", marginBottom:"16px", paddingBottom:"12px", borderBottom:"1px solid #2e2e2e" }}>
          Informações do Link
        </h2>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {[
            { label: "Nome do Link", value: link.nome },
            { label: "Mensagem Inicial enviada ao WhatsApp", value: link.wa_mensagem },
            { label: "Código Único do Link", value: link.id },
            { label: "Data de Criação", value: new Date(link.created_at).toLocaleString("pt-BR") },
          ].map(item => (
            <div key={item.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"16px" }}>
              <p style={{ fontSize:"13px", color:"#606060", flexShrink:0, minWidth:"200px" }}>{item.label}</p>
              <p style={{ fontSize:"13px", color:"#f0f0f0", textAlign:"right", wordBreak:"break-all" }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Links gerados */}
      <div className="card" style={{ marginBottom:"20px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:"600", marginBottom:"16px", paddingBottom:"12px", borderBottom:"1px solid #2e2e2e" }}>
          Links Rastreáveis
        </h2>

        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          {/* Link Meta Ads */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
              <p style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0" }}>Link para Meta Ads</p>
              <div style={{ display:"flex", gap:"6px" }}>
                <CopiarBotao texto={linkMeta}/>
                <a href={linkMeta} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:"4px", padding:"6px 12px", borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222", color:"#a0a0a0", textDecoration:"none", fontSize:"12px" }}>
                  <ExternalLink size={12}/> Testar
                </a>
              </div>
            </div>
            <div style={{ background:"#111", borderRadius:"8px", padding:"10px 14px", border:"1px solid #2e2e2e" }}>
              <p style={{ fontSize:"12px", color:"#606060", fontFamily:"monospace", wordBreak:"break-all" }}>{linkMeta}</p>
            </div>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"6px" }}>
              ⚡ Com countdown de 5 segundos — necessário para o Meta Ads rastrear o clique corretamente.
            </p>
          </div>

          {/* Link Site */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
              <p style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0" }}>Link para Site</p>
              <div style={{ display:"flex", gap:"6px" }}>
                <CopiarBotao texto={link.link_gerado}/>
              </div>
            </div>
            <div style={{ background:"#111", borderRadius:"8px", padding:"10px 14px", border:"1px solid #2e2e2e" }}>
              <p style={{ fontSize:"12px", color:"#606060", fontFamily:"monospace", wordBreak:"break-all" }}>{link.link_gerado}</p>
            </div>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"6px" }}>
              🌐 Para usar em sites, bio do Instagram, stories, etc.
            </p>
          </div>

          {/* Botão flutuante */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
              <p style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0" }}>Botão Flutuante para Site</p>
              <CopiarBotao texto={botaoFlutuante} label="Copiar HTML"/>
            </div>
            <div style={{ background:"#111", borderRadius:"8px", padding:"10px 14px", border:"1px solid #2e2e2e" }}>
              <p style={{ fontSize:"11px", color:"#606060", fontFamily:"monospace", wordBreak:"break-all", maxHeight:"60px", overflow:"hidden" }}>
                {botaoFlutuante.slice(0, 120)}...
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* UTMs para Meta Ads */}
      <div className="card" style={{ marginBottom:"24px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:"600", marginBottom:"6px" }}>Parâmetros de URL para Meta Ads</h2>
        <p style={{ fontSize:"13px", color:"#606060", marginBottom:"16px" }}>
          Cole esses parâmetros no campo "Parâmetros de URL" da campanha no Meta Ads.
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
              <p style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0" }}>
                Caso você <span style={{ color:"#ef4444" }}>NÃO utilize UTMs</span>
              </p>
              <CopiarBotao texto={utmSemExistentes}/>
            </div>
            <div style={{ background:"#111", borderRadius:"8px", padding:"10px 14px", border:"1px solid #2e2e2e" }}>
              <p style={{ fontSize:"12px", color:"#a0a0a0", fontFamily:"monospace", wordBreak:"break-all" }}>{utmSemExistentes}</p>
            </div>
          </div>

          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
              <p style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0" }}>
                Caso você <span style={{ color:"#29ABE2" }}>JÁ utilize UTMs</span>
              </p>
              <CopiarBotao texto={`utm_content={{adset.name}}_{{ad.name}}`}/>
            </div>
            <div style={{ background:"#111", borderRadius:"8px", padding:"10px 14px", border:"1px solid #2e2e2e" }}>
              <p style={{ fontSize:"12px", color:"#a0a0a0", fontFamily:"monospace" }}>utm_content={`{{adset.name}}_{{ad.name}}`}</p>
            </div>
          </div>

          <div style={{ background:"rgba(41,171,226,0.05)", border:"1px solid rgba(41,171,226,0.15)", borderRadius:"8px", padding:"12px 14px" }}>
            <p style={{ fontSize:"12px", color:"#a0a0a0" }}>
              💡 Essa configuração permite cruzar os dados dos cliques no Meta Ads com as conversas que chegam no WhatsApp, identificando qual anúncio gerou cada lead.
            </p>
          </div>
        </div>
      </div>

      <button onClick={onVoltar} className="btn-secondary" style={{ cursor:"pointer" }}>
        <ArrowLeft size={14}/> Voltar para Links
      </button>
    </div>
  );
}

function FormLink({ onSave, onCancel, waNumero }: { onSave: (link: LinkCampanha) => void; onCancel: () => void; waNumero: string }) {
  const [form, setForm] = useState({
    nome: "", wa_mensagem: "", redirect_tipo: "web",
    titulo_redirect: "Por favor, aguarde alguns segundos.",
    msg_redirect: "Estamos localizando um atendente disponível...",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSalvar = async () => {
    if (!form.nome.trim()) { alert("Preencha o nome do link"); return; }
    if (!waNumero) { alert("Nenhum WhatsApp conectado. Configure em Integrações."); return; }
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/c` : "";
      const utmCampaign = form.nome.toLowerCase().replace(/\s+/g, "-");
      // Gerar UUID antecipado para incluir no link
      const linkId = crypto.randomUUID();
      const params = new URLSearchParams({
        wa: waNumero,
        msg: form.wa_mensagem,
        tipo: form.redirect_tipo,
        titulo: form.titulo_redirect,
        desc: form.msg_redirect,
        utm_source: "facebook",
        utm_medium: "cpc",
        utm_campaign: utmCampaign,
        link_id: linkId,
        link_nome: form.nome,
      });
      const link_gerado = `${baseUrl}?${params.toString()}`;
      const { data } = await supabase.from("links_campanha").insert({
        id: linkId,
        agencia_id: agId, nome: form.nome, wa_mensagem: form.wa_mensagem,
        redirect_tipo: form.redirect_tipo, titulo_redirect: form.titulo_redirect,
        msg_redirect: form.msg_redirect, link_gerado, cliques: 0,
        utm_campaign: utmCampaign,
      }).select().single();
      if (data) onSave(data as LinkCampanha);
    } catch(e) { console.error(e); alert("Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px" }}>
        <div>
          <div className="breadcrumb">
            <a href="/">Início</a><span>›</span>
            <button onClick={onCancel} style={{ background:"none", border:"none", color:"#606060", cursor:"pointer", fontSize:"13px", padding:0 }}>
              Links Rastreáveis
            </button><span>›</span>
            <span className="current">Novo link</span>
          </div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Criar Link Rastreável</h1>
        </div>
        <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#29ABE2", background:"rgba(41,171,226,0.1)", border:"1px solid rgba(41,171,226,0.2)", padding:"4px 10px", borderRadius:"20px" }}>
          <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#29ABE2", display:"inline-block" }}/>
          WhatsApp Conectado
        </span>
      </div>

      <div className="card" style={{ marginBottom:"20px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:"600", marginBottom:"20px", paddingBottom:"12px", borderBottom:"1px solid #2e2e2e" }}>
          Configurações do Link
        </h2>
        <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
          <div className="form-group">
            <label className="form-label">Nome do Link Rastreável *</label>
            <input className="form-input" placeholder="Ex: Meta Ads - Black Friday" value={form.nome} onChange={e=>set("nome",e.target.value)}/>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"4px" }}>Nome para identificar o link internamente.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Mensagem Inicial no WhatsApp</label>
            <textarea className="form-input" rows={3} placeholder="Ex: Olá! Vi o anúncio e quero saber mais 😊"
              value={form.wa_mensagem} onChange={e=>set("wa_mensagem",e.target.value)} style={{ resize:"vertical" }}/>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"4px" }}>Mensagem pré-pronta que aparece para o lead ao entrar no WhatsApp.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Texto da página de espera (5 segundos)</label>
            <input className="form-input" value={form.titulo_redirect} onChange={e=>set("titulo_redirect",e.target.value)} style={{ marginBottom:"8px" }}/>
            <textarea className="form-input" rows={2} value={form.msg_redirect} onChange={e=>set("msg_redirect",e.target.value)} style={{ resize:"vertical" }}/>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"4px" }}>Aparece na tela de espera antes de redirecionar para o WhatsApp.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Versão do WhatsApp no computador</label>
            <div style={{ display:"flex", gap:"10px", marginTop:"8px" }}>
              {[{value:"web",label:"WhatsApp Web"},{value:"app",label:"App Desktop"}].map(op => (
                <label key={op.value} style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
                  <div onClick={()=>set("redirect_tipo",op.value)} style={{
                    width:"16px", height:"16px", borderRadius:"50%", flexShrink:0, cursor:"pointer",
                    border:`2px solid ${form.redirect_tipo===op.value?"#29ABE2":"#3a3a3a"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:form.redirect_tipo===op.value?"#29ABE2":"transparent",
                  }}>
                    {form.redirect_tipo===op.value && <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#000" }}/>}
                  </div>
                  <span style={{ fontSize:"13px", color:form.redirect_tipo===op.value?"#f0f0f0":"#a0a0a0" }}>{op.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <button className="btn-secondary" onClick={onCancel} style={{ cursor:"pointer" }}>
          <ArrowLeft size={14}/> Cancelar
        </button>
        <button className="btn-primary" onClick={handleSalvar} disabled={loading} style={{ cursor:"pointer" }}>
          <Check size={14}/> {loading?"Salvando...":"Salvar e Ver Link"}
        </button>
      </div>
    </div>
  );
}

export default function GeradorLinksPage() {
  const [links, setLinks] = useState<LinkCampanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lista"|"form"|"detalhes">("lista");
  const [linkSelecionado, setLinkSelecionado] = useState<LinkCampanha|null>(null);
  const [copiado, setCopiado] = useState<string|null>(null);
  const [waNumero, setWaNumero] = useState("");

  const [conversasPorLink, setConversasPorLink] = useState<Record<string,any[]>>({});

  const carregar = async () => {
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      const [{ data: ag }, { data: ls }, { data: convs }] = await Promise.all([
        supabase.from("agencias").select("whatsapp_numero").eq("id", agId!).single(),
        supabase.from("links_campanha").select("*").eq("agencia_id", agId!).order("created_at", { ascending: false }),
        supabase.from("conversas").select("id,link_id,link_nome,etapa_jornada,utm_campaign").eq("agencia_id", agId!),
      ]);
      setWaNumero(ag?.whatsapp_numero || "");
      setLinks(ls || []);
      // Agrupar conversas por link_id, link_nome e utm_campaign
      const porLink: Record<string,any[]> = {};
      for (const c of (convs||[])) {
        const chaves = [c.link_id, c.link_nome, c.utm_campaign].filter(Boolean);
        for (const chave of chaves) {
          if (!porLink[chave]) porLink[chave] = [];
          // Evitar duplicatas
          if (!porLink[chave].find((x:any) => x.id === c.id)) {
            porLink[chave].push(c);
          }
        }
      }
      setConversasPorLink(porLink);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const copiar = async (texto: string, id: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(id); setTimeout(() => setCopiado(null), 2000);
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este link?")) return;
    await supabase.from("links_campanha").delete().eq("id", id);
    setLinks(l => l.filter(x => x.id !== id));
  };

  if (view === "form") {
    return <FormLink waNumero={waNumero}
      onSave={(link) => { setLinkSelecionado(link); setView("detalhes"); carregar(); }}
      onCancel={() => setView("lista")}/>;
  }

  if (view === "detalhes" && linkSelecionado) {
    return <DetalhesLink link={linkSelecionado} waNumero={waNumero} conversasPorLink={conversasPorLink} onVoltar={() => { setView("lista"); carregar(); }}/>;
  }

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
        <div>
          <div className="breadcrumb"><a href="/">Início</a><span>›</span><span className="current">Links Rastreáveis</span></div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Links Rastreáveis</h1>
          <p style={{ fontSize:"13px", color:"#606060", marginTop:"4px" }}>Crie links rastreados para campanhas no Meta Ads e outros canais.</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#29ABE2", background:"rgba(41,171,226,0.1)", border:"1px solid rgba(41,171,226,0.2)", padding:"4px 10px", borderRadius:"20px" }}>
            <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#29ABE2", display:"inline-block" }}/>
            WhatsApp Conectado
          </span>
          <button className="btn-primary" onClick={() => setView("form")} style={{ cursor:"pointer" }}>
            <Plus size={14}/> Criar Link Rastreável
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>NOME</th>
              <th>CLIQUES</th>
              <th>CRIADO EM</th>
              <th>LINK</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign:"center", color:"#606060", padding:"40px" }}>Carregando...</td></tr>
            ) : !links.length ? (
              <tr><td colSpan={5} style={{ textAlign:"center", color:"#606060", padding:"48px" }}>
                Nenhum link criado ainda.
              </td></tr>
            ) : links.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight:"500", cursor:"pointer" }} onClick={() => { setLinkSelecionado(l); setView("detalhes"); }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <Link2 size={14} color="#606060"/>
                    {l.nome}
                  </div>
                </td>
                <td><span style={{ fontWeight:"600", color:l.cliques>0?"#f0f0f0":"#606060" }}>
                  {Math.max(l.cliques, (conversasPorLink[l.id]||[]).length, (conversasPorLink[l.nome]||[]).length)}
                </span></td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                <td>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button onClick={() => { setLinkSelecionado(l); setView("detalhes"); }} style={{
                      display:"flex", alignItems:"center", gap:"4px", padding:"5px 10px",
                      borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222",
                      color:"#a0a0a0", cursor:"pointer", fontSize:"12px"
                    }}>
                      <Eye size={12}/> Ver
                    </button>
                    <button onClick={() => copiar(l.link_gerado, l.id)} style={{
                      display:"flex", alignItems:"center", gap:"4px", padding:"5px 10px",
                      borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222",
                      color:copiado===l.id?"#f0f0f0":"#a0a0a0", cursor:"pointer", fontSize:"12px"
                    }}>
                      {copiado===l.id?<Check size={12}/>:<Copy size={12}/>}
                      {copiado===l.id?"Copiado!":"Copiar"}
                    </button>
                  </div>
                </td>
                <td>
                  <button className="btn-danger" style={{ padding:"5px 10px", fontSize:"12px", cursor:"pointer" }} onClick={() => remover(l.id)}>
                    <Trash2 size={12}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
