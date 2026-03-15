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
        'onboarding.html'  // ← ADICIONADO
    ];
    const PAGINAS_RESTRITAS_DONO = ['dashboard.html', 'clientes.html', 'profissionais.html', 'servicos.html', 'configuracoes.html', 'financeiro.html'];

    async function checkAuth() {
        const supabase = window.getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        
        const path = window.location.pathname.split('/').pop() || 'index.html';
        const isPublic = PAGINAS_PUBLICAS.includes(path);

        // Se estivermos na página de cadastro do profissional, não execute nenhuma lógica
        if (path === 'cadastro-profissional.html') {
            return;
        }

        if (!session) {
            if (!isPublic) {
                window.location.href = 'index.html';
            }
            return;
        }

        // Usuário logado: buscar perfil completo
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
                    tenant_id: session.user.id
                };
            } else {
                // Se não for admin, buscar do banco de dados
                const { data: perfilBD, error } = await supabase
                    .from('perfis')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (error || !perfilBD) {
                    console.error("Erro ao carregar perfil no Guard:", error);
                    return;
                }

                perfil = perfilBD;
                role = (perfil.role || 'dono').toLowerCase();
            }

            console.log('✅ Role detectado:', role);

            // --- LÓGICA DE REDIRECIONAMENTO POR ROLE ---
            
            // 1. Se está em página de login/cadastro/onboarding mas já está logado
            if (isPublic) {
                if (role === 'profissional') {
                    window.location.href = 'dashboard-profissional.html';
                } else if (role === 'admin') {
                    window.location.href = 'dashboard-admin.html';
                } else {
                    // Se estiver em onboarding e já tem perfil completo, vai para dashboard
                    if (path === 'onboarding.html' && perfil.onboarding_completo) {
                        window.location.href = 'dashboard.html';
                        return;
                    }
                    // Se estiver em onboarding e NÃO tem perfil completo, deixa ficar em onboarding
                    if (path === 'onboarding.html' && !perfil.onboarding_completo) {
                        return;
                    }
                    // Se estiver em login/index e já autenticado, vai para dashboard
                    window.location.href = 'dashboard.html';
                }
                return;
            }

            // 2. Se for PROFISSIONAL tentando acessar área do DONO, bloqueia
            if (role === 'profissional' && PAGINAS_RESTRITAS_DONO.includes(path)) {
                window.location.href = 'dashboard-profissional.html';
                return;
            }

            // 3. Se for DONO tentando acessar a dash do profissional, volta para a dele
            if (role === 'dono' && path === 'dashboard-profissional.html') {
                window.location.href = 'dashboard.html';
                return;
            }

            // 4. Se for ADMIN e entrar em página de cliente, vai para dashboard-admin
            if (role === 'admin' && path === 'dashboard.html') {
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
            window.dispatchEvent(new CustomEvent('perfilCarregado', { 
                detail: perfil 
            }));

        } catch (err) {
            console.error("Erro crítico no Auth Guard:", err);
        }
    }

    // Executa verificação inicial
    checkAuth();

    // Listener para Logout
    window.getSupabase().auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'index.html';
        }
    });
})();
