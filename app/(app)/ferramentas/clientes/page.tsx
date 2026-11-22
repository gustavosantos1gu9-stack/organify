"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
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
  created_at: string;
  _form_count?: number;
  _lp_count?: number;
}

const VAZIO: Omit<ClienteExterno, "id" | "agencia_id" | "created_at" | "_form_count" | "_lp_count"> = {
  nome: "",
  logo_url: "",
  meta_pixel_id: "",
  meta_access_token: "",
  whatsapp_notificacao: "",
  ativo: true,
};

export default function ClientesExternosPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteExterno[]>([]);
  const [loading, setLoading] = useState(true);
  const [agId, setAgId] = useState("");
  const [modal, setModal] = useState<Partial<ClienteExterno> | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const id = await getAgenciaId();
    if (!id) return;
    setAgId(id);

    const { data: lista } = await supabase
      .from("clientes_externos")
      .select("*")
      .eq("agencia_id", id)
      .order("created_at", { ascending: false });

    if (!lista) { setLoading(false); return; }

    const ids = lista.map((c: ClienteExterno) => c.id);

    const [{ data: forms }, { data: lps }] = await Promise.all([
      supabase.from("formularios").select("id, cliente_externo_id").in("cliente_externo_id", ids),
      supabase.from("landing_pages").select("id, cliente_externo_id").in("cliente_externo_id", ids),
    ]);

    const formCount: Record<string, number> = {};
    const lpCount: Record<string, number> = {};
    for (const f of forms || []) if (f.cliente_externo_id) formCount[f.cliente_externo_id] = (formCount[f.cliente_externo_id] || 0) + 1;
    for (const l of lps || []) if (l.cliente_externo_id) lpCount[l.cliente_externo_id] = (lpCount[l.cliente_externo_id] || 0) + 1;

    setClientes(lista.map((c: ClienteExterno) => ({ ...c, _form_count: formCount[c.id] || 0, _lp_count: lpCount[c.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!modal) return;
    if (!modal.nome?.trim()) return alert("Nome é obrigatório");
    setSalvando(true);
    try {
      const payload = {
        agencia_id: agId,
        nome: modal.nome!.trim(),
        logo_url: modal.logo_url?.trim() || "",
        meta_pixel_id: modal.meta_pixel_id?.trim() || "",
        meta_access_token: modal.meta_access_token?.trim() || "",
        whatsapp_notificacao: modal.whatsapp_notificacao?.trim() || "",
        ativo: modal.ativo ?? true,
      };
      if (modal.id) {
        await supabase.from("clientes_externos").update(payload).eq("id", modal.id);
      } else {
        await supabase.from("clientes_externos").insert(payload);
      }
      setModal(null);
      await carregar();
    } catch (e: any) { alert("Erro ao salvar: " + e.message); }
    setSalvando(false);
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este cliente externo?")) return;
    await supabase.from("clientes_externos").delete().eq("id", id);
    await carregar();
  };

  const inp: React.CSSProperties = {
    background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 8,
    padding: "10px 14px", color: "#0A1826", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: 12, color: "#808080", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0A1826", margin: 0 }}>Clientes Externos</h1>
          <p style={{ fontSize: 13, color: "#4A5B6C", margin: "4px 0 0" }}>Gerencie formulários e LPs para clientes sem acesso ao sistema</p>
        </div>
        <button
          onClick={() => setModal({ ...VAZIO })}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, border: "none", background: "#1C6CA6", color: "#F3F5F7", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #FFFFFF", borderTop: "3px solid #1C6CA6", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : clientes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#404040" }}>
          <p style={{ fontSize: 16, margin: 0 }}>Nenhum cliente externo cadastrado.</p>
          <p style={{ fontSize: 13, margin: "8px 0 0", color: "#303030" }}>Clique em "Novo Cliente" para começar.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {clientes.map(c => (
            <div
              key={c.id}
              style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 12, padding: 20, cursor: "pointer", transition: "border-color 0.2s" }}
              onClick={() => router.push(`/ferramentas/clientes/${c.id}`)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#1C6CA6")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#E6EBF0")}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain", background: "#E6EBF0" }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#29ABE220", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#1C6CA6" }}>
                      {c.nome[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0A1826" }}>{c.nome}</div>
                    {!c.ativo && <span style={{ fontSize: 10, background: "#E6EBF0", color: "#4A5B6C", padding: "1px 6px", borderRadius: 6 }}>Inativo</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setModal(c)}
                    style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #E6EBF0", background: "#FFFFFF", color: "#808080", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => remover(c.id)}
                    style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #E6EBF0", background: "#FFFFFF", color: "#4A5B6C", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: c.meta_pixel_id ? "#29ABE215" : "#E6EBF0", color: c.meta_pixel_id ? "#1C6CA6" : "#6B7A89" }}>
                  Pixel {c.meta_pixel_id ? "✓" : "—"}
                </span>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: c.whatsapp_notificacao ? "#22c55e15" : "#E6EBF0", color: c.whatsapp_notificacao ? "#1E6B52" : "#6B7A89" }}>
                  WhatsApp {c.whatsapp_notificacao ? "✓" : "—"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#4A5B6C" }}>
                <span>{c._form_count} formulário{c._form_count !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{c._lp_count} landing page{c._lp_count !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E6EBF0", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0A1826", margin: 0 }}>
                {modal.id ? "Editar Cliente" : "Novo Cliente Externo"}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "#4A5B6C", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>Nome *</label>
                <input style={inp} value={modal.nome ?? ""} onChange={e => setModal(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente" />
              </div>
              <div>
                <label style={lbl}>Logo URL (opcional)</label>
                <input style={inp} value={modal.logo_url ?? ""} onChange={e => setModal(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label style={lbl}>Meta Pixel ID</label>
                <input style={inp} value={modal.meta_pixel_id ?? ""} onChange={e => setModal(p => ({ ...p, meta_pixel_id: e.target.value }))} placeholder="000000000000000" />
              </div>
              <div>
                <label style={lbl}>Meta Access Token</label>
                <input style={inp} value={modal.meta_access_token ?? ""} onChange={e => setModal(p => ({ ...p, meta_access_token: e.target.value }))} placeholder="EAAxxxxx..." />
              </div>
              <div>
                <label style={lbl}>WhatsApp para Notificação</label>
                <input style={inp} value={modal.whatsapp_notificacao ?? ""} onChange={e => setModal(p => ({ ...p, whatsapp_notificacao: e.target.value }))} placeholder="5511999999999" />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={modal.ativo ?? true} onChange={e => setModal(p => ({ ...p, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "#1C6CA6" }} />
                <span style={{ fontSize: 14, color: "#7E93A8" }}>Cliente ativo</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E6EBF0", background: "transparent", color: "#808080", fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 8, border: "none", background: "#1C6CA6", color: "#F3F5F7", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando ? 0.7 : 1 }}>
                <Save size={16} /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
