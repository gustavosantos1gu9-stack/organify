import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ deploy: "2026-04-25T02:56:25.958Z", version: "limit1-fix" });
}
