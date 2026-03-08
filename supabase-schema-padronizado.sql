-- ============================================
-- SCHEMA LIMPO - APENAS TABELAS EM PORTUGUÊS
-- ============================================
-- Execute este SQL no Supabase para limpar e recriar
-- ============================================

-- LIMPAR TABELAS ANTIGAS (se existirem)
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS profissionals CASCADE;
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS servicos CASCADE;
DROP TABLE IF EXISTS profissionais CASCADE;
DROP VIEW IF EXISTS v_agendamentos_completos CASCADE;
DROP VIEW IF EXISTS v_financeiro_diario CASCADE;

-- ============================================
-- TABELA: clientes
-- ============================================
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);
CREATE INDEX idx_clientes_nome ON clientes(nome);

-- RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus clientes"
    ON clientes FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus clientes"
    ON clientes FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus clientes"
    ON clientes FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus clientes"
    ON clientes FOR DELETE
    USING (auth.uid() = tenant_id);

-- ============================================
-- TABELA: servicos
-- ============================================
CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0,
    duracao INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_servicos_tenant ON servicos(tenant_id);
CREATE INDEX idx_servicos_nome ON servicos(nome);

-- RLS
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus serviços"
    ON servicos FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus serviços"
    ON servicos FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus serviços"
    ON servicos FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus serviços"
    ON servicos FOR DELETE
    USING (auth.uid() = tenant_id);

-- ============================================
-- TABELA: profissionais
-- ============================================
CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    comissao_percentual NUMERIC(5,2) DEFAULT 0,
    cor_agenda TEXT DEFAULT '#667eea',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_profissionais_tenant ON profissionais(tenant_id);
CREATE INDEX idx_profissionais_nome ON profissionais(nome);

-- RLS
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus profissionais"
    ON profissionais FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus profissionais"
    ON profissionais FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus profissionais"
    ON profissionais FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus profissionais"
    ON profissionais FOR DELETE
    USING (auth.uid() = tenant_id);

-- ============================================
-- TABELA: agendamentos
-- ============================================
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'confirmado',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_agendamentos_tenant ON agendamentos(tenant_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(data);
CREATE INDEX idx_agendamentos_cliente ON agendamentos(cliente_id);
CREATE INDEX idx_agendamentos_profissional ON agendamentos(profissional_id);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);

-- RLS
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus agendamentos"
    ON agendamentos FOR SELECT
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus agendamentos"
    ON agendamentos FOR INSERT
    WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus agendamentos"
    ON agendamentos FOR UPDATE
    USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus agendamentos"
    ON agendamentos FOR DELETE
    USING (auth.uid() = tenant_id);

-- ============================================
-- TRIGGER: updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_servicos_updated_at
    BEFORE UPDATE ON servicos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_profissionais_updated_at
    BEFORE UPDATE ON profissionais
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_agendamentos_updated_at
    BEFORE UPDATE ON agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_updated_at();

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Agendamentos com detalhes completos
CREATE OR REPLACE VIEW v_agendamentos_completos AS
SELECT 
    a.id,
    a.tenant_id,
    a.data,
    a.hora,
    a.valor,
    a.status,
    a.created_at,
    c.id AS cliente_id,
    c.nome AS cliente_nome,
    c.telefone AS cliente_telefone,
    c.email AS cliente_email,
    s.id AS servico_id,
    s.nome AS servico_nome,
    s.duracao AS servico_duracao,
    p.id AS profissional_id,
    p.nome AS profissional_nome,
    p.comissao_percentual,
    p.cor_agenda,
    (a.valor * p.comissao_percentual / 100) AS comissao_valor
FROM agendamentos a
INNER JOIN clientes c ON a.cliente_id = c.id
INNER JOIN servicos s ON a.servico_id = s.id
INNER JOIN profissionais p ON a.profissional_id = p.id;

-- View: Financeiro diário
CREATE OR REPLACE VIEW v_financeiro_diario AS
SELECT 
    tenant_id,
    data,
    COUNT(*) AS total_agendamentos,
    SUM(valor) AS faturamento_bruto,
    SUM(comissao_valor) AS total_comissoes,
    SUM(valor - comissao_valor) AS lucro_liquido
FROM v_agendamentos_completos
WHERE status IN ('confirmado', 'concluido')
GROUP BY tenant_id, data
ORDER BY data DESC;

-- ============================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- ============================================
-- Descomente as linhas abaixo para popular dados de exemplo
-- IMPORTANTE: Substitua 'SEU_USER_ID' pelo seu user_id real

/*
-- Exemplo de como obter seu user_id:
-- SELECT auth.uid();

-- Inserir clientes de exemplo
INSERT INTO clientes (tenant_id, nome, telefone, email) VALUES
    ('SEU_USER_ID', 'João Silva', '11999990001', 'joao@email.com'),
    ('SEU_USER_ID', 'Maria Santos', '11999990002', 'maria@email.com'),
    ('SEU_USER_ID', 'Pedro Oliveira', '11999990003', 'pedro@email.com');

-- Inserir serviços de exemplo
INSERT INTO servicos (tenant_id, nome, preco, duracao) VALUES
    ('SEU_USER_ID', 'Corte de Cabelo', 50.00, 30),
    ('SEU_USER_ID', 'Barba', 30.00, 20),
    ('SEU_USER_ID', 'Corte + Barba', 70.00, 45);

-- Inserir profissionais de exemplo
INSERT INTO profissionais (tenant_id, nome, comissao_percentual, cor_agenda) VALUES
    ('SEU_USER_ID', 'Ana Costa', 40.00, '#FF6B6B'),
    ('SEU_USER_ID', 'Carlos Lima', 45.00, '#4ECDC4');

-- Inserir agendamentos de exemplo
INSERT INTO agendamentos (tenant_id, cliente_id, servico_id, profissional_id, data, hora, valor, status)
SELECT 
    'SEU_USER_ID',
    c.id,
    s.id,
    p.id,
    CURRENT_DATE,
    '10:00:00',
    s.preco,
    'confirmado'
FROM clientes c, servicos s, profissionais p
WHERE c.tenant_id = 'SEU_USER_ID'
  AND s.tenant_id = 'SEU_USER_ID'
  AND p.tenant_id = 'SEU_USER_ID'
LIMIT 1;
*/

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute estas queries para verificar:
-- SELECT * FROM clientes;
-- SELECT * FROM servicos;
-- SELECT * FROM profissionais;
-- SELECT * FROM agendamentos;
-- SELECT * FROM v_agendamentos_completos;
-- SELECT * FROM v_financeiro_diario;

-- ✅ Schema criado com sucesso!
-- Apenas tabelas em português: clientes, servicos, profissionais, agendamentos
