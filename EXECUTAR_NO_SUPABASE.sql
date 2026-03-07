-- ============================================
-- SCRIPT DEFINITIVO - EXECUTAR NO SUPABASE
-- ============================================
-- Acesse: https://ldnbivvqzpaqcdhxkywl.supabase.co
-- Vá em: SQL Editor > New Query
-- Cole TUDO aqui e clique em RUN
-- ============================================

-- 1. LIMPAR TUDO
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

-- 5. DADOS DE EXEMPLO (OPCIONAL - SERÁ CRIADO POR CADA USUÁRIO)
-- Não incluímos dados iniciais porque cada tenant deve criar seus próprios

-- 6. VERIFICAÇÃO
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

-- ============================================
-- SUCESSO! 
-- ============================================
-- Agora você pode:
-- 1. Criar uma conta em /login.html
-- 2. Confirmar o email
-- 3. Fazer login
-- 4. Começar a usar o sistema!
-- ============================================
