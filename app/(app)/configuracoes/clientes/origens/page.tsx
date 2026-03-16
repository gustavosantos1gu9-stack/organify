"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, X } from "lucide-react";
import { useOrigens, criarOrigem, removerOrigem, supabase } from "@/lib/hooks";

export default function OrigensPage() {
  const { data: origens, loading, refresh } = useOrigens();
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string; ativo: boolean } | null>(null);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const filtradas = origens?.filter((o) => o.nome.toLowerCase().includes(busca.toLowerCase())) ?? [];

  const handleSalvar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        await supabase.from("origens").update({ nome: nome.trim(), ativo }).eq("id", editando.id);
      } else {
        await criarOrigem(nome.trim());
      }
      refresh();
      setShowModal(false);
      setEditando(null);
      setNome("");
      setAtivo(true);
    } catch {
      alert("Erro ao salvar origem");
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (o: { id: string; nome: string; ativo: boolean }) => {
    setEditando(o);
    setNome(o.nome);
    setAtivo(o.ativo);
    setShowModal(true);
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Remover esta origem?")) return;
    await removerOrigem(id);
    refresh();
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <a href="/configuracoes/agencia">Configurações</a><span>›</span>
        <a href="#">Clientes</a><span>›</span>
        <span className="current">Origens</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Origens</h1>

      <div className="table-wrapper">
        <div style={{ padding: "16px", display: "flex", gap: "12px", borderBottom: "1px solid #2e2e2e" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar origens..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => { setEditando(null); setNome(""); setAtivo(true); setShowModal(true); }}>
            <Plus size={14} /> Nova origem
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th><input type="checkbox" style={{ width: "14px", height: "14px" }} /></th>
              <th>TODOS</th>
              <th>NOME</th>
              <th>STATUS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Nenhuma origem encontrada.</td></tr>
            ) : filtradas.map((o) => (
              <tr key={o.id}>
                <td><input type="checkbox" style={{ width: "14px", height: "14px" }} /></td>
                <td></td>
                <td style={{ fontWeight: "500" }}>{o.nome}</td>
                <td><span className={`badge ${o.ativo ? "badge-green" : "badge-gray"}`}>{o.ativo ? "Ativo" : "Inativo"}</span></td>
                <td>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button className="btn-secondary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => handleEditar(o)}>
                      <Edit2 size={12} /> Editar
                    </button>
                    <button className="btn-danger" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => handleRemover(o.id)}>
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal animate-in" style={{ maxWidth: "400px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "600" }}>
                {editando ? "Editar origem" : "Cadastrar origem"}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: "6px" }}><X size={16} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Nome</label>
              <input
                className="form-input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSalvar()}
                autoFocus
              />
              <p style={{ fontSize: "11px", color: "#606060", marginTop: "6px" }}>
                Adicione a origem do seu lead ou cliente. Ex: Site, Instagram, Facebook, Google ads.
              </p>
            </div>

            <div className="form-group" style={{ marginTop: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#a0a0a0" }}>
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                Ativo
              </label>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSalvar} disabled={salvando || !nome.trim()}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
