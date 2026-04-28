import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvailableSlots, createEvent } from "@/lib/google-calendar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { action, agencia_id, data: dateStr, horario, nome_lead, telefone_lead, conversa_id } = await req.json();
    if (!agencia_id) return NextResponse.json({ ok: false, motivo: "agencia_id obrigatório" });

    const { data: ag } = await supabase.from("agencias").select(
      "google_calendar_refresh_token, google_calendar_ativo, reuniao_tipo, reuniao_link_customizado, reuniao_duracao_minutos, reuniao_horario_inicio, reuniao_horario_fim, reuniao_dias_semana, reuniao_intervalo_minutos, agendamento_ativo, nome, zoom_refresh_token, zoom_ativo"
    ).eq("id", agencia_id).single();

    if (!ag) return NextResponse.json({ ok: false, motivo: "Agência não encontrada" });
    if (!ag.agendamento_ativo || !ag.google_calendar_ativo || !ag.google_calendar_refresh_token) {
      return NextResponse.json({ ok: false, motivo: "Agendamento não configurado" });
    }

    const config = {
      duracao_minutos: ag.reuniao_duracao_minutos || 60,
      horario_inicio: ag.reuniao_horario_inicio || "09:00",
      horario_fim: ag.reuniao_horario_fim || "18:00",
      dias_semana: ag.reuniao_dias_semana || [1, 2, 3, 4, 5],
      intervalo_minutos: ag.reuniao_intervalo_minutos || 0,
    };

    if (action === "listar_horarios") {
      if (!dateStr) return NextResponse.json({ ok: false, motivo: "Data obrigatória" });
      const slots = await getAvailableSlots(ag.google_calendar_refresh_token, dateStr, config);
      return NextResponse.json({ ok: true, slots, data: dateStr });
    }

    if (action === "criar_agendamento") {
      if (!dateStr || !horario) return NextResponse.json({ ok: false, motivo: "Data e horário obrigatórios" });

      const [hh, mm] = horario.split(":").map(Number);
      const startDate = new Date(`${dateStr}T${horario}:00-03:00`);
      const endDate = new Date(startDate.getTime() + config.duracao_minutos * 60000);

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      const summary = `Reunião - ${nome_lead || "Lead"}`;
      const description = `Agendado via SALX Convert\nNome: ${nome_lead || "N/A"}\nTelefone: ${telefone_lead || "N/A"}`;

      let meetingLink = "";
      const tipo = ag.reuniao_tipo || "google_meet";

      if (tipo === "google_meet") {
        const event = await createEvent(ag.google_calendar_refresh_token, {
          summary, description, startDateTime: startISO, endDateTime: endISO, addGoogleMeet: true,
        });
        meetingLink = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || "";
      } else if (tipo === "zoom" && ag.zoom_ativo && ag.zoom_refresh_token) {
        // Criar evento no Google Calendar + reunião no Zoom
        const zoomRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
          method: "POST",
          headers: { Authorization: `Bearer ${ag.zoom_refresh_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: summary, type: 2, start_time: startISO,
            duration: config.duracao_minutos, timezone: "America/Sao_Paulo",
          }),
        });
        const zoomData = await zoomRes.json();
        meetingLink = zoomData.join_url || "";

        await createEvent(ag.google_calendar_refresh_token, {
          summary, description: `${description}\n\nZoom: ${meetingLink}`,
          startDateTime: startISO, endDateTime: endISO,
        });
      } else if (tipo === "presencial") {
        await createEvent(ag.google_calendar_refresh_token, {
          summary, description, startDateTime: startISO, endDateTime: endISO,
        });
        meetingLink = "";
      } else if (tipo === "link_customizado") {
        await createEvent(ag.google_calendar_refresh_token, {
          summary, description: `${description}\n\nLink: ${ag.reuniao_link_customizado || ""}`,
          startDateTime: startISO, endDateTime: endISO,
        });
        meetingLink = ag.reuniao_link_customizado || "";
      }

      // Atualizar conversa com agendou_at
      if (conversa_id) {
        await supabase.from("conversas").update({ agendou_at: new Date().toISOString() }).eq("id", conversa_id);
      }

      return NextResponse.json({
        ok: true,
        link: meetingLink,
        data_hora: `${dateStr} ${horario}`,
        tipo,
      });
    }

    return NextResponse.json({ ok: false, motivo: "Ação inválida" });
  } catch (e: any) {
    console.error("[agendar] Erro:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
