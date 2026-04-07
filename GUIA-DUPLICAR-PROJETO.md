# GUIA COMPLETO: Duplicar o SALX Convert para uma nova agência

## Visão Geral do Projeto

O SALX Convert é uma plataforma de gestão para agências de marketing digital, feito em:
- **Frontend/Backend:** Next.js 14 (App Router) com TypeScript
- **Banco de dados:** Supabase (PostgreSQL)
- **WhatsApp:** Evolution API (self-hosted)
- **Anúncios:** Meta Ads API (Facebook/Instagram)
- **Contratos:** Autentique API (assinatura digital)
- **Deploy:** Vercel
- **Autenticação:** Supabase Auth (email/senha)

---

## PASSO 1 — Criar novo repositório GitHub

```bash
# Clonar o projeto original
git clone https://github.com/gustavosantos1gu9-stack/organify.git novo-projeto
cd novo-projeto

# Remover histórico do git e começar limpo
rm -rf .git
git init
git add .
git commit -m "initial commit"

# Criar novo repo no GitHub e fazer push
git remote add origin https://github.com/SEU-USUARIO/novo-projeto.git
git branch -M main
git push -u origin main
```

---

## PASSO 2 — Criar novo projeto no Supabase

1. Acesse https://supabase.com e crie uma nova conta/projeto
2. Anote as credenciais:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **Anon Key:** (em Settings > API > anon/public)
   - **Service Role Key:** (em Settings > API > service_role) — NUNCA expor no frontend
3. Vá em **SQL Editor** no painel do Supabase
4. Cole e execute TODO o conteúdo do arquivo `schema.sql` que está na raiz do projeto
5. Isso vai criar todas as 42 tabelas vazias

### Criar o primeiro usuário admin

No SQL Editor do Supabase, rode:

```sql
-- Primeiro, crie o usuário via Authentication > Users > Add User no painel do Supabase
-- Depois, crie a agência:
INSERT INTO agencias (nome, email) VALUES ('Nome da Agência', 'email@agencia.com');

-- Pegue o ID da agência criada:
SELECT id FROM agencias WHERE email = 'email@agencia.com';

-- Vincule o usuário à agência (use o ID do auth.users e da agencia):
INSERT INTO usuarios (id, email, nome, agencia_id, role)
VALUES ('ID-DO-AUTH-USER', 'email@agencia.com', 'Nome Admin', 'ID-DA-AGENCIA', 'master');
```

---

## PASSO 3 — Configurar Evolution API (WhatsApp)

A Evolution API é o servidor que conecta o WhatsApp. Você precisa de uma instância rodando.

### Opção A: Usar serviço hospedado
- Contratar em https://evolution-api.com ou hospedar no Hetzner/Contabo/VPS

### Opção B: Self-hosted com Docker
```bash
docker run -d \
  --name evolution \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=sua-chave-aqui \
  atendai/evolution-api:latest
```

Anote:
- **Evolution URL:** `https://seu-servidor:8080` (ou domínio com HTTPS)
- **Evolution API Key:** a chave que você definiu

A conexão do WhatsApp é feita pelo próprio sistema (tela de Integrações > WhatsApp).

---

## PASSO 4 — Configurar variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
# ═══ SUPABASE ═══
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...sua-service-role-key

# ═══ APP ═══
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app

# ═══ CRON (proteger endpoints de cron) ═══
CRON_SECRET=gerar-uma-string-aleatoria-aqui

# ═══ AUTENTIQUE (contratos - opcional) ═══
AUTENTIQUE_TOKEN=seu-token-autentique

# ═══ CRIPTOGRAFIA (cadastros - opcional) ═══
CADASTRO_ENCRYPT_KEY=chave-de-32-caracteres-aqui
```

**IMPORTANTE:** As credenciais do Evolution API e Meta Ads NÃO ficam no .env — ficam no banco de dados (tabela `agencias`), configuradas pela interface do sistema.

---

## PASSO 5 — Deploy na Vercel

1. Acesse https://vercel.com
2. Clique em "Add New Project"
3. Importe o repositório do GitHub
4. Em **Environment Variables**, adicione TODAS as variáveis do `.env.local` acima
5. Clique em Deploy
6. Após o deploy, anote a URL (ex: `https://novo-projeto.vercel.app`)
7. Atualize a variável `NEXT_PUBLIC_APP_URL` com essa URL

### Configurar Cron Jobs na Vercel

O arquivo `vercel.json` na raiz já define os crons. Se não existir, crie:

```json
{
  "crons": [
    { "path": "/api/cron/relatorios", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/alertas", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/churn", "schedule": "0 0 1 * *" }
  ]
}
```

---

## PASSO 6 — Primeiro acesso e configuração

1. Acesse `https://seu-dominio.vercel.app/login`
2. Faça login com o usuário criado no Passo 2
3. Vá em **Integrações** e configure:
   - **WhatsApp:** Cole a URL e API Key do Evolution, crie instância e escaneie o QR Code
   - **Meta Ads:** Cole o token de acesso do Facebook Business
4. Vá em **Relatórios Meta > Conexões** para configurar a instância separada de relatórios (opcional)

---

## ESTRUTURA DO PROJETO

```
/app
  /(app)              → Páginas autenticadas (dashboard, clientes, inbox, etc.)
  /api                → API Routes (webhook, evolution, meta-ads, etc.)
  /cadastro           → Formulário público de cadastro de clientes
  /login              → Página de login
  /relatorio          → Página pública de relatório

/components           → Componentes reutilizáveis
/lib                  → Hooks, config, utilitários
/public               → Assets estáticos
```

---

## TABELAS PRINCIPAIS DO BANCO

| Tabela | Descrição |
|--------|-----------|
| `agencias` | Dados da agência (config, tokens, integrações) |
| `usuarios` | Usuários do sistema vinculados à agência |
| `clientes` | Clientes da agência (CRM) |
| `controle_clientes` | Pipeline de controle interno |
| `conversas` | Conversas do WhatsApp (inbox) |
| `mensagens` | Mensagens de cada conversa |
| `leads` | Leads do CRM |
| `relatorios` | Relatórios Meta Ads configurados |
| `relatorios_conexoes` | Conexão WhatsApp separada para relatórios |
| `cadastros_clientes` | Formulários de cadastro preenchidos |
| `jornada_etapas` | Etapas da jornada do cliente (funil) |
| `links_campanha` | Links rastreáveis gerados |
| `movimentacoes` | Financeiro - movimentações |
| `recorrencias` | Financeiro - recorrências |
| `alertas_saldo` | Alertas de saldo de anúncios |
| `times` | Times/squads da agência |
| `metas` | Metas de vendas |

---

## COISAS QUE PRECISAM SER PERSONALIZADAS

1. **`app/api/cadastros/aprovar/route.ts`** — O `AGENCIA_ID` está hardcoded. Mudar para dinâmico ou atualizar com o novo ID
2. **`app/api/contrato/route.ts`** — Os dados da CONTRATADA (SALX Company, CNPJ, endereço) estão no texto do contrato. Atualizar para a nova empresa
3. **`app/api/contrato/route.ts`** — O email de auto-assinatura `gustavosantos1gu9@gmail.com` precisa ser trocado
4. **`components/layout/Sidebar.tsx`** — Logo e nome "SALX Convert" — trocar para a nova marca
5. **Domínio** — Configurar domínio personalizado na Vercel

---

## CHECKLIST FINAL

- [ ] Repo clonado e publicado no GitHub
- [ ] Projeto Supabase criado
- [ ] Schema.sql executado no SQL Editor
- [ ] Usuário admin criado (Auth + tabela usuarios)
- [ ] Agência criada na tabela agencias
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy na Vercel feito
- [ ] Login funcionando
- [ ] WhatsApp conectado (Evolution API)
- [ ] Meta Ads conectado (token do Facebook)
- [ ] AGENCIA_ID hardcoded atualizado
- [ ] Dados do contrato atualizados
- [ ] Cron jobs configurados
