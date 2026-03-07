# 🔑 INSTRUÇÕES PARA CORRIGIR A API KEY

## ❌ PROBLEMA
```
Invalid API key
```

A chave do Supabase está **incorreta, truncada ou expirada**.

---

## ✅ SOLUÇÃO (3 MINUTOS)

### PASSO 1: Acessar o Supabase Dashboard

**URL direta:**
```
https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl/settings/api
```

Ou manualmente:
1. Ir para: https://app.supabase.com
2. Fazer login
3. Clicar no projeto **ldnbivvqzpaqcdhxkywl**
4. No menu lateral, clicar em **Settings** ⚙️
5. Clicar em **API**

---

### PASSO 2: Copiar a Chave Correta

Na página de API, você verá:

```
Project API keys
├─ anon public ← ESTA É A QUE VOCÊ PRECISA!
│  └─ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... [👁️] [📋]
└─ service_role (NUNCA USE ESTA NO FRONTEND!)
```

**Fazer:**
1. Encontrar a seção **"anon"** ou **"public"**
2. Clicar no ícone 👁️ (olho) para revelar a chave
3. Clicar no ícone 📋 (copiar) para copiar a chave completa
4. A chave deve ter aproximadamente **300-400 caracteres**

---

### PASSO 3: Atualizar o Código

Abra o arquivo `js/supabase-config.js` e substitua:

**LINHA 11 - ENCONTRAR:**
```javascript
anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmJpdnZxenBhcWNkaHhreXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQzMTEsImV4cCI6MjA4ODI0MDMxMX0.r8aeQczkDpchEKoap31QrMrSuJf7i-scjIrQvZ7Sq65g'
```

**SUBSTITUIR POR:**
```javascript
anonKey: 'COLE_AQUI_A_CHAVE_QUE_VOCÊ_COPIOU'
```

**Exemplo de como deve ficar:**
```javascript
const SUPABASE_CONFIG = {
    url: 'https://ldnbivvqzpaqcdhxkywl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmJpdnZxenBhcWNkaHhreXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MzAzMjAsImV4cCI6MjA1NjAwNjMyMH0.SUA_CHAVE_COMPLETA_AQUI'
};
```

---

### PASSO 4: Salvar e Republicar

1. **Salvar** o arquivo `js/supabase-config.js`
2. **Republicar** o projeto:
   ```
   Publish → Publish Now
   ```
3. Aguardar ~30 segundos
4. **Testar** novamente

---

## 🧪 COMO TESTAR SE DEU CERTO

### 1. Abrir Console (F12)
```
https://sua-url.genspark.ai/login.html
```

### 2. Verificar Logs

**ANTES (com erro):**
```
❌ Invalid API key
❌ Erro ao criar cliente
```

**DEPOIS (correto):**
```
✅ [Supabase] Cliente inicializado com SUCESSO!
✅ [Supabase] .auth: object
✅ [Supabase] .from: function
```

### 3. Testar Criar Conta
```
1. Clicar "Criar nova conta"
2. Preencher dados
3. Clicar "Criar Conta"
```

**Deve aparecer:**
```
✅ Conta criada! Verifique seu email.
```

---

## 🚨 SE AINDA DER ERRO

### Verificar se a Chave Está Completa

A chave deve:
- ✅ Começar com `eyJ`
- ✅ Ter 3 partes separadas por `.` (ponto)
- ✅ Ter no mínimo 200 caracteres
- ✅ Não ter espaços ou quebras de linha

**Exemplo de chave válida:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmJpdnZxenBhcWNkaHhreXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MzAzMjAsImV4cCI6MjA1NjAwNjMyMH0.x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0
```

### Verificar se Está Usando a Chave Certa

**CERTO:** ✅ anon / public key  
**ERRADO:** ❌ service_role key (esta é secreta!)

### Verificar se o Projeto Existe

Acessar:
```
https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl
```

Se não carregar ou mostrar erro 404:
- O projeto foi deletado OU
- Você não tem acesso OU
- O ID está errado

---

## 📞 CHECKLIST

- [ ] Acessei o Supabase Dashboard
- [ ] Fui em Settings → API
- [ ] Copiei a chave **anon public** completa
- [ ] Colei no `js/supabase-config.js` na linha 11
- [ ] Salvei o arquivo
- [ ] Republiquei o projeto
- [ ] Testei e funcionou ✅

---

## 🎯 PRÓXIMO PASSO

**Depois de atualizar a chave:**

1. ✅ Publicar
2. ✅ Abrir /login.html
3. ✅ Verificar console (deve ver logs verdes)
4. ✅ Criar uma conta de teste
5. ✅ Confirmar que funciona

---

**A CHAVE É O ÚNICO PROBLEMA. CORRIJA E VAI FUNCIONAR!** 🔑✅
