"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, X } from "lucide-react";
import { useCategoriasClientes, criarCategoriaCliente, removerCategoriaCliente, supabase } from "@/lib/hooks";

export default function CategoriasClientesPage() {
  const { data: categorias, loading, refresh } = useCategoriasClientes();
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const filtradas = categorias?.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())) ?? [];

  const handleSalvar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (editando) {
        await supabase.from("categorias_clientes").update({ nome: nome.trim() }).eq("id", editando.id);
      } else {
        await criarCategoriaCliente(nome.trim());
      }
      refresh();
      setShowModal(false);
      setEditando(null);
      setNome("");
    } catch {
      alert("Erro ao salvar categoria");
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (cat: { id: string; nome: string }) => {
    setEditando(cat);
    setNome(cat.nome);
    setShowModal(true);
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Remover esta categoria?")) return;
    await removerCategoriaCliente(id);
    refresh();
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <a href="/configuracoes/agencia">Configurações</a><span>›</span>
        <a href="#">Clientes</a><span>›</span>
        <span className="current">Categorias</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Categorias</h1>

      <div className="table-wrapper">
        <div style={{ padding: "16px", display: "flex", gap: "12px", borderBottom: "1px solid #2e2e2e" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input className="search-input" placeholder="Buscar categorias..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => { setEditando(null); setNome(""); setShowModal(true); }}>
            <Plus size={14} /> Nova categoria
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th><input type="checkbox" style={{ width: "14px", height: "14px" }} /></th>
              <th>TODOS</th>
              <th>NOME</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Nenhuma categoria encontrada.</td></tr>
            ) : filtradas.map((cat) => (
              <tr key={cat.id}>
                <td><input type="checkbox" style={{ width: "14px", height: "14px" }} /></td>
                <td></td>
                <td style={{ fontWeight: "500" }}>{cat.nome}</td>
                <td>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button className="btn-secondary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => handleEditar(cat)}>
                      <Edit2 size={12} /> Editar
                    </button>
                    <button className="btn-danger" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => handleRemover(cat.id)}>
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
                {editando ? "Editar categoria" : "Cadastrar categoria"}
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
                Adicione uma categoria ex: Agronegócio, Saúde, Microempresa, B2B, B2C.
              </p>
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
