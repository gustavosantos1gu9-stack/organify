import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

export const dynamic = "force-dynamic";

export const maxDuration = 55;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET — chamado pelo cron a cada 15 minutos para sincronizar leads de formulário do Meta
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Buscar todas as agências com Meta ativo e ad_account configurado
  const { data: agencias } = await supabase.from("agencias")
    .select("id, meta_business_token, meta_token, meta_ad_account_id, meta_pixel_id, grupo_notificacao_jid, evolution_url, evolution_key, whatsapp_instancia")
    .eq("meta_ativo", true)
    .not("meta_ad_account_id", "is", null);

  let totalGeral = { sincronizados: 0, novos: 0, associados: 0 };

  for (const ag of agencias || []) {
    const token = ag.meta_token || ag.meta_business_token;
    if (!token || !ag.meta_ad_account_id) continue;

    try {
      const resultado = await sincronizarLeads(ag.id, token, ag.meta_ad_account_id, ag.meta_pixel_id || "", 1); // última 1h com overlap de 15min
      totalGeral.sincronizados += resultado.sincronizados;
      totalGeral.novos += resultado.novos;
      totalGeral.associados += resultado.associados;
    } catch (e: any) {
      console.error(`[sync-leads cron] Erro agência ${ag.id}:`, e.message);
    }
  }

  console.log("[sync-leads cron] Concluído:", totalGeral);
  return NextResponse.json({ ok: true, ...totalGeral });
}

export async function POST(req: NextRequest) {
  try {
    const { agencia_id, recuperar } = await req.json();
    if (!agencia_id) return NextResponse.json({ ok: false, motivo: "agencia_id obrigatório" });

    // Buscar token e ad_account
    const { data: ag } = await supabase.from("agencias")
      .select("meta_business_token, meta_token, meta_ad_account_id, meta_pixel_id")
      .eq("id", agencia_id).single();

    const token = ag?.meta_token || ag?.meta_business_token;
    const adAccount = ag?.meta_ad_account_id;
    if (!token) return NextResponse.json({ ok: false, motivo: "Token Meta não configurado" });

    // recuperar: true → varrer todos os leads históricos (sem filtro de data, todas campanhas)
    const horasAtras = recuperar ? 0 : 0.5;
    const resultado = await sincronizarLeads(agencia_id, token, adAccount, ag?.meta_pixel_id || "", horasAtras);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e: any) {
    console.error("[sync-leads] Erro:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

async function sincronizarLeads(
  agencia_id: string,
  token: string,
  adAccount: string,
  pixel_id: string,
  horasAtras = 0  // 0 = todos os leads (sem filtro de data)
): Promise<{ sincronizados: number; novos: number; associados: number; campanhas: number; ads: number }> {
  const acId = adAccount?.startsWith("act_") ? adAccount : `act_${adAccount}`;

  // 1. Buscar campanhas de leads
  const campsRes: Response = await fetch(
    `https://graph.facebook.com/v21.0/${acId}/campaigns?fields=id,name,objective&limit=50&access_token=${token}`
  );
  const campsData = await campsRes.json();
  if (campsData.error) throw new Error(campsData.error.message);

  // Para POST manual rápido (0 < horasAtras < 1): limitar campanhas para evitar timeout
  // horasAtras === 0 = modo recuperação completa (sem limite)
  const modoRapido = horasAtras > 0 && horasAtras < 1;
  const maxCamps = modoRapido ? 5 : 999;
  const leadCamps = (campsData.data || []).filter((c: any) => c.objective === "OUTCOME_LEADS").slice(0, maxCamps);

  // 2. Buscar ads de cada campanha
  const adIds: string[] = [];
  for (const camp of leadCamps) {
    const adsRes: Response = await fetch(
      `https://graph.facebook.com/v21.0/${camp.id}/ads?fields=id,name&limit=50&access_token=${token}`
    );
    const adsData = await adsRes.json();
    for (const ad of adsData.data || []) {
      adIds.push(ad.id);
    }
    if (adIds.length >= 20 && modoRapido) break; // limite para POST rápido
  }

  // Filtro de data: se horasAtras > 0, só pega leads recentes
  const sinceParam = horasAtras > 0
    ? `&since=${Math.floor(Date.now() / 1000) - horasAtras * 3600}`
    : "";

  let totalSincronizados = 0;
  let totalNovos = 0;
  let totalAssociados = 0;

  // 3. Buscar leads de cada ad
  for (const adId of adIds) {
    let nextUrl: string | null = `https://graph.facebook.com/v21.0/${adId}/leads?fields=id,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,platform,created_time&limit=50${sinceParam}&access_token=${token}`;

    while (nextUrl) {
      const leadsRes: Response = await fetch(nextUrl);
      const leadsData = await leadsRes.json();

      for (const lead of leadsData.data || []) {
        totalSincronizados++;
        const leadgenId = lead.id;

        const fields: Record<string, string> = {};
        for (const f of lead.field_data || []) {
          fields[f.name] = Array.isArray(f.values) ? f.values[0] : f.values;
        }

        const nome = fields.full_name || fields.nome || fields.first_name || "Lead Formulário";
        const telefone = fields.phone_number || fields.whatsapp || fields.telefone || null;

        if (!telefone) continue;

        const phoneClean = telefone.replace(/\D/g, "");
        const phoneNorm = phoneClean.startsWith("55") ? phoneClean
          : phoneClean.length >= 10 ? `55${phoneClean}` : phoneClean;

        // Verificar se lead já existe (evitar duplicata)
        const { data: existeLead } = await supabase.from("leads")
          .select("id").eq("leadgen_id", leadgenId).limit(1).maybeSingle();

        const { data: existeRastr } = await supabase.from("rastreamentos_pendentes")
          .select("id").eq("leadgen_id", leadgenId).limit(1).maybeSingle();

        const ehNovo = !existeLead && !existeRastr;

        if (!existeRastr) {
          await supabase.from("rastreamentos_pendentes").insert({
            wa_numero: phoneNorm,
            utm_source: "meta",
            utm_medium: "leadform",
            utm_campaign: lead.campaign_name || "",
            utm_content: lead.adset_name || "",
            utm_term: lead.ad_name || "",
            origem: "Formulário Meta",
            leadgen_id: leadgenId,
            wa_destino: null,
          });
        }

        if (ehNovo) {
          // Salvar no CRM
          const email = fields.email || fields.e_mail || null;
          const cidade = fields.city || fields.cidade || null;
          try {
            await supabase.from("leads").insert({
              agencia_id,
              nome,
              email,
              telefone,
              etapa: "novo",
              utm_source: lead.platform === "ig" ? "ig" : "facebook",
              utm_medium: "leadform",
              utm_campaign: lead.campaign_name || null,
              utm_content: lead.adset_name || null,
              utm_term: lead.ad_name || null,
              leadgen_id: leadgenId,
              meta_campaign_id: lead.campaign_id || null,
              meta_adset_id:    lead.adset_id    || null,
              meta_ad_id:       lead.ad_id       || null,
              whatsapp_mensagem_inicial: `Formulário Meta | Campanha: ${lead.campaign_name || "—"} | Conjunto: ${lead.adset_name || "—"}`,
              observacoes: Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n"),
            });
          } catch {}

          // Notificar grupo
          const camposFixos = [
            { label: "Origem", valor: "Formulário Instantâneo Meta" },
            { label: "Nome", valor: nome },
            { label: "Telefone", valor: telefone || "" },
            { label: "Email", valor: email || "" },
            { label: "Cidade", valor: cidade || "" },
          ].filter(c => c.valor);
          const camposJaUsados = new Set(["full_name","nome","first_name","name","email","e_mail","phone_number","whatsapp","telefone","celular","phone","mobile","numero","tel","contato","city","cidade"]);
          const camposExtras = Object.entries(fields).filter(([k]) => !camposJaUsados.has(k)).map(([k, v]) => ({ label: k, valor: String(v) }));

          await fetch("https://www.salxconvert.com.br/api/notificar-grupo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agencia_id,
              titulo: `Meta Lead Ads — ${lead.campaign_name || "Formulário"}`,
              campos: [...camposFixos, ...camposExtras],
              telefone: telefone || "",
            }),
          }).catch(() => {});

          // Disparar evento Lead no CAPI
          if (pixel_id) {
            dispararEventoMeta({
              pixel_id,
              access_token: token,
              event_name: "Lead",
              phone: phoneNorm || undefined,
              contato_nome: nome,
              utm_campaign: lead.campaign_name || undefined,
              utm_content: lead.adset_name || undefined,
              lead_id: leadgenId,
              action_source: "crm",
              event_id: `leadform_${leadgenId}`,
            }).catch(() => {});
          }

          totalNovos++;
          console.log(`[sync-leads] Novo lead: ${nome} (${telefone}) — ${lead.campaign_name}`);
        }

        // Associar à conversa pelo número (todas variantes BR)
        const variantes = new Set<string>();
        variantes.add(phoneNorm);
        if (phoneNorm.startsWith("55")) variantes.add(phoneNorm.slice(2));
        if (!phoneNorm.startsWith("55")) variantes.add(`55${phoneNorm}`);
        for (const n of Array.from(variantes)) {
          const base = n.startsWith("55") ? n.slice(2) : n;
          const ddd = base.slice(0, 2);
          const rest = base.slice(2);
          if (rest.length === 8) { variantes.add(`55${ddd}9${rest}`); variantes.add(`${ddd}9${rest}`); }
          if (rest.length === 9 && rest.startsWith("9")) { variantes.add(`55${ddd}${rest.slice(1)}`); variantes.add(`${ddd}${rest.slice(1)}`); }
        }

        for (const v of Array.from(variantes)) {
          const { data: conv } = await supabase.from("conversas")
            .select("id, leadgen_id")
            .eq("contato_numero", v)
            .eq("agencia_id", agencia_id)
            .is("leadgen_id", null)
            .limit(1).single();

          if (conv) {
            await supabase.from("conversas").update({
              leadgen_id: leadgenId,
              origem: "Formulário Meta",
              utm_source: lead.platform === "ig" ? "ig" : "meta",
              utm_medium: "leadform",
              utm_campaign: lead.campaign_name || null,
              utm_content: lead.adset_name || null,
              nome_anuncio: lead.ad_name || null,
              meta_campaign_id: lead.campaign_id || null,
              meta_adset_id:    lead.adset_id    || null,
              meta_ad_id:       lead.ad_id       || null,
            }).eq("id", conv.id);
            console.log(`[sync-leads] Associado ${leadgenId} → conversa ${conv.id} (${nome})`);
            totalAssociados++;
            break;
          }
        }
      }

      nextUrl = leadsData.paging?.next || null;
      if (totalSincronizados >= 200) break;
    }
  }

  return { sincronizados: totalSincronizados, novos: totalNovos, associados: totalAssociados, campanhas: leadCamps.length, ads: adIds.length };
}
