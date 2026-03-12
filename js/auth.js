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

  async function signUp({ nome, nomeEmpresa, email, senha, plano }) {
    try {
      const supabase = sup();

      // 1) Criar usuário no Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (signUpError) throw signUpError;

      const userId = signUpData.user.id;

      // 2) Criar tenant (empresa) com o plano escolhido
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert([
          {
            id: userId, // usar o mesmo UUID do usuário para facilitar
            nome_empresa: nomeEmpresa,
            plano,
            trial_inicio: new Date(),
            trial_fim: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 dias depois
            status_pagamento: 'trial',
          },
        ])
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 3) Criar perfil do usuário vinculado ao tenant
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfis')
        .insert([
          {
            id: userId,
            nome,
            email,
            tenant_id: tenantData.id,
            role: 'dono', // dono da empresa
          },
        ]);

      if (perfilError) throw perfilError;

      return { success: true, message: 'Usuário criado com sucesso! Verifique seu e-mail para confirmar.' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async function signIn({ email, senha }) {
    try {
      const supabase = sup();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
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
      return { success: true };
    } catch (err) {
      console.error('signOut error', err);
      return { success: false, message: err?.message ?? String(err) };
    }
  }

  async function getPerfil() {
    try {
      const supabase = sup();
      const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data?.user : supabase.auth.user?.();
      const userId = user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('getPerfil error', err);
      return null;
    }
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

  // Observador de auth para carregar perfil automaticamente
  function startAuthListener() {
    try {
      const supabase = sup();
      if (supabase.auth.onAuthStateChange) {
        supabase.auth.onAuthStateChange(async (event, session) => {
          // Quando ocorrer mudança, tentamos carregar o perfil e emitimos evento global
          const perfil = await getPerfil();
          // armazenar no window para fácil acesso
          window.__perfil = perfil || null;
          // emitir evento para a app
          const ev = new Event('perfilCarregado');
          window.dispatchEvent(ev);
        });
      }
    } catch (err) {
      console.warn('startAuthListener erro', err);
    }
  }

  // Inicializa carregando perfil se já logado
  async function init() {
    try {
      // tenta popular window.__perfil se já existir sessão
      const perfil = await getPerfil();
      window.__perfil = perfil || null;
      window.dispatchEvent(new Event('perfilCarregado'));
      startAuthListener();
    } catch (err) {
      console.warn('auth init failed', err);
    }
  }

  // Expor API global para que o resto do projeto (HTML/JS) possa usar
  window.Auth = {
    signUp,
    signIn,
    signOut,
    getPerfil,
    getTenantId,
    getRole,
    isDono,
    init,
    // Compatibilidade com código antigo que espera função sincrona
    isAuthenticated: function() {
      return !!window.__perfil;
    },
    // Versão assíncrona caso queira usar
    isAuthenticatedAsync: async function() {
      try {
        const supabase = (typeof window.getSupabase === 'function') ? window.getSupabase() : null;
        if (supabase && supabase.auth && supabase.auth.getSession) {
          const { data } = await supabase.auth.getSession();
          return !!data?.session;
        }
      } catch (e) {}
      return !!window.__perfil;
    }
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
