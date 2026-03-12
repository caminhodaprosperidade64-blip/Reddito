/**
 * ============================================
 * AUTH GUARD - CONTROLE DE MENU POR ROLE
 * ============================================
 * Inclua este script em TODAS as páginas privadas,
 * APÓS o auth.js:
 * <script src="/js/auth-guard.js"></script>
 */

console.log('🛡️ [AuthGuard] Carregando...');

// Menus que SOMENTE o dono pode ver
const MENUS_APENAS_DONO = [
    '#menu-clientes',
    '#menu-servicos',
    '#menu-profissionais',
    '#menu-relatorios',
    '#menu-configuracoes',
    '#menu-whatsapp'
];

// Páginas que o profissional NÃO pode acessar (redireciona para agenda)
const PAGINAS_BLOQUEADAS_PROFISSIONAL = [
    '/clientes.html',
    '/servicos.html',
    '/profissionais.html',
    '/relatorios.html',
    '/configuracoes.html',
    '/whatsapp.html',
    '/dashboard.html'
];

function aplicarControleDeMenu(perfil) {
    if (perfil.role === 'dono') {
        console.log('✅ [AuthGuard] Dono — acesso total liberado');
        return; // Dono vê tudo
    }

    if (perfil.role === 'profissional') {
        console.log('🔒 [AuthGuard] Profissional — aplicando restrições');

        // 1. Verificar se está em página bloqueada
        const paginaAtual = window.location.pathname;
        const bloqueada = PAGINAS_BLOQUEADAS_PROFISSIONAL.some(p =>
            paginaAtual.endsWith(p)
        );

        if (bloqueada) {
            console.warn('⛔ [AuthGuard] Página bloqueada para profissional, redirecionando...');
            window.location.href = '/agenda.html';
            return;
        }

        // 2. Esconder itens de menu proibidos
        MENUS_APENAS_DONO.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                el.style.display = 'none';
                console.log(`🙈 [AuthGuard] Menu ocultado: ${selector}`);
            }
        });

        // 3. Mostrar nome do profissional na sidebar (se existir o elemento)
        const nomeEl = document.querySelector('#user-nome');
        if (nomeEl) nomeEl.textContent = perfil.nome || 'Profissional';

        const roleEl = document.querySelector('#user-role');
        if (roleEl) roleEl.textContent = 'Profissional';
    }
}

// Aguardar o evento disparado pelo auth.js
window.addEventListener('perfilCarregado', (event) => {
    aplicarControleDeMenu(event.detail);
});

// Fallback: se o perfil já foi carregado antes deste script
if (window.USER_ROLE) {
    aplicarControleDeMenu({
        role: window.USER_ROLE,
        nome: window.USER_NOME,
        tenant_id: window.TENANT_ID
    });
}

console.log('✅ [AuthGuard] Módulo carregado');
