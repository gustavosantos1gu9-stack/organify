// Regras do "contato real" e do "público qualificado" (definidas pelo Gustavo, 27/11/2026).
// Tudo aqui é cálculo puro, sem banco: fácil de conferir e de testar.
//
// PÚBLICO = conjunto de anúncios, identificado pelo ID do Meta (nomes parecidos não se misturam).
//
// CLASSIFICAÇÃO DE CADA CONTATO que chegou pelo anúncio:
//   - "desenvolveu": a pessoa mandou mensagem DEPOIS da nossa primeira resposta.
//   - "nao_desenvolveu": não respondeu depois da nossa primeira resposta, já recebeu 2 follow-ups
//      e passaram 24h do 2º follow-up.
//   - "aberto": ainda dentro desse prazo (fica fora da conta da taxa).
//   - "sem_resposta": nunca respondemos a pessoa (problema de atendimento, fica fora da taxa).
//   "Toque" = um bloco de mensagens nossas; mensagens com menos de 60 min entre si são o mesmo toque
//   (a IA costuma mandar 2 ou 3 balões seguidos). Toque 1 = resposta; toques 2 e 3 = follow-ups.
//
// TAXA DE QUALIFICAÇÃO = desenvolveram ÷ (desenvolveram + não desenvolveram).
//   Qualificado: ≥ 50%. Só avalia com pelo menos 10 contatos fechados.
//
// TEMPO DE 1ª RESPOSTA: só leads do Meta, só minutos de horário comercial
//   (segunda a sexta, 9h às 18h, horário de Brasília). Mensagem fora do horário começa a contar
//   na abertura seguinte. Usa a mediana (um caso extremo não distorce).

export type Msg = { de_mim: boolean; created_at: string; enviada_por_ia?: boolean | null };
export type Classe = "desenvolveu" | "nao_desenvolveu" | "aberto" | "sem_resposta";

const MIN = 60_000;
const GAP_TOQUE_MIN = 60;
const PRAZO_APOS_2FU_H = 24;
export const LOTE_MINIMO = 10;
export const TAXA_QUALIFICADO = 0.5;

// Horário de Brasília sem horário de verão (UTC-3)
const BRT = 3 * 60 * MIN;
const ABRE = 9 * 60;   // 9:00 em minutos do dia
const FECHA = 18 * 60; // 18:00

/** Minutos de horário comercial (seg–sex, 9h–18h BRT) entre dois instantes. */
export function minutosComerciais(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0;
  let total = 0;
  // percorre dia a dia em horário de Brasília
  let t = inicio.getTime() - BRT;
  const tFim = fim.getTime() - BRT;
  while (t < tFim) {
    const d = new Date(t);
    const meiaNoite = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const proxDia = meiaNoite + 24 * 60 * MIN;
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      const ini = Math.max(t, meiaNoite + ABRE * MIN);
      const fi = Math.min(tFim, meiaNoite + FECHA * MIN);
      if (fi > ini) total += (fi - ini) / MIN;
    }
    t = proxDia;
  }
  return Math.round(total);
}

/** Agrupa mensagens nossas em "toques" (blocos com menos de 60 min entre si). */
function toques(nossas: Date[]): Date[] {
  const out: Date[] = [];
  let ultima: Date | null = null;
  for (const t of nossas) {
    if (!ultima || t.getTime() - ultima.getTime() >= GAP_TOQUE_MIN * MIN) out.push(t);
    ultima = t;
  }
  return out;
}

export function classificar(msgs: Msg[], inicioEntrada: string | null, agora = new Date()): {
  classe: Classe; inicio: Date | null; primeiraResposta: Date | null; respondidaPorIA: boolean;
  /** follow-ups feitos depois que o lead parou de responder (0, 1, 2…) */
  followups: number;
  /** o lead parou de responder, recebeu só a 1ª resposta (nenhum follow-up) e já passaram 24h */
  semFollowup: boolean;
} {
  const ordenadas = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const ini = inicioEntrada ? new Date(new Date(inicioEntrada).getTime() - MIN) : null;
  const daEntrada = ini ? ordenadas.filter(m => new Date(m.created_at) >= ini) : ordenadas;
  const primeiraDoLead = daEntrada.find(m => !m.de_mim);
  const vazio = { followups: 0, semFollowup: false };
  if (!primeiraDoLead) return { classe: "aberto", inicio: null, primeiraResposta: null, respondidaPorIA: false, ...vazio };
  const inicio = new Date(primeiraDoLead.created_at);
  const resposta = daEntrada.find(m => m.de_mim && new Date(m.created_at) > inicio);
  if (!resposta) return { classe: "sem_resposta", inicio, primeiraResposta: null, respondidaPorIA: false, ...vazio };
  const tResp = new Date(resposta.created_at);
  const porIA = !!resposta.enviada_por_ia;

  // Follow-ups contam a partir da ÚLTIMA mensagem do lead: toques nossos depois dela, menos a resposta
  const ultimaDoLead = [...daEntrada].reverse().find(m => !m.de_mim)!;
  const tUltLead = new Date(ultimaDoLead.created_at);
  const nossasDepois = daEntrada.filter(m => m.de_mim && new Date(m.created_at) > tUltLead).map(m => new Date(m.created_at));
  const tqDepois = toques(nossasDepois);
  const followups = Math.max(0, tqDepois.length - 1);
  const passou24h = (t: Date) => agora.getTime() - t.getTime() >= PRAZO_APOS_2FU_H * 60 * MIN;
  const semFollowup = tqDepois.length === 1 && passou24h(tqDepois[0]);

  const respondeuDepois = daEntrada.some(m => !m.de_mim && new Date(m.created_at) > tResp);
  if (respondeuDepois) return { classe: "desenvolveu", inicio, primeiraResposta: tResp, respondidaPorIA: porIA, followups, semFollowup };
  const nossas = daEntrada.filter(m => m.de_mim && new Date(m.created_at) >= tResp).map(m => new Date(m.created_at));
  const tq = toques(nossas);
  // toque 1 = resposta; precisa de mais 2 (follow-ups) e 24h depois do último
  const fechado = tq.length >= 3 && passou24h(tq[tq.length - 1]);
  return { classe: fechado ? "nao_desenvolveu" : "aberto", inicio, primeiraResposta: tResp, respondidaPorIA: porIA, followups, semFollowup };
}

export function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
