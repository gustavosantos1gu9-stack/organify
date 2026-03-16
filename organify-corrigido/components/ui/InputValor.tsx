"use client";

interface InputValorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
}

export function formatarValorBR(valor: string): string {
  // Remove tudo que não é número
  const nums = valor.replace(/\D/g, "");
  if (!nums) return "";
  // Converte para centavos
  const centavos = parseInt(nums, 10);
  // Formata como moeda brasileira
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parsearValorBR(valor: string): number {
  const nums = valor.replace(/\D/g, "");
  if (!nums) return 0;
  return parseInt(nums, 10) / 100;
}

export default function InputValor({ value, onChange, placeholder = "R$ 0,00", className, style, readOnly }: InputValorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { onChange(""); return; }
    const centavos = parseInt(raw, 10);
    const formatado = (centavos / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    onChange(formatado);
  };

  return (
    <input
      className={className || "form-input"}
      style={style}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      readOnly={readOnly}
      inputMode="numeric"
    />
  );
}
