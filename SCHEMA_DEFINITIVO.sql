-- ============================================
-- SCHEMA DEFINITIVO - SaaS Agendamento Pro
-- ============================================
-- INSTRUÇÕES:
-- 1. Acesse https://supabase.com/dashboard
-- 2. Vá em SQL Editor
-- 3. Cole TODO este conteúdo e execute
-- ============================================

-- PASSO 1: LIMPAR TABELAS ANTIGAS (se existirem)
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS profissionais CASCADE;
DROP TABLE IF EXISTS servicos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP VIEW IF EXISTS v_agendamentos_completos CASCADE;
DROP VIEW IF EXISTS v_financeiro_diario CASCADE;
DROP VIEW IF EXISTS v_financeiro_mensal CASCADE;

-- ============================================
-- PASSO 2: CRIAR TABELAS
-- ============================================

-- TABELA: clientes
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

-- TABELA: servicos
CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    duracao INTEGER NOT NULL DEFAULT 60,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0,
    descricao TEXT,
    categoria TEXT DEFAULT 'outros',
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: profissionais
CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    especialidade TEXT,
    telefone TEXT,
    email TEXT,
    comissao_percentual NUMERIC(5,2) DEFAULT 0,
    cor_agenda TEXT DEFAULT '#667eea',
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: agendamentos
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES profissionais(id) ON DELETE SET NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'confirmado' CHECK (status IN ('agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado')),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PASSO 3: ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX idx_clientes_nome ON clientes(nome);
CREATE INDEX idx_servicos_tenant ON servicos(tenant_id);
CREATE INDEX idx_profissionais_tenant ON profissionais(tenant_id);
CREATE INDEX idx_agendamentos_tenant ON agendamentos(tenant_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(data, hora);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_agendamentos_profissional ON agendamentos(profissional_id);

-- ============================================
-- PASSO 4: ROW LEVEL SECURITY (RLS)
-- Isolamento total por tenant
-- ============================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas para CLIENTES
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (auth.uid() = tenant_id);
CREATE POLICY "clientes_delete" ON clientes FOR DELETE USING (auth.uid() = tenant_id);

-- Políticas para SERVIÇOS
CREATE POLICY "servicos_select" ON servicos FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "servicos_insert" ON servicos FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "servicos_update" ON servicos FOR UPDATE USING (auth.uid() = tenant_id);
CREATE POLICY "servicos_delete" ON servicos FOR DELETE USING (auth.uid() = tenant_id);

-- Políticas para PROFISSIONAIS
CREATE POLICY "profissionais_select" ON profissionais FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "profissionais_insert" ON profissionais FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "profissionais_update" ON profissionais FOR UPDATE USING (auth.uid() = tenant_id);
CREATE POLICY "profissionais_delete" ON profissionais FOR DELETE USING (auth.uid() = tenant_id);

-- Políticas para AGENDAMENTOS
CREATE POLICY "agendamentos_select" ON agendamentos FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "agendamentos_insert" ON agendamentos FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "agendamentos_update" ON agendamentos FOR UPDATE USING (auth.uid() = tenant_id);
CREATE POLICY "agendamentos_delete" ON agendamentos FOR DELETE USING (auth.uid() = tenant_id);

-- ============================================
-- PASSO 5: VIEWS ÚTEIS (opcionais, sem RLS)
-- ============================================

-- View: agendamentos completos com joins
CREATE VIEW v_agendamentos_completos AS
SELECT
    a.id,
    a.tenant_id,
    a.data,
    a.hora,
    a.valor,
    a.status,
    a.observacoes,
    a.created_at,
    c.id AS cliente_id,
    c.nome AS cliente_nome,
    c.telefone AS cliente_telefone,
    s.id AS servico_id,
    s.nome AS servico_nome,
    s.duracao AS servico_duracao,
    p.id AS profissional_id,
    p.nome AS profissional_nome,
    p.comissao_percentual,
    p.cor_agenda,
    (a.valor * COALESCE(p.comissao_percentual, 0) / 100) AS comissao_valor,
    (a.valor - (a.valor * COALESCE(p.comissao_percentual, 0) / 100)) AS valor_liquido
FROM agendamentos a
LEFT JOIN clientes c ON a.cliente_id = c.id
LEFT JOIN servicos s ON a.servico_id = s.id
LEFT JOIN profissionais p ON a.profissional_id = p.id;

-- ============================================
-- PASSO 6: FUNÇÃO PARA ATUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER servicos_updated_at BEFORE UPDATE ON servicos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profissionais_updated_at BEFORE UPDATE ON profissionais FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agendamentos_updated_at BEFORE UPDATE ON agendamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

SELECT 'Schema criado com sucesso!' AS status;

SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('clientes', 'servicos', 'profissionais', 'agendamentos')
ORDER BY table_name, ordinal_position;
