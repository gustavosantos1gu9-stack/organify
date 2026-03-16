"use client";

import { useState, useRef, useEffect } from "react";
import { Filter, X, Check } from "lucide-react";

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
  const ref = useRef<HTMLDivElement>(null);

  const totalAtivos = Object.values(valores).filter((v) => v && v !== "").length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className="btn-secondary"
        onClick={() => setAberto(!aberto)}
        style={{ position: "relative", background: totalAtivos > 0 ? "rgba(34,197,94,0.1)" : undefined, borderColor: totalAtivos > 0 ? "#22c55e44" : undefined, color: totalAtivos > 0 ? "#22c55e" : undefined }}
      >
        <Filter size={14} />
        Filtros
        {totalAtivos > 0 && (
          <span style={{ background: "#22c55e", color: "#000", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "2px" }}>
            {totalAtivos}
          </span>
        )}
      </button>

      {aberto && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 100,
          background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: "12px",
          padding: "16px", minWidth: "280px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>Filtros</span>
            {totalAtivos > 0 && (
              <button onClick={() => { onLimpar(); }} className="btn-ghost" style={{ fontSize: "12px", padding: "4px 8px", color: "#ef4444" }}>
                <X size={12} /> Limpar tudo
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {grupos.map((grupo) => (
              <div key={grupo.key}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#606060", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  {grupo.label}
                </label>
                {grupo.tipo === "date-range" ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input type="date" className="form-input" style={{ flex: 1, fontSize: "12px", padding: "6px 8px" }}
                      value={valores[`${grupo.key}_de`] || ""}
                      onChange={(e) => onChange(`${grupo.key}_de`, e.target.value)}/>
                    <span style={{ color: "#606060", fontSize: "12px" }}>até</span>
                    <input type="date" className="form-input" style={{ flex: 1, fontSize: "12px", padding: "6px 8px" }}
                      value={valores[`${grupo.key}_ate`] || ""}
                      onChange={(e) => onChange(`${grupo.key}_ate`, e.target.value)}/>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {grupo.opcoes.map((opcao) => {
                      const ativo = valores[grupo.key] === opcao.value;
                      return (
                        <button key={opcao.value}
                          onClick={() => onChange(grupo.key, ativo ? "" : opcao.value)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 10px", borderRadius: "6px", cursor: "pointer", border: "none",
                            background: ativo ? "rgba(34,197,94,0.1)" : "transparent",
                            color: ativo ? "#22c55e" : "#a0a0a0",
                            fontSize: "13px", textAlign: "left", width: "100%",
                            transition: "all 0.1s",
                          }}
                        >
                          <span>{opcao.label}</span>
                          {ativo && <Check size={13}/>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "16px" }}
            onClick={() => setAberto(false)}>
            Aplicar filtros
          </button>
        </div>
      )}
    </div>
  );
}
