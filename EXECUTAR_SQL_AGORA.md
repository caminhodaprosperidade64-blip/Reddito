# ✅ PROJETO REATIVADO - FINALIZANDO CONFIGURAÇÃO

## 🎯 CREDENCIAIS CONFIRMADAS

```
URL: https://ldnbivvqzpaqcdhxkywl.supabase.co
KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Status: ✅ ATIVO
```

---

## 📋 PRÓXIMO PASSO: CRIAR TABELAS NO BANCO

### PASSO 1: Acessar SQL Editor

1. No Supabase Dashboard, no menu lateral **ESQUERDO**, clique em:
   ```
   📝 SQL Editor
   ```

2. Clique em **"New query"** ou **"+ New Query"** (botão no topo)

---

### PASSO 2: Copiar o SQL

Abra o arquivo: **`EXECUTAR_NO_SUPABASE.sql`**

Ou copie este SQL completo:

```sql
-- ============================================
-- SCRIPT DEFINITIVO - EXECUTAR NO SUPABASE
-- ============================================

-- 1. LIMPAR TUDO (se existir)
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS profissionais CASCADE;
DROP TABLE IF EXISTS servicos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;

-- 2. CRIAR TABELAS

-- CLIENTES
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SERVIÇOS
CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    duracao INTEGER NOT NULL DEFAULT 60,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROFISSIONAIS
CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    especialidade TEXT,
    telefone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AGENDAMENTOS
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES profissionais(id) ON DELETE SET NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado')),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX idx_servicos_tenant ON servicos(tenant_id);
CREATE INDEX idx_profissionais_tenant ON profissionais(tenant_id);
CREATE INDEX idx_agendamentos_tenant ON agendamentos(tenant_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(data, hora);

-- 4. RLS (ROW LEVEL SECURITY) - ISOLAMENTO TOTAL POR TENANT

-- Ativar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- CLIENTES
CREATE POLICY "Users can view own clientes"
    ON clientes FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert own clientes"
    ON clientes FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update own clientes"
    ON clientes FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete own clientes"
    ON clientes FOR DELETE
    USING (auth.uid() = tenant_id);

-- SERVIÇOS
CREATE POLICY "Users can view own servicos"
    ON servicos FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert own servicos"
    ON servicos FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update own servicos"
    ON servicos FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete own servicos"
    ON servicos FOR DELETE
    USING (auth.uid() = tenant_id);

-- PROFISSIONAIS
CREATE POLICY "Users can view own profissionais"
    ON profissionais FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert own profissionais"
    ON profissionais FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update own profissionais"
    ON profissionais FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete own profissionais"
    ON profissionais FOR DELETE
    USING (auth.uid() = tenant_id);

-- AGENDAMENTOS
CREATE POLICY "Users can view own agendamentos"
    ON agendamentos FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert own agendamentos"
    ON agendamentos FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update own agendamentos"
    ON agendamentos FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete own agendamentos"
    ON agendamentos FOR DELETE
    USING (auth.uid() = tenant_id);

-- 5. VERIFICAÇÃO
SELECT 
    'clientes' as tabela, 
    COUNT(*) as total_registros,
    COUNT(DISTINCT tenant_id) as total_tenants
FROM clientes
UNION ALL
SELECT 'servicos', COUNT(*), COUNT(DISTINCT tenant_id) FROM servicos
UNION ALL
SELECT 'profissionais', COUNT(*), COUNT(DISTINCT tenant_id) FROM profissionais
UNION ALL
SELECT 'agendamentos', COUNT(*), COUNT(DISTINCT tenant_id) FROM agendamentos;
```

---

### PASSO 3: Executar o SQL

1. **Cole TODO o SQL** no editor
2. Clique em **"RUN"** (botão ▶️ no canto inferior direito)
3. Aguarde alguns segundos
4. Você verá: ✅ **"Success. No rows returned"** ou uma tabela com zeros

---

### PASSO 4: Verificar Tabelas Criadas

1. No menu lateral, clique em **"Table Editor"**
2. Você deve ver **4 tabelas:**
   - ✅ clientes
   - ✅ servicos
   - ✅ profissionais
   - ✅ agendamentos

---

## 🎉 DEPOIS DISSO

### PASSO 5: Publicar o Sistema

1. Volte para esta aba (GenSpark)
2. Clique em **"Publish"** (botão no topo)
3. Clique em **"Publish Now"**
4. Aguarde ~30 segundos
5. Copie a URL gerada

---

### PASSO 6: Testar o Sistema

1. Abra a URL em uma **nova aba anônima** (Ctrl+Shift+N)
2. Adicione `/login.html` no final
3. Exemplo: `https://sua-url.genspark.ai/login.html`
4. Clique em **"Criar nova conta"**
5. Digite um **email real**
6. Digite uma senha (mínimo 6 caracteres)
7. Clique em **"Criar Conta"**
8. ✅ Você verá: **"Conta criada! Verifique seu email"**

---

### PASSO 7: Confirmar Email

1. Abra seu email
2. Procure por email do Supabase
   - Pode estar em **spam** ou **promoções**
   - Assunto: "Confirm your signup"
3. Clique no link de confirmação
4. Faça login no sistema
5. 🎉 **PRONTO! Sistema 100% funcionando!**

---

## 📋 CHECKLIST RÁPIDO

- [ ] Abri SQL Editor no Supabase
- [ ] Copiei o SQL completo
- [ ] Executei o SQL (RUN)
- [ ] Vi "Success" ou tabela com zeros
- [ ] Verifiquei as 4 tabelas no Table Editor
- [ ] Publiquei o sistema no GenSpark
- [ ] Testei criar conta
- [ ] Confirmei email
- [ ] Fiz login
- [ ] ✅ Sistema funcionando!

---

## 🆘 SE DER ERRO

**No SQL:**
- Tire print do erro
- Me envie
- Vou corrigir imediatamente

**No cadastro:**
- Abra o console (F12)
- Tire print dos logs
- Me envie

---

## 🎯 RESUMO

1. ✅ Credenciais confirmadas
2. ⏳ Executar SQL (você faz - 2 min)
3. ✅ Publicar (você faz - 1 min)
4. ✅ Testar (você faz - 2 min)
5. 🎉 Sistema pronto!

---

**FAÇA AGORA O PASSO 2 e me avise quando terminar!** 🚀
