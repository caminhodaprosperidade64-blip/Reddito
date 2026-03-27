import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

console.log('>>> INICIANDO: backend-whatsapp/server.js');

// Environment flags
console.log('ENV CHECK: SUPABASE_URL', !!process.env.SUPABASE_URL ? 'SET' : 'EMPTY');
console.log('ENV CHECK: SUPABASE_SERVICE_KEY', !!process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'EMPTY');
console.log('ENV CHECK: CLAUDE_API_KEY', !!process.env.CLAUDE_API_KEY ? 'SET' : 'EMPTY');
console.log('ENV CHECK: EVOLUTION_URL', !!process.env.EVOLUTION_URL ? 'SET' : 'EMPTY');
console.log('ENV CHECK: EVOLUTION_API_KEY', !!process.env.EVOLUTION_API_KEY ? 'SET' : 'EMPTY');

if (process.env.EVOLUTION_URL) {
  console.log('EVOLUTION_URL VALUE:', process.env.EVOLUTION_URL);
}
if (process.env.EVOLUTION_API_KEY) {
  const key = process.env.EVOLUTION_API_KEY;
  const masked = key.substring(0, 8) + '...' + key.substring(key.length - 8);
  console.log('EVOLUTION_API_KEY MASKED:', masked);
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// ============================================
// CORS CONFIGURATION (robusta, usando `cors`)
// ============================================

const allowedOrigins = [
  'https://www.redditoapp.com',
  'https://redditoapp.com',
  'https://reddito-production.up.railway.app',
  'http://127.0.0.1:3000',
  'http://localhost:3000'
];

// Delegator para opções dinâmicas do cors
const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');
  console.log(`[CORS] Requisição de origem: ${origin}`);

  // Se não houver Origin (ex: chamadas internas de servidor ou cURL),
  // permitimos com '*' para facilitar debugging. Não habilitamos credentials nesse caso.
  if (!origin) {
    return callback(null, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'apikey', 'x-api-key', 'X-Tenant-ID'],
      exposedHeaders: ['Content-Length'],
      maxAge: 86400,
      credentials: false
    });
  }

  // Se a origem estiver na lista de permitidas, refletimos a origem e habilitamos credentials
  if (allowedOrigins.includes(origin)) {
    return callback(null, {
      origin: origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'apikey', 'x-api-key', 'X-Tenant-ID'],
      exposedHeaders: ['Content-Length'],
      maxAge: 86400,
      credentials: true
    });
  }

  // Origem não permitida
  console.warn(`[CORS] Origem NÃO permitida: ${origin}`);
  // Aqui retornamos origin: false -> o middleware CORS irá responder bloqueando.
  return callback(null, { origin: false });
};

// Aplica o middleware CORS com a delegate
app.use(cors(corsOptionsDelegate));
// Garante que preflight OPTIONS em todas as rotas seja tratado
app.options('*', cors(corsOptionsDelegate));

// Middleware de logging simples de requisições (útil para debug no Railway)
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl} - Origin: ${req.header('Origin')}`);
  next();
});

// ============================================
// CONFIGURATION
// ============================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL || null;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || null;

// Store active instances in memory
const instances = {};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function normalizedEvolutionBase() {
  if (!EVOLUTION_URL) return null;
  let url = EVOLUTION_URL.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  url = url.replace(/\/$/, '');
  return url;
}

async function getOrCreateTenant(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`❌ Erro ao buscar tenant ${tenantId}:`, error);
      return null;
    }

    if (data) {
      return data;
    }

    // Create new tenant if doesn't exist
    const { data: newTenant, error: createError } = await supabase
      .from('tenants')
      .insert([{
        id: tenantId,
        whatsapp_conectado: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error(`❌ Erro ao criar tenant ${tenantId}:`, createError);
      return null;
    }

    return newTenant;
  } catch (err) {
    console.error(`❌ Erro em getOrCreateTenant:`, err);
    return null;
  }
}

async function updateTenantStatus(tenantId, status) {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        whatsapp_conectado: status,
        whatsapp_conectado_em: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select();

    if (error) {
      console.error(`❌ Erro ao atualizar status do tenant ${tenantId}:`, error);
    } else {
      console.log(`✅ Status atualizado para tenant ${tenantId}:`, status);
    }
  } catch (err) {
    console.error(`❌ Erro em updateTenantStatus:`, err);
  }
}

async function buscarOuCriarCliente(phoneNumber, tenantId) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', phoneNumber)
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`❌ Erro ao buscar cliente:`, error);
      return null;
    }

    if (data) {
      return { ...data, primeiro_atendimento: false };
    }

    // Create new client
    const { data: newClient, error: createError } = await supabase
      .from('clientes')
      .insert([{
        telefone: phoneNumber,
        tenant_id: tenantId,
        nome: `Cliente ${phoneNumber.substring(-4)}`,
        primeiro_atendimento: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error(`❌ Erro ao criar cliente:`, createError);
      return null;
    }

    return { ...newClient, primeiro_atendimento: true };
  } catch (err) {
    console.error(`❌ Erro em buscarOuCriarCliente:`, err);
    return null;
  }
}

async function buscarContextoSalao(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error(`❌ Erro ao buscar contexto do salão:`, error);
      return { nome: 'Salão', servicos: [], profissionais: [] };
    }

    return data || { nome: 'Salão', servicos: [], profissionais: [] };
  } catch (err) {
    console.error(`❌ Erro em buscarContextoSalao:`, err);
    return { nome: 'Salão', servicos: [], profissionais: [] };
  }
}

async function buscarHistoricoConversas(clienteId, limit = 15) {
  try {
    const { data, error } = await supabase
      .from('conversas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`❌ Erro ao buscar histórico:`, error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error(`❌ Erro em buscarHistoricoConversas:`, err);
    return [];
  }
}

async function buscarAgendamentosCliente(clienteId) {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('status', 'confirmado')
      .order('data_hora', { ascending: true });

    if (error) {
      console.error(`❌ Erro ao buscar agendamentos:`, error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error(`❌ Erro em buscarAgendamentosCliente:`, err);
    return [];
  }
}

async function gerarRespostaComClaude(mensagem, cliente, historico, contextoSalao, agendamentos) {
  try {
    if (!CLAUDE_API_KEY) {
      return `Olá ${cliente.nome}! Recebemos sua mensagem: "${mensagem}". Responderemos em breve!`;
    }

    const historicoFormatado = historico
      .slice(0, 5)
      .map(h => `Cliente: ${h.mensagem_entrada}\nAssistente: ${h.mensagem_saida}`)
      .join('\n\n');

    const agendamentosFormatado = agendamentos.length > 0
      ? agendamentos.map(a => `- ${new Date(a.data_hora).toLocaleDateString('pt-BR')} às ${new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`).join('\n')
      : 'Nenhum agendamento confirmado';

    const prompt = `Você é um assistente de atendimento para um salão de beleza chamado ${contextoSalao.nome || 'Salão'}.

Cliente: ${cliente.nome}
Telefone: ${cliente.telefone}

Histórico recente:
${historicoFormatado || 'Sem histórico anterior'}

Agendamentos do cliente:
${agendamentosFormatado}

Mensagem do cliente: "${mensagem}"

Responda de forma amigável, profissional e concisa (máximo 3 linhas). Se for uma pergunta sobre agendamentos, confirme os dados acima.`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 10000
      }
    );

    const resposta = response.data?.content?.[0]?.text || `Obrigado pela mensagem, ${cliente.nome}!`;
    return resposta;
  } catch (err) {
    console.error(`❌ Erro ao gerar resposta com Claude:`, err.message);
    return `Olá ${cliente.nome}! Recebemos sua mensagem e responderemos em breve.`;
  }
}

async function registrarConversa(clienteId, tenantId, mensagemEntrada, mensagemSaida, tipo = 'conversa') {
  try {
    const { error } = await supabase
      .from('conversas')
      .insert([{
        cliente_id: clienteId,
        tenant_id: tenantId,
        mensagem_entrada: mensagemEntrada,
        mensagem_saida: mensagemSaida,
        tipo: tipo,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error(`❌ Erro ao registrar conversa:`, error);
    } else {
      console.log(`✅ Conversa registrada para cliente ${clienteId}`);
    }
  } catch (err) {
    console.error(`❌ Erro em registrarConversa:`, err);
  }
}

async function enviarMensagemViaEvolution(instanceName, phoneNumber, message) {
  try {
    const base = normalizedEvolutionBase();
    if (!base) {
      console.error('❌ EVOLUTION_URL não configurado');
      return false;
    }

    const url = `${base}/message/send`;
    
    const response = await axios.post(
      url,
      {
        number: phoneNumber,
        text: message,
        instance: instanceName
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        timeout: 15000
      }
    );

    console.log(`✅ Mensagem enviada para ${phoneNumber} via Evolution`);
    return true;
  } catch (err) {
    console.error(`❌ Erro ao enviar mensagem via Evolution:`, err.message);
    return false;
  }
}

// ============================================
// REST ENDPOINTS - HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'Servidor rodando! ✅',
    timestamp: new Date().toISOString(),
    activeInstances: Object.keys(instances).length,
    evolutionConfigured: !!EVOLUTION_URL && !!EVOLUTION_API_KEY,
    claudeConfigured: !!CLAUDE_API_KEY
  });
});

// ============================================
// EVOLUTION API PROXY ENDPOINTS
// ============================================

app.post('/api/evolution/instance/create', async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('📥 POST /api/evolution/instance/create recebido');
    console.log('========================================');
    
    console.log('📦 Body recebido:', JSON.stringify(req.body, null, 2));
    
    let instanceName = req.body?.instanceName;
    console.log('🔍 instanceName extraído:', instanceName);

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      console.error('❌ EVOLUTION_URL ou EVOLUTION_API_KEY não configurado');
      return res.status(500).json({ 
        error: 'evolution_not_configured', 
        message: 'EVOLUTION_URL ou EVOLUTION_API_KEY ausente no servidor.' 
      });
    }

    if (!instanceName || instanceName === 'undefined' || typeof instanceName !== 'string') {
      console.error('❌ instanceName inválido ou não recebido:', instanceName);
      return res.status(400).json({
        error: 'invalid_instanceName',
        message: 'O campo instanceName é obrigatório e deve ser uma string',
        received: instanceName
      });
    }

    const payload = {
      name: instanceName.trim(),
      qrcode: true
    };

    console.log('✅ Payload validado:', JSON.stringify(payload, null, 2));

    const base = normalizedEvolutionBase();
    if (!base) {
      console.error('❌ EVOLUTION_URL inválido ou vazio');
      return res.status(500).json({ 
        error: 'invalid_evolution_url', 
        message: 'EVOLUTION_URL inválido ou vazio.' 
      });
    }

    const url = `${base}/instance/create`;
    console.log('🌐 URL Evolution:', url);

    let r;
    try {
      console.log('📡 Enviando POST para Evolution API...');
      r = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
          'Accept': 'application/json'
        },
        timeout: 30000,
        validateStatus: () => true
      });

      console.log('✅ Resposta recebida, status:', r.status);
      console.log('📥 Response data:', JSON.stringify(r.data, null, 2));
    } catch (axiosErr) {
      console.error('❌ Erro axios:', axiosErr?.message);
      return res.status(502).json({ 
        error: 'proxy_network_error', 
        detail: axiosErr?.message || String(axiosErr) 
      });
    }

    const respData = r.data !== undefined ? r.data : { raw: r.statusText || '' };
    
    console.log(`📊 Reenviando para client: HTTP ${r.status || 200}`);
    console.log('========================================\n');

    // Store instance in memory
    if ([200, 201, 204].includes(r.status)) {
      instances[instanceName] = {
        name: instanceName,
        status: 'created',
        createdAt: new Date().toISOString()
      };
      console.log(`✅ Instância ${instanceName} armazenada em memória`);
    }

    return res.status(r.status || 200).json(respData);
  } catch (err) {
    console.error('❌ Erro em /api/evolution/instance/create:', err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: 'proxy_error', detail: String(err?.message || err) };
    return res.status(status).json(data);
  }
});

app.get('/api/evolution/instance/connect/:id', async (req, res) => {
  try {
    const id = req.params.id;
    console.log(`\n📥 GET /api/evolution/instance/connect/${id} recebido`);

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      console.error('❌ EVOLUTION_URL ou EVOLUTION_API_KEY não configurado');
      return res.status(500).json({ 
        error: 'evolution_not_configured', 
        message: 'EVOLUTION_URL ou EVOLUTION_API_KEY ausente no servidor.' 
      });
    }

    const base = normalizedEvolutionBase();
    if (!base) {
      console.error('❌ EVOLUTION_URL inválido ou vazio');
      return res.status(500).json({ 
        error: 'invalid_evolution_url', 
        message: 'EVOLUTION_URL inválido ou vazio.' 
      });
    }

    const url = `${base}/instance/connect/${encodeURIComponent(id)}`;
    console.log('🌐 URL Evolution:', url);

    let r;
    try {
      console.log('📡 Enviando GET para Evolution API...');
      r = await axios.get(url, {
        headers: { 
          'apikey': EVOLUTION_API_KEY,
          'Accept': 'application/json'
        },
        timeout: 20000,
        validateStatus: () => true
      });

      console.log('✅ Resposta recebida, status:', r.status);
      if (r.data?.qrcode || r.data?.base64) {
        console.log('✅ QR Code encontrado');
      }
      console.log('📥 Response (primeiros 150 chars):', JSON.stringify(r.data, null, 2).substring(0, 150) + '...');
    } catch (axiosErr) {
      console.error('❌ Erro axios:', axiosErr?.message);
      return res.status(502).json({ 
        error: 'proxy_network_error', 
        detail: axiosErr?.message || String(axiosErr) 
      });
    }

    const respData = r.data !== undefined ? r.data : { raw: r.statusText || '' };
    
    console.log(`📊 Reenviando para client: HTTP ${r.status || 200}\n`);
    return res.status(r.status || 200).json(respData);
  } catch (err) {
    console.error('❌ Erro em /api/evolution/instance/connect/:id:', err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: 'proxy_error', detail: String(err?.message || err) };
    return res.status(status).json(data);
  }
});

app.get('/api/evolution/instance/list', async (req, res) => {
  try {
    console.log('\n📥 GET /api/evolution/instance/list recebido');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      console.error('❌ EVOLUTION_URL ou EVOLUTION_API_KEY não configurado');
      return res.status(500).json({ 
        error: 'evolution_not_configured', 
        message: 'EVOLUTION_URL ou EVOLUTION_API_KEY ausente no servidor.' 
      });
    }

    const base = normalizedEvolutionBase();
    if (!base) {
      console.error('❌ EVOLUTION_URL inválido ou vazio');
      return res.status(500).json({ 
        error: 'invalid_evolution_url', 
        message: 'EVOLUTION_URL inválido ou vazio.' 
      });
    }

    const url = `${base}/instance/list`;
    console.log('🌐 URL Evolution:', url);

    let r;
    try {
      console.log('📡 Enviando GET para Evolution API...');
      r = await axios.get(url, {
        headers: { 
          'apikey': EVOLUTION_API_KEY,
          'Accept': 'application/json'
        },
        timeout: 20000,
        validateStatus: () => true
      });

      console.log('✅ Resposta recebida, status:', r.status);
    } catch (axiosErr) {
      console.error('❌ Erro axios:', axiosErr?.message);
      return res.status(502).json({ 
        error: 'proxy_network_error', 
        detail: axiosErr?.message || String(axiosErr) 
      });
    }

    const respData = r.data !== undefined ? r.data : { raw: r.statusText || '' };
    
    console.log(`📊 Reenviando para client: HTTP ${r.status || 200}\n`);
    return res.status(r.status || 200).json(respData);
  } catch (err) {
    console.error('❌ Erro em /api/evolution/instance/list:', err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: 'proxy_error', detail: String(err?.message || err) };
    return res.status(status).json(data);
  }
});

app.post('/api/evolution/message/send', async (req, res) => {
  try {
    console.log('\n📥 POST /api/evolution/message/send recebido');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      console.error('❌ EVOLUTION_URL ou EVOLUTION_API_KEY não configurado');
      return res.status(500).json({ 
        error: 'evolution_not_configured', 
        message: 'EVOLUTION_URL ou EVOLUTION_API_KEY ausente no servidor.' 
      });
    }

    const { number, text, instance } = req.body;

    if (!number || !text || !instance) {
      console.error('❌ Campos obrigatórios ausentes: number, text, instance');
      return res.status(400).json({
        error: 'missing_fields',
        message: 'number, text e instance são obrigatórios'
      });
    }

    const base = normalizedEvolutionBase();
    if (!base) {
      console.error('❌ EVOLUTION_URL inválido ou vazio');
      return res.status(500).json({ 
        error: 'invalid_evolution_url', 
        message: 'EVOLUTION_URL inválido ou vazio.' 
      });
    }

    const url = `${base}/message/send`;
    console.log('🌐 URL Evolution:', url);

    const payload = {
      number: number,
      text: text,
      instance: instance
    };

    let r;
    try {
      console.log('📡 Enviando mensagem para Evolution API...');
      r = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
          'Accept': 'application/json'
        },
        timeout: 30000,
        validateStatus: () => true
      });

      console.log('✅ Resposta recebida, status:', r.status);
    } catch (axiosErr) {
      console.error('❌ Erro axios:', axiosErr?.message);
      return res.status(502).json({ 
        error: 'proxy_network_error', 
        detail: axiosErr?.message || String(axiosErr) 
      });
    }

    const respData = r.data !== undefined ? r.data : { raw: r.statusText || '' };
    
    console.log(`📊 Reenviando para client: HTTP ${r.status || 200}\n`);
    return res.status(r.status || 200).json(respData);
  } catch (err) {
    console.error('❌ Erro em /api/evolution/message/send:', err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: 'proxy_error', detail: String(err?.message || err) };
    return res.status(status).json(data);
  }
});

// ============================================
// WEBHOOK PARA RECEBER MENSAGENS DA EVOLUTION
// ============================================

app.post('/api/webhook/evolution/messages', async (req, res) => {
  try {
    console.log('\n📥 Webhook de mensagem recebido');
    console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

    const { instance, data } = req.body;

    if (!instance || !data) {
      console.warn('⚠️ Webhook inválido: faltam instance ou data');
      return res.status(400).json({ error: 'invalid_webhook' });
    }

    const phoneNumber = data.key?.remoteJid?.replace('@s.whatsapp.net', '') || data.sender;
    const message = data.message?.conversation || data.body || '';
    const tenantId = req.body.tenantId || 'default';

    if (!phoneNumber || !message) {
      console.warn('⚠️ Dados insuficientes para processar mensagem');
      return res.status(400).json({ error: 'insufficient_data' });
    }

    console.log(`📨 Mensagem recebida de ${phoneNumber}: "${message}"`);

    // Get or create tenant
    const tenant = await getOrCreateTenant(tenantId);
    if (!tenant) {
      console.error('❌ Falha ao obter/criar tenant');
      return res.status(500).json({ error: 'tenant_error' });
    }

    // Get or create client
    const cliente = await buscarOuCriarCliente(phoneNumber, tenantId);
    if (!cliente) {
      console.error('❌ Falha ao obter/criar cliente');
      return res.status(500).json({ error: 'client_error' });
    }

    // Get salon context
    const contextoSalao = await buscarContextoSalao(tenantId);

    // Get conversation history
    const historico = await buscarHistoricoConversas(cliente.id, 10);

    // Get client's appointments
    const agendamentos = await buscarAgendamentosCliente(cliente.id);

    // Generate response with Claude
    const resposta = await gerarRespostaComClaude(
      message,
      cliente,
      historico,
      contextoSalao,
      agendamentos
    );

    // Send response via Evolution
    await enviarMensagemViaEvolution(instance, phoneNumber, resposta);

    // Register conversation
    await registrarConversa(cliente.id, tenantId, message, resposta, 'conversa_ia');

    console.log('✅ Webhook processado com sucesso');

    res.json({ success: true, message: 'Mensagem processada' });
  } catch (err) {
    console.error('❌ Erro em webhook/evolution/messages:', err);
    res.status(500).json({ error: 'webhook_error', detail: err.message });
  }
});

// ============================================
// ROTAS WHATSAPP - INTEGRAÇÃO COM FRONTEND
// ============================================

/**
 * POST /api/whatsapp/gerar-qrcode
 * Gera QR Code para um tenant específico
 * Recebe: { tenantId: string }
 * Retorna: { qrcode: base64_string }
 */
app.post('/api/whatsapp/gerar-qrcode', async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('📥 POST /api/whatsapp/gerar-qrcode recebido');
    console.log('========================================');
    
    const tenantId = req.body?.tenantId || req.header('X-Tenant-ID');
    
    if (!tenantId || tenantId === 'undefined') {
      console.error('❌ tenantId inválido ou ausente');
      return res.status(400).json({
        ok: false,
        message: 'tenantId é obrigatório',
        received: tenantId
      });
    }

    console.log(`🔍 tenantId: ${tenantId}`);

    // Garante que o tenant existe no banco
    const tenant = await getOrCreateTenant(tenantId);
    if (!tenant) {
      console.error('❌ Erro ao obter/criar tenant');
      return res.status(500).json({
        ok: false,
        message: 'Erro ao processar tenant'
      });
    }

    console.log(`✅ Tenant obtido/criado: ${tenantId}`);

    // Verifica se Evolution está configurado
    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      console.error('❌ Evolution API não configurada');
      return res.status(500).json({
        ok: false,
        message: 'Evolution API não configurada no servidor',
        hint: 'Configure EVOLUTION_URL e EVOLUTION_API_KEY no Railway'
      });
    }

    // Nome da instância = tenantId
    const instanceName = tenantId;

    // 1) Cria a instância na Evolution
    console.log(`📡 Criando instância '${instanceName}' na Evolution...`);
    
    const base = normalizedEvolutionBase();
    if (!base) {
      console.error('❌ EVOLUTION_URL inválido');
      return res.status(500).json({
        ok: false,
        message: 'EVOLUTION_URL inválido ou vazio'
      });
    }

    const createUrl = `${base}/instance/create`;
    console.log(`🌐 URL: ${createUrl}`);

    let createResp;
    try {
      createResp = await axios.post(
        createUrl,
        {
          instanceName: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          timeout: 30000,
          validateStatus: () => true
        }
      );

      console.log(`✅ Resposta create: ${createResp.status}`);
    } catch (axiosErr) {
      console.error('❌ Erro na criação:', axiosErr.message);
      return res.status(502).json({
        ok: false,
        message: 'Erro ao comunicar com Evolution API',
        detail: axiosErr.message
      });
    }

    // 2) Aguarda um pouco e tenta obter o QR Code
    console.log(`⏳ Aguardando geração do QR Code...`);
    await new Promise(r => setTimeout(r, 2000));

    const connectUrl = `${base}/instance/connect/${encodeURIComponent(instanceName)}`;
    console.log(`🌐 URL: ${connectUrl}`);

    let qrData = null;
    let retries = 0;
    const maxRetries = 10; // 10 tentativas x 1 segundo = 10 segundos máximo

    while (retries < maxRetries && !qrData) {
      try {
        const connectResp = await axios.get(
          connectUrl,
          {
            headers: {
              'apikey': EVOLUTION_API_KEY
            },
            timeout: 20000,
            validateStatus: () => true
          }
        );

        console.log(`✅ Resposta connect: ${connectResp.status}`);

        // Tenta extrair QR Code da resposta
        const base64 = connectResp.data?.base64 || connectResp.data?.qrcode?.base64;
        const qrcode = connectResp.data?.qrcode;

        if (base64) {
          qrData = base64;
          console.log(`✅ QR Code obtido (base64)`);
          break;
        } else if (qrcode && typeof qrcode === 'string') {
          qrData = qrcode;
          console.log(`✅ QR Code obtido (qrcode field)`);
          break;
        }

        retries++;
        if (retries < maxRetries) {
          console.log(`⏳ Tentativa ${retries}/${maxRetries} - aguardando...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (axiosErr) {
        console.error(`⚠️ Erro na tentativa ${retries}:`, axiosErr.message);
        retries++;
        if (retries < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!qrData) {
      console.error('❌ Não conseguiu obter QR Code após retries');
      return res.status(503).json({
        ok: false,
        message: 'Timeout ao gerar QR Code. Tente novamente.',
        hint: 'Verifique se Evolution API está respondendo'
      });
    }

    // Armazena instância em memória
    instances[instanceName] = {
      name: instanceName,
      tenantId: tenantId,
      status: 'connecting',
      createdAt: new Date().toISOString()
    };

    console.log(`✅ QR Code gerado com sucesso para ${tenantId}`);
    console.log('========================================\n');

    // Retorna QR Code para o frontend
    res.json({
      ok: true,
      qrcode: qrData,
      message: 'QR Code gerado com sucesso'
    });

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/gerar-qrcode:', err);
    res.status(500).json({
      ok: false,
      message: 'Erro ao gerar QR Code',
      detail: err.message
    });
  }
});

/**
 * GET /api/whatsapp/status
 * Verifica status da conexão WhatsApp de um tenant
 * Headers: X-Tenant-ID (opcional, pode vir de sessão)
 * Retorna: { status: 'conectado' | 'desconectado' | 'erro' }
 */
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const tenantId = req.body?.tenantId || req.header('X-Tenant-ID') || req.query.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        status: 'erro',
        message: 'tenantId é obrigatório'
      });
    }

    console.log(`📍 GET /api/whatsapp/status - tenant: ${tenantId}`);

    // Busca status no banco de dados
    const { data, error } = await supabase
      .from('tenants')
      .select('whatsapp_conectado, whatsapp_conectado_em')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.warn(`⚠️ Tenant não encontrado: ${tenantId}`);
      return res.json({
        ok: true,
        status: 'desconectado',
        message: 'Tenant não possui conexão WhatsApp'
      });
    }

    const status = data?.whatsapp_conectado ? 'conectado' : 'desconectado';
    console.log(`✅ Status: ${status}`);

    res.json({
      ok: true,
      status: status,
      conectadoEm: data?.whatsapp_conectado_em || null
    });

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/status:', err);
    res.status(500).json({
      ok: false,
      status: 'erro',
      message: 'Erro ao verificar status',
      detail: err.message
    });
  }
});

/**
 * POST /api/whatsapp/desconectar
 * Desconecta WhatsApp de um tenant
 * Recebe: { tenantId: string }
 * Retorna: { ok: boolean }
 */
app.post('/api/whatsapp/desconectar', async (req, res) => {
  try {
    const tenantId = req.body?.tenantId || req.header('X-Tenant-ID');

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        message: 'tenantId é obrigatório'
      });
    }

    console.log(`\n📥 POST /api/whatsapp/desconectar - tenant: ${tenantId}`);

    // Atualiza status no banco para desconectado
    await updateTenantStatus(tenantId, false);

    // Remove instância da memória
    delete instances[tenantId];

    // Tenta desconectar também na Evolution API
    if (EVOLUTION_URL && EVOLUTION_API_KEY) {
      try {
        const base = normalizedEvolutionBase();
        const deleteUrl = `${base}/instance/delete/${encodeURIComponent(tenantId)}`;
        
        await axios.delete(deleteUrl, {
          headers: { 'apikey': EVOLUTION_API_KEY },
          timeout: 15000,
          validateStatus: () => true
        });

        console.log(`✅ Instância deletada da Evolution`);
      } catch (err) {
        console.warn(`⚠️ Erro ao deletar instância na Evolution:`, err.message);
      }
    }

    console.log(`✅ WhatsApp desconectado para ${tenantId}\n`);

    res.json({
      ok: true,
      message: 'WhatsApp desconectado com sucesso'
    });

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/desconectar:', err);
    res.status(500).json({
      ok: false,
      message: 'Erro ao desconectar',
      detail: err.message
    });
  }
});

/**
 * POST /api/whatsapp/automacoes
 * Salva configurações de automações (boas-vindas, lembretes, agradecimentos)
 * Recebe: { tenantId: string, welcome: boolean, reminder: boolean, thank: boolean }
 * Retorna: { ok: boolean }
 */
app.post('/api/whatsapp/automacoes', async (req, res) => {
  try {
    const { tenantId, welcome, reminder, thank } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        message: 'tenantId é obrigatório'
      });
    }

    console.log(`\n⚙️  POST /api/whatsapp/automacoes - tenant: ${tenantId}`);
    console.log(`   welcome: ${welcome}, reminder: ${reminder}, thank: ${thank}`);

    // Atualiza as automações no banco
    const { error } = await supabase
      .from('tenants')
      .update({
        automacao_welcome: welcome || false,
        automacao_reminder: reminder || false,
        automacao_thank: thank || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    if (error) {
      console.error(`❌ Erro ao salvar automações:`, error);
      return res.status(500).json({
        ok: false,
        message: 'Erro ao salvar automações',
        detail: error.message
      });
    }

    console.log(`✅ Automações salvas\n`);

    res.json({
      ok: true,
      message: 'Automações salvas com sucesso'
    });

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/automacoes:', err);
    res.status(500).json({
      ok: false,
      message: 'Erro ao salvar automações',
      detail: err.message
    });
  }
});

/**
 * POST /api/whatsapp/templates
 * Salva templates de mensagens automáticas
 * Recebe: { tenantId: string, welcome: string, reminder: string, thank: string }
 * Retorna: { ok: boolean }
 */
app.post('/api/whatsapp/templates', async (req, res) => {
  try {
    const { tenantId, welcome, reminder, thank } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        message: 'tenantId é obrigatório'
      });
    }

    console.log(`\n📝 POST /api/whatsapp/templates - tenant: ${tenantId}`);

    // Atualiza templates no banco
    const { error } = await supabase
      .from('tenants')
      .update({
        template_welcome: welcome || 'Olá {cliente}! Bem-vindo.',
        template_reminder: reminder || 'Lembrete: você tem um agendamento.',
        template_thank: thank || 'Obrigado pela sua confiança!',
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    if (error) {
      console.error(`❌ Erro ao salvar templates:`, error);
      return res.status(500).json({
        ok: false,
        message: 'Erro ao salvar templates',
        detail: error.message
      });
    }

    console.log(`✅ Templates salvos\n`);

    res.json({
      ok: true,
      message: 'Templates salvos com sucesso'
    });

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/templates:', err);
    res.status(500).json({
      ok: false,
      message: 'Erro ao salvar templates',
      detail: err.message
    });
  }
});

/**
 * GET /api/whatsapp/automacoes
 * Recupera configurações de automações salvas
 * Retorna: { welcome: boolean, reminder: boolean, thank: boolean }
 */
app.get('/api/whatsapp/automacoes', async (req, res) => {
  try {
    const tenantId = req.header('X-Tenant-ID') || req.query.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        message: 'tenantId é obrigatório'
      });
    }

    console.log(`📍 GET /api/whatsapp/automacoes - tenant: ${tenantId}`);

    const { data, error } = await supabase
      .from('tenants')
      .select('automacao_welcome, automacao_reminder, automacao_thank')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.warn(`⚠️ Automações não encontradas`);
      return res.json({
        ok: true,
        welcome: false,
        reminder: false,
        thank: false
      });
    }

    res.json({
      ok: true,
      welcome: data?.automacao_welcome || false,
      reminder: data?.automacao_reminder || false,
      thank: data?.automacao_thank || false
    });

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/automacoes:', err);
    res.status(500).json({
      ok: false,
      message: 'Erro ao recuperar automações',
      detail: err.message
    });
  }
});

/**
 * GET /api/whatsapp/templates
 * Recupera templates de mensagens salvas
 * Retorna: { welcome: string, reminder: string, thank: string }
 */
app.get('/api/whatsapp/templates', async (req, res) => {
  try {
    const tenantId = req.header('X-Tenant-ID') || req.query.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        message: 'tenantId é obrigatório'
      });
    }

    console.log(`📍 GET /api/whatsapp/templates - tenant: ${tenantId}`);

    const { data, error } = await supabase
      .from('tenants')
      .select('template_welcome, template_reminder, template_thank')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.warn(`⚠️ Templates não encontrados`);
      return res.json({
        ok: true,
        welcome: 'Olá {cliente}! Bem-vindo.',
        reminder: 'Lembrete: você tem um agendamento.',
        thank: 'Obrigado pela sua confiança!'
      });
    }

    res.json({
      ok: true,
      welcome: data?.template_welcome || 'Olá {cliente}! Bem-vindo.',
      reminder: data?.template_reminder || 'Lembrete: você tem um agendamento.',
      thank: data?.template_thank || 'Obrigado pela sua confiança!'
    });

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/templates:', err);
    res.status(500).json({
      ok: false,
      message: 'Erro ao recuperar templates',
      detail: err.message
    });
  }
});

/**
 * POST /api/whatsapp/enviar-manual
 * Envia mensagem manual via WhatsApp
 * Recebe: { tenantId: string, phone: string, message: string }
 * Retorna: { ok: boolean, message: string }
 */
app.post('/api/whatsapp/enviar-manual', async (req, res) => {
  try {
    const { tenantId, phone, message } = req.body;

    if (!tenantId || !phone || !message) {
      return res.status(400).json({
        ok: false,
        message: 'tenantId, phone e message são obrigatórios'
      });
    }

    console.log(`\n📤 POST /api/whatsapp/enviar-manual`);
    console.log(`   tenant: ${tenantId}, phone: ${phone}`);

    // Valida telefone (apenas números, 10-15 dígitos)
    if (!/^\d{10,15}$/.test(phone)) {
      return res.status(400).json({
        ok: false,
        message: 'Telefone inválido. Use apenas números (10-15 dígitos)'
      });
    }

    // Envia via Evolution API
    const success = await enviarMensagemViaEvolution(tenantId, phone, message);

    if (success) {
      console.log(`✅ Mensagem enviada para ${phone}\n`);
      res.json({
        ok: true,
        message: 'Mensagem enviada com sucesso'
      });
    } else {
      console.error(`❌ Falha ao enviar mensagem\n`);
      res.status(500).json({
        ok: false,
        message: 'Erro ao enviar mensagem via WhatsApp'
      });
    }

  } catch (err) {
    console.error('❌ Erro em /api/whatsapp/enviar-manual:', err);
    res.status(500).json({
      ok: false,
      message: 'Erro ao enviar mensagem',
      detail: err.message
    });
  }
});

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor WhatsApp IA rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔁 Evolution proxy: POST /api/evolution/instance/create`);
  console.log(`🔁 Evolution proxy: GET  /api/evolution/instance/connect/:id`);
  console.log(`🔁 Evolution proxy: GET  /api/evolution/instance/list`);
  console.log(`🔁 Evolution proxy: POST /api/evolution/message/send`);
  console.log(`🔗 Webhook: POST /api/webhook/evolution/messages`);
  console.log(`\n📱 WhatsApp Rotas:`);
  console.log(`   POST /api/whatsapp/gerar-qrcode`);
  console.log(`   GET  /api/whatsapp/status`);
  console.log(`   POST /api/whatsapp/desconectar`);
  console.log(`   POST /api/whatsapp/automacoes`);
  console.log(`   GET  /api/whatsapp/automacoes`);
  console.log(`   POST /api/whatsapp/templates`);
  console.log(`   GET  /api/whatsapp/templates`);
  console.log(`   POST /api/whatsapp/enviar-manual`);
  console.log(`\n🔑 Configuration Status:`);
  console.log(`   EVOLUTION_URL: ${EVOLUTION_URL ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   EVOLUTION_API_KEY: ${EVOLUTION_API_KEY ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   CLAUDE_API_KEY: ${CLAUDE_API_KEY ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   SUPABASE: ${process.env.SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log('\n========================================\n');
});

export default app;
