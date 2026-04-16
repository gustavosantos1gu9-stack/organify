"use client";

import { useState, useEffect } from "react";
import { Search, Plus, X, SlidersHorizontal, ExternalLink, Edit2 } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import InputValor, { parsearValorBR } from "@/components/ui/InputValor";
import { useLancamentosFuturos, criarLancamentoFuturo, removerLancamento, useClientes, supabase, getAgenciaId, criarMovimentacao } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const FORMAS_PAGAMENTO = ["Não definido","Pix","Boleto","Cartão de crédito","Cartão de débito","Dinheiro","Transferência bancária"];

// Hook para categorias financeiras
function useCategorias(tipo: "entrada"|"saida"|"") {
  const [cats, setCats] = useState<{id:string;nome:string}[]>([]);
  useEffect(()=>{
    async function load() {
      const agId = await getAgenciaId();
      if (!agId) return;
      let q = supabase.from("categorias_financeiras").select("id,nome").eq("agencia_id",agId).order("nome");
      if (tipo) q = (q as any).eq("tipo", tipo);
      const { data } = await q;
      setCats(data||[]);
    }
    load();
  },[tipo]);
  return cats;
}

function ModalEntrada({ item, onClose, onSave, clientes }: { item?:any; onClose:()=>void; onSave:(d:Record<string,unknown>)=>void; clientes:{id:string;nome:string}[] }) {
  const categorias = useCategorias("entrada");
  const [form, setForm] = useState({
    valor: item ? formatCurrency(item.valor) : "",
    categoria_id: item?.categoria_id||"",
    cliente_id: item?.cliente_id||"",
    forma_pagamento: item?.forma_pagamento||"Não definido",
    data_vencimento: item?.data_vencimento||"",
    descricao: item?.descricao||"",
  });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const isEdit = !!item;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{maxWidth:"520px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h2 style={{fontSize:"17px",fontWeight:"600"}}>{isEdit?"Editar":"Cadastrar"} entrada prevista</h2>
          <button onClick={onClose} className="btn-ghost" style={{padding:"6px"}}><X size={16}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
          <div className="form-group">
            <label className="form-label">Valor *</label>
            <InputValor value={form.valor} onChange={v=>set("valor",v)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-input" value={form.categoria_id} onChange={e=>set("categoria_id",e.target.value)}>
              <option value="">Selecione</option>
              {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cliente</label>
            <select className="form-input" value={form.cliente_id} onChange={e=>set("cliente_id",e.target.value)}>
              <option value="">Selecione</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Forma de pagamento</label>
            <select className="form-input" value={form.forma_pagamento} onChange={e=>set("forma_pagamento",e.target.value)}>
              {FORMAS_PAGAMENTO.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data de vencimento *</label>
            <input type="date" className="form-input" value={form.data_vencimento} onChange={e=>set("data_vencimento",e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" placeholder="Descrição" value={form.descricao} onChange={e=>set("descricao",e.target.value)}/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"24px"}}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={async ()=>{
            if(!form.valor||!form.data_vencimento){alert("Preencha valor e data");return;}
            await onSave({tipo:"entrada",...form, id:item?.id});
            onClose();
          }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ModalSaida({ item, onClose, onSave }: { item?:any; onClose:()=>void; onSave:(d:Record<string,unknown>)=>void }) {
  const categorias = useCategorias("saida");
  const [form, setForm] = useState({
    valor: item ? formatCurrency(item.valor) : "",
    categoria_id: item?.categoria_id||"",
    fornecedor: item?.fornecedor||"",
    forma_pagamento: item?.forma_pagamento||"Pix",
    data_vencimento: item?.data_vencimento||"",
    descricao: item?.descricao||"",
    despesa: item?.despesa||false,
    considerar_cac: item?.considerar_cac||false,
  });
  const set = (k:string,v:string|boolean) => setForm(f=>({...f,[k]:v}));
  const isEdit = !!item;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{maxWidth:"520px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h2 style={{fontSize:"17px",fontWeight:"600"}}>{isEdit?"Editar":"Cadastrar"} saída prevista</h2>
          <button onClick={onClose} className="btn-ghost" style={{padding:"6px"}}><X size={16}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
          <div className="form-group">
            <label className="form-label">Valor *</label>
            <InputValor value={form.valor} onChange={v=>set("valor",v)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-input" value={form.categoria_id} onChange={e=>set("categoria_id",e.target.value)}>
              <option value="">Selecione</option>
              {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fornecedor</label>
            <input className="form-input" placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e=>set("fornecedor",e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Forma de pagamento</label>
            <select className="form-input" value={form.forma_pagamento} onChange={e=>set("forma_pagamento",e.target.value)}>
              {FORMAS_PAGAMENTO.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data de vencimento *</label>
            <input type="date" className="form-input" value={form.data_vencimento} onChange={e=>set("data_vencimento",e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" placeholder="Descrição" value={form.descricao} onChange={e=>set("descricao",e.target.value)}/>
          </div>
        </div>
        <div style={{display:"flex",gap:"16px",paddingTop:"12px"}}>
          <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"13px",color:"#a0a0a0"}}>
            <input type="checkbox" checked={form.despesa} onChange={e=>set("despesa",e.target.checked)} style={{width:"14px",height:"14px"}}/>
            Despesa
          </label>
          <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"13px",color:"#a0a0a0"}}>
            <input type="checkbox" checked={form.considerar_cac} onChange={e=>set("considerar_cac",e.target.checked)} style={{width:"14px",height:"14px"}}/>
            Considerar no cálculo de CAC
          </label>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"24px"}}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button onClick={async ()=>{
            if(!form.valor||!form.data_vencimento){alert("Preencha valor e data");return;}
            await onSave({tipo:"saida",...form, id:item?.id});
            onClose();
          }} style={{background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"}}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalLancar({ item, onClose, onSave }: { item:{id:string;valor:number;descricao:string}; onClose:()=>void; onSave:(id:string,valorRecebido:number)=>void }) {
  const [valorRecebido, setValorRecebido] = useState(formatCurrency(item.valor));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal animate-in" style={{maxWidth:"440px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
          <h2 style={{fontSize:"17px",fontWeight:"600"}}>Efetuar lançamento</h2>
          <button onClick={onClose} className="btn-ghost" style={{padding:"6px"}}><X size={16}/></button>
        </div>
        <p style={{fontSize:"13px",color:"#606060",marginBottom:"24px"}}>Preencha o campo abaixo para efetuar o lançamento:</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
          <div className="form-group">
            <label className="form-label">Valor original</label>
            <InputValor value={formatCurrency(item.valor)} onChange={()=>{}} readOnly/>
          </div>
          <div className="form-group">
            <label className="form-label">Valor recebido</label>
            <InputValor value={valorRecebido} onChange={setValorRecebido}/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"24px"}}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={()=>{
            const v = parsearValorBR(valorRecebido);
            if(!v){alert("Valor inválido");return;}
            onSave(item.id, v); onClose();
          }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function PainelFiltros({ onClose, onFiltrar }: { onClose:()=>void; onFiltrar:(f:Record<string,string>)=>void }) {
  const [filtros, setFiltros] = useState({ data_de:"", data_ate:"", tipo:"", categoria_id:"", fornecedor:"" });
  const categorias = useCategorias("");
  const set = (k:string,v:string) => setFiltros(f=>({...f,[k]:v}));

  return (
    <div style={{position:"fixed",top:0,right:0,width:"380px",height:"100vh",background:"#111",borderLeft:"1px solid #2e2e2e",zIndex:200,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:"1px solid #2e2e2e"}}>
        <h3 style={{fontSize:"16px",fontWeight:"600"}}>Filtros — Lançamentos futuros</h3>
        <button onClick={onClose} className="btn-ghost" style={{padding:"6px"}}><X size={16}/></button>
      </div>
      <div style={{flex:1,padding:"24px",display:"flex",flexDirection:"column",gap:"20px",overflowY:"auto"}}>
        <div className="form-group">
          <label className="form-label">Data de vencimento</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginTop:"8px"}}>
            <div>
              <label style={{fontSize:"11px",color:"#606060",display:"block",marginBottom:"4px"}}>De</label>
              <input type="date" className="form-input" value={filtros.data_de} onChange={e=>set("data_de",e.target.value)}/>
            </div>
            <div>
              <label style={{fontSize:"11px",color:"#606060",display:"block",marginBottom:"4px"}}>Até</label>
              <input type="date" className="form-input" value={filtros.data_ate} onChange={e=>set("data_ate",e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo de lançamento</label>
          <select className="form-input" style={{marginTop:"8px"}} value={filtros.tipo} onChange={e=>set("tipo",e.target.value)}>
            <option value="">Selecione</option>
            <option value="entrada">Entrada prevista</option>
            <option value="saida">Saída prevista</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-input" style={{marginTop:"8px"}} value={filtros.categoria_id} onChange={e=>set("categoria_id",e.target.value)}>
            <option value="">Selecione</option>
            {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Fornecedor</label>
          <select className="form-input" style={{marginTop:"8px"}} value={filtros.fornecedor} onChange={e=>set("fornecedor",e.target.value)}>
            <option value="">Selecione</option>
          </select>
        </div>
      </div>
      <div style={{padding:"20px 24px",borderTop:"1px solid #2e2e2e",display:"flex",gap:"8px"}}>
        <button className="btn-secondary" style={{flex:1,justifyContent:"center"}} onClick={()=>{setFiltros({data_de:"",data_ate:"",tipo:"",categoria_id:"",fornecedor:""});onFiltrar({});}}>Limpar</button>
        <button className="btn-primary" style={{flex:1,justifyContent:"center"}} onClick={()=>{onFiltrar(filtros);onClose();}}>Filtrar</button>
      </div>
    </div>
  );
}

export default function LancamentosFuturosPage() {
  const [showEntrada, setShowEntrada] = useState(false);
  const [showSaida, setShowSaida] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [lancando, setLancando] = useState<{id:string;valor:number;descricao:string}|null>(null);
  const [editando, setEditando] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Record<string,string>>({});
  const { data: lancs, loading, refresh } = useLancamentosFuturos(busca);
  const { data: clientes } = useClientes();

  const filtrados = (lancs??[]).filter(l => {
    if (filtros.tipo && l.tipo !== filtros.tipo) return false;
    if (filtros.data_de && l.data_vencimento < filtros.data_de) return false;
    if (filtros.data_ate && l.data_vencimento > filtros.data_ate) return false;
    if (filtros.categoria_id && l.categoria_id !== filtros.categoria_id) return false;
    return true;
  });

  const totalEntradas = filtrados.filter(l=>l.tipo==="entrada"&&!l.pago).reduce((a,b)=>a+b.valor,0);
  const totalSaidas = filtrados.filter(l=>l.tipo==="saida"&&!l.pago).reduce((a,b)=>a+b.valor,0);
  const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
  const entradasMes = filtrados.filter(l=>l.tipo==="entrada"&&!l.pago&&l.data_vencimento.startsWith(mesAtual)).reduce((a,b)=>a+b.valor,0);
  const saidasMes = filtrados.filter(l=>l.tipo==="saida"&&!l.pago&&l.data_vencimento.startsWith(mesAtual)).reduce((a,b)=>a+b.valor,0);

  // Agrupar por mês
  const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const porMes = filtrados.reduce<Record<string, typeof filtrados>>((acc, l) => {
    const [ano, mes] = l.data_vencimento.split("-");
    const chave = `${ano}-${mes}`;
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(l);
    return acc;
  }, {});
  const mesesOrdenados = Object.keys(porMes).sort();

  const handleSalvar = async (data: Record<string,unknown>) => {
    try {
      const valor = parsearValorBR(data.valor as string);
      if (data.id) {
        // Editar
        await supabase.from("lancamentos_futuros").update({
          valor, categoria_id: data.categoria_id||null,
          cliente_id: data.cliente_id||null,
          forma_pagamento: data.forma_pagamento,
          data_vencimento: data.data_vencimento,
          descricao: data.descricao,
          despesa: data.despesa||false,
          considerar_cac: data.considerar_cac||false,
        }).eq("id", data.id);
      } else {
        await criarLancamentoFuturo({
          tipo: data.tipo as "entrada"|"saida",
          descricao: (data.descricao as string)||"Sem descrição",
          valor,
          data_vencimento: data.data_vencimento as string,
          forma_pagamento: data.forma_pagamento as string||undefined,
          cliente_id: data.cliente_id as string||undefined,
          despesa: data.despesa as boolean||false,
          considerar_cac: data.considerar_cac as boolean||false,
          pago: false,
        });
      }
      refresh();
    } catch(e){ console.error(e); alert("Erro ao salvar"); }
  };

  const handleLancar = async (id: string, valorRecebido: number) => {
    try {
      // Buscar lançamento completo
      const { data: lanc, error: errBusca } = await supabase
        .from("lancamentos_futuros")
        .select("*")
        .eq("id", id)
        .single();

      if (errBusca || !lanc) throw new Error("Lançamento não encontrado");

      const hoje = new Date().toISOString().split("T")[0];

      // Criar movimentação com o valor recebido
      await criarMovimentacao({
        tipo: lanc.tipo,
        descricao: lanc.descricao || "Lançamento",
        valor: valorRecebido,
        data: hoje,
        categoria_id: lanc.categoria_id || undefined,
        cliente_id: lanc.cliente_id || undefined,
        despesa: lanc.despesa || false,
        considerar_cac: lanc.considerar_cac || false,
      });

      // Remover de lançamentos futuros
      await supabase.from("lancamentos_futuros").delete().eq("id", id);

      refresh();
    } catch(e) {
      console.error(e);
      alert("Erro ao lançar");
    }
  };

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <span style={{color:"#a0a0a0"}}>Financeiro</span><span>›</span>
        <span className="current">Lançamentos futuros</span>
      </div>
      <h1 style={{fontSize:"22px",fontWeight:"600",marginBottom:"24px"}}>Lançamentos futuros</h1>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"16px",marginBottom:"28px"}}>
        <KPICard label="Entradas previstas (total)" value={formatCurrency(totalEntradas)} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas previstas (total)" value={formatCurrency(totalSaidas)} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
        <KPICard label="Entradas este mês" value={formatCurrency(entradasMes)} change={0} icon={<ArrowDownToLine size={16}/>} iconBg="green"/>
        <KPICard label="Saídas este mês" value={formatCurrency(saidasMes)} change={0} icon={<ArrowUpFromLine size={16}/>} iconBg="red"/>
      </div>

      <div className="table-wrapper">
        <div style={{padding:"16px",display:"flex",gap:"12px",borderBottom:"1px solid #2e2e2e",flexWrap:"wrap",alignItems:"center"}}>
          <div style={{position:"relative",flex:1,minWidth:"200px"}}>
            <Search size={14} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#606060"}}/>
            <input className="search-input" placeholder="Buscar lançamentos..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
          <button className="btn-secondary" onClick={()=>setShowFiltros(true)}>
            <SlidersHorizontal size={14}/> Filtros
            {Object.values(filtros).some(Boolean) && (
              <span style={{background:"#22c55e",color:"#000",borderRadius:"50%",width:"16px",height:"16px",fontSize:"10px",fontWeight:"700",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {Object.values(filtros).filter(Boolean).length}
              </span>
            )}
          </button>
          <button className="btn-primary" onClick={()=>setShowEntrada(true)}>
            <Plus size={14}/> Nova entrada prevista
          </button>
          <button onClick={()=>setShowSaida(true)} style={{background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)",padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"}}>
            <Plus size={14}/> Nova saída prevista
          </button>
        </div>

        {loading ? (
          <div style={{textAlign:"center",color:"#606060",padding:"40px"}}>Carregando...</div>
        ) : !filtrados.length ? (
          <div style={{textAlign:"center",color:"#606060",padding:"48px"}}>Nenhuma conta encontrada.</div>
        ) : mesesOrdenados.map(chave => {
          const [ano, mes] = chave.split("-");
          const mesIdx = parseInt(mes) - 1;
          const items = porMes[chave];
          const entMes = items.filter(l=>l.tipo==="entrada"&&!l.pago).reduce((a,b)=>a+b.valor,0);
          const saiMes = items.filter(l=>l.tipo==="saida"&&!l.pago).reduce((a,b)=>a+b.valor,0);
          return (
            <div key={chave}>
              <div style={{padding:"12px 16px",background:"#0d0d0d",borderBottom:"1px solid #2e2e2e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:"14px",fontWeight:"600",color:"#f0f0f0"}}>{MESES_NOMES[mesIdx]} {ano}</span>
                <div style={{display:"flex",gap:"16px",fontSize:"12px"}}>
                  {entMes > 0 && <span style={{color:"#22c55e"}}>Entradas: {formatCurrency(entMes)}</span>}
                  {saiMes > 0 && <span style={{color:"#ef4444"}}>Saídas: {formatCurrency(saiMes)}</span>}
                  <span style={{color:entMes-saiMes>=0?"#29ABE2":"#f59e0b",fontWeight:"600"}}>Saldo: {formatCurrency(entMes - saiMes)}</span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{width:"30px"}}><input type="checkbox" style={{width:"14px",height:"14px"}}/></th>
                    <th style={{width:"30px"}}></th>
                    <th>CATEGORIA</th>
                    <th>CLIENTE/FORNECEDOR</th>
                    <th>VENCIMENTO</th>
                    <th>DESCRIÇÃO</th>
                    <th>VALOR</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(l=>(
                    <tr key={l.id}>
                      <td><input type="checkbox" style={{width:"14px",height:"14px"}}/></td>
                      <td>
                        {l.pago ? (
                          <span title="Lançado" style={{fontSize:"10px",background:"rgba(34,197,94,0.1)",color:"#22c55e",padding:"2px 6px",borderRadius:"4px"}}>✓</span>
                        ) : (
                          <span title="Pendente" style={{fontSize:"10px",background:"rgba(245,158,11,0.1)",color:"#f59e0b",padding:"2px 6px",borderRadius:"4px"}}>⏳</span>
                        )}
                      </td>
                      <td style={{color:"#a0a0a0",fontSize:"12px"}}>{l.categorias_financeiras?.nome||"—"}</td>
                      <td style={{fontWeight:"500"}}>{l.clientes?.nome||"—"}</td>
                      <td style={{color:"#a0a0a0"}}>{new Date(l.data_vencimento+"T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td style={{color:"#a0a0a0",fontSize:"12px"}}>{l.descricao||"—"}</td>
                      <td style={{color:l.tipo==="entrada"?"#22c55e":"#ef4444",fontWeight:"600"}}>
                        {formatCurrency(l.valor)}
                      </td>
                      <td>
                        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                          {!l.pago && (
                            <button
                              onClick={()=>setLancando({id:l.id,valor:l.valor,descricao:l.descricao})}
                              style={{display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"6px",border:"1px solid rgba(34,197,94,0.3)",background:"rgba(34,197,94,0.08)",color:"#22c55e",cursor:"pointer",fontSize:"12px"}}
                            >
                              <ExternalLink size={12}/> Lançar
                            </button>
                          )}
                          <button className="btn-secondary" style={{padding:"5px 10px",fontSize:"12px"}} onClick={()=>setEditando(l)}>
                            <Edit2 size={12}/> Editar
                          </button>
                          <button className="btn-danger" style={{padding:"5px 10px",fontSize:"12px"}}
                            onClick={async()=>{ if(confirm("Remover?")){ await removerLancamento(l.id); refresh(); }}}>
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {showEntrada && <ModalEntrada onClose={()=>setShowEntrada(false)} onSave={handleSalvar} clientes={clientes?.map(c=>({id:c.id,nome:c.nome}))||[]}/>}
      {showSaida && <ModalSaida onClose={()=>setShowSaida(false)} onSave={handleSalvar}/>}
      {editando && editando.tipo==="entrada" && <ModalEntrada item={editando} onClose={()=>setEditando(null)} onSave={handleSalvar} clientes={clientes?.map(c=>({id:c.id,nome:c.nome}))||[]}/>}
      {editando && editando.tipo==="saida" && <ModalSaida item={editando} onClose={()=>setEditando(null)} onSave={handleSalvar}/>}
      {lancando && <ModalLancar item={lancando} onClose={()=>setLancando(null)} onSave={handleLancar}/>}
      {showFiltros && <PainelFiltros onClose={()=>setShowFiltros(false)} onFiltrar={setFiltros}/>}
    </div>
  );
}
