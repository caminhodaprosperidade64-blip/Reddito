# SaaS Agendamento Pro — Guia de Instalação e Deploy

## Visão Geral

Sistema SaaS completo para gestão de salões de beleza, clínicas e estabelecimentos de serviços. Inclui agendamento online, controle financeiro por profissional, relatórios detalhados e integração com WhatsApp.

---

## Pré-requisitos

- Conta no [Supabase](https://supabase.com) (gratuita)
- Hospedagem estática (Vercel, Netlify, GitHub Pages ou qualquer servidor web)

---

## PASSO 1 — Configurar o Banco de Dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. No painel do projeto, vá em **SQL Editor**
3. Clique em **New Query**
4. Cole o conteúdo do arquivo `SCHEMA_DEFINITIVO.sql` e execute
5. Aguarde a mensagem: `Schema criado com sucesso!`

> **Importante:** Use o arquivo `SCHEMA_DEFINITIVO.sql` — ele é o mais completo e correto, incluindo todos os campos necessários (`comissao_percentual`, `cor_agenda`, `valor`, etc.).

---

## PASSO 2 — Configurar as Credenciais

Abra o arquivo `js/supabase-config.js` e atualize com as credenciais do seu projeto Supabase:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://SEU-PROJETO.supabase.co',        // Project URL
    anonKey: 'SUA-ANON-KEY-AQUI'                   // anon/public key
};
```

**Onde encontrar as credenciais:**
- No painel Supabase → **Settings** → **API**
- Copie o **Project URL** e a **anon public key**

---

## PASSO 3 — Deploy

### Opção A: Vercel (Recomendado)
1. Crie uma conta em [vercel.com](https://vercel.com)
2. Faça upload da pasta do projeto ou conecte ao GitHub
3. Deploy automático — sem configuração adicional

### Opção B: Netlify
1. Crie uma conta em [netlify.com](https://netlify.com)
2. Arraste a pasta do projeto para o painel
3. Deploy instantâneo

### Opção C: GitHub Pages
1. Faça push do código para um repositório GitHub
2. Vá em **Settings** → **Pages**
3. Selecione a branch `main` como fonte

### Opção D: Servidor Próprio (Apache/Nginx)
Copie todos os arquivos para a pasta `public_html` ou `www` do seu servidor.

---

## PASSO 4 — Primeiro Acesso

1. Acesse a URL do sistema
2. Clique em **Criar Conta** na tela de login
3. Informe e-mail e senha
4. Confirme o e-mail (verifique a caixa de entrada)
5. Faça login e comece a usar!

---

## Estrutura do Projeto

```
/
├── index.html                  → Página inicial
├── login.html                  → Tela de login/cadastro
├── dashboard.html              → Painel principal
├── agenda.html                 → Agenda de agendamentos
├── clientes.html               → Gestão de clientes
├── servicos.html               → Gestão de serviços
├── profissionais.html          → Gestão de profissionais
├── financeiro.html             → Controle financeiro
├── relatorios.html             → Relatórios e gráficos
├── configuracoes.html          → Configurações do sistema
├── whatsapp.html               → Integração WhatsApp
├── SCHEMA_DEFINITIVO.sql       → SQL definitivo para criar o banco
├── css/
│   ├── pro-design-system.css
│   └── pro-components.css
└── js/
    ├── supabase-config.js      → Configuração do Supabase
    ├── auth.js                 → Autenticação
    ├── database.js             → Operações no banco (v2.0)
    └── pro-ui.js               → Componentes de UI
```

---

## Funcionalidades

| Módulo | Status |
|---|---|
| Login / Cadastro | Funcionando |
| Dashboard com métricas e gráficos | Funcionando |
| Agenda diária com horários | Funcionando |
| Gestão de Clientes (CRUD) | Funcionando |
| Gestão de Serviços (CRUD) | Funcionando |
| Gestão de Profissionais (CRUD) | Funcionando |
| Controle Financeiro por profissional | Funcionando |
| Relatórios com gráficos reais | Funcionando |
| Configurações e dados de exemplo | Funcionando |
| WhatsApp (integração) | Em desenvolvimento |

---

## Segurança

O sistema utiliza **Row Level Security (RLS)** do Supabase, garantindo que cada cliente (tenant) acesse apenas seus próprios dados. Cada usuário cadastrado é um tenant isolado.

---

## Correções Aplicadas (v2.0)

1. **database.js** — Adicionado `getDB()` para acessar `window.supabase` corretamente
2. **database.js** — Adicionada função `DB.agendamentos.proximos()` (usada no dashboard)
3. **database.js** — Adicionada função `DB.agendamentos.completos()` (usada no financeiro)
4. **database.js** — Adicionada função `DB.financeiro.relatorio()` (usada no financeiro e relatórios)
5. **database.js** — Adicionada função `DB.financeiro.ultimos7Dias()` (usada nos gráficos)
6. **database.js** — Adicionados aliases `DB.dashboard.stats()` e `DB.dashboard.receitaUltimos7Dias()`
7. **database.js** — Adicionada função `DB.popularDadosExemplo()` (usada nas configurações)
8. **agenda.html** — Corrigido acesso a `a.cliente.nome` sem verificação de null
9. **financeiro.html** — Corrigida dupla chamada de `loadFinanceiro()`
10. **relatorios.html** — Gráfico mensal agora usa dados reais (não mais `Math.random()`)
11. **relatorios.html** — Corrigido erro de sintaxe (backslash incorreto)
12. **SCHEMA_DEFINITIVO.sql** — Schema completo com todos os campos necessários

---

## Suporte

Para dúvidas ou suporte, entre em contato com o desenvolvedor.
