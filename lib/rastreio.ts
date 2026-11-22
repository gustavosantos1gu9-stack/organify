// ── Hierarquia de rastreio: nível mais alto sobrescreve mais baixo, nunca o contrário ──
// Prioridade: resolvido (5) > atribuido_por_texto_link (4) > atribuido_por_data (3)
//           > sem_dados_anuncio (2) > ambiguo (1) > null/Não Rastreada (0)
export const HIERARQUIA_RASTREIO: Record<string, number> = {
  resolvido: 5,
  atribuido_por_texto_link: 4,
  atribuido_por_data: 3,
  sem_dados_anuncio: 2,
  ambiguo: 1,
};

export function nivelRastreio(conversa: any): number {
  // Se tem link_id, mínimo nível 3 (equivale a atribuido_por_data)
  if (conversa?.link_id) return Math.max(HIERARQUIA_RASTREIO[conversa.rastreio_status] ?? 0, 3);
  return HIERARQUIA_RASTREIO[conversa?.rastreio_status] ?? 0;
}

/** Retorna true se é seguro aplicar novo rastreio sobre a conversa atual.
 *  Nunca rebaixa: só aplica se novoStatus tiver nível >= nível atual. */
export function podeAplicarRastreio(conversaAtual: any, novoStatus: string | null): boolean {
  const nivelAtual = nivelRastreio(conversaAtual);
  if (nivelAtual === 0) return true; // sem rastreio → sempre aplica
  const nivelNovo = HIERARQUIA_RASTREIO[novoStatus ?? ""] ?? 0;
  return nivelNovo >= nivelAtual;
}

/** Extrai o número de destino (wa=) da URL do link gerado. */
export function extrairWaDestino(linkGerado: string): string {
  try {
    const url = new URL(linkGerado);
    return url.searchParams.get("wa") || "";
  } catch {
    const m = (linkGerado || "").match(/[?&]wa=([0-9]+)/);
    return m?.[1] || "";
  }
}

/** Verifica se o número de destino do link bate com o whatsapp_numero da agência.
 *  Tolera variações: com/sem código 55, com/sem 9° dígito (11 vs 12 dígitos locais). */
export function destinoBateNumero(waDestino: string, whatsappNumero: string): boolean {
  if (!waDestino || !whatsappNumero) return false;
  const limpar = (n: string) => n.replace(/\D/g, "");
  const a = limpar(waDestino);
  const b = limpar(whatsappNumero);
  if (a === b) return true;
  // Normalizar: remover/adicionar prefixo 55
  const sem55 = (n: string) => n.startsWith("55") ? n.slice(2) : n;
  return sem55(a) === sem55(b);
}
