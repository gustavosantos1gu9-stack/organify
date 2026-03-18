"use client";

import { useState, useEffect } from "react";
import { Check, Copy, Trash2, ExternalLink, Plus, ArrowLeft } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface LinkCampanha {
  id: string; nome: string; wa_mensagem: string; redirect_tipo: string;
  titulo_redirect: string; msg_redirect: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  link_gerado: string; cliques: number; created_at: string;
}

function FormLink({ onSave, onCancel, waNumero }: { onSave: () => void; onCancel: () => void; waNumero: string }) {
  const [form, setForm] = useState({
    nome: "",
    wa_mensagem: "",
    redirect_tipo: "web",
    titulo_redirect: "Por favor, aguarde alguns segundos.",
    msg_redirect: "Estamos localizando um atendente disponível...",
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/c` : "";

  const handleSalvar = async () => {
    if (!form.nome.trim()) { alert("Preencha o nome do link"); return; }
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      const params = new URLSearchParams({
        wa: waNumero,
        msg: form.wa_mensagem,
        tipo: form.redirect_tipo,
        titulo: form.titulo_redirect,
        desc: form.msg_redirect,
        ...(form.utm_source && { utm_source: form.utm_source }),
        ...(form.utm_medium && { utm_medium: form.utm_medium }),
        ...(form.utm_campaign && { utm_campaign: form.utm_campaign }),
      });
      const link_gerado = `${baseUrl}?${params.toString()}`;
      await supabase.from("links_campanha").insert({
        agencia_id: agId,
        nome: form.nome,
        wa_mensagem: form.wa_mensagem,
        redirect_tipo: form.redirect_tipo,
        titulo_redirect: form.titulo_redirect,
        msg_redirect: form.msg_redirect,
        utm_source: form.utm_source || null,
        utm_medium: form.utm_medium || null,
        utm_campaign: form.utm_campaign || null,
        link_gerado,
        cliques: 0,
      });
      onSave();
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
              Criar Link Rastreável
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

      {/* Seção 1 */}
      <div className="card" style={{ marginBottom:"20px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:"600", marginBottom:"20px", paddingBottom:"12px", borderBottom:"1px solid #2e2e2e" }}>
          Configurações Básicas
        </h2>

        <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
          <div className="form-group">
            <label className="form-label">Nome do Link Rastreável</label>
            <input className="form-input" placeholder="Nome do Link Rastreável"
              value={form.nome} onChange={e=>set("nome",e.target.value)}/>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"4px" }}>
              Atribua um nome para poder identificar o seu link.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Mensagem Inicial que será enviada ao WhatsApp de Atendimento</label>
            <textarea className="form-input" rows={4}
              placeholder="Mensagem Inicial que será enviada ao WhatsApp de Atendimento"
              value={form.wa_mensagem} onChange={e=>set("wa_mensagem",e.target.value)}
              style={{ resize:"vertical" }}/>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"4px" }}>
              Essa é a mensagem padrão que virá pré-pronta para ser enviada na conversa com o whatsapp do seu cliente.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Link de redirecionamento do WhatsApp quando acessado via computador</label>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginTop:"8px" }}>
              {[
                { value:"web", label:"WhatsApp Web (recomendado)" },
                { value:"app", label:"Aplicativo WhatsApp para computador" },
              ].map(op => (
                <label key={op.value} style={{ display:"flex", alignItems:"center", gap:"10px", cursor:"pointer" }}>
                  <div onClick={()=>set("redirect_tipo",op.value)} style={{
                    width:"18px", height:"18px", borderRadius:"50%", flexShrink:0, cursor:"pointer",
                    border:`2px solid ${form.redirect_tipo===op.value?"#29ABE2":"#3a3a3a"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:form.redirect_tipo===op.value?"#29ABE2":"transparent",
                  }}>
                    {form.redirect_tipo===op.value && <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#000" }}/>}
                  </div>
                  <span style={{ fontSize:"13px", color:form.redirect_tipo===op.value?"#f0f0f0":"#a0a0a0" }}>{op.label}</span>
                </label>
              ))}
            </div>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"8px" }}>
              Você pode escolher para qual serviço do WhatsApp o lead será redirecionado quando acessar via computador. Obs.: Para a versão mobile não há necessidade de escolher, pois o link rastreável sempre redireciona para o aplicativo instalado no celular.
            </p>
          </div>
        </div>
      </div>

      {/* Seção 2 */}
      <div className="card" style={{ marginBottom:"28px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:"600", marginBottom:"6px" }}>
          Link Rastreável para Meta Ads
        </h2>
        <p style={{ fontSize:"13px", color:"#606060", marginBottom:"20px" }}>
          Link com redirect de espera de 5 segundos — necessário para o Meta Ads rastrear corretamente o clique.
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
          <div className="form-group">
            <label className="form-label">Título da página de redirecionamento</label>
            <input className="form-input" value={form.titulo_redirect} onChange={e=>set("titulo_redirect",e.target.value)}/>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"4px" }}>
              Esse título vai aparecer para o lead na página de redirecionamento, após clicar no link rastreável.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Mensagem da página de redirecionamento</label>
            <textarea className="form-input" rows={3} value={form.msg_redirect}
              onChange={e=>set("msg_redirect",e.target.value)} style={{ resize:"vertical" }}/>
            <p style={{ fontSize:"11px", color:"#606060", marginTop:"4px" }}>
              Esta mensagem vai aparecer para o lead abaixo do título da página de redirecionamento, após clicar no link rastreável.
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <button className="btn-secondary" onClick={onCancel} style={{ cursor:"pointer" }}>
          <ArrowLeft size={14}/> Cancelar
        </button>
        <button className="btn-primary" onClick={handleSalvar} disabled={loading} style={{ cursor:"pointer" }}>
          <Check size={14}/> {loading?"Salvando...":"Salvar e Continuar"}
        </button>
      </div>
    </div>
  );
}

export default function GeradorLinksPage() {
  const [links, setLinks] = useState<LinkCampanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState<string|null>(null);
  const [waNumero, setWaNumero] = useState("");

  const carregar = async () => {
    setLoading(true);
    try {
      const agId = await getAgenciaId();
      const [{ data: ag }, { data: ls }] = await Promise.all([
        supabase.from("agencias").select("whatsapp_numero").eq("id", agId!).single(),
        supabase.from("links_campanha").select("*").eq("agencia_id", agId!).order("created_at", { ascending: false }),
      ]);
      setWaNumero(ag?.whatsapp_numero || "");
      setLinks(ls || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const copiar = async (texto: string, id: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este link?")) return;
    await supabase.from("links_campanha").delete().eq("id", id);
    setLinks(l => l.filter(x => x.id !== id));
  };

  if (criando) {
    return <FormLink waNumero={waNumero} onSave={() => { setCriando(false); carregar(); }} onCancel={() => setCriando(false)}/>;
  }

  return (
    <div className="animate-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
        <div>
          <div className="breadcrumb">
            <a href="/">Início</a><span>›</span><span className="current">Criar Link Rastreável</span>
          </div>
          <h1 style={{ fontSize:"22px", fontWeight:"600" }}>Links Rastreáveis</h1>
          <p style={{ fontSize:"13px", color:"#606060", marginTop:"4px" }}>
            Crie links rastreados para campanhas no Meta Ads e outros canais.
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#29ABE2", background:"rgba(41,171,226,0.1)", border:"1px solid rgba(41,171,226,0.2)", padding:"4px 10px", borderRadius:"20px" }}>
            <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#29ABE2", display:"inline-block" }}/>
            WhatsApp Conectado
          </span>
          <button className="btn-primary" onClick={() => setCriando(true)} style={{ cursor:"pointer" }}>
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
                Nenhum link criado ainda. Crie seu primeiro link rastreável!
              </td></tr>
            ) : links.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight:"500" }}>{l.nome}</td>
                <td>
                  <span style={{ fontWeight:"600", color:l.cliques>0?"#f0f0f0":"#606060" }}>{l.cliques}</span>
                </td>
                <td style={{ color:"#a0a0a0", fontSize:"12px" }}>
                  {new Date(l.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button onClick={() => copiar(l.link_gerado, l.id)} style={{
                      display:"flex", alignItems:"center", gap:"4px", padding:"5px 10px",
                      borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222",
                      color:copiado===l.id?"#f0f0f0":"#a0a0a0", cursor:"pointer", fontSize:"12px"
                    }}>
                      {copiado===l.id?<Check size={12}/>:<Copy size={12}/>}
                      {copiado===l.id?"Copiado!":"Copiar"}
                    </button>
                    <a href={l.link_gerado} target="_blank" rel="noreferrer" style={{
                      display:"flex", alignItems:"center", gap:"4px", padding:"5px 10px",
                      borderRadius:"6px", border:"1px solid #2e2e2e", background:"#222",
                      color:"#a0a0a0", textDecoration:"none", fontSize:"12px"
                    }}>
                      <ExternalLink size={12}/> Testar
                    </a>
                  </div>
                </td>
                <td>
                  <button className="btn-danger" style={{ padding:"5px 10px", fontSize:"12px", cursor:"pointer" }}
                    onClick={() => remover(l.id)}>
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
