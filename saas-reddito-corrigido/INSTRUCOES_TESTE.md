# 🚀 INSTRUÇÕES DE TESTE - SUPABASE

## ✅ CONFIGURAÇÃO CONCLUÍDA!

Seu sistema está **100% configurado** e pronto para testar!

---

## 📋 O QUE FOI FEITO:

### 1️⃣ **Supabase Configurado**
- ✅ Project URL: `https://tnbdfoanjvrepgdmdakahjcd.supabase.co`
- ✅ Anon Key: Configurada em `js/supabase-config.js`
- ✅ SQL executado: 8 tabelas criadas

### 2️⃣ **Arquivos Principais**
- ✅ `dashboard-teste.html` - Página de teste simplificada
- ✅ `dashboard.html` - Dashboard completo
- ✅ `js/supabase-config.js` - Credenciais configuradas
- ✅ `js/supabase-db.js` - API do banco de dados

### 3️⃣ **Sistema Completo**
- ✅ 11 páginas HTML funcionais
- ✅ Design profissional com paleta de cores moderna
- ✅ Integração com Supabase pronta

---

## 🎯 PRÓXIMOS PASSOS:

### **ETAPA 1: PUBLICAR O SITE**

A pré-visualização da GenSpark tem conflitos com o Supabase. Para testar corretamente:

1. **Clique na aba "Publish"** (ao lado de "Files")
2. **Clique em "Publish Now"** ou "Deploy"
3. **Aguarde 30-60 segundos**
4. **Copie a URL pública** que será gerada

---

### **ETAPA 2: TESTAR NO SITE PUBLICADO**

1. **Abra a URL no navegador**
2. **Adicione `/dashboard-teste.html` no final da URL**
   - Exemplo: `https://seu-site.genspark.ai/dashboard-teste.html`

3. **A página vai testar automaticamente:**
   - 🔄 Carregar biblioteca Supabase
   - 🔄 Criar cliente
   - 🔄 Testar conexão
   - 🔄 Buscar empresa

4. **Se tudo estiver OK, você verá:**
   - ✅ Biblioteca Supabase carregada
   - ✅ Cliente Supabase criado
   - ✅ Conexão com banco estabelecida
   - ✅ Empresa encontrada: Salão Exemplo

---

### **ETAPA 3: POPULAR DADOS**

1. **Clique no botão:** "📦 Criar Dados de Exemplo"

2. **O sistema vai criar:**
   - 3 Profissionais (Ana Silva, Carlos Santos, Maria Oliveira)
   - 5 Serviços (Corte Feminino, Corte Masculino, Coloração, Escova, Hidratação)
   - 5 Clientes (Juliana, Pedro, Fernanda, Roberto, Camila)
   - 3 Agendamentos (hoje e amanhã)

3. **Você verá os contadores atualizarem**

---

### **ETAPA 4: TESTAR O DASHBOARD COMPLETO**

1. **Acesse:** `https://seu-site.genspark.ai/dashboard.html`

2. **Abra o console (F12)** e digite:
   ```javascript
   await SupabaseUtils.test()
   ```

3. **Você deve ver:**
   ```
   ✅ Conexão com Supabase OK!
   ✅ Empresa configurada: Salão Exemplo
   ```

4. **Recarregue a página (F5)**
   - O dashboard deve mostrar os dados criados
   - Gráficos devem aparecer
   - Cards com números de hoje/semana/mês

---

## 🔍 RESOLUÇÃO DE PROBLEMAS:

### ❌ Se der erro "SupabaseUtils is not defined"
**Solução:** Limpe o cache do navegador (Ctrl+Shift+R)

### ❌ Se der erro "empresas: permission denied"
**Solução:** Execute o SQL novamente no Supabase

### ❌ Se der erro "Failed to fetch"
**Solução:** Verifique se a URL e anon key estão corretas em `js/supabase-config.js`

### ❌ Se o botão ficar travado em "Carregando..."
**Solução:** Abra o console (F12) e veja o erro. Copie e me envie.

---

## 📊 APÓS POPULAR OS DADOS:

Você poderá testar **todas as páginas**:

1. **Dashboard** (`/dashboard.html`)
   - Ver resumo geral
   - Gráficos de desempenho
   - Próximos agendamentos

2. **Agenda** (`/agenda.html`)
   - Ver calendário semanal
   - Criar novos agendamentos
   - Editar horários

3. **Clientes** (`/clientes.html`)
   - Listar todos os clientes
   - Adicionar novo cliente
   - Editar/excluir clientes

4. **Serviços** (`/servicos.html`)
   - Ver catálogo de serviços
   - Adicionar novos serviços
   - Definir preços e comissões

5. **Profissionais** (`/profissionais.html`)
   - Gerenciar equipe
   - Vincular serviços
   - Definir cores na agenda

6. **Financeiro** (`/financeiro.html`)
   - Ver receitas e despesas
   - Calcular comissões
   - Relatórios por período

7. **Relatórios** (`/relatorios.html`)
   - Gráficos de desempenho
   - Análise por profissional
   - Serviços mais vendidos

8. **WhatsApp** (`/whatsapp.html`)
   - Configurar mensagens automáticas
   - Conectar API (futuro)

9. **Configurações** (`/configuracoes.html`)
   - Dados da empresa
   - Horários de funcionamento
   - Intervalo entre consultas

10. **Página Pública** (`/agendar.html`)
    - Link para clientes agendarem
    - 4 passos: serviço → profissional → horário → confirmação

---

## 🎯 RESUMO DO QUE FAZER AGORA:

```
1. Clicar em "Publish" → "Publish Now"
2. Copiar a URL pública
3. Abrir: URL/dashboard-teste.html
4. Clicar em "Criar Dados de Exemplo"
5. Abrir: URL/dashboard.html
6. Explorar todas as páginas!
```

---

## 💬 PRECISA DE AJUDA?

Se tiver qualquer erro ou dúvida:
1. Pressione F12
2. Copie a mensagem de erro do console
3. Me envie a captura de tela

---

## 🚀 BOA SORTE!

Seu sistema está pronto para decolar! 🎉

Em 5 minutos você terá um **SaaS de agendamento completo** rodando com banco de dados real!

---

**Criado com ❤️ pela GenSpark AI**
