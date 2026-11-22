"use client";

import Link from "next/link";
import { Tags, MapPin, Truck, Landmark, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

// Cadastros de apoio reunidos numa tela só
const GRUPOS = [
  {
    titulo: "Clientes",
    itens: [
      { href: "/configuracoes/clientes/categorias", label: "Categorias de clientes", desc: "Como você agrupa as clientes", icone: <Tags size={18} /> },
      { href: "/configuracoes/clientes/origens", label: "Origens de clientes", desc: "De onde cada cliente veio", icone: <MapPin size={18} /> },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/configuracoes/financeiro/categorias-entrada", label: "Categorias de entrada", desc: "Tipos de receita", icone: <ArrowDownToLine size={18} /> },
      { href: "/configuracoes/financeiro/categorias-saida", label: "Categorias de saída", desc: "Tipos de despesa", icone: <ArrowUpFromLine size={18} /> },
      { href: "/configuracoes/financeiro/contas-bancarias", label: "Contas bancárias", desc: "Onde o dinheiro entra e sai", icone: <Landmark size={18} /> },
      { href: "/configuracoes/fornecedores", label: "Fornecedores", desc: "Quem recebe os pagamentos", icone: <Truck size={18} /> },
    ],
  },
];

export default function CadastrosAuxiliaresPage() {
  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {GRUPOS.map((g) => (
        <section key={g.titulo} className="cartao" style={{ marginBottom: 0 }}>
          <div className="cartao-head"><h2 className="cartao-title">{g.titulo}</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {g.itens.map((i) => (
              <Link key={i.href} href={i.href} className="aux-item lift">
                <span className="aux-ico">{i.icone}</span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{i.label}</span>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{i.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
