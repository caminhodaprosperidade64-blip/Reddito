/**
 * Auth Guard - Proteção de Rotas e Controle de Acesso por Role (Versão Corrigida)
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
    
    const PAGINAS_RESTRITAS_DONO = [
        'dashboard.html', 
        'clientes.html', 
        'profissionais.html', 
        'servicos.html', 
        'configuracoes.html', 
        'financeiro.html'
    ];

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

            // ========== SEM SESSÃO ==========
            if (!session) {
                console.log('✅ [Auth Guard] Sem sessão - páginas públicas liberadas');
                // Se é página pública, deixa ficar
                if (isPublic) {
                    return;
                }
                // Se é página privada, redireciona para login
                console.warn('❌ [Auth Guard] Página privada sem sessão → login');
                window.location.href = 'login.html';
                return;
            }

            // ========== COM SESSÃO ==========
            console.log('🔍 [Auth Guard] Sessão ativa, verificando perfil...');
            
            try {
                const userMetadata = session.user.user_metadata || {};
                const roleFromMetadata = userMetadata.role;

                let role = 'dono';
                let perfil = null;

                // Verificar se é ADMIN
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
                    console.log('✅ [Auth Guard] User é ADMIN');
                } else {
                    // Buscar perfil do BD
                    const { data: perfilBD, error } = await supabase
                        .from('perfis')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (error || !perfilBD) {
                        console.log('⚠️ [Auth Guard] Perfil não encontrado no BD');
                        
                        // Se está em onboarding, PERMITE ficar
                        if (path === 'onboarding.html') {
                            console.log('✅ [Auth Guard] Em onboarding sem perfil - PERMITIDO');
                            return;
                        }
                        
                        // Se é página pública, permite
                        if (isPublic) {
                            console.log('✅ [Auth Guard] Página pública - PERMITIDO');
                            return;
                        }
                        
                        // Senão, redireciona para onboarding
                        console.log('📍 [Auth Guard] Redirecionando para onboarding (perfil não existe)');
                        window.location.href = 'onboarding.html';
                        return;
                    }

                    perfil = perfilBD;
                    role = (perfil.role || 'dono').toLowerCase();
                    console.log(`✅ [Auth Guard] Perfil encontrado | Role: ${role} | Onboarding: ${perfil.onboarding_completo}`);
                }

                // ========== VERIFICAR ONBOARDING INCOMPLETO ==========
                if (!perfil.onboarding_completo) {
                    console.log('⚠️ [Auth Guard] Onboarding INCOMPLETO');
                    
                    if (path === 'onboarding.html') {
                        console.log('✅ [Auth Guard] Em onboarding.html - PERMITIDO');
                        return;
                    }
                    
                    console.log('📍 [Auth Guard] Redirecionando para onboarding');
                    window.location.href = 'onboarding.html';
                    return;
                }

                // ========== ONBOARDING COMPLETO ==========
                console.log('✅ [Auth Guard] Onboarding COMPLETO');
                
                // Se está em página pública, redireciona para dashboard apropriado
                if (isPublic) {
                    if (role === 'profissional') {
                        console.log('📍 [Auth Guard] Profissional em página pública → dashboard-profissional');
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

                // Bloqueio de acesso para profissionais em áreas restritas
                if (role === 'profissional' && PAGINAS_RESTRITAS_DONO.includes(path)) {
                    console.log('❌ [Auth Guard] Profissional bloqueado de página restrita');
                    window.location.href = 'dashboard-profissional.html';
                    return;
                }

                // Bloqueio: dono tentando acessar dashboard de profissional
                if (role === 'dono' && path === 'dashboard-profissional.html') {
                    console.log('📍 [Auth Guard] Dono redirecionado da dashboard-profissional');
                    window.location.href = 'dashboard.html';
                    return;
                }

                // Bloqueio: admin em dashboard de dono
                if (role === 'admin' && path === 'dashboard.html') {
                    console.log('📍 [Auth Guard] Admin redirecionado → dashboard-admin');
                    window.location.href = 'dashboard-admin.html';
                    return;
                }

                // ========== ATUALIZAR UI ==========
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

                // Esconder menu para profissionais
                if (role === 'profissional') {
                    const idsParaEsconder = [
                        'menu-dashboard', 
                        'menu-clientes', 
                        'menu-profissionais', 
                        'menu-servicos', 
                        'menu-financeiro', 
                        'menu-configuracoes'
                    ];
                    idsParaEsconder.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });
                }

                // Disparar evento
                console.log('📢 [Auth Guard] Perfil carregado com sucesso');
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
            console.log('✅ [Auth Guard] Supabase pronto, iniciando verificação...');
            checkAuth();
        } else {
            console.log('⏳ [Auth Guard] Aguardando Supabase ficar pronto...');
            window.addEventListener('supabaseReady', () => {
                console.log('✅ [Auth Guard] Supabase pronto, iniciando verificação...');
                checkAuth();
            }, { once: true });
        }
    }

    // Executar quando o script carregar
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
            console.warn('⚠️ [Auth Guard] Erro ao configurar logout listener:', e);
        }
    });
})();
