/**
 * Auth Guard - Proteção de Rotas e Controle de Acesso por Role (Versão Completa)
 */
(function() {
    // Configuração de páginas
    const PAGINAS_PUBLICAS = [
        '/',
        'index.html', 
        'login.html', 
        'cadastro.html', 
        'primeiro-acesso.html', 
        'cadastro-profissional.html',
        'onboarding.html',
        'agendar.html',
        'aguardando-confirmacao.html'
    ];
    const PAGINAS_RESTRITAS_DONO = ['dashboard.html', 'clientes.html', 'profissionais.html', 'servicos.html', 'configuracoes.html', 'financeiro.html'];

    async function checkAuth() {
        try {
            // Aguardar Supabase estar pronto
            if (!window.isSupabaseReady || !window.isSupabaseReady()) {
                console.warn('⚠️ [Auth Guard] Supabase não está pronto, aguardando...');
                setTimeout(checkAuth, 100);
                return;
            }

            const supabase = window.getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            
            const path = window.location.pathname.split('/').pop() || 'index.html';
            const isPublic = PAGINAS_PUBLICAS.some(p => path === p || path.endsWith(p));

            console.log(`📍 [Auth Guard] Página: ${path} | Pública: ${isPublic} | Sessão: ${!!session}`);

            // Se não tem sessão, página pública é liberada
            if (!session) {
                console.log('✅ [Auth Guard] Sem sessão - página pública liberada');
                return;
            }

            // TEM SESSÃO - buscar perfil
            console.log('🔍 [Auth Guard] Verificando perfil...');
            
            try {
                const userMetadata = session.user.user_metadata || {};
                const roleFromMetadata = userMetadata.role;

                let role = 'dono';
                let perfil = null;

                if (roleFromMetadata === 'admin') {
                    role = 'admin';
                    perfil = {
                        id: session.user.id,
                        email: session.user.email,
                        nome: session.user.user_metadata?.name || 'Admin',
                        role: 'admin',
                        tenant_id: session.user.id,
                        onboarding_completo: true
                    };
                } else {
                    const { data: perfilBD, error } = await supabase
                        .from('perfis')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (error || !perfilBD) {
                        console.log('⚠️ [Auth Guard] Perfil não encontrado - novo usuário');
                        
                        // Se está em onboarding, deixa ficar
                        if (path === 'onboarding.html') {
                            console.log('✅ [Auth Guard] Novo usuário em onboarding - permitido');
                            return;
                        }
                        
                        // Se é página pública (login, index), deixa ficar
                        if (isPublic) {
                            console.log('✅ [Auth Guard] Página pública - permitido');
                            return;
                        }
                        
                        // Senão, redireciona para onboarding
                        console.log('📍 [Auth Guard] Redirecionando para onboarding');
                        window.location.href = 'onboarding.html';
                        return;
                    }

                    perfil = perfilBD;
                    role = (perfil.role || 'dono').toLowerCase();
                }

                console.log(`✅ [Auth Guard] Role: ${role} | Onboarding: ${perfil?.onboarding_completo}`);

                // --- ONBOARDING INCOMPLETO ---
                if (!perfil.onboarding_completo) {
                    if (path === 'onboarding.html') {
                        console.log('✅ [Auth Guard] Onboarding incompleto em onboarding.html - permitido');
                        return;
                    }
                    console.log('📍 [Auth Guard] Redirecionando para onboarding (incompleto)');
                    window.location.href = 'onboarding.html';
                    return;
                }

                // --- ONBOARDING COMPLETO ---
                
                // Se está em página pública (login, index, onboarding), redireciona para dashboard
                if (isPublic) {
                    if (role === 'profissional') {
                        console.log('📍 [Auth Guard] Dono em página pública → dashboard-profissional');
                        window.location.href = 'dashboard-profissional.html';
                    } else if (role === 'admin') {
                        console.log('📍 [Auth Guard] Admin em página pública → dashboard-admin');
                        window.location.href = 'dashboard-admin.html';
                    } else {
                        console.log('📍 [Auth Guard] Dono em página pública → dashboard');
                        window.location.href = 'dashboard.html';
                    }
                    return;
                }

                // Bloqueio de acesso para profissionais
                if (role === 'profissional' && PAGINAS_RESTRITAS_DONO.includes(path)) {
                    console.log('❌ [Auth Guard] Profissional bloqueado');
                    window.location.href = 'dashboard-profissional.html';
                    return;
                }

                // Atualizar UI
                const userNameEl = document.getElementById('userName');
                const userRoleEl = document.getElementById('userRole');
                const userAvatarEl = document.getElementById('userAvatar');

                if (userNameEl) userNameEl.textContent = perfil.nome || 'Usuário';
                if (userRoleEl) {
                    if (role === 'admin') {
                        userRoleEl.textContent = 'Administrador';
                    } else if (role === 'profissional') {
                        userRoleEl.textContent = 'Profissional';
                    } else {
                        userRoleEl.textContent = 'Proprietário';
                    }
                }
                if (userAvatarEl && perfil.avatar_url) userAvatarEl.src = perfil.avatar_url;

                // Dispara evento
                console.log('📢 [Auth Guard] Perfil carregado');
                window.dispatchEvent(new CustomEvent('perfilCarregado', { detail: perfil }));

            } catch (err) {
                console.error("❌ [Auth Guard] Erro ao buscar perfil:", err);
            }

        } catch (err) {
            console.error("❌ [Auth Guard] Erro crítico:", err);
        }
    }

    // Iniciar quando Supabase estiver pronto
    function iniciar() {
        if (window.isSupabaseReady && window.isSupabaseReady()) {
            console.log('✅ [Auth Guard] Iniciando verificação...');
            checkAuth();
        } else {
            console.log('⏳ [Auth Guard] Aguardando Supabase...');
            window.addEventListener('supabaseReady', () => {
                console.log('✅ [Auth Guard] Supabase pronto!');
                checkAuth();
            }, { once: true });
        }
    }

    iniciar();

    // Listener para logout
    window.addEventListener('supabaseReady', () => {
        try {
            window.getSupabase().auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    console.log('🚪 [Auth Guard] Logout detectado');
                    window.location.href = 'index.html';
                }
            });
        } catch (e) {
            console.warn('⚠️ [Auth Guard] Erro ao configurar logout:', e);
        }
    });
})();
