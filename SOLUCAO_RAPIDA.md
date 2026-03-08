# 🔑 SOLUÇÃO RÁPIDA - API KEY INVÁLIDA

## ❌ ERRO
```
Invalid API key
```

## ✅ SOLUÇÃO (2 MINUTOS)

### 1️⃣ Acessar Supabase
```
https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl/settings/api
```

### 2️⃣ Copiar a Chave "anon public"
- Encontrar: **Project API keys**
- Procurar: **anon** ou **public**
- Clicar: 👁️ (mostrar)
- Clicar: 📋 (copiar)

### 3️⃣ Colar no Código
**Arquivo:** `js/supabase-config.js`  
**Linha:** 11

```javascript
anonKey: 'COLE_SUA_CHAVE_AQUI'
```

### 4️⃣ Publicar
```
Publish → Publish Now
```

### 5️⃣ Testar
```
Abrir /login.html
Console deve mostrar: ✅ Cliente inicializado
```

---

## 📋 A CHAVE DEVE TER ESTE FORMATO

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...muito_longa...xyz
```

**Características:**
- ✅ Começa com `eyJ`
- ✅ Tem 3 partes separadas por `.`
- ✅ Tem ~300 caracteres
- ✅ Sem espaços

---

## ⚠️ NÃO USE

- ❌ service_role key (é secreta!)
- ❌ Chave incompleta
- ❌ Chave antiga/expirada

---

**DEPOIS DE ATUALIZAR A CHAVE, VAI FUNCIONAR!** ✅

Consulte **CORRIGIR_API_KEY.md** para instruções detalhadas.
