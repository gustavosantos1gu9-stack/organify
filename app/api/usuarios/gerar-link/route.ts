import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://www.salxconvert.com.br";

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const body = await req.json();
    const { email, type = "recovery" } = body;
    if (!email) return NextResponse.json({ error: "email obrigatório" }, { status: 400 });

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: type === "magiclink" ? "magiclink" : "recovery",
      email,
      options: { redirectTo: BASE_URL },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ link: data.properties?.action_link });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
