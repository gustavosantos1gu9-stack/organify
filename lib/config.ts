// Configurações centralizadas — lidas do banco, não hardcoded
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AgenciaConfig {
  id: string;
  evolution_url: string;
  evolution_key: string;
  whatsapp_instancia: string;
  whatsapp_numero: string;
  meta_pixel_id: string;
  meta_token: string;
  meta_ativo: boolean;
}

// Cache simples para não buscar toda hora
let cache: { config: AgenciaConfig; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minuto

export async function getAgenciaConfig(agenciaId: string): Promise<AgenciaConfig | null> {
  // Usar cache se recente
  if (cache && cache.config.id === agenciaId && Date.now() - cache.ts < CACHE_TTL) {
    return cache.config;
  }

  const { data, error } = await supabase
    .from("agencias")
    .select("id, evolution_url, evolution_key, whatsapp_instancia, whatsapp_numero, meta_pixel_id, meta_token, meta_ativo")
    .eq("id", agenciaId)
    .single();

  if (error || !data) return null;

  const config: AgenciaConfig = {
    id: data.id,
    evolution_url: data.evolution_url || "",
    evolution_key: data.evolution_key || "",
    whatsapp_instancia: data.whatsapp_instancia || "",
    whatsapp_numero: data.whatsapp_numero || "",
    meta_pixel_id: data.meta_pixel_id || "",
    meta_token: data.meta_token || "",
    meta_ativo: data.meta_ativo || false,
  };

  cache = { config, ts: Date.now() };
  return config;
}
