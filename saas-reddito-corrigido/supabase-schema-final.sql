-- ============================================
-- SCHEMA FINAL SUPABASE - SISTEMA DE AGENDAMENTO
-- ============================================
-- ATENÇÃO: Execute este SQL no Supabase SQL Editor
-- ============================================

-- Limpar tabelas anteriores (se existirem)
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS profissional_servico CASCADE;
DROP TABLE IF EXISTS profissionais CASCADE;
DROP TABLE IF EXISTS servicos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;

-- ============================================
-- TABELA: clientes
-- ============================================
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_clientes_user_id ON clientes(user_id);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);

-- RLS Policies
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus clientes"
    ON clientes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus clientes"
    ON clientes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus clientes"
    ON clientes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus clientes"
    ON clientes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TABELA: servicos
-- ============================================
CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0,
    duracao INTEGER NOT NULL DEFAULT 60, -- minutos
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_servicos_user_id ON servicos(user_id);

-- RLS Policies
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus serviços"
    ON servicos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus serviços"
    ON servicos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus serviços"
    ON servicos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus serviços"
    ON servicos FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TABELA: profissionais
-- ============================================
CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    comissao_percentual NUMERIC(5,2) DEFAULT 0, -- ex: 40.00 = 40%
    cor_agenda TEXT DEFAULT '#667eea',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_profissionais_user_id ON profissionais(user_id);

-- RLS Policies
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus profissionais"
    ON profissionais FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus profissionais"
    ON profissionais FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus profissionais"
    ON profissionais FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus profissionais"
    ON profissionais FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TABELA: agendamentos
-- ============================================
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    preco NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'confirmado', -- confirmado, cancelado, concluido
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_agendamentos_user_id ON agendamentos(user_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(data);
CREATE INDEX idx_agendamentos_cliente_id ON agendamentos(cliente_id);
CREATE INDEX idx_agendamentos_profissional_id ON agendamentos(profissional_id);

-- RLS Policies
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus agendamentos"
    ON agendamentos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus agendamentos"
    ON agendamentos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus agendamentos"
    ON agendamentos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus agendamentos"
    ON agendamentos FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER: updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON servicos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profissionais_updated_at BEFORE UPDATE ON profissionais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON agendamentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Agendamentos com detalhes completos
CREATE OR REPLACE VIEW v_agendamentos_completos AS
SELECT 
    a.id,
    a.user_id,
    a.data,
    a.hora,
    a.preco,
    a.status,
    a.created_at,
    c.nome AS cliente_nome,
    c.telefone AS cliente_telefone,
    s.nome AS servico_nome,
    s.duracao AS servico_duracao,
    p.nome AS profissional_nome,
    p.comissao_percentual,
    p.cor_agenda,
    (a.preco * p.comissao_percentual / 100) AS comissao_valor
FROM agendamentos a
JOIN clientes c ON a.cliente_id = c.id
JOIN servicos s ON a.servico_id = s.id
JOIN profissionais p ON a.profissional_id = p.id;

-- View: Resumo financeiro diário
CREATE OR REPLACE VIEW v_financeiro_diario AS
SELECT 
    user_id,
    data,
    COUNT(*) AS total_agendamentos,
    SUM(preco) AS faturamento_bruto,
    SUM(preco * comissao_percentual / 100) AS total_comissoes,
    SUM(preco - (preco * comissao_percentual / 100)) AS lucro_liquido
FROM v_agendamentos_completos
WHERE status = 'concluido'
GROUP BY user_id, data;

-- ============================================
-- SUCESSO!
-- ============================================
-- Schema criado com sucesso!
-- Execute: SELECT * FROM clientes; para testar
