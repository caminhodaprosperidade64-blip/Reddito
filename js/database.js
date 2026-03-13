/
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
                const tenantId = await Auth.getTenantId();
                const supabase = window.getSupabase();
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
                        telefone: dados.telefone,
                        email: dados.email,
                        especialidade: dados.especialidade,
                        status: dados.status || 'Ativo',
                        tipo_comissao: dados.tipo_comissao,
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
                const { data, error } = await supabase
                    .from('profissionais')
                    .update({
                        nome: dados.nome,
                        telefone: dados.telefone,
                        email: dados.email,
                        especialidade: dados.especialidade,
                        status: dados.status || 'Ativo',
                        tipo_comissao: dados.tipo_comissao,
                        comissao_percentual: parseFloat(dados.comissao_percentual || 0),
                        cor_agenda: dados.cor_agenda || '#667eea'
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

    // ... (outros módulos do DB, se houver)
};

// Expondo DB globalmente para acesso em outros scripts
window.DB = DB;

console.log('✅ Módulo DB carregado - Tabelas em português');
