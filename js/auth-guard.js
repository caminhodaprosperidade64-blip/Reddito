/
 * Auth Guard - Proteção de Rotas e Controle de Acesso por Role (Versão Completa)
 */
(function() {
    // Configuração de páginas
    const PAGINAS_PUBLICAS = ['index.html', 'login.html', 'cadastro.html', 'primeiro-acesso.html', 'cadastro-profissional.html'];
    const PAGINAS_RESTRITAS_DONO = ['dashboard.html', 'clientes.html', 'profissionais.html', 'servicos.html', 'configuracoes.html', 'financeiro.html'];

    async function checkAuth() {
        const supabase = window.getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        
        const path = window.location.pathname.split('/').pop() || 'index.html';
        const isPublic = PAGINAS_PUBLICAS.includes(path);

        // ALTERAÇÃO: Se estivermos na página de cadastro do profissional, não execute NENHUMA lógica de redirect/guard.
        // Isso evita que o guard "intercepte" o fluxo público de cadastro (especialmente em abas anônimas).
        if (path === 'cadastro-profissional.html') {
            // Apenas atualiza nada — sai imediatamente
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
            const { data: perfil, error } = await supabase
                .from('perfis')
                .select('')
                .eq('id', session.user.id)  // <-- Mantive a correção feita anteriormente
                .single();

            if (error || !perfil) {
                console.error("Erro ao carregar perfil no Guard:", error);
                return;
            }

            const role = (perfil.role || 'dono').toLowerCase();

            // --- LÓGICA DE REDIRECIONAMENTO POR ROLE ---
            
            // 1. Se está em página de login/cadastro mas já está logado, vai para a dash correta
            if (isPublic) {
                if (role === 'profissional') {
                    window.location.href = 'dashboard-profissional.html';
                } else {
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

            // --- MANIPULAÇÃO DE UI (O QUE MANTÉM O RESTO DO SITE FUNCIONANDO) ---

            // Atualiza elementos de interface se existirem na página
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            const userAvatarEl = document.getElementById('userAvatar');

            if (userNameEl) userNameEl.textContent = perfil.nome || 'Usuário';
            if (userRoleEl) userRoleEl.textContent = role === 'dono' ? 'Administrador' : 'Profissional';
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

            // Dispara o evento que as outras páginas (agenda.html, clientes.html) esperam
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
