# GUIA COMPLETO: Duplicar o SALX Convert (do zero, contas novas)

Este guia serve para uma IA (ou desenvolvedor) configurar uma cópia 100% independente deste projeto, criando todas as contas do zero, sem usar nenhuma conta existente.

---

## Visão Geral do Projeto

Plataforma de gestão para agências de marketing digital. Tecnologias:
- **Frontend/Backend:** Next.js 14 (App Router) com TypeScript
- **Banco de dados:** Supabase (PostgreSQL hospedado)
- **WhatsApp:** Evolution API (servidor de WhatsApp)
- **Anúncios:** Meta Ads API (Facebook/Instagram)
- **Contratos:** Autentique API (assinatura digital)
- **Deploy:** Vercel (hospedagem do site)
- **Autenticação:** Supabase Auth (email/senha)

---

## PASSO 1 — Criar conta no GitHub e subir o código

### 1.1 Criar conta no GitHub
1. Acesse https://github.com
2. Clique em "Sign Up"
3. Crie a conta com email, senha e nome de usuário
4. Confirme o email

### 1.2 Criar repositório e subir o código
1. No GitHub, clique no "+" no canto superior direito > "New repository"
2. Dê um nome (ex: `minha-plataforma`)
3. Deixe como **Private** (privado)
4. Clique em "Create repository"
5. No terminal do computador, rode:

```bash
# Entrar na pasta do projeto (que você recebeu)
cd caminho/para/o/projeto

# Iniciar git e subir
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/SEU-USUARIO/minha-plataforma.git
git branch -M main
git push -u origin main
```

Se pedir login, use seu usuário e um Personal Access Token (GitHub > Settings > Developer Settings > Personal Access Tokens > Generate new token, marcar "repo").

---

## PASSO 2 — Criar conta e projeto no Supabase (Banco de Dados)

### 2.1 Criar conta
1. Acesse https://supabase.com
2. Clique em "Start your project"
3. Faça login com GitHub (a conta que acabou de criar)
4. Crie uma **Organization** (nome da empresa)

### 2.2 Criar projeto
1. Clique em "New Project"
2. Preencha:
   - **Name:** nome do projeto (ex: `minha-plataforma`)
   - **Database Password:** crie uma senha forte e ANOTE ela
   - **Region:** escolha "South America (São Paulo)" se for Brasil
3. Clique em "Create new project"
4. Aguarde ~2 minutos para o projeto ser criado

### 2.3 Anotar as credenciais (MUITO IMPORTANTE)
1. No painel do Supabase, vá em **Settings** (engrenagem) > **API**
2. Anote estes 3 valores:
   - **Project URL:** algo como `https://abcdefgh.supabase.co`
   - **anon public key:** começa com `eyJ...` (chave pública)
   - **service_role key:** começa com `eyJ...` (chave secreta — NUNCA expor no frontend)

### 2.4 Criar as tabelas
1. No painel do Supabase, vá em **SQL Editor** (no menu lateral)
2. Clique em "New query"
3. Abra o arquivo `schema.sql` que está na raiz do projeto
4. Copie TODO o conteúdo e cole no SQL Editor
5. Clique em "Run" (ou Ctrl+Enter)
6. Deve aparecer "Success" — todas as 42 tabelas foram criadas

### 2.5 Criar o primeiro usuário administrador
1. No painel do Supabase, vá em **Authentication** > **Users**
2. Clique em "Add User" > "Create new user"
3. Preencha:
   - **Email:** o email do administrador
   - **Password:** a senha de login
   - Marque "Auto Confirm User"
4. Clique em "Create user"
5. **Anote o User UID** que aparece na lista de usuários (coluna UUID)

Agora vá em **SQL Editor** e rode estes comandos (substituindo os valores):

```sql
-- Criar a agência
INSERT INTO agencias (nome, email)
VALUES ('NOME DA SUA AGÊNCIA', 'email@daagencia.com');

-- Ver o ID da agência criada (anote esse ID!)
SELECT id, nome FROM agencias;

-- Vincular o usuário à agência (substitua os valores!)
INSERT INTO usuarios (id, email, nome, agencia_id, role)
VALUES (
  'COLE-AQUI-O-USER-UID-DO-PASSO-5',
  'email@daagencia.com',
  'Nome do Admin',
  'COLE-AQUI-O-ID-DA-AGENCIA',
  'master'
);
```

---

## PASSO 3 — Criar conta na Vercel (Hospedagem do site)

### 3.1 Criar conta
1. Acesse https://vercel.com
2. Clique em "Sign Up"
3. Escolha "Continue with GitHub" (usa a conta do Passo 1)
4. Autorize o acesso

### 3.2 Criar o projeto
1. Clique em "Add New..." > "Project"
2. Na lista de repositórios, encontre o repo que criou no Passo 1 e clique "Import"
3. **ANTES de clicar Deploy**, configure as variáveis de ambiente:

Clique em "Environment Variables" e adicione CADA uma dessas:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | A URL do Supabase (ex: `https://abcdefgh.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A anon key do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | A service_role key do Supabase |
| `NEXT_PUBLIC_APP_URL` | Deixe em branco por enquanto (vai preencher depois) |
| `CRON_SECRET` | Gere uma string aleatória qualquer (ex: `minhachavesecreta123abc`) |
| `AUTENTIQUE_TOKEN` | Deixe em branco se não vai usar contratos agora |
| `CADASTRO_ENCRYPT_KEY` | Gere uma string de 32 caracteres qualquer |

4. Clique em **Deploy**
5. Aguarde o build (~2-3 minutos)
6. Quando terminar, a Vercel vai mostrar a URL do site (ex: `https://minha-plataforma.vercel.app`)
7. Volte em **Settings > Environment Variables** e atualize `NEXT_PUBLIC_APP_URL` com essa URL
8. Vá em **Deployments** e clique nos 3 pontinhos do último deploy > "Redeploy"

### 3.3 Configurar Cron Jobs
1. Na Vercel, verifique se o arquivo `vercel.json` existe na raiz do projeto com os crons
2. Se não existir, crie no código com este conteúdo e faça push:

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

## PASSO 4 — Configurar Evolution API (WhatsApp)

O Evolution API é um servidor que conecta o WhatsApp ao sistema. Você tem 3 opções:

### Opção A: Hospedar no Hetzner (mais barato, ~3 EUR/mês)
1. Crie conta em https://www.hetzner.com
2. Crie um servidor VPS (CX22, Ubuntu 22.04)
3. Acesse via SSH e rode:

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Rodar Evolution API
docker run -d \
  --name evolution \
  --restart always \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=CRIE-UMA-CHAVE-FORTE-AQUI \
  -e AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true \
  atendai/evolution-api:latest
```

4. Anote:
   - **URL:** `http://IP-DO-SERVIDOR:8080`
   - **API Key:** a chave que você definiu no `AUTHENTICATION_API_KEY`

5. (Recomendado) Configure um domínio com HTTPS usando Nginx + Certbot

### Opção B: Hospedar no Contabo (mais potente)
- Mesmo processo do Hetzner, só muda o provedor (https://contabo.com)

### Opção C: Usar serviço gerenciado
- Contratar em https://evolution-api.com (pagamento mensal, sem precisar configurar servidor)

**IMPORTANTE:** A URL do Evolution e a API Key são configuradas DENTRO do sistema (Integrações), não no .env.

---

## PASSO 5 — Criar conta na Autentique (Contratos — opcional)

Só precisa se for usar a funcionalidade de envio de contratos digitais.

1. Acesse https://www.autentique.com.br
2. Crie uma conta
3. Vá em **Configurações** > **API** > copie o **Token**
4. Na Vercel, adicione a variável `AUTENTIQUE_TOKEN` com esse token
5. Faça redeploy

---

## PASSO 6 — Primeiro acesso e configurações no sistema

### 6.1 Login
1. Acesse `https://sua-url.vercel.app/login`
2. Faça login com o email e senha do usuário criado no Passo 2.5

### 6.2 Conectar WhatsApp
1. Vá em **Integrações** (ou **Configurações** > **Integrações**)
2. Na seção WhatsApp:
   - Cole a **URL** do Evolution API (do Passo 4)
   - Cole a **API Key** do Evolution API
   - Defina um nome para a instância (ex: `whatsapp`)
   - Clique em **Criar Instância**
   - Escaneie o **QR Code** com o WhatsApp do celular
3. Aguarde aparecer "Conectado"

### 6.3 Conectar Meta Ads (Facebook)
1. Acesse https://developers.facebook.com
2. Crie uma conta de desenvolvedor (se não tiver)
3. Crie um app (tipo Business)
4. Gere um **System User Token** com permissões: `ads_read`, `ads_management`, `business_management`
5. No sistema, vá em **Integrações** > **Meta Ads** e cole o token

### 6.4 Configurar WhatsApp dos Relatórios (opcional)
1. Vá em **Relatórios Meta** > **Conexões**
2. Configure uma instância separada do Evolution para envio de relatórios
3. Isso permite usar um número de WhatsApp diferente para enviar relatórios automáticos

---

## PASSO 7 — Personalizar o sistema para a nova marca

Estes arquivos precisam ser editados para trocar dados da empresa original:

### 7.1 Dados do contrato
**Arquivo:** `app/api/contrato/route.ts`
- Linha ~48: Trocar nome da empresa, CNPJ, endereço (dados da CONTRATADA)
- Linha ~365: Trocar o email `gustavosantos1gu9@gmail.com` pelo email do novo dono
- Linha ~226: Trocar telefone e email de contato

### 7.2 ID da agência hardcoded
**Arquivo:** `app/api/cadastros/aprovar/route.ts`
- Linha 9: Trocar o `AGENCIA_ID` pelo ID da nova agência (aquele do Passo 2.5)

### 7.3 Logo e marca
**Arquivo:** `components/layout/Sidebar.tsx`
- Trocar o logo e o nome "SALX Convert" pela nova marca

### 7.4 Formulário de cadastro
**Arquivo:** `app/cadastro/page.tsx`
- Verificar se o `agencia_id` padrão está correto (deve ser o ID da nova agência)

---

## RESUMO DAS CONTAS QUE FORAM CRIADAS

| Serviço | URL | Para que serve |
|---------|-----|---------------|
| **GitHub** | github.com | Guardar o código |
| **Supabase** | supabase.com | Banco de dados + autenticação |
| **Vercel** | vercel.com | Hospedar o site |
| **Hetzner/Contabo** | hetzner.com | Servidor do WhatsApp (Evolution API) |
| **Autentique** | autentique.com.br | Contratos digitais (opcional) |
| **Meta for Developers** | developers.facebook.com | Token do Meta Ads (opcional) |

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

## CHECKLIST FINAL

- [ ] Conta GitHub criada
- [ ] Código subido no repositório privado
- [ ] Conta Supabase criada
- [ ] Projeto Supabase criado (região São Paulo)
- [ ] Schema.sql executado no SQL Editor (42 tabelas)
- [ ] Usuário admin criado (Authentication + tabela usuarios)
- [ ] Agência criada na tabela agencias
- [ ] Conta Vercel criada (via GitHub)
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Deploy feito com sucesso
- [ ] Login funcionando no sistema
- [ ] Servidor Evolution API rodando
- [ ] WhatsApp conectado (QR Code escaneado)
- [ ] AGENCIA_ID hardcoded atualizado no código
- [ ] Dados do contrato atualizados (nome empresa, CNPJ, email)
- [ ] Logo/marca trocados
- [ ] Cron jobs configurados
- [ ] (Opcional) Meta Ads conectado
- [ ] (Opcional) Autentique configurado
- [ ] (Opcional) Domínio personalizado na Vercel

---

## CUSTOS ESTIMADOS (mensal)

| Serviço | Plano | Custo |
|---------|-------|-------|
| GitHub | Free | R$ 0 |
| Supabase | Free (até 500MB) | R$ 0 |
| Vercel | Hobby (Free) | R$ 0 |
| Servidor Evolution (Hetzner CX22) | VPS | ~R$ 20/mês |
| Autentique | Free (5 docs/mês) | R$ 0 |
| **TOTAL mínimo** | | **~R$ 20/mês** |
