-- ============================================
-- LIMPEZA COMPLETA DO BANCO - FORÇA BRUTA
-- ============================================
-- Este script remove TODAS as tabelas e views
-- e recria apenas as 4 tabelas padronizadas
-- ============================================

-- DESABILITAR TODAS AS FOREIGN KEYS TEMPORARIAMENTE
SET session_replication_role = 'replica';

-- REMOVER TODAS AS VIEWS
DROP VIEW IF EXISTS v_agendamentos_completos CASCADE;
DROP VIEW IF EXISTS v_financeiro_diario CASCADE;
DROP VIEW IF EXISTS v_proximos_agendamentos CASCADE;
DROP VIEW IF EXISTS v_clientes_inativos CASCADE;

-- REMOVER TODAS AS TABELAS (em qualquer ordem)
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS agendamentos_logs CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;
DROP TABLE IF EXISTS financeiro CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS profissionais CASCADE;
DROP TABLE IF EXISTS profissionais_servico CASCADE;
DROP TABLE IF EXISTS profissional_servico CASCADE;
DROP TABLE IF EXISTS profissionals CASCADE;
DROP TABLE IF EXISTS servicos CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS whatsapp_automacoes CASCADE;

-- REMOVER FUNÇÕES
DROP FUNCTION IF EXISTS atualizar_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS criar_financeiro_agendamento() CASCADE;
DROP FUNCTION IF EXISTS atualizar_estatisticas_cliente() CASCADE;

-- REABILITAR FOREIGN KEYS
SET session_replication_role = 'origin';

-- ============================================
-- CRIAR TABELAS PADRONIZADAS
-- ============================================

-- TABELA: clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);
CREATE INDEX idx_clientes_nome ON clientes(nome);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus clientes"
    ON clientes FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus clientes"
    ON clientes FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus clientes"
    ON clientes FOR UPDATE USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus clientes"
    ON clientes FOR DELETE USING (auth.uid() = tenant_id);

-- TABELA: servicos
CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0,
    duracao INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_servicos_tenant ON servicos(tenant_id);
CREATE INDEX idx_servicos_nome ON servicos(nome);

ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus serviços"
    ON servicos FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus serviços"
    ON servicos FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus serviços"
    ON servicos FOR UPDATE USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus serviços"
    ON servicos FOR DELETE USING (auth.uid() = tenant_id);

-- TABELA: profissionais
CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    comissao_percentual NUMERIC(5,2) DEFAULT 0,
    cor_agenda TEXT DEFAULT '#667eea',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profissionais_tenant ON profissionais(tenant_id);
CREATE INDEX idx_profissionais_nome ON profissionais(nome);

ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus profissionais"
    ON profissionais FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus profissionais"
    ON profissionais FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus profissionais"
    ON profissionais FOR UPDATE USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus profissionais"
    ON profissionais FOR DELETE USING (auth.uid() = tenant_id);

-- TABELA: agendamentos
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

CREATE INDEX idx_agendamentos_tenant ON agendamentos(tenant_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(data);
CREATE INDEX idx_agendamentos_cliente ON agendamentos(cliente_id);
CREATE INDEX idx_agendamentos_profissional ON agendamentos(profissional_id);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus agendamentos"
    ON agendamentos FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem inserir seus agendamentos"
    ON agendamentos FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem atualizar seus agendamentos"
    ON agendamentos FOR UPDATE USING (auth.uid() = tenant_id);

CREATE POLICY "Usuários podem deletar seus agendamentos"
    ON agendamentos FOR DELETE USING (auth.uid() = tenant_id);

-- TRIGGER: updated_at automático
CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_servicos_updated_at
    BEFORE UPDATE ON servicos
    FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_profissionais_updated_at
    BEFORE UPDATE ON profissionais
    FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_agendamentos_updated_at
    BEFORE UPDATE ON agendamentos
    FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

-- VIEWS ÚTEIS
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
-- VERIFICAÇÃO FINAL
-- ============================================
-- Execute para verificar:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Deve retornar apenas: clientes, servicos, profissionais, agendamentos

SELECT '✅ Banco limpo e recriado com sucesso!' AS status;
