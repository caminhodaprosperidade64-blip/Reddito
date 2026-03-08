/**
 * ============================================
 * AUTH MODULE - VERSÃO FINAL SIMPLIFICADA
 * ============================================
 */

console.log('🔧 [Auth] Carregando módulo...');

// Aguardar Supabase estar pronto
function aguardarSupabase(callback) {
    if (window.isSupabaseReady && window.isSupabaseReady()) {
        console.log('✅ [Auth] Supabase já estava pronto');
        callback();
    } else {
        console.log('⏳ [Auth] Aguardando Supabase...');
        window.addEventListener('supabaseReady', () => {
            console.log('✅ [Auth] Supabase agora está pronto');
            callback();
        }, { once: true });
    }
}

// ============================================
// MÓDULO AUTH
// ============================================

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

    async getTenantId() {
        const user = await this.getUser();
        return user ? user.id : null;
    },

    async isAuthenticated() {
        const user = await this.getUser();
        return user !== null;
    },

    async signIn(email, password) {
        try {
            console.log('🔐 [Auth] Fazendo login...');
            const supabase = window.getSupabase();
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            console.log('✅ [Auth] Login realizado:', data.user.email);
            return { success: true, user: data.user };
            
        } catch (error) {
            console.error('❌ [Auth] Erro no login:', error);
            return { success: false, error: error.message };
        }
    },

    async signUp(email, password) {
        try {
            console.log('📝 [Auth] Criando conta...');
            const supabase = window.getSupabase();
            
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });
            
            if (error) throw error;
            
            console.log('✅ [Auth] Conta criada:', data.user?.email || email);
            return { success: true, user: data.user };
            
        } catch (error) {
            console.error('❌ [Auth] Erro ao criar conta:', error);
            return { success: false, error: error.message };
        }
    },

    async signOut() {
        try {
            const supabase = window.getSupabase();
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            console.log('✅ [Auth] Logout realizado');
            window.location.href = '/';
            return { success: true };
            
        } catch (error) {
            console.error('❌ [Auth] Erro no logout:', error);
            return { success: false, error: error.message };
        }
    },

    async requireAuth() {
        const authenticated = await this.isAuthenticated();
        
        if (!authenticated) {
            console.warn('⚠️ [Auth] Não autenticado');
            alert('Você precisa estar logado.');
            window.location.href = '/';
            return false;
        }
        
        return true;
    }
};

// Exportar
window.Auth = Auth;

console.log('✅ [Auth] Módulo exportado');

// ============================================
// PROTEÇÃO DE ROTAS
// ============================================

function configurarProtecaoRotas() {
    console.log('🛡️ [Auth] Configurando proteção...');
    
    const paginasPublicas = [
        '/', '/index.html', '/login.html', 
        '/aguardando-confirmacao.html', '/agendar.html', 
        '/teste-auth.html'
    ];
    
    const paginaAtual = window.location.pathname;
    const ehPublica = paginasPublicas.some(p => 
        paginaAtual === p || paginaAtual.endsWith(p)
    );
    
    if (ehPublica) {
        console.log('✅ [Auth] Página pública:', paginaAtual);
        return;
    }
    
    console.log('🔒 [Auth] Página privada:', paginaAtual);
    
    Auth.isAuthenticated().then(autenticado => {
        if (!autenticado) {
            console.warn('⚠️ [Auth] Não autenticado, redirecionando...');
            alert('Você precisa estar logado para acessar esta página.');
            window.location.href = '/login.html';
        } else {
            Auth.getUser().then(user => {
                console.log('✅ [Auth] Autenticado:', user.email);
                window.TENANT_ID = user.id;
            });
        }
    });
}

// Aguardar Supabase e configurar proteção
aguardarSupabase(configurarProtecaoRotas);

console.log('✅ [Auth] Módulo carregado completamente');
