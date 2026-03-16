# Organify — Plataforma de gestão para agências

## Stack
- **Frontend**: Next.js 14 + React 18 + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Gráficos**: Recharts
- **Ícones**: Lucide React
- **Hospedagem**: Vercel (frontend) + Supabase (backend)

---

## Estrutura de pastas

```
organify/
├── app/
│   ├── login/                  ← Página de login
│   └── (app)/                  ← Área autenticada
│       ├── page.tsx            ← Dashboard
│       ├── clientes/           ← Gestão de clientes
│       ├── crm/                ← Pipeline de leads
│       ├── dre/                ← Relatório financeiro
│       ├── financeiro/
│       │   ├── movimentacoes/
│       │   ├── lancamentos-futuros/
│       │   └── recorrencias/
│       └── configuracoes/
│           ├── agencia/
│           └── integracoes/
├── components/
│   ├── layout/                 ← Sidebar + Topbar
│   ├── ui/                     ← KPICard, PeriodSelector
│   ├── clientes/               ← Modal cadastro 3 etapas
│   └── financeiro/             ← Modal nova movimentação
├── lib/
│   ├── supabase.ts             ← Cliente Supabase
│   └── utils.ts                ← Formatação, helpers
├── types/
│   └── index.ts                ← Tipos TypeScript
└── supabase-schema.sql         ← Schema completo do banco
```

---

## Setup local

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie um projeto gratuito
2. No painel do Supabase → SQL Editor → cole o conteúdo de `supabase-schema.sql` e execute

### 3. Variáveis de ambiente
Crie um arquivo `.env.local` na raiz:
```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```
(As chaves estão em Supabase → Settings → API)

### 4. Rodar o projeto
```bash
npm run dev
```
Acesse: http://localhost:3000

---

## Deploy (produção)

### Frontend → Vercel
```bash
npm install -g vercel
vercel
```
Configure as mesmas variáveis de ambiente no painel da Vercel.

### Backend → já está no Supabase (nada a fazer)

---

## Rastreamento UTM (campanhas de tráfego)

### Como funciona
1. Você cria links de anúncio com UTMs:
```
https://wa.me/5551999999999?text=Olá!
  &utm_source=facebook
  &utm_medium=cpc
  &utm_campaign=nome-da-campanha
  &utm_content=publico-mulheres-30-45
  &utm_term=anuncio-video-01
```

2. Quando o lead manda mensagem, a **Evolution API** captura os UTMs e envia ao endpoint:
```
POST https://seu-dominio.com/api/leads/SUA_CHAVE_API
{
  "name": "Nome do lead",
  "phone": "51999999999",
  "utm_source": "facebook",
  "utm_campaign": "nome-da-campanha",
  "utm_content": "publico-mulheres-30-45",
  "utm_term": "anuncio-video-01"
}
```

3. O sistema cria o lead automaticamente com todos os UTMs rastreados

### Relatório de conversão por público
A view `vw_conversao_por_publico` mostra:
- Qual público (`utm_content`) trouxe mais leads
- Taxa de conversão lead → cliente por público
- Por campanha e origem

---

## Módulos implementados

| Módulo | Status |
|--------|--------|
| Dashboard com KPIs | ✅ |
| Seletor de período | ✅ |
| Gráficos (linha, barra, pizza) | ✅ |
| Sidebar colapsável | ✅ |
| Login | ✅ |
| Clientes — lista + busca | ✅ |
| Clientes — cadastro 3 etapas | ✅ |
| CRM — tabela + kanban | ✅ |
| Financeiro — Movimentações | ✅ |
| Financeiro — Lançamentos futuros | ✅ |
| Financeiro — Recorrências | ✅ |
| DRE | ✅ |
| Configurações — Agência | ✅ |
| Configurações — Integrações (WA/OpenAI/Asaas) | ✅ |
| Schema Supabase completo | ✅ |
| UTM tracking no banco | ✅ |
| RLS (segurança por agência) | ✅ |

## Próximos passos sugeridos
- [ ] Autenticação real com Supabase Auth
- [ ] Conectar todas as páginas ao banco de dados
- [ ] Webhook Evolution API para captura automática de leads
- [ ] Gerador de links com UTM embutido na plataforma
- [ ] Relatório de conversão por público (dashboard UTM)
- [ ] Notificações WhatsApp automáticas (cobranças)
