import { NextResponse } from "next/server";

export async function GET() {
  // Retorna página que seta sessionStorage e redireciona
  const html = `<!DOCTYPE html>
<html><head><title>Fix</title></head>
<body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center">
<p>Corrigindo sessão...</p>
<script>
  sessionStorage.setItem("agencia_selecionada", "32cdce6e-4664-4ac6-979d-6d68a1a68745");
  setTimeout(() => { window.location.href = "/clientes"; }, 500);
</script>
</div>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
