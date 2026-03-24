'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const campos = [
  { name: 'nome', label: 'Nome completo', placeholder: 'Insira seu nome completo.', type: 'text' },
  { name: 'cnpj', label: 'CNPJ', placeholder: 'Informe o CNPJ da sua empresa.', type: 'text' },
  { name: 'cpf', label: 'CPF', placeholder: 'Informe seu CPF.', type: 'text' },
  { name: 'rg', label: 'RG', placeholder: 'Informe seu RG.', type: 'text' },
  { name: 'endereco_empresa', label: 'Endereço da Empresa', placeholder: 'Endereço completo da sua empresa.', type: 'textarea' },
  { name: 'endereco_pessoal', label: 'Endereço Pessoal', placeholder: 'Seu endereço pessoal.', type: 'textarea' },
  { name: 'email', label: 'Email', placeholder: 'Informe seu email.', type: 'email' },
  { name: 'investimento_anuncios', label: 'Investimento em anúncios', placeholder: 'Valor que pretende investir em anúncios.', type: 'text' },
  { name: 'ticket_micro_laser', label: 'Ticket da micro/laser', placeholder: 'Ticket médio para micro/laser.', type: 'text' },
  { name: 'regiao_anunciar', label: 'Região/cidade para anunciar', placeholder: 'Região ou cidade onde deseja anunciar.', type: 'text' },
  { name: 'faturamento_medio', label: 'Faturamento médio', placeholder: 'Faturamento médio da sua empresa.', type: 'text' },
  { name: 'login_facebook', label: 'Login do Facebook', placeholder: 'Informe seu login do Facebook.', type: 'text' },
  { name: 'senha_facebook', label: 'Senha do Facebook', placeholder: 'Informe sua senha do Facebook.', type: 'password' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #ddd',
  borderRadius: 8, fontSize: 14, color: '#111', background: '#fafafa',
  boxSizing: 'border-box', resize: 'vertical',
}

export default function CadastroPage() {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(campos.map(c => [c.name, '']))
  )
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setErro('')
    const vazio = campos.find(c => !form[c.name]?.trim())
    if (vazio) { setErro(`Campo obrigatório: ${vazio.label}`); return }
    setLoading(true)
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      router.push('/cadastro/confirmacao')
    } catch {
      setErro('Erro ao enviar. Tente novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '40px 36px', maxWidth: 640, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="Salx Digital" style={{ height: 48, marginBottom: 16 }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>Formulário de Cadastro de Cliente</h1>
          <p style={{ color: '#666', marginTop: 8, fontSize: 14 }}>
            Por favor, preencha as informações abaixo para que possamos iniciar sua assessoria.
          </p>
        </div>
        {campos.map(campo => (
          <div key={campo.name} style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#222' }}>
              {campo.label} <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            {campo.type === 'textarea' ? (
              <textarea name={campo.name} placeholder={campo.placeholder} value={form[campo.name]}
                onChange={handleChange} rows={3} maxLength={2000} style={inputStyle}/>
            ) : (
              <input name={campo.name} type={campo.type} placeholder={campo.placeholder}
                value={form[campo.name]} onChange={handleChange} style={inputStyle}/>
            )}
          </div>
        ))}
        {erro && <p style={{ color: '#e53e3e', fontSize: 13, marginBottom: 16 }}>{erro}</p>}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: '14px', background: '#29ABE2', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Enviando...' : 'Enviar Cadastro'}
        </button>
      </div>
    </div>
  )
}
