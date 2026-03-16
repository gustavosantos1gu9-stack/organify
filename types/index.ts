export type TipoPessoa = "fisica" | "juridica";
export type StatusCliente = "ativo" | "inadimplente" | "cancelado";
export type EtapaLead =
  | "novo"
  | "em_contato"
  | "reuniao_agendada"
  | "proposta_enviada"
  | "ganho"
  | "perdido";
export type TipoMovimentacao = "entrada" | "saida";
export type TipoRecorrencia = "mensal" | "trimestral" | "semestral" | "anual";

export interface Agencia {
  id: string;
  nome: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  logo_url?: string;
  cep?: string;
  estado?: string;
  cidade?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  created_at: string;
}

export interface Cliente {
  id: string;
  agencia_id: string;
  tipo: TipoPessoa;
  nome: string;
  documento?: string;
  email?: string;
  telefone?: string;
  whatsapp?: boolean;
  instagram?: string;
  empresa?: string;
  valor_oportunidade?: number;
  faturamento?: number;
  status: StatusCliente;
  responsavel_id?: string;
  origem_id?: string;
  categorias?: string[];
  observacoes?: string;
  cep?: string;
  estado?: string;
  cidade?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  // UTM tracking
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  agencia_id: string;
  nome: string;
  email?: string;
  telefone?: string;
  whatsapp?: boolean;
  etapa: EtapaLead;
  valor?: number;
  responsavel_id?: string;
  origem_id?: string;
  // UTM tracking
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string; // público
  utm_term?: string;    // anúncio
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface Movimentacao {
  id: string;
  agencia_id: string;
  tipo: TipoMovimentacao;
  descricao: string;
  valor: number;
  data: string;
  categoria_id?: string;
  cliente_id?: string;
  conta_bancaria_id?: string;
  comprovante_url?: string;
  observacoes?: string;
  created_at: string;
}

export interface LancamentoFuturo {
  id: string;
  agencia_id: string;
  tipo: TipoMovimentacao;
  descricao: string;
  valor: number;
  data_vencimento: string;
  categoria_id?: string;
  cliente_id?: string;
  pago: boolean;
  created_at: string;
}

export interface Recorrencia {
  id: string;
  agencia_id: string;
  tipo: TipoMovimentacao;
  descricao: string;
  valor: number;
  periodicidade: TipoRecorrencia;
  dia_vencimento: number;
  categoria_id?: string;
  cliente_id?: string;
  ativo: boolean;
  created_at: string;
}

export interface Origem {
  id: string;
  agencia_id: string;
  nome: string;
  ativo: boolean;
}

export interface Categoria {
  id: string;
  agencia_id: string;
  nome: string;
}

export interface CategoriaFinanceira {
  id: string;
  agencia_id: string;
  nome: string;
  tipo: TipoMovimentacao;
}

export interface KPI {
  label: string;
  value: string | number;
  change?: number;
  icon?: string;
  color?: "green" | "red" | "neutral";
}
