/**
 * ============================================
 * AUTH MODULE - COM SUPORTE A ROLES
 * ============================================
 */
console.log('🔧 [Auth] Carregando módulo...');

function aguardarSupabase(callback) {
  if (window.isSupabaseReady && window.isSupabaseReady()) {
    callback();
  } else {
    window.addEventListener('supabaseReady', () => callback(), { once: true });
  }
}

const Auth = {

  async getUser() {
    try {
      const supabase = window.getSupabase();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('❌ [Auth] Erro ao obter usuário:', error);
      return null;
    }
  },

  async getPerfil() {
    try {
      const user = await this.getUser();
      if (!user) return null;

      // Cache em memória para evitar múltiplas queries
      if (window._perfilCache) return window._perfilCache;

      const supabase = window.getSupabase(); // ✅ CORRIGIDO
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', user.id) // ✅ CORRIGIDO: era .eq('id', user.id)
        .single();

      if (error) throw error;
      window._perfilCache = data;
      return data;
    } catch (error) {
      console.error('❌ [Auth] Erro ao obter perfil:', error);
      return null;
    }
  },

  async getTenantId() {
    const perfil = await this.getPerfil();
    return perfil ? perfil.tenant_id : null;
  },

  async getRole() {
    const perfil = await this.getPerfil();
    return perfil ? perfil.role : null;
  },

  async isDono() {
    const role = await this.getRole();
    return role === 'dono';
  },

  async isAuthenticated() {
    const user = await this.getUser();
    return user !== null;
  },

  async signIn(email, password) {
    try {
      const supabase = window.getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window._perfilCache = null; // Limpar cache ao fazer login
      console.log('✅ [Auth] Login realizado:', data.user.email);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('❌ [Auth] Erro no login:', error);
      return { success: false, error: error.message };
    }
  },

  async signUp(email, password, nomeDaEmpresa) {
    try {
      const supabase = window.getSupabase(); // ✅ CORRIGIDO: era getSupabaseClient()

      // 1. Criar conta no Supabase Auth
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const user = data.user;

      // 2. Criar perfil como DONO com tenant_id = user.id (ele É a empresa)
      const { error: perfilError } = await supabase
        .from('perfis')
        .insert({
          user_id: user.id,       // ✅ CORRIGIDO: coluna correta
          tenant_id: user.id,     // O dono define o tenant
          role: 'dono',
          nome: nomeDaEmpresa || email,
          email: email
        });

      if (perfilError) {
        console.warn('⚠️ [Auth] Perfil será criado após confirmação de email:', perfilError.message);
      }

      console.log('✅ [Auth] Conta criada:', user.email);
      return { success: true, user };
    } catch (error) {
      console.error('❌ [Auth] Erro no cadastro:', error);
      return { success: false, error: error.message };
    }
  },

  async signOut() {
    try {
      const supabase = window.getSupabase();
      await supabase.auth.signOut();

      window._perfilCache = null; // Limpar cache
      console.log('✅ [Auth] Logout realizado');
      window.location.href = '/login.html';
      return { success: true };
    } catch (error) {
      console.error('❌ [Auth] Erro no logout:', error);
      return { success: false, error: error.message };
    }
  },

  async requireAuth() {
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  }
};

window.Auth = Auth;
console.log('✅ [Auth] Módulo exportado');

// ============================================
// PROTEÇÃO DE ROTAS
// ============================================
function configurarProtecaoRotas() {
  const paginasPublicas = [
    '/', '/index.html', '/login.html',
    '/aguardando-confirmacao.html', '/agendar.html',
    '/teste-auth.html', '/onboarding-step1.html'
  ];

  const paginaAtual = window.location.pathname;
  const ehPublica = paginasPublicas.some(p =>
    paginaAtual === p || paginaAtual.endsWith(p)
  );

  if (ehPublica) return;

  Auth.isAuthenticated().then(async autenticado => {
    if (!autenticado) {
      window.location.href = '/login.html';
      return;
    }

    const perfil = await Auth.getPerfil();
    if (!perfil) {
      console.warn('⚠️ [Auth] Perfil não encontrado, redirecionando...');
      window.location.href = '/login.html';
      return;
    }

    // Guardar globalmente para uso nas páginas
    window.TENANT_ID = perfil.tenant_id;
    window.USER_ROLE = perfil.role;
    window.USER_NOME = perfil.nome;

    console.log(`✅ [Auth] Autenticado como: ${perfil.role} | Tenant: ${perfil.tenant_id}`);

    // Disparar evento para o auth-guard.js reagir
    window.dispatchEvent(new CustomEvent('perfilCarregado', { detail: perfil }));
  });
}

aguardarSupabase(configurarProtecaoRotas);
console.log('✅ [Auth] Módulo carregado completamente');
