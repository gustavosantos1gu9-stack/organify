"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, RefreshCw, Users, UserX, UserMinus, DollarSign, ChevronUp, ChevronDown, ChevronsUpDown, Eye, Repeat, X } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import Filtros from "@/components/ui/Filtros";
import CadastrarClienteModal from "@/components/clientes/CadastrarClienteModal";
import EditarClienteModal from "@/components/clientes/EditarClienteModal";
import { useClientes, criarCliente, removerCliente, Cliente, useMovimentacoes, atualizarCliente, supabase, gerarLancamentosRecorrencia, getAgenciaId } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

const FILTROS_GRUPOS = [
  { label: "Status", key: "status", opcoes: [
    { label: "Ativo", value: "ativo" },
    { label: "Inadimplente", value: "inadimplente" },
    { label: "Cancelado", value: "cancelado" },
  ]},
  { label: "Recorrência", key: "recorrencia", opcoes: [
    { label: "Recorrente (Ativo)", value: "recorrente" },
    { label: "Pendência", value: "pendencia" },
    { label: "Saiu", value: "saiu" },
  ]},
  { label: "Serviço", key: "servico", opcoes: [
    { label: "Assessoria", value: "assessoria" },
    { label: "Mentoria", value: "mentoria" },
  ]},
  { label: "Frequência", key: "frequencia", opcoes: [
    { label: "Mensal", value: "mensal" },
    { label: "Quinzenal", value: "quinzenal" },
    { label: "Trimestral", value: "trimestral" },
  ]},
  { label: "Origem", key: "origem", opcoes: [
    { label: "Facebook", value: "Facebook" },
    { label: "Instagram", value: "Instagram" },
    { label: "Google", value: "Google" },
    { label: "LinkedIn", value: "LinkedIn" },
    { label: "Indicação", value: "Indicação" },
  ]},
  { label: "Data de cadastro", key: "data", tipo: "date-range" as const, opcoes: [] },
];

type SortKey = "created_at" | "nome" | "status" | "servico" | "frequencia" | "cidade" | "estado" | "valor_oportunidade";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={12} style={{ color:"#404040", marginLeft:"4px", verticalAlign:"middle" }}/>;
  return sortDir === "asc"
    ? <ChevronUp size={12} style={{ color:"#29ABE2", marginLeft:"4px", verticalAlign:"middle" }}/>
    : <ChevronDown size={12} style={{ color:"#29ABE2", marginLeft:"4px", verticalAlign:"middle" }}/>;
}

function StatusSelect({ cliente, onRefresh }: { cliente: Cliente; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const sr = cliente.status_recorrencia || (
    cliente.status === "ativo" ? "ativo" :
    cliente.status === "inadimplente" ? "pendencia" : "saiu"
  );

  const opcoes = [
    { value:"ativo", label:"Ativo", color:"#29ABE2" },
    { value:"pendencia", label:"Pendência", color:"#f59e0b" },
    { value:"saiu", label:"Saiu", color:"#ef4444" },
  ];

  const atual = opcoes.find(o => o.value === sr) || opcoes[0];

  const handleChange = async (value: string) => {
    setOpen(false);
    await atualizarCliente(cliente.id, {
      status_recorrencia: value,
      status: value === "saiu" ? "cancelado" : value === "pendencia" ? "inadimplente" : "ativo",
    });

    // Se saiu: remover lançamentos futuros não pagos
    if (value === "saiu") {
      await supabase
        .from("lancamentos_futuros")
        .delete()
        .eq("cliente_id", cliente.id)
        .eq("pago", false);
    }

    onRefresh();
  };

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display:"flex", alignItems:"center", gap:"6px",
        background:"none", border:"none", cursor:"pointer", padding:"4px 0",
      }}>
        <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:atual.color, flexShrink:0 }}/>
        <span style={{ fontSize:"12px", color:atual.color }}>{atual.label}</span>
        <span style={{ fontSize:"10px", color:"#606060" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"100%", left:0, zIndex:100,
          background:"#1e1e1e", border:"1px solid #3a3a3a", borderRadius:"8px",
          overflow:"hidden", minWidth:"130px", boxShadow:"0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {opcoes.map(o => (
            <button key={o.value} onClick={() => handleChange(o.value)} style={{
              width:"100%", padding:"9px 14px", background:sr===o.value?`${o.color}15`:"none",
              border:"none", cursor:"pointer", fontSize:"13px", color:o.color,
              textAlign:"left", display:"flex", alignItems:"center", gap:"8px",
            }}
            onMouseEnter={e=>(e.currentTarget.style.background=`${o.color}15`)}
            onMouseLeave={e=>(e.currentTarget.style.background=sr===o.value?`${o.color}15`:"none")}>
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:o.color }}/>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalRecorrencia({ cliente, onClose, onSucesso }: { cliente: Cliente; onClose: () => void; onSucesso: () => void }) {
  const [desc, setDesc] = useState(`Assessoria - ${cliente.nome}`);
  const [valor, setValor] = useState(cliente.valor_oportunidade ? String(cliente.valor_oportunidade) : "");
  const [dia, setDia] = useState("");
  const [dia2, setDia2] = useState("");
  const [freq, setFreq] = useState(cliente.frequencia || "mensal");
  const [meses, setMeses] = useState(12);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [recorrencias, setRecorrencias] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const agId = await getAgenciaId();
      if (!agId) return;
      const { data } = await supabase.from("recorrencias").select("*").eq("agencia_id", agId).eq("cliente_id", cliente.id).eq("ativo", true).order("created_at", { ascending: false });
      setRecorrencias(data || []);
    }
    load();
  }, [cliente.id]);

  async function criar() {
    const v = parseFloat(valor.replace(",", "."));
    const d1 = parseInt(dia);
    const d2 = freq === "quinzenal" ? parseInt(dia2) : 0;
    if (!v || !d1 || d1 < 1 || d1 > 31) { alert("Preencha valor e dia (1-31)"); return; }
    if (freq === "quinzenal" && (!d2 || d2 < 1 || d2 > 31)) { alert("Preencha o 2º dia para quinzenal"); return; }
    setSalvando(true);
    try {
      const agId = await getAgenciaId();
      if (!agId) { alert("Erro: agência não encontrada"); setSalvando(false); return; }
      const hoje = new Date();
      const diaVenc = freq === "quinzenal" ? `${d1},${d2}` : String(d1);

      // Calcular próximo vencimento
      let proximo = new Date(hoje.getFullYear(), hoje.getMonth(), d1);
      if (proximo <= hoje) {
        if (freq === "trimestral") proximo.setMonth(proximo.getMonth() + 3);
        else proximo.setMonth(proximo.getMonth() + 1);
      }

      const { data: rec, error: errRec } = await supabase.from("recorrencias").insert({
        agencia_id: agId, tipo: "entrada", descricao: desc, valor: v, periodicidade: freq,
        dia_vencimento: diaVenc, cliente_id: cliente.id, ativo: true,
        proximo_vencimento: proximo.toISOString().split("T")[0],
      }).select().single();
      if (errRec) { console.error("Erro recorrencia:", errRec); alert("Erro ao criar recorrência: " + errRec.message); setSalvando(false); return; }

      // Gerar lançamentos futuros
      const lancamentos: any[] = [];
      if (freq === "quinzenal") {
        // 2 lançamentos por mês nos dias d1 e d2
        for (let m = 0; m < meses; m++) {
          const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() + m, 1);
          for (const dd of [d1, d2]) {
            const dt = new Date(mesRef.getFullYear(), mesRef.getMonth(), dd);
            if (dt > hoje) {
              lancamentos.push({
                agencia_id: agId, tipo: "entrada", descricao: desc, valor: v,
                data_vencimento: dt.toISOString().split("T")[0],
                cliente_id: cliente.id, pago: false, despesa: false,
              });
            }
          }
        }
      } else {
        const totalLanc = freq === "trimestral" ? Math.ceil(meses / 3) : meses;
        let dataAtual = new Date(proximo);
        for (let i = 0; i < totalLanc; i++) {
          lancamentos.push({
            agencia_id: agId, tipo: "entrada", descricao: desc, valor: v,
            data_vencimento: dataAtual.toISOString().split("T")[0],
            cliente_id: cliente.id, pago: false, despesa: false,
          });
          if (freq === "trimestral") dataAtual = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 3, d1);
          else dataAtual = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, d1);
        }
      }

      if (lancamentos.length) {
        const { error: errLanc } = await supabase.from("lancamentos_futuros").insert(lancamentos);
        if (errLanc) { console.error("Erro lancamentos:", errLanc); alert("Recorrência criada, mas erro nos lançamentos: " + errLanc.message); }
      }

      setRecorrencias(prev => [rec, ...prev].filter(Boolean));
      setSucesso(`Recorrência criada + ${lancamentos.length} lançamentos`);
      setValor(""); setDia(""); setDia2("");
      onSucesso();
      setTimeout(() => setSucesso(""), 4000);
    } catch (e: any) { console.error("Erro geral:", e); alert("Erro: " + (e?.message || e)); }
    setSalvando(false);
  }

  const diasPreenchidos = freq === "quinzenal" ? (!!dia && !!dia2) : !!dia;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#141414", border:"1px solid #2e2e2e", borderRadius:"12px", width:"440px", maxHeight:"80vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #2e2e2e", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ margin:0, fontSize:"15px", fontWeight:"600", color:"#f0f0f0" }}>Recorrência de Pagamento</h3>
            <p style={{ margin:"2px 0 0", fontSize:"12px", color:"#606060" }}>{cliente.nome}</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#606060" }}><X size={16}/></button>
        </div>
        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:"10px" }}>
          <input placeholder="Descrição (ex: Assessoria)" value={desc} onChange={e => setDesc(e.target.value)}
            style={{ background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px" }}/>
          <div style={{ display:"flex", gap:"10px" }}>
            <input placeholder="Valor (R$)" value={valor} onChange={e => setValor(e.target.value)} type="number" step="0.01"
              style={{ flex:1, background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px" }}/>
            <input placeholder={freq === "quinzenal" ? "1º Dia" : "Dia"} value={dia} onChange={e => setDia(e.target.value)} type="number" min="1" max="31"
              style={{ width:"70px", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", textAlign:"center" }}/>
            {freq === "quinzenal" && (
              <input placeholder="2º Dia" value={dia2} onChange={e => setDia2(e.target.value)} type="number" min="1" max="31"
                style={{ width:"70px", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", textAlign:"center" }}/>
            )}
          </div>
          <div style={{ display:"flex", gap:"10px" }}>
            <select value={freq} onChange={e => setFreq(e.target.value)}
              style={{ flex:1, background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", cursor:"pointer" }}>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
            </select>
            <select value={meses} onChange={e => setMeses(Number(e.target.value))}
              style={{ width:"100px", background:"#1a1a1a", border:"1px solid #2e2e2e", borderRadius:"8px", padding:"9px 12px", color:"#f0f0f0", fontSize:"13px", cursor:"pointer" }}>
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
              <option value={24}>24 meses</option>
            </select>
          </div>
          <button onClick={criar} disabled={salvando || !valor || !diasPreenchidos}
            style={{ background:(!valor||!diasPreenchidos)?"#2e2e2e":"#29ABE2", border:"none", borderRadius:"8px", padding:"10px", cursor:(!valor||!diasPreenchidos)?"default":"pointer", color:(!valor||!diasPreenchidos)?"#606060":"#000", fontWeight:"600", fontSize:"13px", marginTop:"4px" }}>
            {salvando ? "Criando..." : "Criar Recorrência e Lançamentos"}
          </button>
          {sucesso && <p style={{ color:"#22c55e", fontSize:"12px", margin:0, textAlign:"center" }}>{sucesso}</p>}

          {recorrencias.length > 0 && (
            <div style={{ marginTop:"8px", borderTop:"1px solid #2e2e2e", paddingTop:"12px" }}>
              <p style={{ fontSize:"11px", color:"#606060", margin:"0 0 8px", textTransform:"uppercase", fontWeight:"600" }}>Recorrências ativas</p>
              {recorrencias.map(r => (
                <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", background:"#1a1a1a", borderRadius:"8px", marginBottom:"6px", border:"1px solid #2e2e2e" }}>
                  <div>
                    <p style={{ fontSize:"13px", color:"#f0f0f0", margin:0 }}>{r.descricao}</p>
                    <p style={{ fontSize:"11px", color:"#606060", margin:0 }}>Dia {r.dia_vencimento} • {r.periodicidade}</p>
                  </div>
                  <span style={{ fontSize:"13px", color:"#22c55e", fontWeight:"600" }}>R$ {Number(r.valor).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [recCliente, setRecCliente] = useState<Cliente | null>(null);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: clientes, loading, refresh } = useClientes(busca, filtros.status || "");
  const { data: movs } = useMovimentacoes();

  // Busca cliente fresco do banco antes de abrir modal
  const handleEditar = async (c: Cliente) => {
    const { data } = await supabase
      .from("clientes")
      .select("*, origens(nome)")
      .eq("id", c.id)
      .single();
    setEditando(data || c);
  };

  const ativos = clientes?.filter((c) => c.status === "ativo") ?? [];
  const inadimplentes = clientes?.filter((c) => c.status === "inadimplente") ?? [];
  const cancelados = clientes?.filter((c) => c.status === "cancelado") ?? [];
  const receitaTotal = ativos.reduce((s, c) => s + (c.valor_oportunidade || 0), 0);
  const receitaMedia = ativos.length > 0 ? receitaTotal / ativos.length : 0;
  const churnRate = clientes?.length ? Math.round((cancelados.length / clientes.length) * 100) : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtrados = useMemo(() => {
    let list = (clientes ?? []).filter((c) => {
      // Por padrão, esconde quem saiu (só aparece se filtrar por "saiu")
      const sr = c.status_recorrencia || (c.status === "cancelado" ? "saiu" : "ativo");
      if (!filtros.recorrencia && sr === "saiu") return false;

      if (filtros.origem && c.origens?.nome !== filtros.origem) return false;
      if (filtros.tipo && c.tipo !== filtros.tipo) return false;
      if (filtros.servico && c.servico !== filtros.servico) return false;
      if (filtros.frequencia && c.frequencia !== filtros.frequencia) return false;
      if (filtros.data_de && c.created_at < filtros.data_de) return false;
      if (filtros.data_ate && c.created_at > filtros.data_ate + "T23:59:59") return false;
      if (filtros.recorrencia === "recorrente" && sr !== "ativo") return false;
      if (filtros.recorrencia === "pendencia" && sr !== "pendencia") return false;
      if (filtros.recorrencia === "saiu" && sr !== "saiu") return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortKey) {
        case "created_at": va = a.created_at; vb = b.created_at; break;
        case "nome": va = a.nome.toLowerCase(); vb = b.nome.toLowerCase(); break;
        case "status": va = a.status; vb = b.status; break;
        case "servico": va = a.servico || ""; vb = b.servico || ""; break;
        case "frequencia": va = a.frequencia || ""; vb = b.frequencia || ""; break;
        case "cidade": va = a.cidade || ""; vb = b.cidade || ""; break;
        case "estado": va = a.estado || ""; vb = b.estado || ""; break;
        case "valor_oportunidade": va = a.valor_oportunidade || 0; vb = b.valor_oportunidade || 0; break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [clientes, filtros, sortKey, sortDir]);

  const thStyle = (key: SortKey): React.CSSProperties => ({
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    WebkitUserSelect: "none",
  });

  const handleSalvar = async (data: Record<string, unknown>) => {
    try {
      const parsearValor = (v: string) => {
        if (!v) return 0;
        const limpo = (v as string).replace(/[R$\s.]/g, "").replace(",", ".");
        return parseFloat(limpo) || 0;
      };

      const valorOportunidade = parsearValor(data.valor_oportunidade as string);
      const servico = (data.servico as string) || "mentoria";
      const frequencia = (data.frequencia as string) || "mensal";

      const novoCliente = await criarCliente({
        tipo: data.tipo as string,
        nome: data.nome as string,
        documento: data.documento as string || undefined,
        email: data.email as string || undefined,
        telefone: data.telefone as string || undefined,
        whatsapp: data.whatsapp as boolean,
        instagram: data.instagram as string || undefined,
        empresa: data.empresa as string || undefined,
        valor_oportunidade: valorOportunidade,
        faturamento: parsearValor(data.faturamento as string),
        cep: data.cep as string || undefined,
        estado: data.estado as string || undefined,
        cidade: data.cidade as string || undefined,
        logradouro: data.logradouro as string || undefined,
        numero: data.numero as string || undefined,
        complemento: data.complemento as string || undefined,
        bairro: data.bairro as string || undefined,
        observacoes: data.observacoes as string || undefined,
        origem_id: data.origem_id as string || undefined,
        categoria_id: data.categoria_id as string || undefined,
        status: (data.status_recorrencia as string) === "saiu" ? "cancelado" :
                (data.status_recorrencia as string) === "pendencia" ? "inadimplente" : "ativo",
        status_recorrencia: (data.status_recorrencia as string) || "ativo",
        servico,
        frequencia,
      });

      refresh();

      // Gerar lançamentos futuros se assessoria — separado para não bloquear o save
      if (servico === "assessoria" && valorOportunidade > 0 && novoCliente) {
        try {
          await gerarLancamentosRecorrencia({
            ...novoCliente,
            valor_oportunidade: valorOportunidade,
            servico,
            frequencia,
          });
        } catch (e) {
          console.error("Erro ao gerar lançamentos:", e);
        }
      }
    } catch (e) { console.error(e); alert("Erro ao salvar cliente"); }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span className="current">Clientes</span>
      </div>
      <h1 style={{ fontSize:"22px", fontWeight:"600", marginBottom:"24px" }}>Clientes</h1>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"16px" }}>
        <KPICard label="Clientes recorrentes" value={ativos.length} change={0} icon={<Users size={16}/>} iconBg="green"/>
        <KPICard label="Clientes inadimplentes" value={inadimplentes.length} change={0} icon={<UserX size={16}/>} iconBg="red"/>
        <KPICard label="Clientes cancelados" value={cancelados.length} change={0} icon={<UserMinus size={16}/>} iconBg="red"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"28px" }}>
        <KPICard label="Total de clientes" value={clientes?.length ?? 0} change={0} icon={<Users size={16}/>} iconBg="green"/>
        <KPICard label="Receita média por cliente" value={formatCurrency(receitaMedia)} change={0} icon={<DollarSign size={16}/>} iconBg="green"/>
        <KPICard label="Churn rate" value={`${churnRate}%`} change={0} icon={<UserMinus size={16}/>} iconBg={churnRate > 0 ? "red" : "green"}/>
      </div>

      <div className="table-wrapper">
        <div style={{ padding:"16px", display:"flex", gap:"12px", borderBottom:"1px solid #2e2e2e", flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:"200px" }}>
            <Search size={14} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#606060" }}/>
            <input className="search-input" placeholder="Buscar clientes..." value={busca} onChange={(e) => setBusca(e.target.value)}/>
          </div>
          <Filtros grupos={FILTROS_GRUPOS} valores={filtros}
            onChange={(key, value) => setFiltros((f) => ({ ...f, [key]: value }))}
            onLimpar={() => setFiltros({})}/>
          <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={14}/> Novo cliente</button>
        </div>

        {Object.values(filtros).some(Boolean) && (
          <div style={{ padding:"8px 16px", background:"rgba(41,171,226,0.05)", borderBottom:"1px solid #2e2e2e", display:"flex", gap:"8px", flexWrap:"wrap" }}>
            {Object.entries(filtros).filter(([,v]) => v).map(([k, v]) => (
              <span key={k} style={{ display:"flex", alignItems:"center", gap:"4px", background:"rgba(41,171,226,0.1)", color:"#29ABE2", padding:"3px 10px", borderRadius:"20px", fontSize:"12px" }}>
                {v}
                <button onClick={() => setFiltros((f) => ({ ...f, [k]: "" }))} style={{ background:"none", border:"none", cursor:"pointer", color:"#29ABE2", padding:"0", lineHeight:1 }}>×</button>
              </span>
            ))}
          </div>
        )}

        <div className="table-scroll">
          <table style={{ minWidth:"1100px" }}>
            <thead>
              <tr>
                <th><input type="checkbox" style={{ width:"14px",height:"14px" }}/></th>
                <th onClick={() => handleSort("status")} style={thStyle("status")}>
                  STATUS <SortIcon col="status" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th></th>
                <th onClick={() => handleSort("nome")} style={thStyle("nome")}>
                  NOME <SortIcon col="nome" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th onClick={() => handleSort("servico")} style={thStyle("servico")}>
                  CATEGORIA <SortIcon col="servico" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th onClick={() => handleSort("frequencia")} style={thStyle("frequencia")}>
                  FREQUÊNCIA <SortIcon col="frequencia" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th onClick={() => handleSort("valor_oportunidade")} style={thStyle("valor_oportunidade")}>
                  TICKET <SortIcon col="valor_oportunidade" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th onClick={() => handleSort("cidade")} style={thStyle("cidade")}>
                  CIDADE <SortIcon col="cidade" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th onClick={() => handleSort("estado")} style={thStyle("estado")}>
                  ESTADO <SortIcon col="estado" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th onClick={() => handleSort("created_at")} style={thStyle("created_at")}>
                  CRIADO EM <SortIcon col="created_at" sortKey={sortKey} sortDir={sortDir}/>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Carregando...</td></tr>
              ) : !filtrados.length ? (
                <tr><td colSpan={11} style={{ textAlign:"center",color:"#606060",padding:"40px" }}>Nenhum cliente encontrado.</td></tr>
              ) : filtrados.map((c) => (
                <tr key={c.id}>
                  <td><input type="checkbox" style={{ width:"14px",height:"14px" }}/></td>
                  <td><StatusSelect cliente={c} onRefresh={refresh}/></td>
                  <td>
                    <div style={{ width:"32px",height:"32px",borderRadius:"50%",background:"#29ABE220",color:"#29ABE2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"600" }}>
                      {c.nome.charAt(0).toUpperCase()}
                    </div>
                  </td>
                  <td style={{ fontWeight:"500" }}>{c.nome}</td>
                  <td>
                    {c.servico ? (
                      <span className={`badge ${c.servico==="assessoria"?"badge-green":"badge-gray"}`} style={{ textTransform:"capitalize" }}>
                        {c.servico}
                      </span>
                    ) : <span style={{color:"#606060"}}>—</span>}
                  </td>
                  <td>
                    {c.servico === "assessoria" && c.frequencia ? (
                      <span className="badge badge-gray" style={{ textTransform:"capitalize" }}>{c.frequencia}</span>
                    ) : <span style={{color:"#606060"}}>—</span>}
                  </td>
                  <td style={{ color:"#29ABE2", fontWeight:"600" }}>
                    {c.valor_oportunidade ? formatCurrency(c.valor_oportunidade) : "—"}
                  </td>
                  <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.cidade || "—"}</td>
                  <td style={{ color:"#a0a0a0", fontSize:"12px" }}>{c.estado || "—"}</td>
                  <td style={{ color:"#a0a0a0" }}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <div style={{ display:"flex",gap:"6px" }}>
                      <button className="btn-ghost" style={{ padding:"5px 8px" }} title="Recorrência" onClick={() => setRecCliente(c)}>
                        <Repeat size={13}/>
                      </button>
                      <a href={`/clientes/${c.id}`} className="btn-ghost" style={{ padding:"5px 8px", textDecoration:"none", display:"flex", alignItems:"center", gap:"4px", fontSize:"12px" }} title="Ver detalhes">
                        <Eye size={12}/>
                      </a>
                      <button className="btn-secondary" style={{ padding:"5px 10px",fontSize:"12px" }} onClick={() => handleEditar(c)}>
                        <Edit2 size={12}/> Editar
                      </button>
                      <button className="btn-danger" style={{ padding:"5px 10px",fontSize:"12px" }} onClick={async()=>{ if(confirm("Remover?")){ await removerCliente(c.id); refresh(); }}}>
                        <Trash2 size={12}/> Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <CadastrarClienteModal onClose={() => setShowModal(false)} onSave={handleSalvar}/>}
      {editando && <EditarClienteModal cliente={editando} onClose={() => setEditando(null)} onSave={refresh}/>}
      {recCliente && <ModalRecorrencia cliente={recCliente} onClose={() => setRecCliente(null)} onSucesso={refresh}/>}
    </div>
  );
}
