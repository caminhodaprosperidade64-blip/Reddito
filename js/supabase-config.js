/**
 * ============================================
 * CONFIGURAÇÃO DO SUPABASE - VERSÃO 4.0.0
 * ============================================
 */

console.log('🔧 [Supabase Config] Versão 4.0.0');

const SUPABASE_CONFIG = {
    url: 'https://ldnbivvqzpaqcdhxkywl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmJpdnZxenBhcWNkaHhreXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQzMTEsImV4cCI6MjA4ODI0MDMxMX0.r8aeQczkDpchEKoap31QrMrSuJf7i-scjIrQZ7Sq65g'
};

// ============================================
// INICIALIZAÇÃO — UMA ÚNICA VEZ
// ============================================

let clienteInicializado = false;
let tentativas = 0;
const MAX = 20; // ← reduzido de 100 para 20 (2 segundos máximo)

function inicializarClienteSupabase() {
    if (clienteInicializado) return true;

    const lib = window.supabase;

    // CDN ainda não carregou
    if (!lib) return false;

    // Cliente já foi criado (tem .auth mas não tem .createClient)
    if (typeof lib.auth !== 'undefined' && typeof lib.createClient === 'undefined') {
        console.log('✅ [Supabase] Cliente já estava pronto');
        clienteInicializado = true;
        window.supabaseClient = lib;
        window.dispatchEvent(new Event('supabaseReady'));
        return true;
    }

    // Biblioteca CDN disponível — criar cliente
    if (typeof lib.createClient !== 'function') {
        console.error('❌ [Supabase] createClient não encontrado');
        return false;
    }

    try {
        const cliente = lib.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey,
            {
                auth: {
                    persistSession: true,       // ← FIX: garante sessão persistida no localStorage
                    autoRefreshToken: true,     // ← FIX: renova token automaticamente
                    detectSessionInUrl: true,   // ← necessário para confirmar email via link
                    storageKey: 'reddito-auth'  // ← chave única para evitar conflito com outros apps
                }
            }
        );

        if (!cliente || typeof cliente.auth === 'undefined') {
            console.error('❌ [Supabase] Cliente inválido');
            return false;
        }

        // FIX: salvar em variável separada, NÃO sobrescrever window.supabase com o cliente
        window.supabaseClient = cliente;
        window.supabase = cliente; // mantido por compatibilidade, mas agora é feito só 1x

        clienteInicializado = true;

        console.log('✅ [Supabase] Cliente criado com SUCESSO! v4.0.0');
        window.dispatchEvent(new Event('supabaseReady')); // ← disparado apenas 1x

        return true;

    } catch (erro) {
        console.error('❌ [Supabase] Erro ao criar cliente:', erro);
        return false;
    }
}

function tentar() {
    tentativas++;

    if (inicializarClienteSupabase()) {
        console.log(`✅ [Supabase] SUCESSO na tentativa ${tentativas}`);
        return;
    }

    if (tentativas < MAX) {
        setTimeout(tentar, 100);
    } else {
        console.error(`❌ [Supabase] FALHOU após ${MAX} tentativas. Verifique o CDN.`);
        window.dispatchEvent(new Event('supabaseError'));
    }
}

tentar();

// ============================================
// HELPERS
// ============================================

window.getSupabase = function () {
    if (!window.supabaseClient || typeof window.supabaseClient.auth === 'undefined') {
        throw new Error('Cliente Supabase não inicializado. Aguarde o evento supabaseReady.');
    }
    return window.supabaseClient;
};

window.isSupabaseReady = function () {
    return clienteInicializado &&
        !!window.supabaseClient &&
        typeof window.supabaseClient.auth !== 'undefined';
};

async function validarConexao() {
    try {
        const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/`, {
            headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
            }
        });
        return response.status === 200 || response.status === 404;
    } catch (error) {
        console.error('❌ [Supabase] Erro na validação:', error);
        return false;
    }
}

window.validarConexaoSupabase = validarConexao;

window.SupabaseUtils = {
    isConnected() { return window.isSupabaseReady(); },
    async test() {
        try {
            const supabase = window.getSupabase();
            const { error } = await supabase.from('clientes').select('count').limit(1);
            if (error) console.log('⚠️ Tabela clientes não existe ainda');
            else console.log('✅ Conexão testada com sucesso');
            return true;
        } catch (error) {
            console.error('❌ Erro ao testar:', error);
            return false;
        }
    }
};

console.log('✅ [Supabase Config] Módulo carregado - v4.0.0');
