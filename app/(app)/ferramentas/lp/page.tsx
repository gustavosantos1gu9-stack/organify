"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, Save, Eye, Copy, ExternalLink, X, Globe } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";
import { APP_URL } from "@/lib/config";

interface LandingPage {
  id: string;
  agencia_id: string;
  slug: string;
  titulo: string;
  subtitulo: string;
  video_url: string;
  logo_url: string;
  cta_texto: string;
  cta_whatsapp: string;
  cta_mensagem: string;
  evento_visita: string;
  ativo: boolean;
  created_at: string;
  cliente_externo_id?: string | null;
}

function gerarSlug(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "lp";
}

const LP_VAZIA: Omit<LandingPage, "id" | "agencia_id" | "created_at"> = {
  slug: "",
  titulo: "",
  subtitulo: "",
  video_url: "",
  logo_url: "",
  cta_texto: "Falar no WhatsApp",
  cta_whatsapp: "",
  cta_mensagem: "Olá! Vi sua página e quero saber mais.",
  evento_visita: "ViewContent",
  ativo: true,
};

function LandingPagesPageInner() {
  const searchParams = useSearchParams();
  const clienteIdParam = searchParams.get("cliente_id");
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Partial<LandingPage> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [agId, setAgId] = useState("");
  const [copiado, setCopiado] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [clienteNome, setClienteNome] = useState("");

  useEffect(() => {
    setAppUrl(window.location.origin);
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);
    let q = supabase.from("landing_pages").select("*").eq("agencia_id", id).order("created_at", { ascending: false });
    if (clienteIdParam) q = q.eq("cliente_externo_id", clienteIdParam);
    const { data } = await q;
    setPages(data || []);
    if (clienteIdParam) {
      const { data: c } = await supabase.from("clientes_externos").select("nome").eq("id", clienteIdParam).single();
      if (c) setClienteNome(c.nome);
    }
    setLoading(false);
  };

  const novaLP = () => {
    setEditando({ ...LP_VAZIA, agencia_id: agId, cliente_externo_id: clienteIdParam || null });
  };

  const salvar = async () => {
    if (!editando) return;
    if (!editando.slug?.trim()) return alert("Defina um slug (URL) para a página.");
    if (!editando.titulo?.trim()) return alert("Título é obrigatório.");
    setSalvando(true);
    try {
      const payload = {
        agencia_id: agId,
        slug: editando.slug!.trim(),
        titulo: editando.titulo!.trim(),
        subtitulo: editando.subtitulo?.trim() || "",
        video_url: editando.video_url?.trim() || "",
        logo_url: editando.logo_url?.trim() || "",
        cta_texto: editando.cta_texto?.trim() || "Falar no WhatsApp",
        cta_whatsapp: editando.cta_whatsapp?.trim() || "",
        cta_mensagem: editando.cta_mensagem?.trim() || "",
        evento_visita: editando.evento_visita?.trim() || "ViewContent",
        ativo: editando.ativo ?? true,
        cliente_externo_id: editando.cliente_externo_id || null,
      };
      if (editando.id) {
        await supabase.from("landing_pages").update(payload).eq("id", editando.id);
      } else {
        await supabase.from("landing_pages").insert(payload);
      }
      await carregar();
      setEditando(null);
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
    setSalvando(false);
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta landing page?")) return;
    await supabase.from("landing_pages").delete().eq("id", id);
    await carregar();
  };

  const copiarUrl = (slug: string) => {
    navigator.clipboard.writeText(`${APP_URL}/lp/${slug}`);
    setCopiado(slug);
    setTimeout(() => setCopiado(""), 2000);
  };

  const input = (field: keyof typeof LP_VAZIA, label: string, placeholder = "", type = "text") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#808080", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      <input
        type={type}
        value={(editando as any)?.[field] ?? ""}
        placeholder={placeholder}
        onChange={e => setEditando(prev => ({ ...prev, [field]: e.target.value }))}
        style={{
          background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8,
          padding: "10px 14px", color: "#f0f0f0", fontSize: 14, outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={e => e.currentTarget.style.borderColor = "#29ABE2"}
        onBlur={e => e.currentTarget.style.borderColor = "#2e2e2e"}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {clienteIdParam && clienteNome && (
        <div style={{ background: "#0f1a2a", border: "1px solid #1a3a5a", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#4a9aba" }}>
          Criando para cliente: <strong style={{ color: "#29ABE2" }}>{clienteNome}</strong>
          <a href="/ferramentas/lp" style={{ marginLeft: 12, fontSize: 12, color: "#606060", textDecoration: "underline" }}>Ver todas</a>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Landing Pages</h1>
          <p style={{ fontSize: 13, color: "#606060", margin: "4px 0 0" }}>Crie páginas públicas com vídeo e botão de WhatsApp</p>
        </div>
        <button
          onClick={novaLP}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, border: "none", background: "#29ABE2", color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={16} /> Nova LP
        </button>
      </div>

      {/* Modal de edição */}
      {editando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#141414", border: "1px solid #2e2e2e", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>
                {editando.id ? "Editar Landing Page" : "Nova Landing Page"}
              </h2>
              <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", color: "#606060", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Slug */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#808080", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>URL da Página (slug)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#404040", whiteSpace: "nowrap" }}>/lp/</span>
                  <input
                    type="text"
                    value={editando.slug ?? ""}
                    placeholder="minha-pagina"
                    onChange={e => setEditando(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                    style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "10px 14px", color: "#f0f0f0", fontSize: 14, outline: "none" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#29ABE2"}
                    onBlur={e => e.currentTarget.style.borderColor = "#2e2e2e"}
                  />
                  <button
                    onClick={() => setEditando(prev => ({ ...prev, slug: gerarSlug(editando.titulo || "") }))}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #2e2e2e", background: "#1a1a1a", color: "#808080", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Gerar
                  </button>
                </div>
              </div>

              {input("logo_url", "URL da Logo", "https://... (link da imagem da logo)")}
              {editando.logo_url && (
                <img src={editando.logo_url} alt="" style={{ height: 40, objectFit: "contain", maxWidth: 160, borderRadius: 6, background: "#0a0a0a", padding: "4px 8px" }} />
              )}
              {input("titulo", "Título", "Ex: Descubra como triplicar suas vendas")}
              {input("subtitulo", "Subtítulo", "Uma frase de apoio para o visitante")}

              {/* Vídeo */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#808080", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>URL do Vídeo</label>
                <input
                  type="url"
                  value={editando.video_url ?? ""}
                  placeholder="https://youtube.com/watch?v=... ou Vimeo"
                  onChange={e => setEditando(prev => ({ ...prev, video_url: e.target.value }))}
                  style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "10px 14px", color: "#f0f0f0", fontSize: 14, outline: "none" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#29ABE2"}
                  onBlur={e => e.currentTarget.style.borderColor = "#2e2e2e"}
                />
                <p style={{ fontSize: 11, color: "#404040", margin: 0 }}>YouTube ou Vimeo. Opcional — a página funciona só com texto e CTA.</p>
              </div>

              {/* CTA */}
              <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 14, border: "1px solid #1e1e1e" }}>
                <p style={{ fontSize: 12, color: "#29ABE2", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Botão de WhatsApp</p>
                {input("cta_texto", "Texto do Botão", "Falar no WhatsApp")}
                {input("cta_whatsapp", "Número do WhatsApp", "5511999999999 (com código do país)")}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "#808080", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mensagem Inicial</label>
                  <textarea
                    value={editando.cta_mensagem ?? ""}
                    placeholder="Mensagem que abre pré-preenchida no WhatsApp"
                    onChange={e => setEditando(prev => ({ ...prev, cta_mensagem: e.target.value }))}
                    rows={2}
                    style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "10px 14px", color: "#f0f0f0", fontSize: 14, outline: "none", resize: "vertical" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#29ABE2"}
                    onBlur={e => e.currentTarget.style.borderColor = "#2e2e2e"}
                  />
                </div>
              </div>

              {/* Pixel — evento de visita */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#808080", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Evento Pixel ao Acessar</label>
                <select
                  value={editando.evento_visita ?? "ViewContent"}
                  onChange={e => setEditando(prev => ({ ...prev, evento_visita: e.target.value }))}
                  style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "10px 14px", color: "#f0f0f0", fontSize: 14, outline: "none" }}
                >
                  <option value="ViewContent">ViewContent (padrão)</option>
                  <option value="PageView">PageView</option>
                  <option value="LandingPage">LandingPage (customizado)</option>
                  <option value="Lead">Lead</option>
                  <option value="custom">Personalizado...</option>
                </select>
                {editando.evento_visita === "custom" && (
                  <input
                    type="text"
                    placeholder="Nome do evento (ex: VisitaLP_Micro)"
                    onChange={e => setEditando(prev => ({ ...prev, evento_visita: e.target.value }))}
                    style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "10px 14px", color: "#f0f0f0", fontSize: 14, outline: "none" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#29ABE2"}
                    onBlur={e => e.currentTarget.style.borderColor = "#2e2e2e"}
                  />
                )}
                <p style={{ fontSize: 11, color: "#404040", margin: 0 }}>Dispara no pixel quando alguém abre esta página.</p>
              </div>

              {/* Ativo */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editando.ativo ?? true}
                  onChange={e => setEditando(prev => ({ ...prev, ativo: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "#29ABE2" }}
                />
                <span style={{ fontSize: 14, color: "#c0c0c0" }}>Página ativa (acessível publicamente)</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setEditando(null)}
                style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #2e2e2e", background: "transparent", color: "#808080", fontSize: 14, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 8, border: "none", background: "#29ABE2", color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando ? 0.7 : 1 }}
              >
                <Save size={16} />
                {salvando ? "Salvando..." : "Salvar Landing Page"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1a1a1a", borderTop: "3px solid #29ABE2", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : pages.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#404040" }}>
          <Globe size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: 16, margin: 0 }}>Nenhuma landing page criada ainda.</p>
          <p style={{ fontSize: 13, margin: "8px 0 0", color: "#303030" }}>Clique em "Nova LP" para começar.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pages.map(lp => (
            <div key={lp.id} style={{ background: "#141414", border: "1px solid #2e2e2e", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>{lp.titulo}</span>
                  {!lp.ativo && <span style={{ fontSize: 10, background: "#2a2a2a", color: "#606060", padding: "2px 8px", borderRadius: 10 }}>Inativo</span>}
                </div>
                <div style={{ fontSize: 12, color: "#606060", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#29ABE2" }}>/lp/{lp.slug}</span>
                  {lp.video_url && <span style={{ color: "#3a3a3a" }}>· Vídeo</span>}
                  {lp.cta_whatsapp && <span style={{ color: "#3a3a3a" }}>· CTA WhatsApp</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => copiarUrl(lp.slug)}
                  title="Copiar URL"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #2e2e2e", background: "#1a1a1a", color: copiado === lp.slug ? "#22c55e" : "#808080", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <Copy size={14} />
                  {copiado === lp.slug ? "Copiado!" : "Copiar"}
                </button>
                <a
                  href={`/lp/${lp.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ver página"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #2e2e2e", background: "#1a1a1a", color: "#808080", cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none" }}
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => setEditando(lp)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #2e2e2e", background: "#1a1a1a", color: "#f0f0f0", cursor: "pointer", fontSize: 13 }}
                >
                  Editar
                </button>
                <button
                  onClick={() => excluir(lp.id)}
                  title="Excluir"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #2e2e2e", background: "#1a1a1a", color: "#606060", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dica: conectar com formulário */}
      {pages.length > 0 && (
        <div style={{ marginTop: 24, background: "#0f1a2a", border: "1px solid #1a3a5a", borderRadius: 10, padding: 16 }}>
          <p style={{ fontSize: 13, color: "#4a9aba", margin: 0 }}>
            <strong>Dica:</strong> Para redirecionar um formulário para uma LP, vá em <strong>Formulários → Redirecionar URL</strong> e cole o link da LP (ex: <code style={{ background: "#0a1520", padding: "1px 6px", borderRadius: 4 }}>/lp/{pages[0]?.slug}</code>).
          </p>
        </div>
      )}
    </div>
  );
}

export default function LandingPagesPage() {
  return (
    <Suspense>
      <LandingPagesPageInner />
    </Suspense>
  );
}
