# Sistema de Agendamento - RedditoApp

Sistema completo de agendamento multi-tenant com Supabase.

## 🚀 Deploy

Este projeto está configurado para deploy automático no Vercel.

## 🌐 Domínio

- Produção: https://www.redditoapp.com
- Preview: https://sistema-agendamento.vercel.app

## 🔧 Tecnologias

- Frontend: HTML5, CSS3, JavaScript
- Backend: Supabase (PostgreSQL + Auth)
- Hosting: Vercel
- CDN: Cloudflare

## 📦 Estrutura

```
/
├── index.html          # Landing page
├── login.html          # Login e cadastro
├── dashboard.html      # Dashboard principal
├── agenda.html         # Calendário
├── clientes.html       # Gestão de clientes
├── servicos.html       # Gestão de serviços
├── profissionais.html  # Gestão de profissionais
├── financeiro.html     # Controle financeiro
├── relatorios.html     # Relatórios
├── js/
│   ├── supabase-config.js
│   ├── auth.js
│   └── database.js
└── css/
    └── dashboard.css
```

## 🔐 Segurança

- RLS (Row Level Security) no Supabase
- JWT authentication
- HTTPS obrigatório
- Headers de segurança configurados

## 📄 Licença

Proprietário: RedditoApp
