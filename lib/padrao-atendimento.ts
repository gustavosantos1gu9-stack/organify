// Padrão de atendimento Salx — base para a auditoria semanal do atendimento das clientes.
// Primeira versão escrita a partir do roteiro da Secretária IA (mesma lógica de atendimento).
// O dono edita em Acompanhamento → Metodologia (acomp_config.padrao_atendimento).

export const ETAPAS_PADRAO = [
  { k: "acolhimento", label: "Acolhimento" },
  { k: "conducao", label: "Condução" },
  { k: "entender_caso", label: "Entender o caso antes do preço" },
  { k: "resultados", label: "Mostrar resultados" },
  { k: "preco_objecoes", label: "Preço e objeções" },
  { k: "convite_horarios", label: "Convite com horários" },
  { k: "followup", label: "Follow-up" },
  { k: "escrita", label: "Forma de escrever" },
] as const;

export const PADRAO_ATENDIMENTO_PADRAO = `PADRÃO DE ATENDIMENTO SALX (leads que chegam pelo anúncio no WhatsApp)

1. ACOLHIMENTO
- Responder rápido. Lead de anúncio esfria em minutos.
- Na primeira mensagem: cumprimentar, se apresentar pelo nome e já fazer UMA pergunta que entende o caso (ex.: o que mais incomoda hoje e se já fez o procedimento antes).
- Não perguntar o que a pessoa quer se o anúncio já deixou claro. Quem conduz é a clínica.

2. CONDUÇÃO (quem conduz é a clínica)
- Toda resposta termina com uma pergunta que leva ao próximo passo.
- Nunca responder várias perguntas da lead sem fazer uma pergunta de volta.
- Nunca repetir uma pergunta que a lead já respondeu.
- Nunca devolver a decisão técnica para a lead ("o que você prefere fazer?"). A especialista indica o caminho.

3. ENTENDER O CASO ANTES DO PREÇO
- Antes de falar valor, saber o incômodo/desejo e se é a primeira vez ou se já fez antes.
- Se a lead pedir o preço logo de cara: acolher, explicar em uma frase que depende do caso e fazer a pergunta que falta.

4. MOSTRAR RESULTADOS
- Antes de agendar, enviar fotos/vídeos de resultados parecidos com o caso dela, com uma frase curta de contexto.

5. PREÇO E OBJEÇÕES
- Padrão para qualquer objeção: acolher em uma frase curta, responder o mínimo necessário, e retomar o passo que falta com UMA pergunta.
- Adiamento ("vou ver", "depois eu marco", "vou juntar dinheiro") não é um não: trabalhar a objeção e oferecer a condição especial (desconto, vaga, avaliação gratuita) antes de encerrar.

6. CONVITE COM HORÁRIOS
- Convidar para agendar oferecendo 2 opções concretas de dia e horário (ex.: quarta às 10h ou quinta às 15h), não "quando você pode?".
- Antes de confirmar, pedir o nome completo. Depois de agendar, mandar a confirmação com data, hora e regra de cancelamento.

7. FOLLOW-UP
- Se a lead parou de responder, fazer pelo menos 2 follow-ups em dias diferentes.
- O follow-up retoma o assunto dela (o caso, a foto, o horário oferecido) e traz um motivo para responder (vaga, condição, resultado). Não basta "oi, sumida?".

8. FORMA DE ESCREVER
- Frases curtas, uma intenção por mensagem, no máximo um parágrafo. Sem textão.
- Linguagem de WhatsApp, coloquial-profissional, sem termos técnicos.
- Evitar vícios de robô: "fico à disposição", "espero ter ajudado", "posso ajudar em algo mais?".`;
