# ⚡ CONFIGURAÇÃO EXATA PARA SEU SISTEMA

## 🎯 URL DO SISTEMA
```
https://rwlknmwb.gensparkspace.com
```

---

## 📋 CONFIGURAR NO SUPABASE (COPIAR E COLAR)

### PASSO 1: Acessar Configurações

1. **Acesse:** https://supabase.com/dashboard/project/ldnbivvqzpaqcdhxkywl/auth/url-configuration

2. **Ou navegue:**
   - Menu lateral → **Authentication**
   - Aba → **URL Configuration**

---

### PASSO 2: Configurar URLs

#### Site URL
```
https://rwlknmwb.gensparkspace.com
```
**Cole exatamente isso no campo "Site URL"**

#### Redirect URLs

Clique em **"Add URL"** e adicione **cada uma** destas URLs:

```
https://rwlknmwb.gensparkspace.com/**
```

```
https://rwlknmwb.gensparkspace.com/dashboard.html
```

```
https://rwlknmwb.gensparkspace.com/login.html
```

```
https://rwlknmwb.gensparkspace.com/aguardando-confirmacao.html
```

**Depois de adicionar todas, clique em "Save"**

---

### PASSO 3: Personalizar Email de Confirmação

1. **Ainda em Authentication, clique em:**
   - **Email Templates**

2. **Selecione:** "Confirm signup"

3. **Cole este template:**

```html
<h2>Bem-vindo ao Sistema de Agendamento! 🎉</h2>

<p>Olá!</p>

<p>Obrigado por se cadastrar em nosso <strong>Sistema de Agendamento</strong>.</p>

<p>Para ativar sua conta e começar a usar todas as funcionalidades, clique no botão abaixo:</p>

<table cellpadding="0" cellspacing="0" border="0" style="margin: 30px auto;">
  <tr>
    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
      <a href="{{ .ConfirmationURL }}" 
         style="display: inline-block; padding: 15px 40px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">
        ✅ Confirmar Minha Conta
      </a>
    </td>
  </tr>
</table>

<p style="margin-top: 20px;">Ou copie e cole este link no seu navegador:</p>
<p style="word-break: break-all; color: #667eea; font-size: 12px;">{{ .ConfirmationURL }}</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

<p style="color: #666; font-size: 13px;">
  Se você não criou esta conta, pode ignorar este email com segurança.
</p>

<p style="color: #666; font-size: 12px; margin-top: 20px;">
  <strong>Sistema de Agendamento</strong><br>
  Gestão profissional e completa para seu negócio<br>
  📅 Agendamentos • 👥 Clientes • 💰 Financeiro • 📊 Relatórios
</p>
```

4. **Clique em "Save"**

---

## 🧪 TESTAR AGORA

### Opção A: Criar Nova Conta (Recomendado)

1. **Acesse:** https://rwlknmwb.gensparkspace.com/login.html
2. **Clique em:** "Criar nova conta"
3. **Use outro email** (diferente do anterior)
4. **Crie a conta**
5. **Verifique o email** (deve chegar personalizado)
6. **Clique no link**
7. ✅ **Deve funcionar!**

### Opção B: Reconfirmar Email Anterior

Se quiser usar o mesmo email que já tentou:

1. **Acesse:** https://rwlknmwb.gensparkspace.com/aguardando-confirmacao.html
2. **Clique em:** "Reenviar Email"
3. **Verifique seu email**
4. **Clique no novo link**
5. ✅ **Deve funcionar!**

---

## 📊 CHECKLIST DE CONFIGURAÇÃO

### No Supabase
- [ ] Acessei Authentication → URL Configuration
- [ ] Configurei Site URL: `https://rwlknmwb.gensparkspace.com`
- [ ] Adicionei 4 Redirect URLs
- [ ] Cliquei em "Save"
- [ ] Acessei Email Templates
- [ ] Selecionei "Confirm signup"
- [ ] Colei o template HTML
- [ ] Cliquei em "Save"

### Teste
- [ ] Criei nova conta (ou reenviei email)
- [ ] Recebi email personalizado
- [ ] Link de confirmação funcionou
- [ ] Fui redirecionado para login
- [ ] Consegui fazer login
- [ ] Acessei o dashboard

---

## 🎨 COMO VAI FICAR

### Email Antes (atual)
```
confirm your signup
follow this link to confirm your user:
[link quebrado]
```

### Email Depois (novo)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sistema de Agendamento 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bem-vindo ao Sistema de Agendamento! 

Olá!

Obrigado por se cadastrar em nosso 
Sistema de Agendamento.

Para ativar sua conta e começar a usar 
todas as funcionalidades, clique no 
botão abaixo:

    ┌───────────────────────────┐
    │ ✅ Confirmar Minha Conta  │
    └───────────────────────────┘
         (botão roxo bonito)

Ou copie e cole este link:
https://rwlknmwb.gensparkspace.com/...

──────────────────────────────────

Se você não criou esta conta, pode 
ignorar este email com segurança.

Sistema de Agendamento
Gestão profissional e completa para 
seu negócio
📅 Agendamentos • 👥 Clientes 
💰 Financeiro • 📊 Relatórios
```

---

## 🚀 FLUXO COMPLETO

```
1. Usuário cria conta
   ↓
2. Email personalizado é enviado
   ↓
3. Usuário clica no link do email
   ↓
4. Supabase confirma o email
   ↓
5. Redireciona para: https://rwlknmwb.gensparkspace.com/dashboard.html
   ↓
6. Sistema detecta confirmação
   ↓
7. Usuário faz login
   ↓
8. ✅ Dashboard carregado!
```

---

## 🆘 SE AINDA NÃO FUNCIONAR

**Possíveis problemas:**

1. **URLs não foram salvas corretamente**
   - Solução: Verifique se clicou em "Save"
   - Recarregue a página e confirme

2. **Email ainda está em cache**
   - Solução: Use outro email para testar
   - Ou aguarde 5 minutos

3. **Link ainda aponta para URL antiga**
   - Solução: Reenvie o email (será gerado com nova URL)

---

## 💡 PRÓXIMOS PASSOS

Após configurar:

1. ✅ Teste criar uma conta
2. ✅ Verifique se email chega personalizado
3. ✅ Confirme que link funciona
4. ✅ Me avise se deu tudo certo!

---

## 📸 PRINTS PARA CONFERIR

### URL Configuration deve estar assim:
```
Site URL: https://rwlknmwb.gensparkspace.com

Redirect URLs:
✓ https://rwlknmwb.gensparkspace.com/**
✓ https://rwlknmwb.gensparkspace.com/dashboard.html
✓ https://rwlknmwb.gensparkspace.com/login.html
✓ https://rwlknmwb.gensparkspace.com/aguardando-confirmacao.html
```

---

**CONFIGURE AGORA E ME AVISE QUANDO TERMINAR!** 🚀

**Se der qualquer erro, tire print e me envie que resolvo na hora!** ✅
