/**
 * ============================================
 * CONFIGURAÇÃO DO SUPABASE - VERSÃO DEFINITIVA
 * ============================================
 */

console.log('🔧 [Supabase Config] Versão 3.2.0');

const SUPABASE_CONFIG = {
    url: 'https://ldnbivvqzpaqcdhxkywl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmJpdnZxenBhcWNkaHhreXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQzMTEsImV4cCI6MjA4ODI0MDMxMX0.r8aeQczkDpchEKoap31QrMrSuJf7i-scjIrQZ7Sq65g'
};

console.log('✅ [Supabase] URL:', SUPABASE_CONFIG.url);
console.log('✅ [Supabase] Key length:', SUPABASE_CONFIG.anonKey.length);

// ============================================
// INICIALIZAÇÃO ROBUSTA
// ============================================

let clienteInicializado = false;

function inicializarClienteSupabase() {
    if (clienteInicializado) {
        console.log('✅ [Supabase] Cliente já inicializado');
        return true;
    }
    
    console.log('🔄 [Supabase] Iniciando cliente...');
    
    // Verificar se CDN carregou
    if (typeof window.supabase === 'undefined') {
        console.warn('⚠️ [Supabase] CDN não carregou');
        return false;
    }
    
    // Se já é cliente (tem .auth)
    if (window.supabase && typeof window.supabase.auth !== 'undefined') {
        console.log('✅ [Supabase] Cliente já estava pronto');
        clienteInicializado = true;
        return true;
    }
    
    // Salvar biblioteca
    const lib = window.supabase;
    
    if (!lib || typeof lib.createClient !== 'function') {
        console.error('❌ [Supabase] createClient não encontrado');
        return false;
    }
    
    try {
        console.log('🏗️ [Supabase] Criando cliente...');
        
        const cliente = lib.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        
        if (!cliente || typeof cliente.auth === 'undefined') {
            console.error('❌ [Supabase] Cliente inválido');
            return false;
        }
        
        // Exportar
        window.supabase = cliente;
        window.supabaseClient = cliente;
        
        clienteInicializado = true;
        
        console.log('✅ [Supabase] Cliente criado com SUCESSO!');
        console.log('✅ [Supabase] .auth:', typeof cliente.auth);
        console.log('✅ [Supabase] .from:', typeof cliente.from);
        
        // Evento
        window.dispatchEvent(new Event('supabaseReady'));
        
        return true;
        
    } catch (erro) {
        console.error('❌ [Supabase] Erro:', erro);
        return false;
    }
}

// ============================================
// VALIDAÇÃO DE CONEXÃO
// ============================================

async function validarConexao() {
    try {
        const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/`, {
            headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
            }
        });
        return response.status === 200 || response.status === 404; // Ambos indicam servidor online
    } catch (error) {
        console.error('❌ [Supabase] Erro na validação:', error);
        return false;
    }
}

window.validarConexaoSupabase = validarConexao;

let tentativas = 0;
const MAX = 100;

function tentar() {
    tentativas++;
    console.log(`🔄 [Supabase] Tentativa ${tentativas}/${MAX}`);
    
    if (inicializarClienteSupabase()) {
        console.log(`✅ [Supabase] SUCESSO na tentativa ${tentativas}!`);
        return;
    }
    
    if (tentativas < MAX) {
        setTimeout(tentar, 100);
    } else {
        console.error(`❌ [Supabase] FALHOU após ${MAX} tentativas`);
        console.error('Possíveis causas:');
        console.error('1. CDN bloqueado por firewall');
        console.error('2. Conexão lenta');
        console.error('3. Erro no navegador');
        
        window.dispatchEvent(new Event('supabaseError'));
    }
}

console.log('🚀 [Supabase] Iniciando...');
tentar();

// ============================================
// HELPERS
// ============================================

window.getSupabase = function() {
    if (!window.supabase || typeof window.supabase.auth === 'undefined') {
        throw new Error('Cliente Supabase não inicializado');
    }
    return window.supabase;
};

window.isSupabaseReady = function() {
    return clienteInicializado && 
           window.supabase && 
           typeof window.supabase.auth !== 'undefined';
};

window.SupabaseUtils = {
    isConnected() {
        return window.isSupabaseReady();
    },

    async test() {
        try {
            const supabase = window.getSupabase();
            const { data, error } = await supabase
                .from('clientes')
                .select('count')
                .limit(1);
            
            if (error) {
                console.log('⚠️ Tabela clientes não existe (normal se ainda não criou)');
            } else {
                console.log('✅ Conexão testada com sucesso');
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao testar:', error);
            return false;
        }
    }
};

console.log('✅ [Supabase Config] Módulo carregado - v3.2.0');
