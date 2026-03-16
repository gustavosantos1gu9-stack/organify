"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, X, Eye, EyeOff } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/supabase";

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  agencia_bancaria: string;
  conta: string;
  tipo: string;
  saldo_inicial: number;
  data_saldo_inicial: string;
  apelido: string;
  chave_pix: string;
  conta_recebimento: boolean;
  observacoes: string;
  ativo: boolean;
}

const BANCOS = [
  "Selecione",
  "Banco ABC Brasil S.A.",
  "Banco Afinz S.A. Banco Múltiplo",
  "Banco Agibank S.A.",
  "Banco Alfa S.A.",
  "Banco Andbank (Brasil) S.A.",
  "Banco B3 S.A.",
  "Banco BANDEPE S.A.",
  "Banco BMG S.A.",
  "Banco BNP Paribas Brasil S.A.",
  "Banco BOCOM BBM S.A.",
  "Banco Bradescard S.A.",
  "Banco Bradesco BBI S.A.",
  "Banco Bradesco Financiamentos S.A.",
  "Banco Bradesco S.A.",
  "Banco BS2 S.A.",
  "Banco BTG Pactual S.A.",
  "Banco C6 Consignado S.A.",
  "Banco C6 S.A. (C6 Bank)",
  "Banco Caixa Geral - Brasil S.A.",
  "Banco Cargill S.A.",
  "Banco Investcred Unibanco S.A.",
  "Banco Itaú BBA S.A.",
  "Banco Itaú Consignado S.A.",
  "Banco ItauBank S.A",
  "Banco J. P. Morgan S.A.",
  "Banco J. Safra S.A.",
  "Banco John Deere S.A.",
  "Banco Letsbank S.A.",
  "Banco Luso Brasileiro S.A.",
  "Banco Master S.A.",
  "Banco Mercado Pago S.A.",
  "Banco Mercantil do Brasil S.A.",
  "Banco Mizuho do Brasil S.A.",
  "Banco Modal S.A.",
  "Banco Morgan Stanley S.A.",
  "Banco MUFG Brasil S.A.",
  "Banco Neon S.A.",
  "Banco Original S.A.",
  "Banco PAN S.A.",
  "Banco Paulista S.A.",
  "Banco Pine S.A.",
  "Banco Rabobank International Brasil S.A.",
  "Banco Rendimento S.A.",
  "Banco Rodobens S.A.",
  "Banco Safra S.A.",
  "Banco Santander (Brasil) S.A.",
  "Banco Semear S.A.",
  "Banco Senff S.A.",
  "Banco Société Générale Brasil S.A.",
  "Banco Sumitomo Mitsui Brasileiro S.A.",
  "Banco Topázio S.A.",
  "Banco Triângulo S.A.",
  "Banco Voiter S.A.",
  "Nubank (Nu Pagamentos S.A.)",
  "PagBank (PagSeguro Internet S.A.)",
  "PicPay Serviços S.A.",
];

export default function ContasBancariasPage() {
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<ContaBancaria | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContas, setLoadingContas] = useState(true);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [showSenha, setShowSenha] = useState(false);

  const [form, setForm] = useState({
    tipo: "corrente",
    banco: "",
    agencia_bancaria: "",
    conta: "",
    saldo_inicial: "R$ 0,00",
    data_saldo_inicial: new Date().toISOString().split("T")[0],
    apelido: "",
    chave_pix: "",
    conta_recebimento: false,
    observacoes: "",
    senha: "",
  });

  const loadContas = useCallback(async () => {
    setLoadingContas(true);
    try {
      const agenciaId = await getAgenciaId();
      if (!agenciaId) return;
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("agencia_id", agenciaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setContas(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingContas(false);
    }
  }, []);

  useEffect(() => {
    loadContas();
  }, [loadContas]);

  const filtradas = contas.filter((c) =>
    c.apelido?.toLowerCase().includes(busca.toLowerCase()) ||
    c.banco?.toLowerCase().includes(busca.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      tipo: "corrente",
      banco: "",
      agencia_bancaria: "",
      conta: "",
      saldo_inicial: "R$ 0,00",
      data_saldo_inicial: new Date().toISOString().split("T")[0],
      apelido: "",
      chave_pix: "",
      conta_recebimento: false,
      observacoes: "",
      senha: "",
    });
    setEditando(null);
  };

  const handleSalvar = async () => {
    if (!form.senha) {
      alert("Digite sua senha para confirmar");
      return;
    }
    setLoading(true);
    try {
      const agenciaId = await getAgenciaId();
      const saldoLimpo = parseFloat(form.saldo_inicial.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;

      const payload = {
        agencia_id: agenciaId,
        tipo: form.tipo,
        banco: form.banco,
        agencia_bancaria: form.agencia_bancaria,
        conta: form.conta,
        saldo_inicial: saldoLimpo,
        data_saldo_inicial: form.data_saldo_inicial,
        nome: form.apelido || form.banco,
        chave_pix: form.chave_pix,
        conta_recebimento: form.conta_recebimento,
        observacoes: form.observacoes,
        ativo: true,
      };

      if (editando) {
        await supabase.from("contas_bancarias").update(payload).eq("id", editando.id);
      } else {
        await supabase.from("contas_bancarias").insert(payload);
      }

      loadContas();
      setShowModal(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar conta bancária");
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (conta: ContaBancaria) => {
    setEditando(conta);
    setForm({
      tipo: conta.tipo || "corrente",
      banco: conta.banco || "",
      agencia_bancaria: conta.agencia_bancaria || "",
      conta: conta.conta || "",
      saldo_inicial: conta.saldo_inicial ? `R$ ${conta.saldo_inicial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "R$ 0,00",
      data_saldo_inicial: conta.data_saldo_inicial || new Date().toISOString().split("T")[0],
      apelido: conta.apelido || conta.nome || "",
      chave_pix: conta.chave_pix || "",
      conta_recebimento: conta.conta_recebimento || false,
      observacoes: conta.observacoes || "",
      senha: "",
    });
    setShowModal(true);
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Remover esta conta bancária?")) return;
    try {
      await supabase.from("contas_bancarias").delete().eq("id", id);
      loadContas();
    } catch (e) {
      console.error(e);
      alert("Erro ao remover conta");
    }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <a href="/configuracoes/agencia">Configurações</a><span>›</span>
        <a href="#">Financeiro</a><span>›</span>
        <span className="current">Contas bancárias</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Contas bancárias</h1>

      <div className="table-wrapper">
        <div style={{ padding: "16px", display: "flex", gap: "12px", borderBottom: "1px solid #2e2e2e" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#606060" }} />
            <input
              className="search-input"
              placeholder="Buscar contas bancárias..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={14} /> Nova conta bancária
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>BANCO</th>
              <th>APELIDO</th>
              <th>TIPO</th>
              <th>AGÊNCIA</th>
              <th>CONTA</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loadingContas ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Carregando...</td></tr>
            ) : !filtradas.length ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#606060", padding: "40px" }}>Nenhuma conta bancária encontrada.</td></tr>
            ) : filtradas.map((conta) => (
              <tr key={conta.id}>
                <td style={{ fontWeight: "500" }}>{conta.banco}</td>
                <td>{conta.apelido || conta.nome}</td>
                <td style={{ textTransform: "capitalize" }}>{conta.tipo}</td>
                <td>{conta.agencia_bancaria}</td>
                <td>{conta.conta}</td>
                <td>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button className="btn-secondary" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => handleEditar(conta)}>
                      <Edit2 size={12} /> Editar
                    </button>
                    <button className="btn-danger" style={{ padding: "5px 10px", fontSize: "12px" }} onClick={() => handleRemover(conta.id)}>
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
          <div className="modal animate-in" style={{ maxWidth: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "600" }}>
                {editando ? "Editar conta bancária" : "Cadastrar conta bancária"}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: "6px" }}><X size={16} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Tipo de conta</label>
                <select className="form-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="corrente">Conta corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="caixa">Caixa</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Banco</label>
                <select className="form-input" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })}>
                  {BANCOS.map((b) => <option key={b} value={b === "Selecione" ? "" : b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
              <div className="form-group">
                <label className="form-label">Agência</label>
                <input className="form-input" value={form.agencia_bancaria} onChange={(e) => setForm({ ...form, agencia_bancaria: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Conta</label>
                <input className="form-input" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
              <div className="form-group">
                <label className="form-label">Saldo inicial</label>
                <input className="form-input" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Data do saldo inicial</label>
                <input type="date" className="form-input" value={form.data_saldo_inicial} onChange={(e) => setForm({ ...form, data_saldo_inicial: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
              <div className="form-group">
                <label className="form-label">Apelido</label>
                <input className="form-input" value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", paddingTop: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#a0a0a0" }}>
                  <input type="checkbox" checked={form.conta_recebimento} onChange={(e) => setForm({ ...form, conta_recebimento: e.target.checked })} />
                  Conta de recebimento?
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: "12px" }}>
              <label className="form-label">Chave PIX</label>
              <input className="form-input" value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginTop: "12px" }}>
              <label className="form-label">Observações</label>
              <textarea className="form-input" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginTop: "12px" }}>
              <label className="form-label">Senha</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showSenha ? "text" : "password"}
                  className="form-input"
                  placeholder="Digite sua senha para confirmar"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#606060" }}
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSalvar} disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
