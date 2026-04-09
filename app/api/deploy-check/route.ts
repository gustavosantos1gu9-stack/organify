// app/api/deploy-check/route.ts
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ version: "20260409-v2", deployed: true });
}
