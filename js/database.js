const DB = {
  servicos: {
    async listar() {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('tenant_id', perfil.tenant_id)
        .order('nome');

      if (error) throw error;
      return data;
    },

    async salvar(dados) {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const payload = {
        nome: dados.nome,
        descricao: dados.descricao,
        valor: parseFloat(dados.valor) || 0,
        tenant_id: perfil.tenant_id
      };

      if (dados.id) {
        const { data, error } = await supabase
          .from('servicos')
          .update(payload)
          .eq('id', dados.id);
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('servicos')
          .insert([payload]);
        if (error) throw error;
        return data;
      }
    },

    async excluir(id) {
      const supabase = window.getSupabase();
      const { data, error } = await supabase
        .from('servicos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return data;
    }
  },

  profissionais: {
    async listar() {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const { data, error } = await supabase
        .from('profissionais')
        .select('*, email, especialidade')
        .eq('tenant_id', perfil.tenant_id)
        .order('nome');

      if (error) throw error;
      return data;
    },

    async salvar(dados) {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const payload = {
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        especialidade: dados.especialidade,
        status: dados.status || 'Ativo',
        tipo_comissao: dados.tipo_comissao,
        comissao_percentual: parseFloat(dados.comissao_percentual) || 0,
        cor_agenda: dados.cor_agenda || '#6366F1',
        tenant_id: perfil.tenant_id
      };

      if (dados.id) {
        const { data, error } = await supabase
          .from('profissionais')
          .update(payload)
          .eq('id', dados.id);
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('profissionais')
          .insert([payload]);
        if (error) throw error;
        return data;
      }
    },

    async excluir(id) {
      const supabase = window.getSupabase();
      const { data, error } = await supabase
        .from('profissionais')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return data;
    }
  },

  agendamentos: {
    async listar() {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id, role, profissional_id')
        .eq('user_id', session.user.id)
        .single();

      let query = supabase
        .from('agendamentos')
        .select('*, cliente(*), servico(*), profissional(*)')
        .eq('tenant_id', perfil.tenant_id);

      if (perfil.role === 'profissional') {
        query = query.eq('profissional_id', perfil.profissional_id);
      }

      const { data, error } = await query.order('data', { ascending: false });

      if (error) throw error;
      return data;
    },

    async salvar(dados) {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const payload = {
        cliente_id: dados.cliente_id,
        servico_id: dados.servico_id,
        profissional_id: dados.profissional_id,
        data: dados.data,
        hora: dados.hora,
        status: dados.status,
        observacoes: dados.observacoes,
        valor: parseFloat(dados.valor) || 0,
        tenant_id: perfil.tenant_id
      };

      if (dados.id) {
        const { data, error } = await supabase
          .from('agendamentos')
          .update(payload)
          .eq('id', dados.id);
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('agendamentos')
          .insert([payload]);
        if (error) throw error;
        return data;
      }
    },

    async excluir(id) {
      const supabase = window.getSupabase();
      const { data, error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return data;
    }
  },

  clientes: {
    async listar() {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('tenant_id', perfil.tenant_id)
        .order('nome');

      if (error) throw error;
      return data;
    },

    async salvar(dados) {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const payload = {
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        observacoes: dados.observacoes,
        tenant_id: perfil.tenant_id
      };

      if (dados.id) {
        const { data, error } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', dados.id);
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('clientes')
          .insert([payload]);
        if (error) throw error;
        return data;
      }
    },

    async excluir(id) {
      const supabase = window.getSupabase();
      const { data, error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return data;
    }
  },

  financeiro: {
    async resumo() {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id, role, profissional_id')
        .eq('user_id', session.user.id)
        .single();

      let query = supabase
        .from('financeiro')
        .select('valor')
        .eq('tenant_id', perfil.tenant_id);

      if (perfil.role === 'profissional') {
        query = query.eq('profissional_id', perfil.profissional_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.reduce((acc, item) => acc + parseFloat(item.valor), 0);
    },

    async porProfissional() {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      const { data, error } = await supabase
        .from('financeiro')
        .select('profissional_id, sum(valor) as total')
        .eq('tenant_id', perfil.tenant_id)
        .group('profissional_id');

      if (error) throw error;
      return data;
    }
  }
};
