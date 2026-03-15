/**
 * Auth Guard - Proteção de Rotas e Controle de Acesso por Role (Versão Completa)
 */
(function() {
    // Configuração de páginas
    const PAGINAS_PUBLICAS = [
        'index.html', 
        'login.html', 
        'cadastro.html', 
        'primeiro-acesso.html', 
        'cadastro-profissional.html',
        'onboarding.html'
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
            const isPublic = PAGINAS_PUBLICAS.includes(path);

            console.log(`📍 [Auth Guard] Página atual: ${path} | Pública: ${isPublic} | Sessão: ${!!session}`);

            // Se estivermos na página de cadastro do profissional, não execute nenhuma lógica
            if (path === 'cadastro-profissional.html') {
                return;
            }

            // SEM SESSÃO
            if (!session) {
                if (!isPublic) {
                    console.warn(`⚠️ [Auth Guard] Não autenticado em página privada ${path}, redirecionando para login`);
                    window.location.href = 'login.html';
                }
                return;
            }

            // COM SESSÃO: buscar perfil completo
            try {
                // PRIMEIRO: Verificar se é ADMIN no metadata
                const userMetadata = session.user.user_metadata || {};
                const roleFromMetadata = userMetadata.role;

                let role = 'dono'; // padrão
                let perfil = null;

                // Se for admin, usar esse role
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
                    // Se não for admin, buscar do banco de dados
                    const { data: perfilBD, error } = await supabase
                        .from('perfis')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (error) {
                        console.warn("⚠️ [Auth Guard] Perfil não encontrado no BD:", error.message);
                        // Perfil não existe ainda (novo usuário no onboarding)
                        if (path === 'onboarding.html') {
                            console.log('✅ [Auth Guard] Novo usuário em onboarding.html - permitido');
                            return;
                        }
                        // Se não está em onboarding, redirecionar para onboarding
                        console.log('📍 [Auth Guard] Redirecionando para onboarding (perfil não existe)');
                        window.location.href = 'onboarding.html';
                        return;
                    }

                    perfil = perfilBD;
                    role = (perfil.role || 'dono').toLowerCase();
                }

                console.log(`✅ [Auth Guard] Role: ${role} | Onboarding completo: ${perfil?.onboarding_completo}`);

                // --- LÓGICA DE REDIRECIONAMENTO POR ROLE ---
                
                // 1. VERIFICAR ONBOARDING INCOMPLETO
                if (!perfil.onboarding_completo) {
                    if (path === 'onboarding.html') {
                        console.log('✅ [Auth Guard] Em onboarding com perfil incompleto - permitido');
                        return;
                    }
                    console.log('📍 [Auth Guard] Redirecionando para onboarding (incompleto)');
                    window.location.href = 'onboarding.html';
                    return;
                }

                // 2. ONBOARDING COMPLETO - Se está em página pública
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

                // 3. Se for PROFISSIONAL tentando acessar área do DONO, bloqueia
                if (role === 'profissional' && PAGINAS_RESTRITAS_DONO.includes(path)) {
                    console.log('📍 [Auth Guard] Profissional bloqueado de página restrita → dashboard-profissional');
                    window.location.href = 'dashboard-profissional.html';
                    return;
                }

                // 4. Se for DONO tentando acessar a dash do profissional, volta para a dele
                if (role === 'dono' && path === 'dashboard-profissional.html') {
                    console.log('📍 [Auth Guard] Dono redirecionado da dashboard-profissional → dashboard');
                    window.location.href = 'dashboard.html';
                    return;
                }

                // 5. Se for ADMIN e entrar em página de cliente, vai para dashboard-admin
                if (role === 'admin' && path === 'dashboard.html') {
                    console.log('📍 [Auth Guard] Admin redirecionado → dashboard-admin');
                    window.location.href = 'dashboard-admin.html';
                    return;
                }

                // --- MANIPULAÇÃO DE UI ---

                // Atualiza elementos de interface
                const userNameEl = document.getElementById('userName');
                const userRoleEl = document.getElementById('userRole');
                const userAvatarEl = document.getElementById('userAvatar');

                if (userNameEl) userNameEl.textContent = perfil.nome || 'Usuário';
                if (userRoleEl) {
                    if (role === 'admin') {
                        userRoleEl.textContent = 'Administrador';
                    } else if (role === 'dono') {
                        userRoleEl.textContent = 'Proprietário';
                    } else {
                        userRoleEl.textContent = 'Profissional';
                    }
                }
                if (userAvatarEl && perfil.avatar_url) userAvatarEl.src = perfil.avatar_url;

                // Esconde itens de menu restritos para profissionais
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

                // Dispara o evento que as outras páginas esperam
                console.log('📢 [Auth Guard] Disparando evento perfilCarregado');
                window.dispatchEvent(new CustomEvent('perfilCarregado', { 
                    detail: perfil 
                }));

            } catch (err) {
                console.error("❌ [Auth Guard] Erro ao buscar perfil:", err);
            }

        } catch (err) {
            console.error("❌ [Auth Guard] Erro crítico:", err);
        }
    }

    // Aguardar Supabase estar pronto antes de executar
    function iniciar() {
        if (window.isSupabaseReady && window.isSupabaseReady()) {
            console.log('✅ [Auth Guard] Supabase pronto, iniciando verificação...');
            checkAuth();
        } else {
            console.log('⏳ [Auth Guard] Aguardando Supabase ficar pronto...');
            window.addEventListener('supabaseReady', () => {
                console.log('✅ [Auth Guard] Supabase ficou pronto, iniciando verificação...');
                checkAuth();
            }, { once: true });
        }
    }

    // Iniciar assim que o script carregar
    iniciar();

    // Listener para Logout
    window.addEventListener('supabaseReady', () => {
        try {
            window.getSupabase().auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    console.log('🚪 [Auth Guard] Usuário fez logout');
                    window.location.href = 'index.html';
                }
            });
        } catch (e) {
            console.warn('⚠️ [Auth Guard] Não foi possível configurar listener de logout:', e);
        }
    });
})();
