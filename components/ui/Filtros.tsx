"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal, X, Check } from "lucide-react";

interface FiltroOpcao {
  label: string;
  value: string;
}

interface FiltroGrupo {
  label: string;
  key: string;
  opcoes: FiltroOpcao[];
  tipo?: "select" | "date-range";
}

interface FiltrosProps {
  grupos: FiltroGrupo[];
  valores: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onLimpar: () => void;
}

export default function Filtros({ grupos, valores, onChange, onLimpar }: FiltrosProps) {
  const [aberto, setAberto] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>(valores);

  useEffect(() => { setLocal(valores); }, [valores]);

  const totalAtivos = Object.values(valores).filter(v => v && v !== "").length;

  const handleFiltrar = () => {
    Object.entries(local).forEach(([k, v]) => onChange(k, v));
    setAberto(false);
  };

  const handleLimpar = () => {
    setLocal({});
    onLimpar();
  };

  const setLocal_ = (k: string, v: string) => setLocal(f => ({ ...f, [k]: v }));

  return (
    <>
      <button
        className="btn-secondary"
        onClick={() => setAberto(true)}
        style={{
          background: totalAtivos > 0 ? "rgba(34,197,94,0.1)" : undefined,
          borderColor: totalAtivos > 0 ? "#22c55e44" : undefined,
          color: totalAtivos > 0 ? "#22c55e" : undefined,
        }}
      >
        <SlidersHorizontal size={14}/>
        Filtros
        {totalAtivos > 0 && (
          <span style={{ background:"#22c55e", color:"#000", borderRadius:"50%", width:"16px", height:"16px", fontSize:"10px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {totalAtivos}
          </span>
        )}
      </button>

      {/* Overlay */}
      {aberto && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:199 }}
          onClick={() => setAberto(false)}
        />
      )}

      {/* Painel lateral */}
      <div style={{
        position: "fixed",
        top: 0,
        right: aberto ? 0 : "-420px",
        width: "380px",
        height: "100vh",
        background: "#111",
        borderLeft: "1px solid #2e2e2e",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        transition: "right 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 24px", borderBottom:"1px solid #2e2e2e" }}>
          <h3 style={{ fontSize:"16px", fontWeight:"600" }}>Filtros</h3>
          <button onClick={() => setAberto(false)} className="btn-ghost" style={{ padding:"6px", cursor:"pointer" }}>
            <X size={16}/>
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, padding:"24px", display:"flex", flexDirection:"column", gap:"20px", overflowY:"auto" }}>
          {grupos.map((grupo) => (
            <div key={grupo.key}>
              <label style={{ fontSize:"11px", fontWeight:"600", color:"#606060", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:"8px" }}>
                {grupo.label}
              </label>

              {grupo.tipo === "date-range" ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                  <div>
                    <label style={{ fontSize:"11px", color:"#606060", display:"block", marginBottom:"4px" }}>De</label>
                    <input type="date" className="form-input"
                      value={local[`${grupo.key}_de`] || ""}
                      onChange={e => setLocal_(`${grupo.key}_de`, e.target.value)}/>
                  </div>
                  <div>
                    <label style={{ fontSize:"11px", color:"#606060", display:"block", marginBottom:"4px" }}>Até</label>
                    <input type="date" className="form-input"
                      value={local[`${grupo.key}_ate`] || ""}
                      onChange={e => setLocal_(`${grupo.key}_ate`, e.target.value)}/>
                  </div>
                </div>
              ) : (
                <select
                  className="form-input"
                  value={local[grupo.key] || ""}
                  onChange={e => setLocal_(grupo.key, e.target.value)}
                >
                  <option value="">Selecione</option>
                  {grupo.opcoes.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:"20px 24px", borderTop:"1px solid #2e2e2e", display:"flex", gap:"8px" }}>
          <button className="btn-secondary" style={{ flex:1, justifyContent:"center", cursor:"pointer" }} onClick={handleLimpar}>
            Limpar
          </button>
          <button className="btn-primary" style={{ flex:1, justifyContent:"center", cursor:"pointer" }} onClick={handleFiltrar}>
            Filtrar
          </button>
        </div>
      </div>
    </>
  );
}
