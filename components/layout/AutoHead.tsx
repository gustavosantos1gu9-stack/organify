"use client";

import { usePathname } from "next/navigation";

// Cabeçalho do canvas por rota: linha de contexto, título e destaque em itálico.
// O título antigo de cada página fica escondido quando este cabeçalho aparece.
const CABECALHOS: Record<string, [string, string, string]> = {
  "/inicio": ["Gestão · visão geral", "Financeiro", "do mês"],
  "/financeiro": ["Gestão · visão geral", "Financeiro", "do mês"],
  "/churn": ["Clientes · histórico de saídas", "Churn", "de clientes"],
  "/configuracoes/cadastros-auxiliares": ["Gestão · categorias, origens, contas e fornecedores", "Cadastros", "auxiliares"],
  "/uti": ["Clientes · custo alto, em recuperação", "UTI", "de clientes"],
  "/cadastros": ["Clientes · formulários enviados pelo link público", "Cadastros", "de clientes"],
  "/gerador-de-leads": ["Clientes · histórico de saídas", "Churn", "de clientes"],
  "/escala-ester": ["Escalas · controle mensal de clientes", "Escala", "da Carol"],
  "/escala-nicolas": ["Escalas · controle mensal de clientes", "Escala", "do Nicolas"],
  "/escala-lavinia": ["Escalas · controle mensal de clientes", "Escala", "da Lavínia"],
  "/inbox": ["Atendimento · conversas do WhatsApp", "Inbox", "de conversas"],
  "/inbox/dashboard": ["Atendimento · números das conversas", "Painel", "de conversas"],
  "/crm": ["Atendimento · jornada de compra", "CRM", "de leads"],
  "/crm/dashboard": ["Atendimento · números do CRM", "Painel", "do CRM"],
  "/jornada": ["Atendimento · etapas que disparam eventos para a Meta", "Jornada", "de compra"],
  "/funis": ["Atendimento · sequências automáticas de mensagens", "Funis", "de mensagens"],
  "/reunioes": ["Clientes · reuniões marcadas com as clientes", "Reuniões", "agendadas"],
  "/reunioes-vendas": ["Atendimento · SDR", "Reuniões", "de vendas"],
  "/secretaria-ia": ["Atendimento · atendente virtual no WhatsApp", "Secretária", "IA"],
  "/performance": ["Tráfego · campanhas, agendamentos e resultados", "Performance", "do mês"],
  "/relatorios-meta": ["Tráfego · envio automático nos grupos das clientes", "Relatórios", "Meta"],
  "/relatorios-meta/alertas": ["Tráfego · saldo e erros de pagamento, com aviso no grupo", "Alertas", "de contas"],
  "/relatorios-meta/conexoes": ["Tráfego · contas ligadas à plataforma", "Conexões", "da agência"],
  "/mensagens-rastreaveis": ["Tráfego · mensagens que chegaram com dados de campanha", "Mensagens", "rastreáveis"],
  "/formularios": ["Tráfego · formulários de qualificação com rastreio", "Formulários", "da agência"],
  "/ferramentas/gerador-links": ["Tráfego · links com rastreio para as campanhas", "Links", "de campanha"],
  "/ferramentas/campanhas": ["Tráfego · configuração das campanhas", "Configurar", "campanha"],
  "/disparos-pixel": ["Tráfego · eventos enviados para a Meta", "Disparos", "de Pixel"],
  "/disparos-webhook": ["Tráfego · avisos para outros sistemas em tempo real", "Disparos", "de Webhook"],
  "/financeiro/movimentacoes": ["Gestão · entradas e saídas", "Movimentações", "do caixa"],
  "/financeiro/lancamentos-futuros": ["Gestão · o que ainda vai entrar e sair", "Lançamentos", "futuros"],
  "/financeiro/recorrencias": ["Gestão · cobranças e despesas que se repetem", "Recorrências", "do financeiro"],
  "/dre": ["Gestão · resultado do período", "DRE", "do período"],
  "/clientes": ["Gestão · contratos e cobrança", "Clientes", "do financeiro"],
  "/financas": ["Gestão · finanças pessoais", "Finanças", "pessoais"],
  "/ferramentas/clientes": ["Gestão · formulários e LPs para clientes de fora da carteira", "Clientes", "externos"],
  "/ferramentas/lp": ["Gestão · páginas para clientes externos", "Landing", "pages"],
  "/ferramentas/configuracoes": ["Gestão · ferramentas", "Configurações", "das ferramentas"],
  "/clientes-saas": ["Gestão · agências que usam a plataforma", "Clientes", "SaaS"],
  "/configuracoes/integracoes": ["Gestão · conexões da agência", "Integrações", "da agência"],
  "/configuracoes/whatsapp-contas": ["Gestão · todas as contas, do master e das filhas", "Contas", "de WhatsApp"],
  "/configuracoes/whatsapp-status": ["Gestão · monitor das instâncias", "Status", "do WhatsApp"],
  "/configuracoes/times": ["Gestão · o que cada time enxerga na plataforma", "Times", "e permissões"],
  "/configuracoes/usuarios": ["Gestão · quem acessa a plataforma", "Usuários", "da agência"],
  "/configuracoes/agencia": ["Gestão · dados da agência", "Configurações", "da agência"],
  "/configuracoes/fornecedores": ["Gestão · cadastros", "Fornecedores", "da agência"],
  "/configuracoes/financeiro/categorias-entrada": ["Gestão · cadastros do financeiro", "Categorias", "de entrada"],
  "/configuracoes/financeiro/categorias-saida": ["Gestão · cadastros do financeiro", "Categorias", "de saída"],
  "/configuracoes/financeiro/contas-bancarias": ["Gestão · cadastros do financeiro", "Contas", "bancárias"],
  "/configuracoes/clientes/categorias": ["Gestão · cadastros de clientes", "Categorias", "de clientes"],
  "/configuracoes/clientes/origens": ["Gestão · cadastros de clientes", "Origens", "de clientes"],
  "/perfil": ["Conta · seus dados de acesso", "Seu", "perfil"],
};

export default function AutoHead() {
  const pathname = usePathname() || "";
  const c = CABECALHOS[pathname];
  if (!c) return null;
  const [contexto, titulo, destaque] = c;
  return (
    <header className="pg-head auto-head">
      <div className="pg-head-txt">
        <span className="pg-ctx">{contexto}</span>
        <h1 className="pg-title">{titulo} <span className="font-serif-accent pg-accent">{destaque}</span></h1>
      </div>
    </header>
  );
}
