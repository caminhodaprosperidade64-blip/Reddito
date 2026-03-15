/**
 * ============================================
 * DATABASE MODULE - 100% SUPABASE
 * ============================================
 */

const DB = {
    // ============================================
    // CLIENTES
    // ============================================
    clientes: {
        async listar() {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('nome', { ascending: true });
                if (error) throw error;
                console.log('✅ Clientes carregados:', data.length);
                return data || [];
            } catch (error) {
                console.error('❌ Erro ao listar clientes:', error);
                return [];
            }
        },

        async buscar(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .single();
                if (error) throw error;
                return data;
            } catch (error) {
                console.error('❌ Erro ao buscar cliente:', error);
                return null;
            }
        },

        async criar(dados) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('clientes')
                    .insert({
                        tenant_id: tenantId,
                        nome: dados.nome,
                        telefone: dados.telefone || null,
                        email: dados.email || null,
                        // Adicione outros campos de clientes aqui se necessário
                    })
                    .select()
                    .single();
                if (error) throw error;
                console.log('✅ Cliente criado:', data);
                return { success: true, data };
            } catch (error) {
                console.error('❌ Erro ao criar cliente:', error);
                return { success: false, error: error.message };
            }
        },

        async atualizar(id, dados) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('clientes')
                    .update({
                        nome: dados.nome,
                        telefone: dados.telefone || null,
                        email: dados.email || null,
                        // Adicione outros campos de clientes aqui se necessário
                    })
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .select()
                    .single();
                if (error) throw error;
                console.log('✅ Cliente atualizado:', data);
                return { success: true, data };
            } catch (error) {
                console.error('❌ Erro ao atualizar cliente:', error);
                return { success: false, error: error.message };
            }
        },

        async excluir(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { error } = await supabase
                    .from('clientes')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                console.log('✅ Cliente excluído');
                return { success: true };
            } catch (error) {
                console.error('❌ Erro ao excluir cliente:', error);
                return { success: false, error: error.message };
            }
        }
    },

    // ============================================
    // SERVICOS
    // ============================================
    servicos: {
        async listar() {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('servicos')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('nome', { ascending: true });
                if (error) throw error;
                console.log('✅ Serviços carregados:', data.length);
                return data || [];
            } catch (error) {
                console.error('❌ Erro ao listar serviços:', error);
                return [];
            }
        },

        async buscar(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('servicos')
                    .select('*')
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .single();
                if (error) throw error;
                return data;
            } catch (error) {
                console.error('❌ Erro ao buscar serviço:', error);
                return null;
            }
        },

        async criar(dados) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('servicos')
                    .insert({
                        tenant_id: tenantId,
                        nome: dados.nome,
                        preco: parseFloat(dados.preco),
                        duracao: parseInt(dados.duracao)
                    })
                    .select()
                    .single();
                if (error) throw error;
                console.log('✅ Serviço criado:', data);
                return { success: true, data };
            } catch (error) {
                console.error('❌ Erro ao criar serviço:', error);
                return { success: false, error: error.message };
            }
        },

        async atualizar(id, dados) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('servicos')
                    .update({
                        nome: dados.nome,
                        preco: parseFloat(dados.preco),
                        duracao: parseInt(dados.duracao)
                    })
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .select()
                    .single();
                if (error) throw error;
                console.log('✅ Serviço atualizado:', data);
                return { success: true, data };
            } catch (error) {
                console.error('❌ Erro ao atualizar serviço:', error);
                return { success: false, error: error.message };
            }
        },

        async excluir(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { error } = await supabase
                    .from('servicos')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                console.log('✅ Serviço excluído');
                return { success: true };
            } catch (error) {
                console.error('❌ Erro ao excluir serviço:', error);
                return { success: false, error: error.message };
            }
        }
    },

    // ============================================
    // PROFISSIONAIS
    // ============================================
    profissionais: {
        async listar() {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('profissionais')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('nome', { ascending: true });
                if (error) throw error;
                console.log('✅ Profissionais carregados:', data.length);
                return data || [];
            } catch (error) {
                console.error('❌ Erro ao listar profissionais:', error);
                return [];
            }
        },

        async buscar(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('profissionais')
                    .select('*')
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .single();
                if (error) throw error;
                return data;
            } catch (error) {
                console.error('❌ Erro ao buscar profissional:', error);
                return null;
            }
        },

        async criar(dados) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('profissionais')
                    .insert({
                        tenant_id: tenantId,
                        nome: dados.nome,
                        telefone: dados.telefone || null,
                        email: dados.email || null,
                        especialidade: dados.especialidade || null,
                        status: dados.status || 'ativo',
                        comissao_tipo: dados.comissao_tipo || 'percentual',
                        comissao_percentual: parseFloat(dados.comissao_percentual || 0),
                        cor_agenda: dados.cor_agenda || '#667eea'
                    })
                    .select()
                    .single();
                if (error) throw error;
                console.log('✅ Profissional criado:', data);
                return { success: true, data };
            } catch (error) {
                console.error('❌ Erro ao criar profissional:', error);
                return { success: false, error: error.message };
            }
        },

        async atualizar(id, dados) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                
                const updateData = {
                    nome: dados.nome,
                    telefone: dados.telefone || null,
                    email: dados.email || null,
                    especialidade: dados.especialidade || null
                };

                // Campos opcionais
                if (dados.status !== undefined) updateData.status = dados.status;
                if (dados.comissao_tipo !== undefined) updateData.comissao_tipo = dados.comissao_tipo;
                if (dados.comissao_percentual !== undefined) updateData.comissao_percentual = parseFloat(dados.comissao_percentual || 0);
                if (dados.cor_agenda !== undefined) updateData.cor_agenda = dados.cor_agenda || '#667eea';

                const { data, error } = await supabase
                    .from('profissionais')
                    .update(updateData)
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .select()
                    .single();
                if (error) throw error;
                console.log('✅ Profissional atualizado:', data);
                return { success: true, data };
            } catch (error) {
                console.error('❌ Erro ao atualizar profissional:', error);
                return { success: false, error: error.message };
            }
        },

        async excluir(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { error } = await supabase
                    .from('profissionais')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                console.log('✅ Profissional excluído');
                return { success: true };
            } catch (error) {
                console.error('❌ Erro ao excluir profissional:', error);
                return { success: false, error: error.message };
            }
        }
    },

    // ============================================
    // AGENDAMENTOS
    // ============================================
    agendamentos: {
        async listar(filtros = {}) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();

                let query = supabase
                    .from('agendamentos')
                    .select(`
                        *,
                        cliente:clientes(id, nome, telefone, email),
                        servico:servicos(id, nome, preco, duracao),
                        profissional:profissionais(id, nome, comissao_percentual, cor_agenda)
                    `)
                    .eq('tenant_id', tenantId);

                if (filtros.data) query = query.eq('data', filtros.data);
                if (filtros.profissional_id) query = query.eq('profissional_id', filtros.profissional_id);
                if (filtros.status) query = query.eq('status', filtros.status);

                query = query.order('data', { ascending: true })
                             .order('hora', { ascending: true });

                const { data, error } = await query;
                if (error) throw error;
                console.log('✅ Agendamentos carregados:', data.length);
                return data || [];
            } catch (error) {
                console.error('❌ Erro ao listar agendamentos:', error);
                return [];
            }
        },

        async buscar(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('agendamentos')
                    .select(`
                        *,
                        cliente:clientes(id, nome, telefone, email),
                        servico:servicos(id, nome, preco, duracao),
                        profissional:profissionais(id, nome, comissao_percentual, cor_agenda)
                    `)
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .single();
                if (error) throw error;
                return data;
            } catch (error) {
                console.error('❌ Erro ao buscar agendamento:', error);
                return null;
            }
        },

        async criar(dados) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('agendamentos')
                    .insert({
                        tenant_id: tenantId,
                        cliente_id: dados.cliente_id,
                        servico_id: dados.servico_id,
                        profissional_id: dados.profissional_id,
                        data: dados.data,
                        hora: dados.hora,
                        valor: parseFloat(dados.valor),
                        status: dados.status || 'confirmado'
                    })
                    .select()
                    .single();
                if (error) throw error;
                console.log('✅ Agendamento criado:', data);
                return { success: true, data };
            } catch (error) {
                console.error('❌ Erro ao criar agendamento:', error);
                return { success: false, error: error.message };
            }
        },

        async atualizar(id, dados) {
    try {
        const tenantId = await Auth.getTenantId();
        const supabase = window.getSupabase();

        const updateData = {};

        // NÃO usar "if (dados.campo)" porque isso ignora valores como 0.
        if (dados.cliente_id !== undefined) updateData.cliente_id = dados.cliente_id;
        if (dados.servico_id !== undefined) updateData.servico_id = dados.servico_id;
        if (dados.profissional_id !== undefined) updateData.profissional_id = dados.profissional_id;
        if (dados.data !== undefined) updateData.data = dados.data;
        if (dados.hora !== undefined) updateData.hora = dados.hora;

        if (dados.valor !== undefined) {
            // Permite 0 e evita NaN quando vier string vazia
            updateData.valor = (dados.valor === null || dados.valor === '' ? null : parseFloat(dados.valor));
        }

        if (dados.status !== undefined) updateData.status = dados.status;

        // Já existe no seu banco (você confirmou):
        if (dados.observacoes !== undefined) updateData.observacoes = dados.observacoes;

        // Novos campos (após rodar o SQL no Supabase):
        if (dados.forma_pagamento !== undefined) updateData.forma_pagamento = dados.forma_pagamento;
        if (dados.status_pagamento !== undefined) updateData.status_pagamento = dados.status_pagamento;
        if (dados.nsu !== undefined) updateData.nsu = dados.nsu;
        if (dados.autorizacao !== undefined) updateData.autorizacao = dados.autorizacao;
        if (dados.pago_em !== undefined) updateData.pago_em = dados.pago_em;

        const { data, error } = await supabase
            .from('agendamentos')
            .update(updateData)
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Agendamento atualizado:', data);
        return { success: true, data };
    } catch (error) {
        console.error('❌ Erro ao atualizar agendamento:', error);
        return { success: false, error: error.message };
    }
}
        async excluir(id) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { error } = await supabase
                    .from('agendamentos')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                console.log('✅ Agendamento excluído');
                return { success: true };
            } catch (error) {
                console.error('❌ Erro ao excluir agendamento:', error);
                return { success: false, error: error.message };
            }
        },

        async listarPorData(data) {
            return this.listar({ data });
        },

        async listarPorPeriodo(dataInicio, dataFim) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('agendamentos')
                    .select(`
                        *,
                        cliente:clientes(id, nome, telefone),
                        servico:servicos(id, nome, preco, duracao),
                        profissional:profissionais(id, nome, comissao_percentual, cor_agenda)
                    `)
                    .eq('tenant_id', tenantId)
                    .gte('data', dataInicio)
                    .lte('data', dataFim)
                    .order('data', { ascending: true })
                    .order('hora', { ascending: true });
                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('❌ Erro ao listar por período:', error);
                return [];
            }
        }
    },

    // ============================================
    // FINANCEIRO
    // ============================================
    financeiro: {
        async resumo(dataInicio, dataFim) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('agendamentos')
                    .select(`
                        valor,
                        status,
                        profissional:profissionais(comissao_percentual)
                    `)
                    .eq('tenant_id', tenantId)
                    .gte('data', dataInicio)
                    .lte('data', dataFim)
                    .in('status', ['confirmado', 'concluido']);
                if (error) throw error;
                const agendamentos = data || [];
                let faturamentoBruto = 0;
                let totalComissoes = 0;
                agendamentos.forEach(ag => {
                    const valor = parseFloat(ag.valor || 0);
                    const comissaoPerc = parseFloat(ag.profissional?.comissao_percentual || 0);
                    const comissao = (valor * comissaoPerc) / 100;
                    faturamentoBruto += valor;
                    totalComissoes += comissao;
                });
                return {
                    faturamentoBruto,
                    totalComissoes,
                    lucroLiquido: faturamentoBruto - totalComissoes,
                    totalAgendamentos: agendamentos.length
                };
            } catch (error) {
                console.error('❌ Erro ao calcular resumo:', error);
                return { faturamentoBruto: 0, totalComissoes: 0, lucroLiquido: 0, totalAgendamentos: 0 };
            }
        },

        async faturamentoDia(data) {
            return this.resumo(data, data);
        },

        async faturamentoMes(ano, mes) {
            const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
            const ultimoDia = new Date(ano, mes, 0).getDate();
            const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`;
            return this.resumo(dataInicio, dataFim);
        },

        async porProfissional(dataInicio, dataFim) {
            try {
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('agendamentos')
                    .select(`
                        valor,
                        profissional_id,
                        profissional:profissionais(nome, comissao_percentual)
                    `)
                    .eq('tenant_id', tenantId)
                    .gte('data', dataInicio)
                    .lte('data', dataFim)
                    .in('status', ['confirmado', 'concluido']);
                if (error) throw error;
                const agendamentos = data || [];
                const resultado = {};
                agendamentos.forEach(ag => {
                    const id = ag.profissional_id;
                    if (!resultado[id]) {
                        resultado[id] = {
                            nome: ag.profissional?.nome || 'Desconhecido',
                            faturamento: 0,
                            comissao: 0,
                            totalAgendamentos: 0
                        };
                    }
                    const valor = parseFloat(ag.valor || 0);
                    const comissaoPerc = parseFloat(ag.profissional?.comissao_percentual || 0);
                    const comissao = (valor * comissaoPerc) / 100;
                    resultado[id].faturamento += valor;
                    resultado[id].comissao += comissao;
                    resultado[id].totalAgendamentos += 1;
                });
                return Object.values(resultado);
            } catch (error) {
                console.error('❌ Erro ao calcular por profissional:', error);
                return [];
            }
        }
    },

    // ============================================
    // DASHBOARD
    // ============================================
    dashboard: {
        async estatisticas() {
            try {
                const hoje = new Date().toISOString().split('T')[0];
                const agora = new Date();
                const [clientes, servicos, profissionais, agendamentosHoje, financeiroDia, financeiroMes] = await Promise.all([
                    DB.clientes.listar(),
                    DB.servicos.listar(),
                    DB.profissionais.listar(),
                    DB.agendamentos.listarPorData(hoje),
                    DB.financeiro.faturamentoDia(hoje),
                    DB.financeiro.faturamentoMes(agora.getFullYear(), agora.getMonth() + 1)
                ]);
                return {
                    totalClientes: clientes.length,
                    totalServicos: servicos.length,
                    totalProfissionais: profissionais.length,
                    agendamentosHoje: agendamentosHoje.length,
                    faturamentoDia: financeiroDia.faturamentoBruto,
                    faturamentoMes: financeiroMes.faturamentoBruto
                };
            } catch (error) {
                console.error('❌ Erro ao obter estatísticas:', error);
                return { totalClientes: 0, totalServicos: 0, totalProfissionais: 0, agendamentosHoje: 0, faturamentoDia: 0, faturamentoMes: 0 };
            }
        },

        async obterTodosTenants() {
            try {
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('tenants')
                    .select('*')
                    .order('data_inicio', { ascending: false });
                if (error) throw error;
                console.log('✅ Tenants carregados:', data.length);
                return data || [];
            } catch (error) {
                console.error('❌ Erro ao listar tenants:', error);
                return [];
            }
        },

        async obterAssinaturasAtivas() {
            try {
                const supabase = window.getSupabase();
                const { data, error } = await supabase
                    .from('assinaturas')
                    .select('*')
                    .eq('status', 'ativa');
                if (error) throw error;
                console.log('✅ Assinaturas carregadas:', data.length);
                return data || [];
            } catch (error) {
                console.error('❌ Erro ao listar assinaturas:', error);
                return [];
            }
        }
    }
};

// ✅ Expõe DB globalmente para todos os HTMLs
window.DB = DB;

console.log('✅ Módulo DB carregado - Tabelas em português');
