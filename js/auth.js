/* js/auth.js
   Versão compatível com frontend que usa window.getSupabase()
   - Funções: signUp, signIn, signOut, getPerfil, getTenantId, getRole, isDono
   - Registra handlers de auth e emite evento 'perfilCarregado' quando o perfil está pronto
*/

(function () {
  // helpers
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

      // Dependendo da versão do supabase, id pode vir em signUpData.user.id
      const userId = signUpData?.user?.id ?? signUpData?.id;
      if (!userId) {
        // Em alguns fluxos sem confirmação imediata, o usuário pode não ser retornado.
        // Buscamos o usuário pelo email (caso a sessão já exista) — fallback inseguro, mas raro.
        const { data: userByEmail } = await supabase.auth.getUserByEmail?.(email) ?? {};
        // se não encontrarmos, apenas falhe com mensagem clara
        if (!userByEmail?.id) {
          throw new Error('Não foi possível obter o ID do usuário após o signUp. Verifique confirmação de e-mail.');
        }
      }

      // Use o id do usuário como id do tenant para simplificar ligação inicial
      const tenantPayload = {
        id: userId,
        nome_empresa: nomeEmpresa,
        plano,
        trial_inicio: new Date().toISOString(),
        trial_fim: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        status_pagamento: 'trial',
      };

      // 2) Inserir tenant (empresa)
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert([tenantPayload])
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 3) Inserir perfil (perfis)
      const perfilPayload = {
        id: userId,
        nome,
        email,
        tenant_id: tenantData.id,
        role: 'dono',
      };

      const { data: perfilData, error: perfilError } = await supabase
        .from('perfis')
        .insert([perfilPayload])
        .select();

      if (perfilError) throw perfilError;

      return { success: true, message: 'Cadastro criado. Verifique seu e-mail para confirmação (se aplicável).' };
    } catch (err) {
      console.error('signUp error', err);
      return { success: false, message: err?.message ?? String(err) };
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
      } else if (supabase.auth.onAuthStateChange === undefined && supabase.auth.onAuthStateChange !== undefined) {
        // fallback - não necessário na maioria das versões modernas
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
  };

  // auto-init
  // chamamos init depois de um pequeno timeout para garantir que js/supabase-config.js já foi carregado
  setTimeout(() => {
    try {
      init();
    } catch (e) {
      // ignore
    }
  }, 250);
})();
