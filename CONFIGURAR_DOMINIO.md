# 🌐 CONFIGURAR DOMÍNIO PERSONALIZADO - redditoapp.com

## 🎯 OBJETIVO

Substituir: `https://rwlknmwb.gensparkspace.com`  
Por: `https://www.redditoapp.com` ou `https://redditoapp.com`

---

## 📋 PASSOS COMPLETOS

### PARTE 1: CONFIGURAR DNS (No seu provedor de domínio)

Você precisa acessar o painel onde comprou/gerencia o domínio (GoDaddy, Registro.br, Hostinger, etc.)

#### Opção A: Usar www.redditoapp.com (Recomendado)

Adicione este registro DNS:

```
Tipo: CNAME
Nome: www
Valor: rwlknmwb.gensparkspace.com
TTL: 3600 (ou automático)
```

#### Opção B: Usar redditoapp.com (sem www)

Adicione estes registros DNS:

```
Tipo: A
Nome: @
Valor: [IP do GenSparkSpace - precisamos descobrir]
TTL: 3600
```

E também:
```
Tipo: CNAME
Nome: www
Valor: rwlknmwb.gensparkspace.com
TTL: 3600
```

**🔍 Qual provedor você usa?** (GoDaddy, Registro.br, Hostinger, outro?)

---

### PARTE 2: CONFIGURAR NO GENSPARKSPACE

⚠️ **IMPORTANTE:** O GenSparkSpace pode não suportar domínios personalizados diretamente. Neste caso, temos 2 alternativas:

#### Alternativa 1: Usar Cloudflare (Grátis e Recomendado)

**Vantagens:**
- ✅ Grátis
- ✅ CDN global (site mais rápido)
- ✅ SSL automático
- ✅ Proteção DDoS
- ✅ Cache inteligente

**Passo a passo:**

1. **Criar conta no Cloudflare**
   - Acesse: https://dash.cloudflare.com/sign-up
   - Cadastre-se (grátis)

2. **Adicionar domínio**
   - Clique em "Add site"
   - Digite: `redditoapp.com`
   - Selecione plano: **Free**

3. **Configurar DNS**
   ```
   Tipo: CNAME
   Nome: www
   Destino: rwlknmwb.gensparkspace.com
   Proxy: ✅ Ativado (nuvem laranja)
   ```
   
   ```
   Tipo: CNAME
   Nome: @
   Destino: rwlknmwb.gensparkspace.com
   Proxy: ✅ Ativado (nuvem laranja)
   ```

4. **Atualizar Nameservers**
   - Cloudflare vai te dar 2 nameservers (exemplo):
     ```
     ns1.cloudflare.com
     ns2.cloudflare.com
     ```
   - Você precisa atualizar isso no seu provedor de domínio

5. **Configurar redirecionamento www → não-www (ou vice-versa)**
   - Em Cloudflare: Rules → Page Rules
   - Criar regra:
     ```
     Se URL: redditoapp.com/*
     Então: Redirecionar 301 para https://www.redditoapp.com/$1
     ```

6. **SSL/TLS**
   - Em Cloudflare: SSL/TLS
   - Selecione: **Full** ou **Flexible**

---

#### Alternativa 2: Fazer Deploy em Vercel/Netlify (Recomendado para Produção)

Se você quiser um deploy mais profissional:

**Vercel (Recomendado):**
1. Criar conta: https://vercel.com/signup
2. Conectar com GitHub
3. Fazer deploy do projeto
4. Adicionar domínio personalizado
5. SSL automático

**Netlify:**
1. Criar conta: https://app.netlify.com/signup
2. Fazer drag & drop dos arquivos
3. Adicionar domínio personalizado
4. SSL automático

---

### PARTE 3: CONFIGURAR NO SUPABASE

Depois que o domínio estiver apontando corretamente, atualizar no Supabase:

**Authentication → URL Configuration:**

```
Site URL: https://www.redditoapp.com
```

**Redirect URLs:**
```
https://www.redditoapp.com/**
https://redditoapp.com/**
https://www.redditoapp.com/dashboard.html
https://www.redditoapp.com/login.html
https://www.redditoapp.com/aguardando-confirmacao.html
```

---

### PARTE 4: ATUALIZAR CÓDIGO (Se necessário)

Se você fizer deploy em Vercel/Netlify, não precisa alterar nada no código!

Se usar apenas DNS, pode ser necessário atualizar alguns links absolutos.

---

## 🎯 RECOMENDAÇÃO FINAL

**Para um sistema profissional de venda, recomendo:**

### Setup Ideal:
```
Domínio: redditoapp.com (você já tem ✅)
         ↓
Cloudflare: DNS + CDN + SSL (grátis)
         ↓
Vercel/Netlify: Hosting profissional (grátis)
         ↓
Supabase: Backend + Database (você já tem ✅)
```

**Vantagens:**
- ✅ Domínio personalizado
- ✅ SSL/HTTPS automático
- ✅ CDN global (rápido em todo mundo)
- ✅ Deploy automático (Git push → site atualiza)
- ✅ 99.9% uptime
- ✅ Grátis ou muito barato

---

## 🚀 QUAL CAMINHO VOCÊ PREFERE?

### Opção 1: Cloudflare + GenSparkSpace ⚡
- **Tempo:** 15 minutos
- **Custo:** Grátis
- **Complexidade:** Baixa
- **Resultado:** Domínio funcionando

### Opção 2: Cloudflare + Vercel 🌟 (RECOMENDADO)
- **Tempo:** 20 minutos
- **Custo:** Grátis
- **Complexidade:** Média
- **Resultado:** Setup profissional completo

### Opção 3: Apenas DNS (Básico)
- **Tempo:** 5 minutos
- **Custo:** Grátis
- **Complexidade:** Baixa
- **Resultado:** Pode ter problemas de SSL

---

## 📞 INFORMAÇÕES QUE PRECISO

Para te ajudar melhor, me diga:

1. **Onde você comprou/gerencia o domínio redditoapp.com?**
   - [ ] GoDaddy
   - [ ] Registro.br
   - [ ] Hostinger
   - [ ] Namecheap
   - [ ] Outro: __________

2. **Qual setup você prefere?**
   - [ ] Opção 1: Cloudflare + GenSparkSpace
   - [ ] Opção 2: Cloudflare + Vercel (profissional)
   - [ ] Opção 3: Apenas DNS básico

3. **Você tem acesso ao painel DNS do domínio?**
   - [ ] Sim
   - [ ] Não, preciso de ajuda

---

## 🎨 COMO VAI FICAR

### Antes:
```
https://rwlknmwb.gensparkspace.com/login.html
```

### Depois:
```
https://www.redditoapp.com/login.html
```

**Muito mais profissional!** 🎉

---

## 💡 BONUS: CONFIGURAÇÕES EXTRAS

Depois que configurar o domínio, posso te ajudar com:

- 📧 Email profissional: contato@redditoapp.com
- 🔒 SSL/HTTPS avançado
- 📊 Google Analytics
- 🎨 Favicon personalizado
- 📱 PWA (App instalável)
- 🚀 Performance optimization

---

**Me diga qual opção você prefere e qual seu provedor de domínio!** 🌐

**Vou te dar o passo a passo completo e específico!** ✅
