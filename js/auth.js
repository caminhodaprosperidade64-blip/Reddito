/**
 * ============================================
 * AUTH MODULE - VERSÃO ATUALIZADA COM ONBOARDING
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

  async isAuthenticated() {
    try {
      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      return !!session?.user;
    } catch (e) {
      console.error('❌ [Auth] Erro ao obter session:', e);
      return false;
    }
  },

  async getPerfil() {
    try {
      if (window._perfilCache) return window._perfilCache;

      const supabase = window.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return null;

      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', user.id)
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

  async signIn(email, password) {
    try {
      const supabase = window.getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window._perfilCache = null;
      console.log('✅ [Auth] Login realizado:', data.user.email);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('❌ [Auth] Erro no login:', error);
      return { success: false, error: error.message };
    }
  },

  async signUp(email, password, nomeDaEmpresa) {
    try {
      const supabase = window.getSupabase();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const user = data.user;

      // Cria perfil básico — onboarding_completo = false
      const { error: perfilError } = await supabase
        .from('perfis')
        .insert({
          id:                  user.id,
          tenant_id:           user.id,
          role:                'dono',
          nome:                nomeDaEmpresa || email,
          email:               email,
          onboarding_completo: false
        });

      if (perfilError) {
        console.warn('⚠️ [Auth] Perfil será criado após confirmação:', perfilError.message);
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
      window._perfilCache = null;
      console.log('✅ [Auth] Logout realizado');
      window.location.href = 'login.html';
      return { success: true };
    } catch (error) {
      console.error('❌ [Auth] Erro no logout:', error);
      return { success: false, error: error.message };
    }
  },

  async requireAuth() {
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      window.location.href = 'login.html';
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
  if (window.__protecaoRotasRodou) return;
  window.__protecaoRotasRodou = true;

  const paginasPublicas = [
    '/', '/index.html', '/login.html',
    '/aguardando-confirmacao.html', '/agendar.html',
    '/onboarding.html', '/teste-auth.html',
    'index.html', 'login.html',
    'aguardando-confirmacao.html', 'agendar.html',
    'onboarding.html'
  ];

  const paginaAtual = window.location.pathname;
  const ehPublica = paginasPublicas.some(p =>
    paginaAtual === p || paginaAtual.endsWith(p)
  );

  if (ehPublica) return;

  Auth.isAuthenticated().then(async autenticado => {
    if (!autenticado) {
      console.warn('⚠️ [Auth] Não autenticado, redirecionando para login...');
      window.location.href = 'login.html';
      return;
    }

    const perfil = await Auth.getPerfil();

    // Sem perfil = primeiro acesso → onboarding
    if (!perfil) {
      console.warn('⚠️ [Auth] Perfil não encontrado → onboarding');
      window.location.href = 'onboarding.html';
      return;
    }

    // Perfil existe mas onboarding não foi concluído → onboarding
    if (!perfil.onboarding_completo) {
      console.warn('⚠️ [Auth] Onboarding incompleto → redirecionando...');
      window.location.href = 'onboarding.html';
      return;
    }

    // Tudo OK — expõe dados globais e dispara evento
    window.TENANT_ID = perfil.tenant_id;
    window.USER_ROLE = perfil.role;
    window.USER_NOME = perfil.nome;

    console.log(`✅ [Auth] Autenticado: ${perfil.role} | Tenant: ${perfil.tenant_id}`);
    window.dispatchEvent(new CustomEvent('perfilCarregado', { detail: perfil }));
  });
}

aguardarSupabase(configurarProtecaoRotas);
console.log('✅ [Auth] Módulo carregado completamente');
