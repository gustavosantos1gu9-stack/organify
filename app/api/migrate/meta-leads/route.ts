import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispararEventoMeta } from "@/lib/meta-pixel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_ID = "104712445150405";

async function processarLeadsDoFormulario(
  formId: string,
  agenciaId: string,
  token: string,
  pixelId: string,
  log: string[]
): Promise<{ processados: number; atualizados: number; criados: number }> {
  let processados = 0, atualizados = 0, criados = 0;
  let nextUrl = `https://graph.facebook.com/v21.0/${formId}/leads?fields=id,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,created_time&limit=100&access_token=${token}`;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    const data = await res.json();

    if (data.error) {
      log.push(`Erro API Meta (form ${formId}): ${data.error.message}`);
      break;
    }

    for (const lead of data.data || []) {
      processados++;
      const leadgenId = lead.id;
      const fields: Record<string, string> = {};
      for (const f of lead.field_data || []) {
        fields[f.name] = Array.isArray(f.values) ? f.values[0] : f.values;
      }

      const nome = fields.full_name || fields.nome || fields.first_name || fields.name || "Lead Formulário";
      const email = fields.email || null;
      const telefone = fields.phone_number || fields.whatsapp || fields.telefone
        || fields.celular || fields.phone || fields.mobile || fields.numero
        || fields.tel || fields.contato || null;

      const campanhaNome = lead.campaign_name || "";
      const conjuntoNome = lead.adset_name || "";
      let criativoNome = lead.ad_name || "";

      // Buscar nome do anúncio pelo ad_id se não veio direto
      if (!criativoNome && lead.ad_id) {
        try {
          const adRes = await fetch(
            `https://graph.facebook.com/v21.0/${lead.ad_id}?fields=name&access_token=${token}`
          );
          const adData = await adRes.json();
          if (!adData.error && adData.name) criativoNome = adData.name;
        } catch {}
      }

      log.push(`Lead: ${nome} | Tel: ${telefone} | Campanha: ${campanhaNome} | Conjunto: ${conjuntoNome || "—"} | Anúncio: ${criativoNome || "—"}`);

      if (!telefone) { log.push(`  → Sem telefone, pulando`); continue; }

      const phoneClean = telefone.replace(/\D/g, "");
      const phoneNorm = phoneClean.startsWith("55") ? phoneClean
        : phoneClean.length >= 10 ? `55${phoneClean}` : phoneClean;

      const variantes: string[] = [phoneNorm];
      const semCC = phoneNorm.startsWith("55") ? phoneNorm.slice(2) : phoneNorm;
      if (!variantes.includes(semCC)) variantes.push(semCC);
      if (semCC.length === 10) {
        variantes.push("55" + semCC.slice(0, 2) + "9" + semCC.slice(2));
        variantes.push(semCC.slice(0, 2) + "9" + semCC.slice(2));
      }
      if (semCC.length === 11) {
        variantes.push("55" + semCC.slice(0, 2) + semCC.slice(3));
        variantes.push(semCC.slice(0, 2) + semCC.slice(3));
      }

      // Buscar conversa existente
      const { data: conv } = await supabase.from("conversas")
        .select("id, leadgen_id, utm_campaign, origem")
        .eq("agencia_id", agenciaId)
        .in("contato_numero", variantes)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conv) {
        const updateData: Record<string, any> = {
          leadgen_id: leadgenId,
          origem: "Formulário Meta",
          utm_source: "meta",
          utm_medium: "leadform",
          utm_term: criativoNome || null,
        };
        if (campanhaNome) {
          updateData.utm_campaign = campanhaNome;
          updateData.utm_content = conjuntoNome;
        }
        await supabase.from("conversas").update(updateData).eq("id", conv.id);
        atualizados++;
        log.push(`  → Conversa ${conv.id.slice(0, 8)} atualizada com rastreamento completo`);

        // Disparar CAPI Contact se ainda não foi
        const { data: jaDisparou } = await supabase.from("pixel_disparos")
          .select("id").eq("conversa_id", conv.id).eq("evento", "Contact").limit(1);
        if (!jaDisparou?.length && pixelId) {
          try {
            await dispararEventoMeta({
              pixel_id: pixelId,
              access_token: token,
              event_name: "Contact",
              phone: phoneNorm,
              email: email || undefined,
              contato_nome: nome,
              utm_campaign: campanhaNome,
              lead_id: leadgenId,
              action_source: "crm",
              event_id: `contact_retro_${leadgenId}`,
            });
            await supabase.from("pixel_disparos").insert({
              agencia_id: agenciaId, conversa_id: conv.id,
              telefone: phoneNorm, etapa: "Fez Contato",
              evento: "Contact", status: "sucesso",
              retorno: "retroativo",
            });
            log.push(`  → Pixel Contact enviado ao Meta`);
          } catch (e: any) {
            log.push(`  → Erro pixel: ${e.message}`);
          }
        }
      } else {
        // Criar rastreamento pendente para quando o lead entrar em contato
        await supabase.from("rastreamentos_pendentes").upsert({
          wa_numero: phoneNorm,
          utm_source: "meta",
          utm_medium: "leadform",
          utm_campaign: campanhaNome,
          utm_content: conjuntoNome,
          utm_term: criativoNome,
          origem: "Formulário Meta",
          leadgen_id: leadgenId,
        }, { onConflict: "wa_numero" });
        criados++;
        log.push(`  → Sem conversa ainda, rastreamento pendente criado`);
      }

      // Garantir registro na tabela leads
      const { data: leadExistente } = await supabase.from("leads")
        .select("id").eq("leadgen_id", leadgenId).limit(1).maybeSingle();
      if (!leadExistente) {
        await supabase.from("leads").insert({
          agencia_id: agenciaId, nome, email, telefone,
          etapa: "novo",
          utm_source: "facebook", utm_medium: "leadform",
          utm_campaign: campanhaNome, utm_content: conjuntoNome, utm_term: criativoNome,
          leadgen_id: leadgenId,
        });
      }
    }

    nextUrl = data.paging?.next || "";
  }

  return { processados, atualizados, criados };
}

// GET /api/migrate/meta-leads?token=...&listar=true — lista formulários e processa todos
// token: user token do Graph API Explorer — o sistema troca automaticamente pelo page token
// listar=true: só lista os formulários sem processar (para verificar antes de rodar)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agenciaId = searchParams.get("agencia_id") || "32cdce6e-4664-4ac6-979d-6d68a1a68745";
    const tokenParam = searchParams.get("token") || null;
    const apenasListar = searchParams.get("listar") === "true";

    const { data: ag } = await supabase.from("agencias")
      .select("meta_token, meta_business_token, meta_pixel_id")
      .eq("id", agenciaId).single();

    let token = tokenParam || ag?.meta_token || ag?.meta_business_token;
    if (!token) return NextResponse.json({ ok: false, error: "Token Meta não encontrado para a agência" });

    // Trocar user token → page token automaticamente
    // O endpoint /me/accounts retorna os tokens das páginas do usuário
    if (tokenParam) {
      try {
        const accountsRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?access_token=${tokenParam}`
        );
        const accountsData = await accountsRes.json();
        if (!accountsData.error && accountsData.data?.length > 0) {
          // Buscar a página Salx Digital pelo ID
          const pagina = accountsData.data.find((p: any) => p.id === PAGE_ID) || accountsData.data[0];
          if (pagina?.access_token) {
            token = pagina.access_token;
          }
        }
      } catch {}
    }

    // Listar formulários da página
    const formsRes = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}/leadgen_forms?fields=id,name,status,leads_count&limit=100&access_token=${token}`
    );
    const formsData = await formsRes.json();

    if (formsData.error) {
      return NextResponse.json({ ok: false, error: formsData.error.message });
    }

    const formularios = formsData.data || [];

    // Se só quer listar, retorna sem processar
    if (apenasListar) {
      return NextResponse.json({
        ok: true,
        formularios: formularios.map((f: any) => ({ id: f.id, nome: f.name, leads: f.leads_count })),
      });
    }

    const log: string[] = [];
    let totalProcessados = 0, totalAtualizados = 0, totalCriados = 0;

    for (const form of formularios) {
      log.push(`\n=== Formulário: ${form.name} (${form.id}) — ${form.leads_count ?? "?"} leads ===`);
      const { processados, atualizados, criados } = await processarLeadsDoFormulario(
        form.id, agenciaId, token, ag?.meta_pixel_id || "", log
      );
      totalProcessados += processados;
      totalAtualizados += atualizados;
      totalCriados += criados;
    }

    return NextResponse.json({
      ok: true,
      formularios: formularios.map((f: any) => ({ id: f.id, nome: f.name, leads: f.leads_count })),
      total: { processados: totalProcessados, atualizados: totalAtualizados, criados: totalCriados },
      log,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/migrate/meta-leads — processa formulário específico
// Body: { form_id: "123...", agencia_id?: "uuid" }
export async function POST(req: NextRequest) {
  try {
    const { form_id, agencia_id: agenciaIdParam } = await req.json();
    if (!form_id) return NextResponse.json({ ok: false, error: "form_id obrigatório" });

    const agenciaId = agenciaIdParam || "32cdce6e-4664-4ac6-979d-6d68a1a68745";

    const { data: ag } = await supabase.from("agencias")
      .select("meta_token, meta_business_token, meta_pixel_id")
      .eq("id", agenciaId).single();

    const token = ag?.meta_token || ag?.meta_business_token;
    if (!token) return NextResponse.json({ ok: false, error: "Token Meta não encontrado" });

    const log: string[] = [];
    const { processados, atualizados, criados } = await processarLeadsDoFormulario(
      form_id, agenciaId, token, ag?.meta_pixel_id || "", log
    );

    return NextResponse.json({ ok: true, processados, atualizados, criados, log });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
