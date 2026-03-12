/* js/auth.js
   Compatível com frontend do projeto (usa window.getSupabase()).
   Fornece:
    - signUp, signIn, signOut
    - getPerfil, getTenantId, getRole, isDono
    - isAuthenticated (síncrono) e isAuthenticatedAsync (assíncrono)
    - init() que popula window.__perfil e emite 'perfilCarregado'
*/

(function () {
  'use strict';

  function sup() {
    if (typeof window.getSupabase !== 'function') {
      throw new Error('getSupabase() não está disponível. Verifique js/supabase-config.js');
    }
    return window.getSupabase();
  }

  async function signUp({ nome, nomeEmpresa, email, senha, plano = 'plano1' }) {
    try {
      const supabase = sup();

      // 1) Criar usuário no Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (signUpError) throw signUpError;

      // Obter user id
      const userId = signUpData?.user?.id ?? signUpData?.id;
      if (!userId) {
        // Tentar obter via getUser (fallback)
        try {
          const resp = await supabase.auth.getUser();
          const uid = resp?.data?.user?.id;
          if (uid) {
            // continue
          } else {
            throw new Error('Não foi possível obter o ID do usuário após o signUp.');
          }
        } catch (e) {
          throw new Error('Não foi possível obter o ID do usuário após o signUp. Verifique a configuração de confirmações.');
        }
      }

      // 2) Criar tenant (empresa) usando o mesmo id do usuário para facilitar ligação inicial
      const tenantPayload = {
        id: userId,
        nome_empresa: nomeEmpresa,
        plano,
        trial_inicio: new Date().toISOString(),
        trial_fim: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        status_pagamento: 'trial',
      };

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert([tenantPayload])
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 3) Criar perfil vinculado ao tenant
      const perfilPayload = {
        id: userId,
        nome,
        email,
        tenant_id: tenantData.id,
        role: 'dono',
      };

      const { error: perfilError } = await supabase
        .from('perfis')
        .insert([perfilPayload]);

      if (perfilError) throw perfilError;

      return { success: true, message: 'Cadastro criado. Verifique seu e-mail para confirmação (se aplicável).' };
    } catch (err) {
      console.error('signUp error', err);
      // Mensagem amigável
      return { success: false, message: err?.message ?? String(err) };
    }
  }

  async function signIn({ email, senha }) {
    try {
      const supabase = sup();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      // carregar perfil imediatamente
      await refreshPerfil();
      return { success: true, data };
    } catch (err) {
      console.error('signIn error', err);
      return { success: false, message: err?.message ?? String(err) };
    }
  }

  async function signOut() {
    try {
      const supabase = sup();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // limpar perfil local
      window.__perfil = null;
      window.dispatchEvent(new Event('perfilCarregado'));
      return { success: true };
    } catch (err) {
      console.error('signOut error', err);
      return { success: false, message: err?.message ?? String(err) };
    }
  }

  async function getPerfil() {
    try {
      // Retorna perfil já carregado em memória se existir
      if (window.__perfil) return window.__perfil;

      const supabase = sup();
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      // armazenar localmente para acesso síncrono
      window.__perfil = data ?? null;
      return data;
    } catch (err) {
      console.error('getPerfil error', err);
      return null;
    }
  }

  async function refreshPerfil() {
    const perfil = await getPerfil();
    window.__perfil = perfil || null;
    window.dispatchEvent(new Event('perfilCarregado'));
    return window.__perfil;
  }

  async function getTenantId() {
    const perfil = await getPerfil();
    return perfil?.tenant_id ?? null;
  }

  async function getRole() {
    const perfil = await getPerfil();
    return perfil?.role ?? null;
  }

  async function isDono() {
    const role = await getRole();
    return role === 'dono';
  }

  // Síncrono: compatível com código legado que espera função imediata
  function isAuthenticated() {
    return !!window.__perfil;
  }

  async function isAuthenticatedAsync() {
    try {
      const supabase = sup();
      if (supabase.auth.getSession) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return true;
      }
    } catch (e) {
      // ignore
    }
    return !!window.__perfil;
  }

  // Listener de alterações de autenticação
  function startAuthListener() {
    try {
      const supabase = sup();
      if (supabase.auth.onAuthStateChange) {
        supabase.auth.onAuthStateChange(async (event, session) => {
          // sempre atualiza o perfil quando houver mudança
          await refreshPerfil();
        });
      }
    } catch (err) {
      console.warn('startAuthListener erro', err);
    }
  }

  // Inicialização: popula window.__perfil se existir sessão ativa
  async function init() {
    try {
      await refreshPerfil();
      startAuthListener();
    } catch (err) {
      console.warn('auth init failed', err);
    }
  }

  // Expor API pública
  window.Auth = {
    signUp,
    signIn,
    signOut,
    getPerfil,
    getTenantId,
    getRole,
    isDono,
    init,
    // Compatibilidade
    isAuthenticated,
    isAuthenticatedAsync,
  };

  // auto-init com pequeno delay para garantir carregamento do supabase-config
  setTimeout(() => {
    try {
      init();
    } catch (e) {
      // ignore
    }
  }, 200);
})();
