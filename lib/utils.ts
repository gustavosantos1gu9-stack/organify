export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}

export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getChangeColor(change: number): string {
  if (change > 0) return "text-accent-green";
  if (change < 0) return "text-red-500";
  return "text-text-secondary";
}

export function getChangeLabel(change: number): string {
  if (change > 0) return `+${change.toFixed(1)}%`;
  if (change < 0) return `${change.toFixed(1)}%`;
  return "0%";
}

export const ETAPAS_LEAD = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "reuniao_agendada", label: "Reunião agendada" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
];

export const ORIGENS_PADRAO = [
  "Facebook",
  "Instagram",
  "Google",
  "LinkedIn",
  "Indicação",
  "Outro",
];
