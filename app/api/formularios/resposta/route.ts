import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const {
      formulario_id, agencia_id, respostas, cliente_externo_id,
      // dados extraídos do formulário
      nome, telefone, email,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbp,
      form_nome, desqualificado,
    } = await req.json();

    if (!formulario_id || !agencia_id || !respostas) {
      return NextResponse.json({ ok: false, error: "formulario_id, agencia_id e respostas são obrigatórios" }, { status: 400 });
    }

    // 0. Resolver IDs numéricos e macros inválidas nos UTMs antes de qualquer gravação
    let utmCampaignFinal   = utm_campaign   || null;
    let utmContentFinal    = utm_content    || null;
    let utmTermFinal       = utm_term       || null;
    let metaCampaignId: string | null = null;
    let metaAdsetId:    string | null = null;
    let metaAdId:       string | null = null;
    let utmRastreioErro: string | null = null;

    if (utm_campaign || utm_content || utm_term) {
      const { data: agMeta } = await supabase.from("agencias")
        .select("meta_business_token, meta_token, parent_id")
        .eq("id", agencia_id).single();
      let parentMeta: any = null;
      if (agMeta?.parent_id) {
        const { data: pm } = await supabase.from("agencias")
          .select("meta_business_token, meta_token").eq("id", agMeta.parent_id).single();
        parentMeta = pm;
      }
      const { getMetaToken, resolverIdsMeta } = await import("@/lib/meta-tracking");
      const metaToken = getMetaToken(agMeta || {}, parentMeta);
      const ids = await resolverIdsMeta({ utm_campaign, utm_content, utm_term }, metaToken);
      utmCampaignFinal  = ids.utm_campaign;
      utmContentFinal   = ids.utm_content;
      utmTermFinal      = ids.utm_term;
      metaCampaignId    = ids.meta_campaign_id;
      metaAdsetId       = ids.meta_adset_id;
      metaAdId          = ids.meta_ad_id;
      utmRastreioErro   = ids.rastreio_erro;
    }

    // 1. Salvar respostas
    const { data: resposta, error: errResp } = await supabase.from("formularios_respostas").insert({
      formulario_id,
      agencia_id,
      respostas,
      cliente_externo_id: cliente_externo_id || null,
      fbclid: fbclid || null,
      fbp: fbp || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
      created_at: new Date().toISOString(),
    }).select("id").single();

    if (errResp) {
      console.error("[formularios/resposta] Erro formularios_respostas:", errResp);
    }

    // 2. Criar lead no CRM (apenas leads qualificados)
    let leadId: string | null = null;
    if (!desqualificado && (nome || telefone || email)) {
      const { data: lead, error: errLead } = await supabase.from("leads").insert({
        agencia_id,
        nome: nome || "Lead Formulário",
        telefone: telefone || null,
        email: email || null,
        etapa: "novo",
        utm_source: utm_source || "salx_form",
        utm_medium: utm_medium || "formulario",
        utm_campaign: utmCampaignFinal || form_nome || null,
        utm_content: utmContentFinal || null,
        utm_term: utmTermFinal || null,
        meta_campaign_id: metaCampaignId || null,
        meta_adset_id:    metaAdsetId    || null,
        meta_ad_id:       metaAdId       || null,
        whatsapp_mensagem_inicial: `Formulário: ${form_nome || formulario_id}`,
      }).select("id").single();

      if (errLead) console.error("[formularios/resposta] Erro leads:", errLead);
      else leadId = lead?.id || null;
    }

    // 3. Disparar pixel Lead (Contact) se tiver fbclid ou utm — não depende de conversa
    if (!desqualificado && fbclid && agencia_id) {
      try {
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.salxconvert.com.br";
        const phoneCleanPx = telefone ? telefone.replace(/\D/g, "") : "";
        const phoneNormPx = phoneCleanPx.startsWith("55") ? phoneCleanPx
          : phoneCleanPx.length >= 10 ? `55${phoneCleanPx}` : phoneCleanPx;
        fetch(`${APP_URL}/api/pixel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agencia_id,
            etapa_nome: "Entrou em contato",
            phone: phoneNormPx || undefined,
            fbclid: fbclid || undefined,
            fbp: fbp || undefined,
            contato_nome: nome || undefined,
            utm_campaign: utm_campaign || undefined,
            utm_content: utm_content || undefined,
            is_ctwa: false,
          }),
        }).catch(() => {});
      } catch {}
    }

    // 5. Salvar rastreamento pendente para match automático quando lead enviar WhatsApp
    if (telefone) {
      const phoneClean = telefone.replace(/\D/g, "");
      const phoneNorm = phoneClean.startsWith("55") ? phoneClean
        : phoneClean.length >= 10 ? `55${phoneClean}` : phoneClean;

      const { error: errRp } = await supabase.from("rastreamentos_pendentes").insert({
        wa_numero: phoneNorm,
        utm_source: utm_source || "salx_form",
        utm_medium: utm_medium || "formulario",
        utm_campaign: utmCampaignFinal || form_nome || null,
        utm_content: utmContentFinal || null,
        utm_term: utmTermFinal || null,
        origem: `Formulário: ${form_nome || "SALX"}`,
        fbclid: fbclid || null,
      });

      if (errRp) console.error("[formularios/resposta] Erro rastreamentos_pendentes:", errRp);
    }

    // 6. Notificar via WhatsApp (server-side, não depende do browser do lead)
    try {
      // Montar campos da mensagem a partir das respostas + formulário
      const { data: formData } = await supabase.from("formularios")
        .select("perguntas, nome")
        .eq("id", formulario_id)
        .single();

      if (formData?.perguntas) {
        const perguntas: any[] = formData.perguntas;
        function linkWhatsApp(tel: string) {
          const d = tel.replace(/\D/g, "");
          return `https://wa.me/${d.startsWith("55") ? d : "55" + d}`;
        }
        function formatarTelefone(tel: string) {
          const d = tel.replace(/\D/g, "");
          const s = d.startsWith("55") ? d.slice(2) : d;
          if (s.length === 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`;
          if (s.length === 10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`;
          return tel;
        }

        const camposMsg = [
          { label: "Origem", valor: "Formulário SALX" },
          ...perguntas
            .filter((p: any) => !["welcome", "video", "obrigado", "galeria"].includes(p.tipo) && respostas[p.id])
            .map((p: any) => ({ label: p.label, valor: respostas[p.id] })),
        ];

        const phoneField = perguntas.find((p: any) => p.tipo === "phone");
        const telefoneMsg = phoneField ? (respostas[phoneField.id] || "") : (telefone || "");

        // Buscar config da agência
        const { data: ag } = await supabase.from("agencias")
          .select("evolution_url, evolution_key, whatsapp_instancia, parent_id, grupo_notificacao_jid")
          .eq("id", agencia_id).single();

        let evoUrl = ag?.evolution_url || "";
        let evoKey = ag?.evolution_key || "";
        let instancia = ag?.whatsapp_instancia || "";
        let grupoJid = ag?.grupo_notificacao_jid || "";
        let destinoNumero = "";

        // Cliente externo → enviar pro número de notificação do cliente
        if (cliente_externo_id) {
          const { data: ce } = await supabase.from("clientes_externos")
            .select("whatsapp_notificacao").eq("id", cliente_externo_id).single();
          if (ce?.whatsapp_notificacao) {
            const n = ce.whatsapp_notificacao.replace(/\D/g, "");
            destinoNumero = n.startsWith("55") ? n : `55${n}`;
          }
          // Para cliente, usar Evolution do master
          if (!evoUrl || !evoKey || !instancia) {
            const { data: master } = await supabase.from("agencias")
              .select("evolution_url, evolution_key, whatsapp_instancia")
              .is("parent_id", null).single();
            if (master) { evoUrl = master.evolution_url; evoKey = master.evolution_key; instancia = master.whatsapp_instancia; }
          }
        }

        // Fallback para parent se filha não tiver Evolution
        if ((!evoUrl || !grupoJid) && ag?.parent_id) {
          const { data: parent } = await supabase.from("agencias")
            .select("evolution_url, evolution_key, whatsapp_instancia, grupo_notificacao_jid")
            .eq("id", ag.parent_id).single();
          if (parent) {
            evoUrl = evoUrl || parent.evolution_url || "";
            evoKey = evoKey || parent.evolution_key || "";
            instancia = instancia || parent.whatsapp_instancia || "";
            grupoJid = grupoJid || parent.grupo_notificacao_jid || "";
          }
        }

        const destino = destinoNumero || grupoJid;
        if (evoUrl && evoKey && instancia && destino) {
          const linhasCampos = camposMsg
            .filter((c: any) => c.valor?.toString().trim())
            .map((c: any) => `▪ *${c.label}:* ${c.valor}`)
            .join("\n");
          const linkWA = telefoneMsg ? `\n\n💬 ${linkWhatsApp(telefoneMsg)}` : "";
          const telFormatado = telefoneMsg ? ` — ${formatarTelefone(telefoneMsg)}` : "";
          const mensagem = desqualificado
            ? `❌ *Desqualificado${form_nome ? ` — ${form_nome}` : ""}*${telFormatado}\n\n${linhasCampos}${linkWA}`
            : `🔔 *Novo Lead${form_nome ? ` — ${form_nome}` : ""}*${telFormatado}\n\n${linhasCampos}${linkWA}`;

          await fetch(`${evoUrl}/message/sendText/${instancia}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evoKey },
            body: JSON.stringify({ number: destino, text: mensagem }),
          });
        }
      }
    } catch (eNotif: any) {
      console.error("[formularios/resposta] Erro notificação WhatsApp:", eNotif.message);
    }

    return NextResponse.json({ ok: true, resposta_id: resposta?.id, lead_id: leadId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
