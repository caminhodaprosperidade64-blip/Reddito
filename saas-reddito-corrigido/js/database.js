/**
 * ============================================
 * DATABASE MODULE - v2.0 CORRIGIDO
 * ============================================
 * TABELAS EM PORTUGUÊS (usando tenant_id):
 * - clientes
 * - servicos
 * - profissionais
 * - agendamentos
 *
 * CORREÇÕES APLICADAS:
 * 1. Adicionado helper getDB() para acessar window.supabase corretamente
 * 2. Adicionada função DB.agendamentos.proximos()
 * 3. Adicionada função DB.agendamentos.completos()
 * 4. Adicionada função DB.financeiro.relatorio()
 * 5. Adicionada função DB.financeiro.ultimos7Dias()
 * 6. Adicionados aliases DB.dashboard.stats() e DB.dashboard.receitaUltimos7Dias()
 * 7. Adicionada função DB.popularDadosExemplo()
 * 8. Corrigido tratamento de null em profissional.comissao_percentual
 */

// Helper para obter o cliente Supabase de forma segura
function getDB() {
    const client = window.supabase || window.supabaseClient;
    if (!client || typeof client.from !== 'function') {
        throw new Error('Cliente Supabase não inicializado. Aguarde o carregamento.');
    }
    return client;
}

const DB = {
    // ============================================
    // CLIENTES
    // ============================================
    clientes: {
        async listar() {
            try {
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const { data, error } = await supabase
                    .from('clientes')
                    .insert({
                        tenant_id: tenantId,
                        nome: dados.nome,
                        telefone: dados.telefone,
                        email: dados.email || null
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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const { data, error } = await supabase
                    .from('clientes')
                    .update({
                        nome: dados.nome,
                        telefone: dados.telefone,
                        email: dados.email || null
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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const { data, error } = await supabase
                    .from('servicos')
                    .insert({
                        tenant_id: tenantId,
                        nome: dados.nome,
                        preco: parseFloat(dados.preco),
                        duracao: parseInt(dados.duracao),
                        categoria: dados.categoria || 'outros',
                        status: dados.status || 'ativo',
                        descricao: dados.descricao || null
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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const { data, error } = await supabase
                    .from('servicos')
                    .update({
                        nome: dados.nome,
                        preco: parseFloat(dados.preco),
                        duracao: parseInt(dados.duracao),
                        categoria: dados.categoria || 'outros',
                        status: dados.status || 'ativo',
                        descricao: dados.descricao || null
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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const { data, error } = await supabase
                    .from('profissionais')
                    .insert({
                        tenant_id: tenantId,
                        nome: dados.nome,
                        especialidade: dados.especialidade || null,
                        telefone: dados.telefone || null,
                        email: dados.email || null,
                        comissao_percentual: parseFloat(dados.comissao_percentual || 0),
                        cor_agenda: dados.cor_agenda || '#667eea',
                        status: dados.status || 'ativo'
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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const { data, error } = await supabase
                    .from('profissionais')
                    .update({
                        nome: dados.nome,
                        especialidade: dados.especialidade || null,
                        telefone: dados.telefone || null,
                        email: dados.email || null,
                        comissao_percentual: parseFloat(dados.comissao_percentual || 0),
                        cor_agenda: dados.cor_agenda || '#667eea',
                        status: dados.status || 'ativo'
                    })
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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                let query = supabase
                    .from('agendamentos')
                    .select(`
                        *,
                        cliente:clientes(id, nome, telefone, email),
                        servico:servicos(id, nome, preco, duracao),
                        profissional:profissionais(id, nome, comissao_percentual, cor_agenda)
                    `)
                    .eq('tenant_id', tenantId);

                if (filtros.data) {
                    query = query.eq('data', filtros.data);
                }
                if (filtros.profissional_id) {
                    query = query.eq('profissional_id', filtros.profissional_id);
                }
                if (filtros.status) {
                    query = query.eq('status', filtros.status);
                }

                query = query
                    .order('data', { ascending: true })
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

        // Alias para listar com join completo (usado em financeiro)
        async completos(filtros = {}) {
            return this.listar(filtros);
        },

        async buscar(id) {
            try {
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const { data, error } = await supabase
                    .from('agendamentos')
                    .insert({
                        tenant_id: tenantId,
                        cliente_id: dados.cliente_id,
                        servico_id: dados.servico_id,
                        profissional_id: dados.profissional_id,
                        data: dados.data,
                        hora: dados.hora,
                        valor: parseFloat(dados.valor || 0),
                        status: dados.status || 'confirmado',
                        observacoes: dados.observacoes || null
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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

                const updateData = {};
                if (dados.cliente_id) updateData.cliente_id = dados.cliente_id;
                if (dados.servico_id) updateData.servico_id = dados.servico_id;
                if (dados.profissional_id) updateData.profissional_id = dados.profissional_id;
                if (dados.data) updateData.data = dados.data;
                if (dados.hora) updateData.hora = dados.hora;
                if (dados.valor !== undefined) updateData.valor = parseFloat(dados.valor);
                if (dados.status) updateData.status = dados.status;
                if (dados.observacoes !== undefined) updateData.observacoes = dados.observacoes;

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
        },

        async excluir(id) {
            try {
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
        },

        // Retorna os próximos N agendamentos a partir de hoje
        async proximos(limite = 5) {
            try {
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();
                const hoje = new Date().toISOString().split('T')[0];

                const { data, error } = await supabase
                    .from('agendamentos')
                    .select(`
                        *,
                        cliente:clientes(id, nome, telefone),
                        servico:servicos(id, nome, preco, duracao),
                        profissional:profissionais(id, nome, comissao_percentual, cor_agenda)
                    `)
                    .eq('tenant_id', tenantId)
                    .gte('data', hoje)
                    .in('status', ['agendado', 'confirmado'])
                    .order('data', { ascending: true })
                    .order('hora', { ascending: true })
                    .limit(limite);

                if (error) throw error;

                // Normalizar campos para compatibilidade com o dashboard
                return (data || []).map(a => ({
                    ...a,
                    cliente_nome: a.cliente ? a.cliente.nome : '—',
                    servico_nome: a.servico ? a.servico.nome : '—',
                    profissional_nome: a.profissional ? a.profissional.nome : '—'
                }));
            } catch (error) {
                console.error('❌ Erro ao buscar próximos agendamentos:', error);
                return [];
            }
        }
    },

    // ============================================
    // FINANCEIRO (calculado dos agendamentos)
    // ============================================
    financeiro: {
        async resumo(dataInicio, dataFim) {
            try {
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                    .in('status', ['confirmado', 'concluido', 'concluído']);

                if (error) throw error;

                const agendamentos = data || [];
                let faturamentoBruto = 0;
                let totalComissoes = 0;

                agendamentos.forEach(ag => {
                    const valor = parseFloat(ag.valor || 0);
                    const comissaoPct = ag.profissional ? parseFloat(ag.profissional.comissao_percentual || 0) : 0;
                    const comissao = (valor * comissaoPct) / 100;

                    faturamentoBruto += valor;
                    totalComissoes += comissao;
                });

                const lucroLiquido = faturamentoBruto - totalComissoes;

                return {
                    faturamentoBruto,
                    totalComissoes,
                    lucroLiquido,
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

        // Relatório completo com dados do período atual
        async relatorio() {
            try {
                const agora = new Date();
                const hoje = agora.toISOString().split('T')[0];

                // Início da semana (segunda-feira)
                const diaSemana = agora.getDay();
                const inicioSemana = new Date(agora);
                inicioSemana.setDate(agora.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
                const inicioSemanaStr = inicioSemana.toISOString().split('T')[0];

                const [dia, semana, mes, porProfissional] = await Promise.all([
                    this.faturamentoDia(hoje),
                    this.resumo(inicioSemanaStr, hoje),
                    this.faturamentoMes(agora.getFullYear(), agora.getMonth() + 1),
                    this.porProfissional(
                        `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`,
                        hoje
                    )
                ]);

                return {
                    receitaDia: dia.faturamentoBruto,
                    receitaSemana: semana.faturamentoBruto,
                    receitaMes: mes.faturamentoBruto,
                    lucroLiquido: mes.lucroLiquido,
                    totalComissoes: mes.totalComissoes,
                    totalFaturado: mes.faturamentoBruto,
                    porProfissional: porProfissional.map(p => ({
                        profissional_nome: p.nome,
                        total: p.faturamento,
                        comissoes: p.comissao,
                        atendimentos: p.totalAgendamentos
                    }))
                };
            } catch (error) {
                console.error('❌ Erro ao gerar relatório:', error);
                return {
                    receitaDia: 0,
                    receitaSemana: 0,
                    receitaMes: 0,
                    lucroLiquido: 0,
                    totalComissoes: 0,
                    totalFaturado: 0,
                    porProfissional: []
                };
            }
        },

        async porProfissional(dataInicio, dataFim) {
            try {
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();

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
                    .in('status', ['confirmado', 'concluido', 'concluído']);

                if (error) throw error;

                const agendamentos = data || [];
                const resultado = {};

                agendamentos.forEach(ag => {
                    const id = ag.profissional_id;

                    if (!resultado[id]) {
                        resultado[id] = {
                            nome: ag.profissional ? ag.profissional.nome : 'Desconhecido',
                            faturamento: 0,
                            comissao: 0,
                            totalAgendamentos: 0
                        };
                    }

                    const valor = parseFloat(ag.valor || 0);
                    const comissaoPct = ag.profissional ? parseFloat(ag.profissional.comissao_percentual || 0) : 0;
                    const comissao = (valor * comissaoPct) / 100;

                    resultado[id].faturamento += valor;
                    resultado[id].comissao += comissao;
                    resultado[id].totalAgendamentos += 1;
                });

                return Object.values(resultado);
            } catch (error) {
                console.error('❌ Erro ao calcular por profissional:', error);
                return [];
            }
        },

        // Retorna faturamento dos últimos 7 dias
        async ultimos7Dias() {
            try {
                const supabase = getDB();
                const tenantId = await Auth.getTenantId();
                const hoje = new Date();
                const resultado = [];

                for (let i = 6; i >= 0; i--) {
                    const data = new Date(hoje);
                    data.setDate(hoje.getDate() - i);
                    const dataStr = data.toISOString().split('T')[0];

                    const { data: ags, error } = await supabase
                        .from('agendamentos')
                        .select('valor, status')
                        .eq('tenant_id', tenantId)
                        .eq('data', dataStr)
                        .in('status', ['confirmado', 'concluido', 'concluído']);

                    if (!error && ags) {
                        const totalValor = ags.reduce((sum, a) => sum + parseFloat(a.valor || 0), 0);
                        resultado.push({ data: dataStr, valor: totalValor, quantidade: ags.length });
                    } else {
                        resultado.push({ data: dataStr, valor: 0, quantidade: 0 });
                    }
                }

                return resultado;
            } catch (error) {
                console.error('❌ Erro ao buscar últimos 7 dias:', error);
                return [];
            }
        }
    },

    // ============================================
    // DASHBOARD (estatísticas gerais)
    // ============================================
    dashboard: {
        async estatisticas() {
            try {
                const hoje = new Date().toISOString().split('T')[0];
                const agora = new Date();

                const amanha = new Date(agora);
                amanha.setDate(agora.getDate() + 1);
                const amanhaStr = amanha.toISOString().split('T')[0];

                const [clientes, servicos, profissionais, agendamentosHoje, agendamentosAmanha, financeiroDia, financeiroMes] = await Promise.all([
                    DB.clientes.listar(),
                    DB.servicos.listar(),
                    DB.profissionais.listar(),
                    DB.agendamentos.listarPorData(hoje),
                    DB.agendamentos.listarPorData(amanhaStr),
                    DB.financeiro.faturamentoDia(hoje),
                    DB.financeiro.faturamentoMes(agora.getFullYear(), agora.getMonth() + 1)
                ]);

                return {
                    totalClientes: clientes.length,
                    totalServicos: servicos.length,
                    totalProfissionais: profissionais.length,
                    agendamentosHoje: agendamentosHoje.length,
                    agendamentosAmanha: agendamentosAmanha.length,
                    faturamentoDia: financeiroDia.faturamentoBruto,
                    faturamentoMes: financeiroMes.faturamentoBruto,
                    // Aliases para compatibilidade com dashboard.html
                    receitaDia: financeiroDia.faturamentoBruto,
                    receitaMes: financeiroMes.faturamentoBruto
                };
            } catch (error) {
                console.error('❌ Erro ao obter estatísticas:', error);
                return {
                    totalClientes: 0,
                    totalServicos: 0,
                    totalProfissionais: 0,
                    agendamentosHoje: 0,
                    agendamentosAmanha: 0,
                    faturamentoDia: 0,
                    faturamentoMes: 0,
                    receitaDia: 0,
                    receitaMes: 0
                };
            }
        },

        // Alias para compatibilidade com dashboard.html que chama DB.dashboard.stats()
        async stats() {
            return this.estatisticas();
        },

        // Retorna dados dos últimos 7 dias para gráficos
        async receitaUltimos7Dias() {
            return DB.financeiro.ultimos7Dias();
        }
    },

    // ============================================
    // POPULAR DADOS DE EXEMPLO (para configurações)
    // ============================================
    async popularDadosExemplo() {
        try {
            console.log('📦 Populando dados de exemplo...');

            // Criar profissionais de exemplo
            await DB.profissionais.criar({ nome: 'Ana Silva', comissao_percentual: 40, cor_agenda: '#667eea' });
            await DB.profissionais.criar({ nome: 'Carlos Santos', comissao_percentual: 35, cor_agenda: '#10B981' });

            // Criar serviços de exemplo
            await DB.servicos.criar({ nome: 'Corte Feminino', preco: 80, duracao: 60 });
            await DB.servicos.criar({ nome: 'Coloração', preco: 150, duracao: 120 });
            await DB.servicos.criar({ nome: 'Manicure', preco: 40, duracao: 45 });

            // Criar clientes de exemplo
            await DB.clientes.criar({ nome: 'Maria Oliveira', telefone: '(11) 99999-1111', email: 'maria@email.com' });
            await DB.clientes.criar({ nome: 'João Pereira', telefone: '(11) 99999-2222', email: 'joao@email.com' });

            console.log('✅ Dados de exemplo criados com sucesso!');
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao popular dados:', error);
            return { success: false, error: error.message };
        }
    }
};

console.log('✅ Módulo DB carregado - v2.0 (corrigido)');
