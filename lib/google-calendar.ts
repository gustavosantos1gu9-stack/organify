const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error("[GCal] Erro ao obter access token:", JSON.stringify(data));
    // Sinalizar token expirado/revogado para que o chamador possa agir
    if (data.error === "invalid_grant" || data.error === "token_revoked") {
      throw Object.assign(new Error("TOKEN_EXPIRADO"), { tokenExpirado: true });
    }
    throw new Error(`GCal auth error: ${data.error || "unknown"}`);
  }
  return data.access_token;
}

interface BusySlot { start: string; end: string; }

export async function getFreeBusy(refreshToken: string, timeMin: string, timeMax: string): Promise<BusySlot[]> {
  try {
    const accessToken = await getAccessToken(refreshToken);
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: "America/Sao_Paulo",
        items: [{ id: "primary" }],
      }),
    });
    const data = await res.json();
    return data.calendars?.primary?.busy || [];
  } catch (e: any) {
    if (e?.tokenExpirado) throw e; // propagar para cima
    console.error("[GCal] getFreeBusy erro:", e?.message);
    return [];
  }
}

interface MeetingConfig {
  duracao_minutos: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  intervalo_minutos: number;
}

export async function getAvailableSlots(refreshToken: string, date: string, config: MeetingConfig, preloadedBusy?: BusySlot[]): Promise<string[]> {
  const dayOfWeek = new Date(date + "T12:00:00-03:00").getDay();
  if (!config.dias_semana.includes(dayOfWeek)) return [];

  const busy = preloadedBusy ?? await getFreeBusy(refreshToken, `${date}T00:00:00-03:00`, `${date}T23:59:59-03:00`);

  const slots: string[] = [];
  const [startH, startM] = config.horario_inicio.split(":").map(Number);
  const [endH, endM] = config.horario_fim.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const step = config.duracao_minutos + config.intervalo_minutos;

  for (let min = startMin; min + config.duracao_minutos <= endMin; min += step) {
    const slotStart = new Date(`${date}T00:00:00-03:00`);
    slotStart.setHours(0, 0, 0, 0);
    slotStart.setMinutes(slotStart.getMinutes() + min + slotStart.getTimezoneOffset() + 180);

    const slotEnd = new Date(slotStart.getTime() + config.duracao_minutos * 60000);

    const conflict = busy.some(b => {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
    });

    if (!conflict) {
      const hh = String(Math.floor(min / 60)).padStart(2, "0");
      const mm = String(min % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

// Buscar slots de múltiplos dias com 1 única chamada ao Google (1 token + 1 freeBusy)
export async function getAvailableSlotsMultipleDays(
  refreshToken: string, dates: string[], config: MeetingConfig
): Promise<{ data: string; slots: string[] }[]> {
  const validDates = dates.filter(date => {
    const dayOfWeek = new Date(date + "T12:00:00-03:00").getDay();
    return config.dias_semana.includes(dayOfWeek);
  });
  if (!validDates.length) return [];

  const timeMin = `${validDates[0]}T00:00:00-03:00`;
  const timeMax = `${validDates[validDates.length - 1]}T23:59:59-03:00`;
  const allBusy = await getFreeBusy(refreshToken, timeMin, timeMax);

  return validDates.map(date => {
    const dayStart = new Date(`${date}T00:00:00-03:00`).getTime();
    const dayEnd = new Date(`${date}T23:59:59-03:00`).getTime();
    const dayBusy = allBusy.filter(b => {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      return bStart < dayEnd && bEnd > dayStart;
    });
    const slots = getAvailableSlotsSync(date, config, dayBusy);
    return { data: date, slots };
  });
}

// Versão síncrona (sem fetch) pra usar com busy pré-carregado
function getAvailableSlotsSync(date: string, config: MeetingConfig, busy: BusySlot[]): string[] {
  const slots: string[] = [];
  const [startH, startM] = config.horario_inicio.split(":").map(Number);
  const [endH, endM] = config.horario_fim.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const step = config.duracao_minutos + config.intervalo_minutos;

  for (let min = startMin; min + config.duracao_minutos <= endMin; min += step) {
    const slotStart = new Date(`${date}T00:00:00-03:00`);
    slotStart.setHours(0, 0, 0, 0);
    slotStart.setMinutes(slotStart.getMinutes() + min + slotStart.getTimezoneOffset() + 180);
    const slotEnd = new Date(slotStart.getTime() + config.duracao_minutos * 60000);

    const conflict = busy.some(b => {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
    });
    if (!conflict) {
      const hh = String(Math.floor(min / 60)).padStart(2, "0");
      const mm = String(min % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

interface CreateEventOpts {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmail?: string;
  addGoogleMeet?: boolean;
}

export async function createEvent(refreshToken: string, opts: CreateEventOpts) {
  const accessToken = await getAccessToken(refreshToken); // throws TOKEN_EXPIRADO se inválido

  const event: any = {
    summary: opts.summary,
    description: opts.description || "",
    start: { dateTime: opts.startDateTime, timeZone: "America/Sao_Paulo" },
    end: { dateTime: opts.endDateTime, timeZone: "America/Sao_Paulo" },
  };

  if (opts.attendeeEmail) {
    event.attendees = [{ email: opts.attendeeEmail }];
  }

  if (opts.addGoogleMeet) {
    event.conferenceData = {
      createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }

  const url = opts.addGoogleMeet
    ? "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1"
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[GCal] Erro ao criar evento:", JSON.stringify(data));
    throw new Error(`Google Calendar erro ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  }
  console.log(`[GCal] Evento criado: ${data.id} - ${data.summary}`);
  return data;
}

// Buscar eventos por nome (summary) num intervalo de datas
export async function findEvents(refreshToken: string, query: string, timeMin: string, timeMax: string) {
  try {
    const accessToken = await getAccessToken(refreshToken);
    const params = new URLSearchParams({ q: query, timeMin, timeMax, singleEvents: "true", orderBy: "startTime" });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return data.items || [];
  } catch (e: any) {
    if (e?.tokenExpirado) throw e;
    console.error("[GCal] findEvents erro:", e?.message);
    return [];
  }
}

// Deletar evento pelo ID
export async function deleteEvent(refreshToken: string, eventId: string) {
  const accessToken = await getAccessToken(refreshToken);
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Erro ao deletar evento: ${res.status}`);
  }
  console.log(`[GCal] Evento deletado: ${eventId}`);
}
