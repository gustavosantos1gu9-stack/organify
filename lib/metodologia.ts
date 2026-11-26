// Metodologia Salx em código: fases, faixas, gargalo, próximo passo e cenário de tráfego.
// Usa os custos ideais de CADA cliente (variam por região, potencial e know-how).

export const FASES = [
  { v: "onboarding", label: "Onboarding", ordem: 0, cor: "#8CC6EC" },
  { v: "etapa0", label: "Fase 0", ordem: 1, cor: "#B42318" },
  { v: "etapa1", label: "Fase 1", ordem: 2, cor: "#C2620E" },
  { v: "etapa2", label: "Fase 2", ordem: 3, cor: "#B7791F" },
  { v: "etapa3", label: "Fase 3", ordem: 4, cor: "#1C6CA6" },
  { v: "etapa4", label: "Fase 4", ordem: 5, cor: "#1E6B52" },
  { v: "resultado_oscilando", label: "Oscilando", ordem: 3.5, cor: "#6B4FC8" },
] as const;
export const faseLabel = (v?: string | null) => FASES.find(f => f.v === v)?.label || "Sem fase";
export const faseCor = (v?: string | null) => FASES.find(f => f.v === v)?.cor || "#7E93A8";
export const faseOrdem = (v?: string | null) => FASES.find(f => f.v === v)?.ordem ?? -1;

export const ONBOARDING_ITENS = [
  { k: "grupo", label: "Grupo criado com boas-vindas" },
  { k: "drive", label: "Drive enviado (pelo foco da cliente)" },
  { k: "link_bio", label: "Link de edição na bio" },
  { k: "videos", label: "3 vídeos gravados" },
  { k: "edicao", label: "Vídeos editados" },
  { k: "reuniao", label: "Primeira reunião feita" },
  { k: "pdf", label: "PDF de atendimento enviado" },
  { k: "acessos", label: "Acessos Meta liberados" },
  { k: "conta_central", label: "Conta passada para a central" },
] as const;

export const PILARES = [
  { k: "resposta", label: "Resposta", dica: "Responder os contatos em até 5 minutos no horário comercial." },
  { k: "atendimento", label: "Atendimento", dica: "Seguir o roteiro do PDF e sempre terminar a mensagem com uma pergunta." },
  { k: "conteudo", label: "Conteúdo", dica: "Gravar vídeos novos a cada 15 dias para o anúncio não cansar." },
  { k: "dados", label: "Dados", dica: "Preencher agendamentos, comparecimentos e vendas toda semana." },
  { k: "venda", label: "Venda presencial", dica: "Apresentar pacotes e combos na avaliação, com prazo para fechar." },
] as const;

export const FAIXAS_PADRAO = {
  taxaAgendMin: 8,        // %  abaixo: ruim
  taxaAgendBoa: 10,       // %  acima: boa
  taxaAgendMuitoBoa: 15,  // %  (a definir pelo Gustavo — editável)
  comparecMin: 50,
  conversaoMin: 50,
  conversaoMinTicketAlto: 40,
  ticketAlto: 600,
  ticketMin: 500,
  loteMinimo: 30,
  custoMsgPadrao: 7,      // R$ — usado só se a cliente não tiver o próprio
  custoAgendPadrao: 150,  // R$ — usado só se a cliente não tiver o próprio
};
export type Faixas = typeof FAIXAS_PADRAO;

export interface Ideais {
  custo_msg_ideal?: number | null;
  custo_lead_ideal?: number | null;
  custo_agend_ideal?: number | null;
  cpa_ideal?: number | null;
  ticket_medio?: number | null;
  tipo_contato?: string | null;   // "mensagem" ou "lead" (vem da Meta)
}

export interface Numeros {
  semanas: number;
  investimento: number;     // R$ no período (0 = não registrado)
  contatos: number;         // mensagens/leads
  agendamentos: number;
  comparecimentos: number;
  vendas: number;
  faturamento: number;
}

export function somar(linhas: any[]): Numeros {
  const n: Numeros = { semanas: linhas.length, investimento: 0, contatos: 0, agendamentos: 0, comparecimentos: 0, vendas: 0, faturamento: 0 };
  for (const l of linhas) {
    n.investimento += Number(l.investimento) || 0;
    n.contatos += Number(l.mensagens) || 0;
    n.agendamentos += Number(l.agendamentos) || 0;
    n.comparecimentos += Number(l.comparecimentos) || 0;
    n.vendas += Number(l.vendas) || 0;
    n.faturamento += Number(l.faturamento) || 0;
  }
  return n;
}

export interface Taxas {
  custoContato: number | null;
  custoAgend: number | null;
  cpa: number | null;
  taxaAgend: number | null;
  comparec: number | null;
  conversao: number | null;
  ticket: number | null;
}
export function taxas(n: Numeros): Taxas {
  const d = (a: number, b: number) => (b > 0 ? a / b : null);
  return {
    custoContato: n.investimento > 0 ? d(n.investimento, n.contatos) : null,
    custoAgend: n.investimento > 0 ? d(n.investimento, n.agendamentos) : null,
    cpa: n.investimento > 0 ? d(n.investimento, n.vendas) : null,
    taxaAgend: n.contatos > 0 ? (n.agendamentos / n.contatos) * 100 : null,
    comparec: n.agendamentos > 0 ? (n.comparecimentos / n.agendamentos) * 100 : null,
    conversao: n.comparecimentos > 0 ? (n.vendas / n.comparecimentos) * 100 : null,
    ticket: n.vendas > 0 && n.faturamento > 0 ? n.faturamento / n.vendas : null,
  };
}

/** Custo ideal de contato: o de mensagem, ou o de lead se a cliente trabalha com cadastro. */
export function idealContato(i: Ideais, f: Faixas) {
  if (i.tipo_contato === "lead") return i.custo_lead_ideal || i.custo_msg_ideal || f.custoMsgPadrao;
  return i.custo_msg_ideal || i.custo_lead_ideal || f.custoMsgPadrao;
}
export function idealAgend(i: Ideais, f: Faixas) {
  return i.custo_agend_ideal || f.custoAgendPadrao;
}

export type Tom = "ok" | "atencao" | "ruim" | "sem";
export function tomCusto(valor: number | null, ideal: number): Tom {
  if (valor === null) return "sem";
  if (valor <= ideal) return "ok";
  if (valor <= ideal * 1.25) return "atencao";
  return "ruim";
}
export function tomTaxa(valor: number | null, min: number, boa?: number): Tom {
  if (valor === null) return "sem";
  if (valor < min) return "ruim";
  if (boa !== undefined && valor < boa) return "atencao";
  return "ok";
}

/** Fase sugerida pelos números da cliente + onboarding. */
export function sugerirFase(args: {
  onboardingCompleto: boolean;
  temCampanha: boolean;
  atual: Numeros;
  anterior: Numeros;
  ideais: Ideais;
  faixas: Faixas;
  faseConfirmada?: string | null;
}): { fase: string; motivo: string } {
  const { atual, anterior, ideais, faixas: f, faseConfirmada } = args;
  if (!args.onboardingCompleto && (!args.temCampanha || atual.contatos === 0)) {
    return { fase: "onboarding", motivo: "Onboarding ainda não terminou." };
  }
  const t = taxas(atual);
  const tAnt = taxas(anterior);
  const iCont = idealContato(ideais, f);
  const iAg = idealAgend(ideais, f);

  if (atual.contatos === 0) return { fase: "etapa0", motivo: "Sem contatos registrados no período." };
  if (t.custoContato !== null && t.custoContato > iCont) {
    return { fase: "etapa0", motivo: `Custo por contato R$ ${t.custoContato.toFixed(2)} acima do ideal desta cliente (R$ ${iCont.toFixed(2)}).` };
  }
  if (atual.contatos < f.loteMinimo) {
    return { fase: "etapa1", motivo: `Custo de contato bom; aguardando ${f.loteMinimo - atual.contatos} contatos para validar agendamento.` };
  }
  const agendRuim = (t.taxaAgend !== null && t.taxaAgend < f.taxaAgendMin) || (t.custoAgend !== null && t.custoAgend > iAg);
  if (agendRuim) {
    // estava bem antes e caiu → oscilando
    const antBom = anterior.contatos >= f.loteMinimo && tAnt.taxaAgend !== null && tAnt.taxaAgend >= f.taxaAgendMin &&
      (tAnt.custoAgend === null || tAnt.custoAgend <= iAg);
    if (antBom && faseOrdem(faseConfirmada) >= faseOrdem("etapa3")) {
      return { fase: "resultado_oscilando", motivo: "Agendamento estava bom no período anterior e caiu agora." };
    }
    return { fase: "etapa2", motivo: t.custoAgend !== null && t.custoAgend > iAg
      ? `Custo por agendamento R$ ${t.custoAgend.toFixed(2)} acima do ideal desta cliente (R$ ${iAg.toFixed(2)}).`
      : `Taxa de agendamento ${t.taxaAgend?.toFixed(1)}% abaixo de ${f.taxaAgendMin}%.` };
  }
  const ticketAlto = (t.ticket ?? ideais.ticket_medio ?? 0) > f.ticketAlto;
  const convMin = ticketAlto ? f.conversaoMinTicketAlto : f.conversaoMin;
  const vendaBoa = t.comparec !== null && t.comparec >= f.comparecMin && t.conversao !== null && t.conversao >= convMin;
  if (vendaBoa) return { fase: "etapa4", motivo: "Agendamento, comparecimento e conversão na faixa: pronta para escalar (com a permissão da cliente)." };
  return { fase: "etapa3", motivo: "Agendamento com bom custo; falta validar comparecimento e conversão." };
}

/** Primeiro gargalo do funil e o próximo passo, na ordem da metodologia. */
export function diagnosticar(args: { atual: Numeros; ideais: Ideais; faixas: Faixas; avaliacaoGratuita?: boolean | null; ultimoTipo?: string | null }) {
  const { atual, ideais, faixas: f } = args;
  const t = taxas(atual);
  const iCont = idealContato(ideais, f);
  const iAg = idealAgend(ideais, f);
  if (atual.contatos < f.loteMinimo) {
    return { gargalo: "Lote mínimo", passo: `Aguardando ${f.loteMinimo - atual.contatos} contatos antes de julgar as taxas. Foco agora: custo por contato.`, area: "trafego" };
  }
  if (t.custoContato !== null && t.custoContato > iCont) {
    return { gargalo: "Custo por contato", passo: "Seguir o cenário de tráfego indicado abaixo (criativos e público).", area: "trafego" };
  }
  if (t.taxaAgend !== null && t.taxaAgend < f.taxaAgendMin) {
    // ordem: atendimento → preço/cobrança → público
    if (args.avaliacaoGratuita === false) {
      return { gargalo: "Taxa de agendamento", passo: "Avaliação está sendo cobrada: deixar a avaliação gratuita (regra fixa da metodologia).", area: "oferta" };
    }
    if (args.ultimoTipo === "atendimento") {
      return { gargalo: "Taxa de agendamento", passo: "Atendimento já ajustado: revisar preço e forma de apresentar o valor. Reavaliar com mais 20 contatos.", area: "oferta" };
    }
    if (args.ultimoTipo === "preco_oferta") {
      return { gargalo: "Taxa de agendamento", passo: "Atendimento e oferta já ajustados: CS confirma e o gestor otimiza o público.", area: "publico" };
    }
    return { gargalo: "Taxa de agendamento", passo: "CS analisa as conversas e ajusta o atendimento primeiro. Reavaliar com mais 20 contatos.", area: "atendimento" };
  }
  if (t.custoAgend !== null && t.custoAgend > iAg) {
    return { gargalo: "Custo por agendamento", passo: "Taxa ok, custo alto: baixar o custo por contato (cenário de tráfego) sem mexer no atendimento.", area: "trafego" };
  }
  if (t.comparec !== null && t.comparec < f.comparecMin) {
    return { gargalo: "Comparecimento", passo: "Fazer 2 confirmações antes do dia e revisar se há cobrança no agendamento.", area: "atendimento" };
  }
  const ticketAlto = (t.ticket ?? ideais.ticket_medio ?? 0) > f.ticketAlto;
  const convMin = ticketAlto ? f.conversaoMinTicketAlto : f.conversaoMin;
  if (t.conversao !== null && t.conversao < convMin) {
    return { gargalo: "Conversão no presencial", passo: "Revisar oferta, pacotes e combos da avaliação (sem prometer número de sessões).", area: "oferta" };
  }
  if (t.ticket !== null && t.ticket < f.ticketMin) {
    return { gargalo: "Ticket médio", passo: "Ticket abaixo de R$ 500: montar pacotes e combos.", area: "oferta" };
  }
  if (t.comparec === null || t.conversao === null) {
    return { gargalo: "Dados de venda", passo: "Faltam comparecimentos e vendas preenchidos para avaliar o presencial.", area: "dados" };
  }
  return { gargalo: "Nenhum", passo: "Todas as taxas na faixa: propor aumento de verba com a permissão da cliente.", area: "escala" };
}

/** Cenário do fluxograma do gestor (A a E). */
export function cenarioTrafego(args: { atual: Numeros; ideais: Ideais; faixas: Faixas; diasCampanha: number | null }) {
  const { atual, ideais, faixas: f, diasCampanha } = args;
  const t = taxas(atual);
  const iCont = idealContato(ideais, f);
  const custoAlto = t.custoContato !== null && t.custoContato > iCont;
  if (custoAlto && (diasCampanha === null || diasCampanha <= 30)) {
    return { c: "A", titulo: "Campanha nova, custo alto", acao: "Deixar os criativos rodarem até 2x o CPA ideal; nenhum bateu → analisar CTR, cliques, CPC e CPM; reeditar ou pedir vídeo cru; ampliar público (Advantage+); se não melhorar, pedir criativos novos." };
  }
  if (custoAlto) {
    return { c: "C", titulo: "Cliente antiga, custo subiu", acao: "Duplicar o criativo de melhor resultado; esperar ~3 dias; duplicar o público; duplicar a campanha; criativo saturou → pedir novos." };
  }
  if (atual.contatos >= f.loteMinimo && atual.agendamentos === 0 && t.custoContato !== null && t.custoContato >= 3) {
    return { c: "D", titulo: "Muitas mensagens, não fecha", acao: "Diminuir público; tirar Facebook e deixar só Instagram; reduzir faixa etária (ex.: até 45 anos)." };
  }
  if (atual.contatos >= f.loteMinimo && t.taxaAgend !== null && t.taxaAgend < f.taxaAgendMin) {
    return { c: "E", titulo: "Custo bom, não agenda", acao: "Ler o motivo nas conversas: sem resposta → cenário D; público de longe → diminuir o raio ou desligar Advantage+; motivo financeiro → esperar 30+ mensagens ou custo por agendamento acima do ideal e ir para o D." };
  }
  return { c: "—", titulo: "Sem ação de tráfego agora", acao: "Custo dentro do ideal da cliente. Se ela disser que recebe pouco: cenário B (avisar a Lavínia e conferir a coluna Novas Mensagens)." };
}

export const INSTRUCOES_PADRAO = `Você é a assistente da Salx Digital, assessoria de tráfego para profissionais de micropigmentação, laser e regeneração.
Metodologia: tráfego (Meta Ads) + perfil do Instagram + atendimento no WhatsApp, fechando com uma boa oferta no presencial.
Objetivo principal: bom custo por agendamento, com comparecimento e conversão saudáveis; depois escalar mantendo as taxas.
Regras fixas: mudar uma coisa por vez; só julgar uma taxa com o lote mínimo de contatos; ordem de diagnóstico: atendimento → preço e oferta → público; avaliação sempre gratuita; 2 confirmações antes do agendamento; nunca prometer número de sessões em pacotes; só sugerir aumento de verba com taxas na faixa boa e permissão da profissional.
Tom com a cliente: parceria, explicar o porquê com os números dela, dizer o próximo passo e o prazo para reavaliar. Frases curtas, sem travessão.`;
