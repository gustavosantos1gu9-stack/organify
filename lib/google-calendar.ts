const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export async function getAccessToken(refreshToken: string): Promise<string | null> {
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
  return data.access_token || null;
}

interface BusySlot { start: string; end: string; }

export async function getFreeBusy(refreshToken: string, timeMin: string, timeMax: string): Promise<BusySlot[]> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return [];

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
}

interface MeetingConfig {
  duracao_minutos: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  intervalo_minutos: number;
}

export async function getAvailableSlots(refreshToken: string, date: string, config: MeetingConfig): Promise<string[]> {
  const dayOfWeek = new Date(date + "T12:00:00-03:00").getDay();
  if (!config.dias_semana.includes(dayOfWeek)) return [];

  const timeMin = `${date}T00:00:00-03:00`;
  const timeMax = `${date}T23:59:59-03:00`;
  const busy = await getFreeBusy(refreshToken, timeMin, timeMax);

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
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) throw new Error("Token inválido");

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

  return res.json();
}
