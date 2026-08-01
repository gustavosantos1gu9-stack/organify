import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://salxconvert-blond.vercel.app";
const REDIRECT_URI = `${APP_URL}/api/auth/google/financas/callback`;

export async function GET() {
  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state: "financas",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
