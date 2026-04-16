import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

async function handleProxy(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");
  const apiKey = searchParams.get("key");
  const method = searchParams.get("method") || req.method;

  if (!targetUrl || !apiKey) {
    return NextResponse.json({ error: "url and key required" }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      "apikey": apiKey,
      "Content-Type": "application/json",
    };

    const fetchOptions: RequestInit = { method, headers };

    if (method === "POST" || method === "PUT") {
      try {
        const body = await req.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {}
    }

    const res = await fetch(targetUrl, fetchOptions);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
