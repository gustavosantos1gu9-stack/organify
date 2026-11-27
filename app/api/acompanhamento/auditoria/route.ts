import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classificar, minutosComerciais, mediana, Msg } from "@/lib/qualidade-publicos";
import { PADRAO_ATENDIMENTO_PADRAO, ETAPAS_PADRAO } from "@/lib/padrao-atendimento";
import { credencialIA, iaJson } from "@/lib/ia-agencia";

// Auditoria semanal do atendimento da cliente (leads do Meta no WhatsApp dela):
//  1) números sem IA (tempo de resposta em horário comercial, sem resposta, follow-ups…)
//  2) leitura de uma amostra de conversas pela IA, comparando com o Padrão de atendimento Salx.
// POST (botão na ficha, usuário logado) · GET (cron de segunda-feira).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DIA = 86400000;
const BRT = 3 * 3600000;
const AMOSTRA = 12;

/** Segunda-feira (data BRT, YYYY-MM-DD) da semana de um instante */
function segundaDe(t: number) {
  const d = new Date(t - BRT);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  const seg = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dow * DIA);
  return seg.toISOString().slice(0, 10);
}

async function auditar(clienteId: string, modo: "semana_anterior" | "ultimos_7_dias", soNumeros = false) {
  const { data: cli } = await supabase.from("controle_clientes").select("id, nome, agencia_id").eq("id", clienteId).single();
  if (!cli) throw new Error("Cliente não encontrada");
  const { data: ac } = await supabase.from("acomp_clientes").select("filha_id").eq("cliente_id", clienteId).maybeSingle();
  const filhaId = (ac as any)?.filha_id;
  if (!filhaId) throw new Error("SEM_FILHA");

  // Janela analisada
  const agora = Date.now();
  let ini: number, fim: number, semana: string;
  if (modo === "semana_anterior") {
    semana = segundaDe(agora - 7 * DIA);
    ini = new Date(`${semana}T03:00:00Z`).getTime();
    fim = ini + 7 * DIA;
  } else {
    fim = agora; ini = agora - 7 * DIA; semana = segundaDe(agora);
  }

  // 1. Leads do Meta que chegaram na janela (fora o histórico importado)
  const { data: convsRaw } = await supabase.from("conversas")
    .select("id, primeira_mensagem_at, created_at")
    .eq("agencia_id", filhaId).ilike("origem", "meta ads%")
    .gte("primeira_mensagem_at", new Date(ini).toISOString()).lt("primeira_mensagem_at", new Date(fim).toISOString())
    .limit(2000);
  const convs = (convsRaw || []).filter((c: any) => new Date(c.created_at).getTime() - new Date(c.primeira_mensagem_at).getTime() <= 3600000);

  const msgs = new Map<string, any[]>();
  const ids = convs.map((c: any) => c.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("mensagens")
      .select("conversa_id, de_mim, created_at, enviada_por_ia, tipo, conteudo").in("conversa_id", ids.slice(i, i + 150))
      .order("created_at").limit(20000);
    for (const m of data || []) { const l = msgs.get(m.conversa_id) || []; l.push(m); msgs.set(m.conversa_id, l); }
  }

  const tempos: number[] = [];
  const n = { leads: convs.length, respondidos: 0, sem_resposta: 0, por_ia: 0, desenvolveram: 0, nao_desenvolveram: 0, aberto: 0, pararam: 0, sem_followup: 0, com_1_followup: 0, com_2_followups: 0 };
  const grupos: Record<string, string[]> = { sem_followup: [], nao_desenvolveu: [], desenvolveu: [], sem_resposta: [], aberto: [] };
  const agoraD = new Date(agora);
  for (const c of convs) {
    const r = classificar((msgs.get(c.id) || []) as Msg[], c.primeira_mensagem_at, agoraD);
    if (r.classe === "sem_resposta") { n.sem_resposta++; grupos.sem_resposta.push(c.id); continue; }
    if (!r.inicio) continue;
    n.respondidos++;
    if (r.respondidaPorIA) n.por_ia++;
    if (r.primeiraResposta) tempos.push(minutosComerciais(r.inicio, r.primeiraResposta));
    if (r.classe === "desenvolveu") n.desenvolveram++; else if (r.classe === "nao_desenvolveu") n.nao_desenvolveram++; else n.aberto++;
    // "Parou de responder": última mensagem da conversa é nossa
    const l = msgs.get(c.id) || [];
    if (l.length && l[l.length - 1].de_mim) {
      n.pararam++;
      if (r.semFollowup) n.sem_followup++;
      if (r.followups === 1) n.com_1_followup++;
      if (r.followups >= 2) n.com_2_followups++;
    }
    if (r.semFollowup) grupos.sem_followup.push(c.id);
    else if (r.classe === "nao_desenvolveu") grupos.nao_desenvolveu.push(c.id);
    else if (r.classe === "desenvolveu") grupos.desenvolveu.push(c.id);
    else grupos.aberto.push(c.id);
  }
  const fechados = n.desenvolveram + n.nao_desenvolveram;
  const numeros = {
    ...n,
    janela: { de: new Date(ini).toISOString(), ate: new Date(fim).toISOString() },
    tempo_mediana_min: mediana(tempos),
    ate_5min: tempos.length ? tempos.filter(t => t <= 5).length / tempos.length : null,
    ate_15min: tempos.length ? tempos.filter(t => t <= 15).length / tempos.length : null,
    ate_60min: tempos.length ? tempos.filter(t => t <= 60).length / tempos.length : null,
    pct_ia: n.respondidos ? n.por_ia / n.respondidos : null,
    taxa_desenvolvimento: fechados ? n.desenvolveram / fechados : null,
  };

  // 2. Amostra para a IA: prioriza onde costuma estar o problema
  const amostra: string[] = [];
  for (const g of ["sem_followup", "nao_desenvolveu", "desenvolveu", "aberto"]) amostra.push(...grupos[g].slice(0, 3));
  for (const g of ["sem_followup", "nao_desenvolveu", "desenvolveu", "aberto"]) for (const id of grupos[g]) if (amostra.length < AMOSTRA && !amostra.includes(id)) amostra.push(id);

  if (soNumeros) return { semana_inicio: semana, numeros, amostra: amostra.length };

  let ia: any = null; let modelo: string | null = null;
  if (amostra.length >= 3) {
    const { key, modelo: modeloAg } = await credencialIA(supabase, (cli as any).agencia_id);
    if (!key) throw new Error("SEM_CHAVE");
    const { data: cfg } = await supabase.from("acomp_config").select("padrao_atendimento").eq("agencia_id", (cli as any).agencia_id).maybeSingle();
    const padrao = (cfg as any)?.padrao_atendimento || PADRAO_ATENDIMENTO_PADRAO;
    const fmtH = (s: string) => new Date(new Date(s).getTime() - BRT).toISOString().slice(5, 16).replace("T", " ").replace(/^(\d\d)-(\d\d)/, "$2/$1");
    const transcricoes = amostra.map((id, i) => {
      const l = (msgs.get(id) || []).slice(0, 30);
      const linhas = l.map((m: any) => {
        const quem = m.de_mim ? (m.enviada_por_ia ? "CLÍNICA (IA)" : "CLÍNICA") : "LEAD";
        const txt = (m.conteudo || `[${m.tipo || "mídia"}]`).replace(/\s+/g, " ").slice(0, 220);
        return `[${fmtH(m.created_at)}] ${quem}: ${txt}`;
      });
      return `--- CONVERSA ${i + 1} ---\n${linhas.join("\n")}`;
    }).join("\n\n");

    const sistema = `Você é auditora de atendimento comercial de clínicas de estética (micropigmentação). Avalie se a CLÍNICA seguiu o padrão de atendimento abaixo nas conversas com leads que chegaram por anúncio no WhatsApp.
Mensagens "CLÍNICA (IA)" foram enviadas pela secretária virtual; as demais foram escritas pela equipe da clínica.
Um follow-up é qualquer mensagem da clínica que RETOMA a conversa depois que a lead parou de responder (texto, áudio, foto, figurinha). Mensagens enviadas logo em seguida da resposta, continuando o mesmo assunto, NÃO são follow-up.
Seja justa e concreta. Use trechos reais e curtos das conversas como exemplo (no máximo 20 palavras). Não invente nada que não esteja nas conversas. "[audio]" significa áudio sem transcrição: não avalie o conteúdo dele.

${padrao}

Responda em JSON com este formato:
{"nota_geral": 0-10, "resumo": "2 frases",
 "etapas": [{"k": "${ETAPAS_PADRAO.map(e => e.k).join('|')}", "nota": 0-10 ou null se não deu para avaliar, "comentario": "1 frase", "exemplo": "trecho real ou vazio", "como_deveria": "como deveria ter sido, 1 frase ou vazio"}],
 "followups": {"comentario": "1 a 2 frases sobre os follow-ups: se aconteceram, se retomaram o assunto da lead"},
 "pontos_fortes": ["até 3"], "melhorar": ["até 3, cada um com uma ação prática"],
 "mensagem_cliente": "mensagem de WhatsApp para a DONA da clínica, em nome da CS da Salx, tom próximo e direto, sem termos técnicos, 5 a 8 linhas curtas: elogie 1 ponto, mostre 2 ou 3 melhorias práticas com exemplo e incentive."}`;
    const usuario = `Números da semana (calculados pelo sistema, use para contexto):
- leads do anúncio: ${n.leads}; sem nenhuma resposta: ${n.sem_resposta}
- tempo mediano da 1ª resposta em horário comercial: ${numeros.tempo_mediana_min ?? "—"} min; respondidos em até 15 min: ${numeros.ate_15min !== null ? Math.round(numeros.ate_15min * 100) + "%" : "—"}
- leads que pararam de responder: ${n.pararam}; desses, sem nenhum follow-up: ${n.sem_followup}; com 2 follow-ups: ${n.com_2_followups}

Conversas (amostra de ${amostra.length}):
${transcricoes}`;
    const r = await iaJson(key, modeloAg, sistema, usuario);
    ia = r.json; modelo = r.modelo;
  }

  const registro = {
    agencia_id: (cli as any).agencia_id, cliente_id: clienteId, filha_id: filhaId, semana_inicio: semana,
    numeros, ia, modelo, conversas_lidas: ia ? amostra.length : 0,
  };
  const { data: salvo, error } = await supabase.from("acomp_auditorias").upsert(registro, { onConflict: "cliente_id,semana_inicio" }).select("*").single();
  if (error) throw new Error(error.message);
  return salvo;
}

function erroAmigavel(msg: string) {
  if (msg === "SEM_FILHA") return "Vincule a cliente à agência dela na plataforma (campo “Agência na plataforma”) para analisar o atendimento.";
  if (msg === "SEM_CHAVE") return "A agência não tem chave de IA cadastrada (Configurações → Integrações).";
  if (msg === "CHAVE_INVALIDA") return "A chave de IA da agência é inválida ou expirou. Atualize em Configurações → Integrações.";
  return "Não foi possível analisar agora. Tente de novo em instantes.";
}

// Botão "Analisar agora" na ficha (últimos 7 dias)
export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!jwt) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(jwt);
  if (!user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { cliente_id } = await req.json().catch(() => ({}));
  if (!cliente_id) return NextResponse.json({ error: "cliente_id obrigatório" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, auditoria: await auditar(cliente_id, "ultimos_7_dias") });
  } catch (e: any) {
    console.error("[auditoria] manual", e?.message);
    return NextResponse.json({ error: erroAmigavel(e?.message) }, { status: 400 });
  }
}

// Cron de segunda-feira: semana anterior, em lotes (roda de hora em hora até cobrir todas)
export async function GET(req: NextRequest) {
  // Conferência: ?conferir=<cliente_id> devolve só os números (sem IA, sem gravar)
  const conferir = new URL(req.url).searchParams.get("conferir");
  if (conferir) {
    try { return NextResponse.json(await auditar(conferir, "ultimos_7_dias", true)); }
    catch (e: any) { return NextResponse.json({ error: erroAmigavel(e?.message) }, { status: 400 }); }
  }
  const ua = req.headers.get("user-agent") || "";
  const auth = req.headers.get("authorization") || "";
  const okCron = ua.includes("vercel-cron") || (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`);
  if (!okCron) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const semana = segundaDe(Date.now() - 7 * DIA);
  const { data: vinculados } = await supabase.from("acomp_clientes").select("cliente_id").not("filha_id", "is", null);
  const { data: feitos } = await supabase.from("acomp_auditorias").select("cliente_id").eq("semana_inicio", semana);
  const jaFeitos = new Set(((feitos || []) as any[]).map(f => f.cliente_id));
  const pendentes = ((vinculados || []) as any[]).map(v => v.cliente_id).filter(id => !jaFeitos.has(id));

  const resultado: Record<string, string> = {};
  const inicio = Date.now();
  for (const id of pendentes) {
    if (Date.now() - inicio > 40000) break; // o resto fica para a próxima hora
    try { await auditar(id, "semana_anterior"); resultado[id] = "ok"; }
    catch (e: any) { resultado[id] = e?.message || "erro"; }
  }
  return NextResponse.json({ semana, pendentes: pendentes.length, feitos: resultado });
}
