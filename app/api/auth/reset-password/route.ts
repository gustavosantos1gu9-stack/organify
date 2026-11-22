import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const SITE_URL = "https://organify-blond.vercel.app";

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.RESEND_FROM || "noreply@salxconvert.com.br";
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email obrigatório" }, { status: 400 });

    if (GMAIL_USER && GMAIL_PASS) {
      // Gmail SMTP — sem domínio próprio necessário
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${SITE_URL}/nova-senha` },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const link = data.properties?.action_link;
      if (!link) return NextResponse.json({ error: "Falha ao gerar link" }, { status: 500 });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: GMAIL_USER, pass: GMAIL_PASS },
      });

      await transporter.sendMail({
        from: `Salx Convert <${GMAIL_USER}>`,
        to: email,
        subject: "Redefinição de senha - Salx Convert",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#111;margin-bottom:8px">Redefinir sua senha</h2>
            <p style="color:#555;margin-bottom:24px">
              Você solicitou a redefinição da sua senha no Salx Convert.<br>
              Clique no botão abaixo para criar uma nova senha.
            </p>
            <a href="${link}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px">
              Redefinir minha senha
            </a>
            <p style="color:#999;font-size:12px;margin-top:24px">
              Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este email.
            </p>
          </div>
        `,
      });
      return NextResponse.json({ ok: true });
    }

    if (RESEND_API_KEY) {
      // Caminho Resend: gerar link via admin (sem rate limit do Supabase) + enviar via Resend
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${SITE_URL}/nova-senha` },
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const link = data.properties?.action_link;
      if (!link) return NextResponse.json({ error: "Falha ao gerar link" }, { status: 500 });

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [email],
          subject: "Redefinição de senha - Salx Convert",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#111;margin-bottom:8px">Redefinir sua senha</h2>
              <p style="color:#555;margin-bottom:24px">
                Você solicitou a redefinição da sua senha no Salx Convert.<br>
                Clique no botão abaixo para criar uma nova senha.
              </p>
              <a href="${link}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px">
                Redefinir minha senha
              </a>
              <p style="color:#999;font-size:12px;margin-top:24px">
                Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este email.
              </p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const errData = await emailRes.json().catch(() => ({}));
        console.error("[reset-password] Resend erro:", errData);
        return NextResponse.json({ error: "Falha ao enviar email via Resend" }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // Sem Resend: usar Supabase nativo (sujeito ao rate limit de 4/hora)
    // NÃO chamar generateLink antes — evita invalidar o token que o Supabase vai enviar
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/nova-senha`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
