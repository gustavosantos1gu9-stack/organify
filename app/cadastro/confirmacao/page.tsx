export default function ConfirmacaoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '48px 40px', maxWidth: 480, textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 12 }}>Cadastro enviado!</h1>
        <p style={{ color: '#555', fontSize: 15, lineHeight: 1.6 }}>
          Recebemos suas informações. Nossa equipe entrará em contato em breve para dar início à sua assessoria.
        </p>
        <p style={{ color: '#29ABE2', fontWeight: 600, marginTop: 24, fontSize: 14 }}>Salx Digital</p>
      </div>
    </div>
  )
}
