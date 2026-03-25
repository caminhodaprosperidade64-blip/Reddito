// server.js
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
// CORS CONFIGURATION
// ============================================

const allowedOrigins = [
  'https://www.redditoapp.com',
  'https://redditoapp.com',
  'https://reddito-production.up.railway.app',
  'http://127.0.0.1:3000',
  'http://localhost:3000'
];

// Middleware CORS com logging e headers explícitos
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`[CORS] Requisição de: ${origin}`);
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, apikey, x-api-key');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
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
// REST ENDPOINTS
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
  console.log(`\n🔑 Configuration Status:`);
  console.log(`   EVOLUTION_URL: ${EVOLUTION_URL ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   EVOLUTION_API_KEY: ${EVOLUTION_API_KEY ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   CLAUDE_API_KEY: ${CLAUDE_API_KEY ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   SUPABASE: ${process.env.SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log('\n========================================\n');
});

export default app;
