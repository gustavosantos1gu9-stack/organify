"use client";

import { useState } from "react";
import { MessageCircle, Link2, Copy, Check, ExternalLink, ChevronRight, Info } from "lucide-react";

export default function CampanhasPage() {
  const [tipo, setTipo] = useState<"mensagem"|"link"|null>(null);
  const [copiado, setCopiado] = useState(false);

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="animate-in" style={{ maxWidth:"800px" }}>
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span style={{color:"#4A5B6C"}}>Ferramentas</span><span>›</span>
        <span className="current">Configurar Campanha</span>
      </div>
      <h1 style={{ fontSize:"22px", fontWeight:"600", marginBottom:"8px" }}>Configurar Campanha no Meta Ads</h1>
      <p style={{ fontSize:"13px", color:"#4A5B6C", marginBottom:"28px" }}>
        Escolha o tipo de campanha para ver o passo a passo de configuração e rastreamento.
      </p>

      {/* Seleção de tipo */}
      {!tipo && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
          {[
            {
              id: "mensagem",
              icon: <MessageCircle size={32} color="#25D366"/>,
              titulo: "Campanha de Mensagem",
              subtitulo: "Click to WhatsApp",
              descricao: "Lead clica no anúncio e vai direto para o WhatsApp. Rastreamento por termo-chave.",
              pros: ["Mais conversões", "Fricção menor", "Lead já no WhatsApp"],
              contras: ["Rastreamento limitado", "Não sabe qual criativo"],
              cor: "#25D366",
            },
            {
              id: "link",
              icon: <Link2 size={32} color="#1877f2"/>,
              titulo: "Campanha de Link",
              subtitulo: "Click to Website → WhatsApp",
              descricao: "Lead clica e passa pela sua página de rastreamento antes do WhatsApp.",
              pros: ["Rastreamento completo", "Sabe campanha e criativo", "Evento no Pixel"],
              contras: ["Uma etapa a mais", "Possível perda de conversão"],
              cor: "#1877f2",
            },
          ].map(op => (
            <div key={op.id} onClick={() => setTipo(op.id as any)} style={{
              background:"#FFFFFF", border:`2px solid #E6EBF0`, borderRadius:"12px",
              padding:"24px", cursor:"pointer", transition:"border-color 0.2s",
            }}
            onMouseEnter={e=>(e.currentTarget.style.borderColor=op.cor)}
            onMouseLeave={e=>(e.currentTarget.style.borderColor="#E6EBF0")}>
              <div style={{ marginBottom:"12px" }}>{op.icon}</div>
              <h3 style={{ fontSize:"15px", fontWeight:"600", color:"#0A1826", marginBottom:"2px" }}>{op.titulo}</h3>
              <p style={{ fontSize:"12px", color:op.cor, marginBottom:"8px" }}>{op.subtitulo}</p>
              <p style={{ fontSize:"13px", color:"#4A5B6C", marginBottom:"16px" }}>{op.descricao}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"4px", marginBottom:"12px" }}>
                {op.pros.map(p => <span key={p} style={{ fontSize:"12px", color:"#1C6CA6" }}>✓ {p}</span>)}
                {op.contras.map(c => <span key={c} style={{ fontSize:"12px", color:"#4A5B6C" }}>✗ {c}</span>)}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"4px", color:op.cor, fontSize:"13px", fontWeight:"500" }}>
                Configurar <ChevronRight size={14}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuração Campanha de Mensagem */}
      {tipo === "mensagem" && (
        <div>
          <button onClick={() => setTipo(null)} style={{ background:"none", border:"none", color:"#4A5B6C", cursor:"pointer", fontSize:"13px", marginBottom:"20px", display:"flex", alignItems:"center", gap:"4px" }}>
            ← Voltar
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"24px" }}>
            <MessageCircle size={24} color="#25D366"/>
            <div>
              <h2 style={{ fontSize:"17px", fontWeight:"600", color:"#0A1826" }}>Campanha de Mensagem</h2>
              <p style={{ fontSize:"12px", color:"#4A5B6C" }}>Click to WhatsApp — rastreamento por termo-chave</p>
            </div>
          </div>

          {/* Passo a passo */}
          {[
            {
              n: 1,
              titulo: "Configure o anúncio no Meta Ads",
              cor: "#1877f2",
              conteudo: (
                <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                  <div style={{ background:"#FFFFFF", borderRadius:"8px", padding:"12px 16px", border:"1px solid #E6EBF0" }}>
                    <p style={{ fontSize:"12px", color:"#4A5B6C", marginBottom:"4px" }}>Configurações do anúncio:</p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Objetivo: <strong>Mensagens</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Tipo de mensagem: <strong>WhatsApp</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Número: <strong>seu número conectado</strong></p>
                  </div>
                </div>
              ),
            },
            {
              n: 2,
              titulo: "Defina uma mensagem de saudação única por campanha",
              cor: "#1C6CA6",
              conteudo: (
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  <p style={{ fontSize:"13px", color:"#4A5B6C" }}>
                    Cada campanha deve ter uma mensagem diferente para identificar a origem:
                  </p>
                  {[
                    { campanha: "Black Friday", msg: "Oi! Vi o anúncio da Black Friday e quero saber mais 🖤" },
                    { campanha: "Assessoria Jan", msg: "Olá! Vi o anúncio de assessoria de janeiro e quero informações" },
                    { campanha: "Stories Promo", msg: "Oi vim pelo stories! Quero saber sobre a promoção" },
                  ].map(ex => (
                    <div key={ex.campanha} style={{ background:"#FFFFFF", borderRadius:"8px", padding:"12px 16px", border:"1px solid #E6EBF0" }}>
                      <p style={{ fontSize:"11px", color:"#4A5B6C", marginBottom:"4px" }}>{ex.campanha}</p>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <p style={{ fontSize:"13px", color:"#0A1826", flex:1, fontFamily:"monospace" }}>"{ex.msg}"</p>
                        <button onClick={()=>copiar(ex.msg)} style={{ background:"none", border:"none", cursor:"pointer", color:"#4A5B6C" }}>
                          {copiado ? <Check size={14} color="#1C6CA6"/> : <Copy size={14}/>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              n: 3,
              titulo: "Cadastre o termo-chave na Jornada de Compra",
              cor: "#6B4FC8",
              conteudo: (
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  <p style={{ fontSize:"13px", color:"#4A5B6C" }}>
                    No Organify, vá em <strong style={{color:"#0A1826"}}>Jornada de Compra</strong> e crie uma etapa com o termo-chave da mensagem:
                  </p>
                  <div style={{ background:"#FFFFFF", borderRadius:"8px", padding:"12px 16px", border:"1px solid #E6EBF0" }}>
                    <p style={{ fontSize:"12px", color:"#4A5B6C", marginBottom:"8px" }}>Exemplo de configuração:</p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Nome da etapa: <strong>Black Friday</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Evento Meta: <strong>Lead</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Termo-chave: <strong>Black Friday</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• É primeiro contato: <strong>✓ Sim</strong></p>
                  </div>
                  <a href="/jornada" style={{ display:"flex", alignItems:"center", gap:"6px", color:"#6B4FC8", fontSize:"13px", textDecoration:"none" }}>
                    Ir para Jornada de Compra <ExternalLink size={12}/>
                  </a>
                </div>
              ),
            },
            {
              n: 4,
              titulo: "Como o rastreamento funciona",
              cor: "#C2620E",
              conteudo: (
                <div style={{ background:"#FFFFFF", borderRadius:"8px", padding:"16px", border:"1px solid #E6EBF0" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                    {[
                      { icon:"📱", texto:"Lead clica no anúncio Black Friday" },
                      { icon:"💬", texto:'Mensagem pré-pronta: "Vi o anúncio da Black Friday..."' },
                      { icon:"🔍", texto:"Organify detecta o termo-chave na mensagem" },
                      { icon:"🏷️", texto:"Conversa marcada como origem: Black Friday" },
                      { icon:"📊", texto:"Evento Lead disparado para o Meta Pixel" },
                    ].map((s,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <span style={{ fontSize:"16px" }}>{s.icon}</span>
                        <span style={{ fontSize:"13px", color:"#4A5B6C" }}>{s.texto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
          ].map(passo => (
            <div key={passo.n} className="card" style={{ marginBottom:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
                <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:passo.cor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:"700", color:"#fff", flexShrink:0 }}>
                  {passo.n}
                </div>
                <h3 style={{ fontSize:"14px", fontWeight:"600", color:"#0A1826" }}>{passo.titulo}</h3>
              </div>
              {passo.conteudo}
            </div>
          ))}
        </div>
      )}

      {/* Configuração Campanha de Link */}
      {tipo === "link" && (
        <div>
          <button onClick={() => setTipo(null)} style={{ background:"none", border:"none", color:"#4A5B6C", cursor:"pointer", fontSize:"13px", marginBottom:"20px", display:"flex", alignItems:"center", gap:"4px" }}>
            ← Voltar
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"24px" }}>
            <Link2 size={24} color="#1877f2"/>
            <div>
              <h2 style={{ fontSize:"17px", fontWeight:"600", color:"#0A1826" }}>Campanha de Link</h2>
              <p style={{ fontSize:"12px", color:"#4A5B6C" }}>Click to Website → rastreamento completo via UTM</p>
            </div>
          </div>

          {[
            {
              n: 1,
              titulo: "Crie um link rastreável no Organify",
              cor: "#1C6CA6",
              conteudo: (
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  <p style={{ fontSize:"13px", color:"#4A5B6C" }}>
                    Vá em <strong style={{color:"#0A1826"}}>Links & Campanhas</strong> e crie um link para cada campanha:
                  </p>
                  <div style={{ background:"#FFFFFF", borderRadius:"8px", padding:"12px 16px", border:"1px solid #E6EBF0" }}>
                    <p style={{ fontSize:"12px", color:"#4A5B6C", marginBottom:"8px" }}>Campos importantes:</p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Nome: <strong>Black Friday Nov 2026</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Fonte (utm_source): <strong>facebook</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Meio (utm_medium): <strong>cpc</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Campanha: <strong>black-friday-nov26</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Mensagem: <strong>Oi vim pelo anúncio!</strong></p>
                  </div>
                  <a href="/ferramentas/gerador-links" style={{ display:"flex", alignItems:"center", gap:"6px", color:"#1C6CA6", fontSize:"13px", textDecoration:"none" }}>
                    Criar link rastreável <ExternalLink size={12}/>
                  </a>
                </div>
              ),
            },
            {
              n: 2,
              titulo: "Use o link gerado no Meta Ads",
              cor: "#1877f2",
              conteudo: (
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  <p style={{ fontSize:"13px", color:"#4A5B6C" }}>
                    No Meta Ads, configure o anúncio assim:
                  </p>
                  <div style={{ background:"#FFFFFF", borderRadius:"8px", padding:"12px 16px", border:"1px solid #E6EBF0" }}>
                    <p style={{ fontSize:"12px", color:"#4A5B6C", marginBottom:"8px" }}>Configurações:</p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Objetivo: <strong>Tráfego</strong> ou <strong>Conversões</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Destino: <strong>Website</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• URL: <strong style={{color:"#1C6CA6"}}>seu link rastreável</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• Pixel: <strong>ativado ✓</strong></p>
                  </div>
                  <div style={{ background:"rgba(194,98,14,0.08)", border:"1px solid rgba(194,98,14,0.2)", borderRadius:"8px", padding:"10px 14px" }}>
                    <p style={{ fontSize:"12px", color:"#C2620E" }}>
                      ⚠️ Para campanhas de conversão, configure o evento <strong>Lead</strong> no Pixel do Meta como meta de otimização.
                    </p>
                  </div>
                </div>
              ),
            },
            {
              n: 3,
              titulo: "O que acontece quando o lead clica",
              cor: "#6B4FC8",
              conteudo: (
                <div style={{ background:"#FFFFFF", borderRadius:"8px", padding:"16px", border:"1px solid #E6EBF0" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                    {[
                      { icon:"🖱️", texto:"Lead clica no anúncio" },
                      { icon:"⏳", texto:"Cai na página /c com countdown de 5 segundos" },
                      { icon:"📊", texto:"Pixel do Meta dispara evento Lead automaticamente" },
                      { icon:"💬", texto:"Redireciona para WhatsApp com mensagem pré-pronta" },
                      { icon:"🏷️", texto:"Conversa salva com utm_source, utm_campaign, utm_content" },
                      { icon:"📈", texto:"Meta usa o evento para otimizar o anúncio" },
                    ].map((s,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <span style={{ fontSize:"16px" }}>{s.icon}</span>
                        <span style={{ fontSize:"13px", color:"#4A5B6C" }}>{s.texto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              n: 4,
              titulo: "Dica: crie um link por criativo",
              cor: "#B4387A",
              conteudo: (
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  <p style={{ fontSize:"13px", color:"#4A5B6C" }}>
                    Para saber qual imagem/vídeo performou melhor, crie um link diferente para cada criativo usando o campo <strong style={{color:"#0A1826"}}>utm_content</strong>:
                  </p>
                  <div style={{ background:"#FFFFFF", borderRadius:"8px", padding:"12px 16px", border:"1px solid #E6EBF0" }}>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• utm_content: <strong>video-depoimento-01</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• utm_content: <strong>imagem-antes-depois</strong></p>
                    <p style={{ fontSize:"13px", color:"#0A1826" }}>• utm_content: <strong>carrossel-servicos</strong></p>
                  </div>
                  <p style={{ fontSize:"12px", color:"#4A5B6C" }}>
                    No relatório de conversas você verá qual criativo gerou mais leads.
                  </p>
                </div>
              ),
            },
          ].map(passo => (
            <div key={passo.n} className="card" style={{ marginBottom:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
                <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:passo.cor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:"700", color:"#fff", flexShrink:0 }}>
                  {passo.n}
                </div>
                <h3 style={{ fontSize:"14px", fontWeight:"600", color:"#0A1826" }}>{passo.titulo}</h3>
              </div>
              {passo.conteudo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
