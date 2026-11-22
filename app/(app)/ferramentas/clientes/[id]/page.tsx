"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Copy, ExternalLink, Search, Upload, X, ChevronDown } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

interface ClienteExterno {
  id: string;
  agencia_id: string;
  nome: string;
  logo_url: string;
  meta_pixel_id: string;
  meta_access_token: string;
  whatsapp_notificacao: string;
  ativo: boolean;
}

export default function ClienteExternoDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [tab, setTab] = useState<"config" | "forms" | "lps">("config");
  const [cliente, setCliente] = useState<ClienteExterno | null>(null);
  const [form, setForm] = useState<ClienteExterno | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formularios, setFormularios] = useState<any[]>([]);
  const [lps, setLps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState("");
  const [appUrl, setAppUrl] = useState("");

  // Meta selectors
  const [tokenDefault, setTokenDefault] = useState("");
  const [contasAds, setContasAds] = useState<any[]>([]);
  const [contaBusca, setContaBusca] = useState("");
  const [pixelsDisponiveis, setPixelsDisponiveis] = useState<any[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState("");
  const [buscandoContas, setBuscandoContas] = useState(false);
  const [buscandoPixels, setBuscandoPixels] = useState(false);
  const [mostrarContas, setMostrarContas] = useState(false);
  const [erroContas, setErroContas] = useState("");

  // Logo upload
  const [uploadandoLogo, setUploadandoLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAppUrl(window.location.origin);
    carregar();
    carregarTokenDefault();
  }, [id]);

  // Preview da logo atual
  useEffect(() => {
    if (form?.logo_url) setLogoPreview(form.logo_url);
  }, [form?.logo_url]);


  const carregarTokenDefault = async () => {
    const agId = await getAgenciaId();
    if (!agId) return;
    // Pegar token da Lavínia via relatorios_conexoes do master
    const { data } = await supabase
      .from("relatorios_conexoes")
      .select("meta_token")
      .eq("agencia_id", agId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const token = data?.meta_token;
    if (token) {
      setTokenDefault(token);
      // Auto-buscar contas ao carregar a página
      setBuscandoContas(true);
      setMostrarContas(true);
      setContasAds([]);
      setPixelsDisponiveis([]);
      setContaSelecionada("");
      setErroContas("");
      try {
        const res = await fetch("/api/meta-ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listar_contas", token }),
        });
        const dataContas = await res.json();
        if (dataContas.error) {
          setErroContas(dataContas.error);
        } else {
          const lista = Array.isArray(dataContas) ? dataContas : [];
          setContasAds(lista.map((c: any) => ({ ...c, id_clean: c.id.replace("act_", "") })));
          if (lista.length === 0) setErroContas("Nenhuma conta encontrada.");
        }
      } catch (e: any) { setErroContas("Erro de conexão: " + e.message); }
      setBuscandoContas(false);
    }
  };

  const carregar = async () => {
    setLoading(true);
    const { data: c } = await supabase.from("clientes_externos").select("*").eq("id", id).single();
    if (c) { setCliente(c); setForm(c); }
    const [{ data: f }, { data: l }] = await Promise.all([
      supabase.from("formularios").select("id, nome, slug, ativo").eq("cliente_externo_id", id).order("created_at", { ascending: false }),
      supabase.from("landing_pages").select("id, titulo, slug, ativo").eq("cliente_externo_id", id).order("created_at", { ascending: false }),
    ]);
    setFormularios(f || []);
    setLps(l || []);
    setLoading(false);
  };

  const salvar = async () => {
    if (!form) return;
    setSalvando(true);
    try {
      await supabase.from("clientes_externos").update({
        nome: form.nome,
        logo_url: form.logo_url,
        meta_pixel_id: form.meta_pixel_id,
        meta_access_token: form.meta_access_token,
        whatsapp_notificacao: form.whatsapp_notificacao,
        ativo: form.ativo,
      }).eq("id", id);
      setCliente(form);
      alert("Salvo!");
    } catch (e: any) { alert("Erro: " + e.message); }
    setSalvando(false);
  };

  const copiar = (texto: string, chave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(chave);
    setTimeout(() => setCopiado(""), 2000);
  };

  const buscarContas = async () => {
    const token = tokenDefault || form?.meta_access_token;
    if (!token) return alert("Token da Lavínia não encontrado. Configure em Integrações.");
    setBuscandoContas(true);
    setMostrarContas(true);
    setContasAds([]);
    setPixelsDisponiveis([]);
    setContaSelecionada("");
    setErroContas("");
    try {
      const res = await fetch("/api/meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listar_contas", token }),
      });
      const data = await res.json();
      if (data.error) {
        setErroContas(data.error);
      } else {
        const lista = Array.isArray(data) ? data : [];
        setContasAds(lista.map((c: any) => ({ ...c, id_clean: c.id.replace("act_", "") })));
        if (lista.length === 0) setErroContas("Nenhuma conta encontrada. Verifique se o token tem acesso às contas de anúncio.");
      }
    } catch (e: any) { setErroContas("Erro de conexão: " + e.message); }
    setBuscandoContas(false);
  };

  const selecionarConta = async (adAccountId: string) => {
    setContaSelecionada(adAccountId);
    setPixelsDisponiveis([]);
    setBuscandoPixels(true);
    try {
      const res = await fetch("/api/meta-ads/pixels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenDefault || form?.meta_access_token, ad_account_id: adAccountId }),
      });
      const data = await res.json();
      setPixelsDisponiveis(data.pixels || []);
      if (data.pixels?.length === 1) {
        setForm(p => p && ({ ...p, meta_pixel_id: data.pixels[0].id }));
      }
    } catch { }
    setBuscandoPixels(false);
  };

  const uploadLogo = async (file: File) => {
    setUploadandoLogo(true);
    try {
      // Preview local imediato
      const reader = new FileReader();
      reader.onload = e => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("clienteId", id);
      const res = await fetch("/api/upload-logo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const { error: dbError } = await supabase
        .from("clientes_externos")
        .update({ logo_url: json.url })
        .eq("id", id);
      if (dbError) throw new Error("Erro ao salvar no banco: " + dbError.message);

      setForm(p => p && ({ ...p, logo_url: json.url }));
      setLogoPreview(json.url);
    } catch (e: any) {
      alert("Erro ao subir logo: " + (e.message || "verifique o bucket de storage"));
    }
    setUploadandoLogo(false);
  };

  const contasFiltradas = contasAds.filter(c =>
    !contaBusca || c.name?.toLowerCase().includes(contaBusca.toLowerCase()) || c.id_clean?.includes(contaBusca)
  );

  const inp: React.CSSProperties = {
    background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 8,
    padding: "10px 14px", color: "#0A1826", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    fontSize: 12, color: "#808080", fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", display: "block", marginBottom: 6,
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #FFFFFF", borderTop: "3px solid #1C6CA6", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!cliente) return (
    <div style={{ textAlign: "center", padding: 80, color: "#4A5B6C" }}>Cliente não encontrado.</div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push("/ferramentas/clientes")} style={{ background: "none", border: "1px solid #E6EBF0", borderRadius: 8, padding: "6px 12px", color: "#808080", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0A1826", margin: 0 }}>{cliente.nome}</h1>
        {!cliente.ativo && <span style={{ fontSize: 11, background: "#E6EBF0", color: "#4A5B6C", padding: "3px 8px", borderRadius: 6 }}>Inativo</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, background: "#FFFFFF", borderRadius: 10, padding: 4, border: "1px solid #E6EBF0", width: "fit-content" }}>
        {(["config", "forms", "lps"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 18px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: tab === t ? "#1C6CA6" : "transparent",
            color: tab === t ? "#000" : "#808080",
          }}>
            {t === "config" ? "Configuração" : t === "forms" ? `Formulários (${formularios.length})` : `Landing Pages (${lps.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Configuração */}
      {tab === "config" && form && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 12, padding: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>

            {/* Nome */}
            <div>
              <label style={lbl}>Nome *</label>
              <input style={inp} value={form.nome} onChange={e => setForm(p => p && ({ ...p, nome: e.target.value }))} />
            </div>

            {/* Logo — upload direto */}
            <div>
              <label style={lbl}>Logo</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {logoPreview && (
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img src={logoPreview} alt="Logo" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF" }} />
                    <button
                      onClick={() => { setLogoPreview(""); setForm(p => p && ({ ...p, logo_url: "" })); supabase.from("clientes_externos").update({ logo_url: "" }).eq("id", id); }}
                      style={{ position: "absolute", top: -6, right: -6, background: "#E6EBF0", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    >
                      <X size={10} color="#aaa" />
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadandoLogo}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8, border: "1px dashed #E6EBF0", background: "#FFFFFF", color: "#808080", cursor: "pointer", fontSize: 13, opacity: uploadandoLogo ? 0.6 : 1 }}
                >
                  <Upload size={14} /> {uploadandoLogo ? "Enviando..." : logoPreview ? "Trocar imagem" : "Enviar logo"}
                </button>
              </div>
            </div>

            {/* Meta Access Token */}
            <div>
              <label style={lbl}>Meta Access Token</label>
              <input
                style={inp}
                value={form.meta_access_token}
                onChange={e => setForm(p => p && ({ ...p, meta_access_token: e.target.value }))}
                placeholder="EAAxxxxx..."
                type="password"
              />
              {tokenDefault && !form.meta_access_token && (
                <span style={{ fontSize: 11, color: "#6B7A89", marginTop: 4, display: "block" }}>Usando token da Lavínia (padrão)</span>
              )}
            </div>

            {/* Conta de Anúncios + Pixel — seletor */}
            <div>
              <label style={lbl}>Conta de Anúncios e Pixel</label>
              <button
                onClick={buscarContas}
                disabled={buscandoContas}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF", color: "#7E93A8", cursor: "pointer", fontSize: 13, width: "100%", opacity: buscandoContas ? 0.6 : 1 }}
              >
                <Search size={14} /> {buscandoContas ? "Buscando contas..." : "Buscar contas de anúncios"}
              </button>

              {mostrarContas && (
                <div style={{ marginTop: 10, background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 8, overflow: "hidden" }}>
                  {/* Busca */}
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid #FFFFFF" }}>
                    <input
                      style={{ ...inp, padding: "7px 10px", fontSize: 13 }}
                      placeholder="Filtrar contas..."
                      value={contaBusca}
                      onChange={e => setContaBusca(e.target.value)}
                    />
                  </div>

                  {buscandoContas ? (
                    <div style={{ padding: 16, color: "#6B7A89", fontSize: 13, textAlign: "center" }}>Carregando...</div>
                  ) : erroContas ? (
                    <div style={{ padding: 14, color: "#B42318", fontSize: 12, background: "#ef444410", borderRadius: 6, margin: 8 }}>
                      ⚠ {erroContas}
                    </div>
                  ) : contasFiltradas.length === 0 ? (
                    <div style={{ padding: 16, color: "#6B7A89", fontSize: 13, textAlign: "center" }}>Nenhuma conta encontrada.</div>
                  ) : (
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {contasFiltradas.map(c => (
                        <button
                          key={c.id}
                          onClick={() => selecionarConta(c.id_clean)}
                          style={{
                            width: "100%", textAlign: "left", padding: "10px 14px", border: "none",
                            background: contaSelecionada === c.id_clean ? "rgba(41,171,226,0.1)" : "transparent",
                            borderLeft: contaSelecionada === c.id_clean ? "3px solid #1C6CA6" : "3px solid transparent",
                            color: "#0A1826", cursor: "pointer", fontSize: 13, display: "flex", flexDirection: "column", gap: 2,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: "#6B7A89" }}>{c.id_clean} {c.business ? `· ${c.business}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Pixels da conta selecionada */}
                  {contaSelecionada && (
                    <div style={{ borderTop: "1px solid #FFFFFF", padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, color: "#6B7A89", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pixels da conta</div>
                      {buscandoPixels ? (
                        <div style={{ fontSize: 13, color: "#6B7A89" }}>Carregando pixels...</div>
                      ) : pixelsDisponiveis.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#6B7A89" }}>Nenhum pixel encontrado.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pixelsDisponiveis.map(px => (
                            <button
                              key={px.id}
                              onClick={() => { setForm(p => p && ({ ...p, meta_pixel_id: px.id })); }}
                              style={{
                                textAlign: "left", padding: "8px 12px", borderRadius: 6, border: "1px solid",
                                borderColor: form.meta_pixel_id === px.id ? "#1C6CA6" : "#E6EBF0",
                                background: form.meta_pixel_id === px.id ? "rgba(41,171,226,0.1)" : "#FFFFFF",
                                color: "#0A1826", cursor: "pointer", fontSize: 13,
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{px.name || "Pixel sem nome"}</span>
                              <span style={{ fontSize: 11, color: "#6B7A89", marginLeft: 8 }}>{px.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Pixel selecionado */}
              {form.meta_pixel_id && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#6B7A89" }}>Pixel selecionado:</span>
                  <span style={{ fontSize: 12, color: "#1C6CA6", fontWeight: 600 }}>{form.meta_pixel_id}</span>
                  <button onClick={() => setForm(p => p && ({ ...p, meta_pixel_id: "" }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7A89", padding: 0, display: "flex" }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp */}
            <div>
              <label style={lbl}>WhatsApp para Notificação</label>
              <input style={inp} value={form.whatsapp_notificacao} onChange={e => setForm(p => p && ({ ...p, whatsapp_notificacao: e.target.value }))} placeholder="5511999999999" />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => p && ({ ...p, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "#1C6CA6" }} />
              <span style={{ fontSize: 14, color: "#7E93A8" }}>Cliente ativo</span>
            </label>

            <button onClick={salvar} disabled={salvando} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 8, border: "none", background: "#1C6CA6", color: "#F3F5F7", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando ? 0.7 : 1 }}>
              <Save size={16} /> {salvando ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Formulários */}
      {tab === "forms" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={() => router.push(`/formularios?cliente_id=${id}`)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, border: "none", background: "#1C6CA6", color: "#F3F5F7", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              + Novo Formulário
            </button>
          </div>
          {formularios.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#404040" }}>
              <p style={{ fontSize: 15 }}>Nenhum formulário vinculado a este cliente.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {formularios.map(f => (
                <div key={f.id} style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0A1826", marginBottom: 4 }}>{f.nome}</div>
                    <div style={{ fontSize: 12, color: "#1C6CA6" }}>/f/{f.slug}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => copiar(`${appUrl}/f/${f.slug}`, `f-${f.id}`)}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF", color: copiado === `f-${f.id}` ? "#1E6B52" : "#808080", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                    >
                      <Copy size={13} /> {copiado === `f-${f.id}` ? "Copiado!" : "Copiar"}
                    </button>
                    <a href={`/f/${f.slug}`} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF", color: "#808080", cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none" }}>
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => router.push(`/formularios?cliente_id=${id}&form_id=${f.id}`)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF", color: "#0A1826", cursor: "pointer", fontSize: 13 }}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Landing Pages */}
      {tab === "lps" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={() => router.push(`/ferramentas/lp?cliente_id=${id}`)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, border: "none", background: "#1C6CA6", color: "#F3F5F7", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              + Nova LP
            </button>
          </div>
          {lps.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#404040" }}>
              <p style={{ fontSize: 15 }}>Nenhuma landing page vinculada a este cliente.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lps.map(lp => (
                <div key={lp.id} style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0A1826", marginBottom: 4 }}>{lp.titulo}</div>
                    <div style={{ fontSize: 12, color: "#1C6CA6" }}>/lp/{lp.slug}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => copiar(`${appUrl}/lp/${lp.slug}`, `lp-${lp.id}`)}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF", color: copiado === `lp-${lp.id}` ? "#1E6B52" : "#808080", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                    >
                      <Copy size={13} /> {copiado === `lp-${lp.id}` ? "Copiado!" : "Copiar"}
                    </button>
                    <a href={`/lp/${lp.slug}`} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF", color: "#808080", cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none" }}>
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => router.push(`/ferramentas/lp?cliente_id=${id}&lp_id=${lp.id}`)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E6EBF0", background: "#FFFFFF", color: "#0A1826", cursor: "pointer", fontSize: 13 }}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
