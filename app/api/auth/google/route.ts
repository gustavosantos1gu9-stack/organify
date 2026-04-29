import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app"}/api/auth/google/callback`;

export async function GET(req: NextRequest) {
  const agenciaId = req.nextUrl.searchParams.get("agencia_id");
  if (!agenciaId) return NextResponse.json({ error: "agencia_id obrigatório" }, { status: 400 });

  const state = Buffer.from(JSON.stringify({ agencia_id: agenciaId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
