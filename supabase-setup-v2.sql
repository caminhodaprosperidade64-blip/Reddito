-- ============================================
-- SISTEMA PROFISSIONAL DE AGENDAMENTO - SUPABASE
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- Cria todas as tabelas, RLS e políticas

-- 1. TABELA EMPRESAS
-- ============================================
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(100),
    endereco TEXT,
    horario_inicio TIME DEFAULT '08:00',
    horario_fim TIME DEFAULT '18:00',
    intervalo_minimo INTEGER DEFAULT 30, -- minutos
    dias_funcionamento VARCHAR(50) DEFAULT '1,2,3,4,5,6', -- 0=dom, 1=seg, ...
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA CLIENTES
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    data_nascimento DATE,
    cpf VARCHAR(14),
    observacoes TEXT,
    total_gasto DECIMAL(10,2) DEFAULT 0,
    total_visitas INTEGER DEFAULT 0,
    ultima_visita TIMESTAMP WITH TIME ZONE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, telefone)
);

-- 3. TABELA PROFISSIONAIS
-- ============================================
CREATE TABLE IF NOT EXISTS profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    email VARCHAR(100),
    telefone VARCHAR(20),
    especialidade VARCHAR(100),
    cor VARCHAR(7) DEFAULT '#6366F1', -- cor para agenda
    tipo_comissao VARCHAR(20) DEFAULT 'percentual', -- percentual ou fixo
    valor_comissao DECIMAL(10,2) DEFAULT 0, -- % ou valor fixo
    horario_inicio TIME,
    horario_fim TIME,
    dias_trabalho VARCHAR(50), -- 0,1,2,3,4,5,6
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA SERVIÇOS
-- ============================================
CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    duracao_minutos INTEGER NOT NULL DEFAULT 30,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0,
    categoria VARCHAR(100),
    tempo_retorno_dias INTEGER DEFAULT 30, -- para identificar clientes inativos
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA PROFISSIONAL_SERVICO (muitos-para-muitos)
-- ============================================
CREATE TABLE IF NOT EXISTS profissional_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profissional_id, servico_id)
);

-- 6. TABELA AGENDAMENTOS
-- ============================================
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    duracao_minutos INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'agendado', -- agendado, confirmado, concluido, cancelado
    observacoes TEXT,
    valor_servico DECIMAL(10,2) NOT NULL,
    origem VARCHAR(20) DEFAULT 'sistema', -- sistema, publico, whatsapp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABELA FINANCEIRO
-- ============================================
CREATE TABLE IF NOT EXISTS financeiro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    agendamento_id UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    profissional_id UUID REFERENCES profissionais(id) ON DELETE SET NULL,
    servico_id UUID REFERENCES servicos(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL, -- receita, despesa, comissao
    descricao TEXT,
    valor DECIMAL(10,2) NOT NULL,
    data_movimento DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente', -- pendente, pago, cancelado
    forma_pagamento VARCHAR(50), -- dinheiro, pix, cartao_credito, cartao_debito
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABELA WHATSAPP_AUTOMACOES
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_automacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- confirmacao, agradecimento, lembrete, reativacao
    titulo VARCHAR(200) NOT NULL,
    mensagem TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    quando_enviar VARCHAR(100), -- ex: 24h_antes, 1h_antes, apos_agendamento
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_profissionais_empresa ON profissionais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicos_empresa ON servicos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa ON agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON agendamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional ON agendamentos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_empresa ON financeiro(empresa_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON financeiro(data_movimento);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON empresas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profissionais_updated_at BEFORE UPDATE ON profissionais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON servicos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON agendamentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGER: CRIAR FINANCEIRO APÓS AGENDAMENTO
-- ============================================
CREATE OR REPLACE FUNCTION criar_financeiro_agendamento()
RETURNS TRIGGER AS $$
DECLARE
    v_profissional profissionais%ROWTYPE;
    v_comissao DECIMAL(10,2);
    v_valor_empresa DECIMAL(10,2);
BEGIN
    -- Buscar dados do profissional
    SELECT * INTO v_profissional FROM profissionais WHERE id = NEW.profissional_id;
    
    -- Calcular comissão
    IF v_profissional.tipo_comissao = 'percentual' THEN
        v_comissao := NEW.valor_servico * (v_profissional.valor_comissao / 100);
    ELSE
        v_comissao := v_profissional.valor_comissao;
    END IF;
    
    v_valor_empresa := NEW.valor_servico - v_comissao;
    
    -- Inserir receita (valor do serviço)
    INSERT INTO financeiro (
        empresa_id, agendamento_id, cliente_id, profissional_id, servico_id,
        tipo, descricao, valor, data_movimento, status
    ) VALUES (
        NEW.empresa_id, NEW.id, NEW.cliente_id, NEW.profissional_id, NEW.servico_id,
        'receita', 'Agendamento', NEW.valor_servico, DATE(NEW.data_hora), 'pendente'
    );
    
    -- Inserir comissão (despesa)
    IF v_comissao > 0 THEN
        INSERT INTO financeiro (
            empresa_id, agendamento_id, cliente_id, profissional_id, servico_id,
            tipo, descricao, valor, data_movimento, status
        ) VALUES (
            NEW.empresa_id, NEW.id, NEW.cliente_id, NEW.profissional_id, NEW.servico_id,
            'comissao', 'Comissão profissional', v_comissao, DATE(NEW.data_hora), 'pendente'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_criar_financeiro_agendamento
    AFTER INSERT ON agendamentos
    FOR EACH ROW
    WHEN (NEW.status != 'cancelado')
    EXECUTE FUNCTION criar_financeiro_agendamento();

-- ============================================
-- TRIGGER: ATUALIZAR ESTATÍSTICAS DO CLIENTE
-- ============================================
CREATE OR REPLACE FUNCTION atualizar_estatisticas_cliente()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('concluido', 'confirmado') THEN
        UPDATE clientes SET
            total_visitas = total_visitas + 1,
            total_gasto = total_gasto + NEW.valor_servico,
            ultima_visita = NEW.data_hora
        WHERE id = NEW.cliente_id;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.status != 'concluido' AND NEW.status = 'concluido' THEN
        UPDATE clientes SET
            total_visitas = total_visitas + 1,
            total_gasto = total_gasto + NEW.valor_servico,
            ultima_visita = NEW.data_hora
        WHERE id = NEW.cliente_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_estatisticas_cliente
    AFTER INSERT OR UPDATE ON agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_estatisticas_cliente();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissional_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_automacoes ENABLE ROW LEVEL SECURITY;

-- Políticas simples para desenvolvimento (permitir tudo)
-- EM PRODUÇÃO: implementar autenticação e políticas por empresa_id

CREATE POLICY "Permitir tudo empresas" ON empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo profissionais" ON profissionais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo servicos" ON servicos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo profissional_servico" ON profissional_servico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo agendamentos" ON agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo financeiro" ON financeiro FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo whatsapp_automacoes" ON whatsapp_automacoes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- ============================================
-- Inserir empresa exemplo
INSERT INTO empresas (nome, slug, telefone, email) VALUES
('Salão Exemplo', 'salao-exemplo', '11999999999', 'contato@salaoexemplo.com')
ON CONFLICT (slug) DO NOTHING;

-- Mensagens WhatsApp padrão
DO $$
DECLARE
    v_empresa_id UUID;
BEGIN
    SELECT id INTO v_empresa_id FROM empresas WHERE slug = 'salao-exemplo' LIMIT 1;
    
    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO whatsapp_automacoes (empresa_id, tipo, titulo, mensagem, quando_enviar) VALUES
        (v_empresa_id, 'confirmacao', 'Confirmação de Agendamento', 
         'Olá {nome}! Seu agendamento para {servico} com {profissional} está confirmado para {data} às {hora}. Até lá! 🎉',
         'imediatamente'),
        (v_empresa_id, 'lembrete', 'Lembrete de Agendamento',
         'Olá {nome}! Lembrete: você tem agendamento amanhã às {hora} para {servico}. Confirme sua presença! 📅',
         '24h_antes'),
        (v_empresa_id, 'agradecimento', 'Agradecimento',
         'Olá {nome}! Obrigado por escolher nosso estabelecimento! Foi um prazer atendê-lo(a). Até a próxima! ⭐',
         'apos_conclusao'),
        (v_empresa_id, 'reativacao', 'Reativação',
         'Olá {nome}! Sentimos sua falta! Já faz um tempo que você não nos visita. Que tal agendar um horário? 💇',
         'cliente_inativo')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Próximos agendamentos
CREATE OR REPLACE VIEW v_proximos_agendamentos AS
SELECT 
    a.id,
    a.data_hora,
    a.status,
    a.observacoes,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    p.nome as profissional_nome,
    p.cor as profissional_cor,
    s.nome as servico_nome,
    s.duracao_minutos,
    a.valor_servico,
    e.nome as empresa_nome,
    a.empresa_id
FROM agendamentos a
JOIN clientes c ON a.cliente_id = c.id
JOIN profissionais p ON a.profissional_id = p.id
JOIN servicos s ON a.servico_id = s.id
JOIN empresas e ON a.empresa_id = e.id
WHERE a.data_hora >= NOW()
  AND a.status IN ('agendado', 'confirmado')
ORDER BY a.data_hora;

-- View: Clientes inativos
CREATE OR REPLACE VIEW v_clientes_inativos AS
SELECT 
    c.id,
    c.nome,
    c.telefone,
    c.email,
    c.ultima_visita,
    c.total_visitas,
    c.total_gasto,
    COALESCE(s.tempo_retorno_dias, 30) as tempo_retorno_dias,
    DATE_PART('day', NOW() - c.ultima_visita) as dias_sem_visitar,
    e.nome as empresa_nome,
    c.empresa_id
FROM clientes c
JOIN empresas e ON c.empresa_id = e.id
LEFT JOIN LATERAL (
    SELECT servico_id FROM agendamentos 
    WHERE cliente_id = c.id 
    ORDER BY data_hora DESC 
    LIMIT 1
) a ON true
LEFT JOIN servicos s ON a.servico_id = s.id
WHERE c.ultima_visita IS NOT NULL
  AND c.ativo = true
  AND DATE_PART('day', NOW() - c.ultima_visita) > COALESCE(s.tempo_retorno_dias, 30)
ORDER BY c.ultima_visita ASC;

-- ============================================
-- FIM DO SETUP
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- Depois configure as credenciais em js/supabase-config.js
