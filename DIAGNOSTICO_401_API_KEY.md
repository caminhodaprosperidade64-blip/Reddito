# 🚨 DIAGNÓSTICO: API KEY INVÁLIDA (401)

## ❌ PROBLEMA IDENTIFICADO

O erro é claro:
```
ldnbivvqzpaqcdhxkywl.supabase.co/auth/v1/signup:1  
Failed to load resource: the server responded with a status of 401 ()
AuthApiError: Invalid API key
```

**Status 401 = Unauthorized** significa que o Supabase está rejeitando a chave API.

---

## 🔍 POSSÍVEIS CAUSAS

### 1. Projeto Foi Pausado ⏸️
O Supabase pausa projetos gratuitos após inatividade.

**Solução:**
1. Acesse: https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl
2. Se aparecer "Paused", clique em **"Restore"** ou **"Unpause"**
3. Aguarde 2-3 minutos
4. Teste novamente

### 2. Projeto Foi Deletado 🗑️
O projeto não existe mais no Supabase.

**Solução:**
1. Acesse: https://app.supabase.com/projects
2. Verifique se o projeto `ldnbivvqzpaqcdhxkywl` está na lista
3. Se NÃO aparecer, o projeto foi deletado
4. Você precisará criar um novo projeto

### 3. API Key Foi Rotacionada 🔄
A chave pode ter sido alterada no dashboard.

**Solução:**
1. Acesse: https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl/settings/api
2. Copie a nova chave **anon public**
3. Me envie a nova chave
4. Vou atualizar o código

### 4. Limite de Requisições Excedido 🚫
Plano gratuito tem limite de requisições.

**Solução:**
1. Aguarde 1 hora
2. Ou faça upgrade do plano
3. Ou crie novo projeto

---

## 🎯 SOLUÇÃO IMEDIATA: CRIAR NOVO PROJETO

Se o projeto foi deletado ou pausado, vou te guiar para criar um novo:

### PASSO 1: Criar Novo Projeto Supabase

1. Acesse: https://app.supabase.com
2. Clique em **"New Project"**
3. Preencha:
   - **Name:** Sistema Agendamento
   - **Database Password:** (anote essa senha!)
   - **Region:** South America (São Paulo) - mais próximo do Brasil
   - **Pricing Plan:** Free
4. Clique em **"Create new project"**
5. Aguarde 2-3 minutos (criação do banco)

### PASSO 2: Copiar Credenciais

1. Após criado, vá em: **Settings** > **API**
2. Copie:
   - **Project URL:** (exemplo: https://xxxxx.supabase.co)
   - **anon public key:** (exemplo: eyJhbGci...)

### PASSO 3: Me Enviar

Envie para mim:
```
URL: https://xxxxx.supabase.co
KEY: eyJhbGci...
```

Vou atualizar o código em 1 minuto!

---

## 🧪 TESTE RÁPIDO DA API KEY ATUAL

Execute este comando no console (F12) do navegador:

```javascript
// Teste direto no servidor Supabase
fetch('https://ldnbivvqzpaqcdhxkywl.supabase.co/rest/v1/', {
    method: 'GET',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmJpdnZxenBhcWNkaHhreXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQzMTEsImV4cCI6MjA4ODI0MDMxMX0.r8aeQczkDpchEKoap31QrMrSuJf7i-scjIrQZ7Sq65g',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmJpdnZxenBhcWNkaHhreXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQzMTEsImV4cCI6MjA4ODI0MDMxMX0.r8aeQczkDpchEKoap31QrMrSuJf7i-scjIrQZ7Sq65g'
    }
})
.then(async response => {
    console.log('Status:', response.status);
    console.log('OK:', response.ok);
    
    if (response.status === 401) {
        console.error('❌ API KEY INVÁLIDA - Projeto pausado ou deletado');
        console.log('Soluções:');
        console.log('1. Reativar projeto em https://app.supabase.com');
        console.log('2. Copiar nova API key');
        console.log('3. Criar novo projeto');
    } else if (response.status === 200) {
        console.log('✅ API KEY VÁLIDA - Problema pode ser outro');
        const data = await response.json();
        console.log('Resposta:', data);
    } else {
        console.warn('⚠️ Status inesperado:', response.status);
        const text = await response.text();
        console.log('Resposta:', text);
    }
})
.catch(error => {
    console.error('❌ Erro na requisição:', error);
    console.log('Possível problema de rede ou CORS');
});
```

**Me envie o resultado desse teste!**

---

## 📸 SCREENSHOTS NECESSÁRIOS

Para eu te ajudar melhor, tire screenshots de:

1. **Dashboard do Supabase:**
   - https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl
   - (mostra se está ativo/pausado/deletado)

2. **Lista de Projetos:**
   - https://app.supabase.com/projects
   - (mostra todos seus projetos)

3. **Console do Navegador:**
   - F12 > Console
   - (resultado do teste acima)

---

## 🚀 OPÇÃO ALTERNATIVA: USAR MEU PROJETO DE TESTE

**Se você quiser testar AGORA sem esperar**, posso:

1. Criar um projeto Supabase de demonstração
2. Configurar tudo
3. Te dar acesso temporário
4. Depois você migra para seu próprio projeto

**Quer fazer isso?** Me responda e eu crio em 2 minutos!

---

## 📋 CHECKLIST DE DIAGNÓSTICO

Marque o que você já verificou:

- [ ] Tentei acessar https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl
- [ ] Verifiquei se o projeto está na lista de projetos
- [ ] Verifiquei se o projeto está pausado
- [ ] Copiei nova API key do dashboard
- [ ] Executei o teste da API key no console
- [ ] Tirei screenshots solicitados

---

## 💡 RESUMO

**Problema:** API Key retorna 401 (Unauthorized)

**Causas Prováveis:**
1. ⏸️ Projeto pausado
2. 🗑️ Projeto deletado
3. 🔄 API key rotacionada
4. 🚫 Limite excedido

**Solução Mais Rápida:**
1. Criar novo projeto Supabase
2. Copiar URL + API key
3. Me enviar
4. Eu atualizo em 1 minuto
5. ✅ Sistema funcionando!

---

## 🆘 PRÓXIMOS PASSOS

**Escolha UMA opção:**

### Opção A: Verificar Projeto Atual
1. Acesse o dashboard
2. Verifique status
3. Me envie screenshot

### Opção B: Criar Novo Projeto
1. Crie novo projeto
2. Copie URL + Key
3. Me envie

### Opção C: Usar Projeto de Teste
1. Me confirme
2. Eu crio e configuro
3. Teste em 2 minutos

**Qual opção você prefere?** 🤔
