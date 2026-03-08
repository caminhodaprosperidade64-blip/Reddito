# 🔴 DIAGNÓSTICO: Invalid API Key

## 🔍 POSSÍVEIS CAUSAS

### 1. Projeto Supabase Não Existe Mais

**Testar:**
```
Acessar: https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl
```

**Se mostrar erro 404 ou "Project not found":**
- O projeto foi deletado OU
- O ID do projeto está errado OU
- Você não tem acesso

### 2. Projeto Foi Pausado (Free Tier)

Projetos Supabase gratuitos são **pausados após 7 dias de inatividade**.

**Como reativar:**
1. Acessar: https://app.supabase.com
2. Encontrar o projeto na lista
3. Clicar em "Restore" ou "Resume"
4. Aguardar 2-3 minutos

### 3. Chave Errada (Improvável)

A chave fornecida parece válida, mas pode haver caracteres invisíveis.

---

## ✅ SOLUÇÃO: CRIAR NOVO PROJETO

Se o projeto antigo não existe mais, vamos criar um novo:

### PASSO 1: Criar Novo Projeto Supabase

1. **Acessar:** https://app.supabase.com
2. **Clicar:** "New Project"
3. **Preencher:**
   - Name: `sistema-agendamento`
   - Database Password: `(escolher senha forte)`
   - Region: `South America (São Paulo)` (mais próximo)
4. **Clicar:** "Create new project"
5. **Aguardar:** ~2 minutos (criação)

### PASSO 2: Copiar Credenciais do Novo Projeto

Após criar, ir em **Settings → API**:

1. **Project URL:** `https://xxxxx.supabase.co`
2. **anon public key:** `eyJhbGc...`

### PASSO 3: Atualizar o Código

Substitua no `js/supabase-config.js`:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://SEU_NOVO_PROJECT_ID.supabase.co',
    anonKey: 'SUA_NOVA_CHAVE_ANON'
};
```

### PASSO 4: Criar Tabelas no Novo Projeto

Ir em **SQL Editor** e executar este script:

```sql
-- Criar tabelas
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2),
    duracao INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    especialidade TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    cliente_id UUID REFERENCES clientes(id),
    servico_id UUID REFERENCES servicos(id),
    profissional_id UUID REFERENCES profissionais(id),
    data_hora TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pendente',
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuários veem apenas seus dados"
ON clientes FOR ALL
USING (tenant_id = auth.uid());

CREATE POLICY "Usuários veem apenas seus dados"
ON servicos FOR ALL
USING (tenant_id = auth.uid());

CREATE POLICY "Usuários veem apenas seus dados"
ON profissionais FOR ALL
USING (tenant_id = auth.uid());

CREATE POLICY "Usuários veem apenas seus dados"
ON agendamentos FOR ALL
USING (tenant_id = auth.uid());
```

### PASSO 5: Publicar e Testar

1. Publicar o projeto
2. Testar login
3. Criar conta
4. Usar o sistema

---

## 🚀 ALTERNATIVA RÁPIDA: USAR PROJETO DEMO

Se não quiser criar novo projeto, posso configurar com um projeto demo público para você testar o sistema.

---

## 📞 O QUE FAZER AGORA?

**Opção 1:** Verificar se o projeto existe
```
https://app.supabase.com/project/ldnbivvqzpaqcdhxkywl
```

**Opção 2:** Criar novo projeto e me enviar:
- URL do projeto
- anon public key

**Opção 3:** Reativar projeto pausado (se for o caso)

---

**Me envie screenshot do Supabase Dashboard ou confirme se quer criar novo projeto.** 📸
