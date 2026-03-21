// server.js
import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  isJidBroadcast
} from '@whiskeysockets/baileys';

import qrcodeTerminal from 'qrcode-terminal';
import Levenshtein from 'js-levenshtein';
import cors from 'cors';

dotenv.config();

console.log('>>> INICIANDO: backend-whatsapp/server.js');

// Environment flags (não imprime chaves, apenas se estão setadas)
console.log('ENV CHECK: SUPABASE_URL', !!process.env.SUPABASE_URL ? 'SET' : 'EMPTY');
console.log('ENV CHECK: SUPABASE_SERVICE_KEY', !!process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'EMPTY');
console.log('ENV CHECK: CLAUDE_API_KEY', !!process.env.CLAUDE_API_KEY ? 'SET' : 'EMPTY');
console.log('ENV CHECK: EVOLUTION_URL', !!process.env.EVOLUTION_URL ? 'SET' : 'EMPTY');
console.log('ENV CHECK: EVOLUTION_API_KEY', !!process.env.EVOLUTION_API_KEY ? 'SET' : 'EMPTY');

// Log dos valores reais (com máscara para segurança)
if (process.env.EVOLUTION_URL) {
  console.log('EVOLUTION_URL VALUE:', process.env.EVOLUTION_URL);
}
if (process.env.EVOLUTION_API_KEY) {
  const key = process.env.EVOLUTION_API_KEY;
  const masked = key.substring(0, 8) + '...' + key.substring(key.length - 8);
  console.log('EVOLUTION_API_KEY MASKED:', masked);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// aumentar limite caso payloads maiores sejam enviados
app.use(express.json({ limit: '1mb' }));

/**
 * CORS - permitir apenas os domínios de frontend necessários.
 * Ajuste a lista `origin` conforme os domínios reais do seu frontend.
 * Em produção, substitua by-allowed list explicitamente.
 */
const allowedOrigins = [
  'https://www.redditoapp.com',
  'https://redditoapp.com',
  'https://reddito-production.up.railway.app',
  'http://127.0.0.1:3000',
  'http://localhost:3000'
  // adicione outros domínios de frontend aqui
];

app.use(cors({
  origin: function(origin, callback){
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'apikey', 'x-api-key'],
  credentials: true,
  maxAge: 86400
}));
app.options('*', cors());

// ============================================
// CONFIGURAÇÕES
// ============================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PORT = process.env.PORT || 3000;

const EVOLUTION_URL = process.env.EVOLUTION_URL || null;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || null;

const logger = pino();

// Armazenar conexões WhatsApp por tenant
const conexoesWhatsApp = {};

// Pequeno helper para log seguro de objetos grandes
function safeDump(obj, label = '') {
  try {
    console.log(`--- DUMP ${label} ---`);
    console.log(JSON.stringify(obj, null, 2));
  } catch (e) {
    console.log(`--- DUMP ${label} (raw) ---`);
    console.log(obj);
  }
}

// captura erros não tratados para logs (ajuda em debug de produção)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// ============================================
// CONECTAR WHATSAPP BAILEYS MULTI-TENANT
// ============================================

async function conectarWhatsAppTenant(tenantId) {
  try {
    console.log(`🔔 conectarWhatsAppTenant chamado para tenantId=${tenantId}`);

    // Se já existe conexão, retorna ela (evita múltiplas instâncias)
    if (conexoesWhatsApp[tenantId]) {
      console.log(`ℹ️  Já existe uma conexão ativa para tenant ${tenantId}. Retornando conexão existente.`);
      return conexoesWhatsApp[tenantId];
    }

    const authDir = path.join(__dirname, 'auth_info', tenantId);

    // Criar diretório auth_info/<tenantId> se não existir
    try {
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
        console.log(`✅ Diretório de auth criado: ${authDir}`);
      } else {
        console.log(`ℹ️  Diretório de auth já existe: ${authDir}`);
      }
    } catch (mkdirErr) {
      console.error(`❌ Erro ao criar authDir ${authDir}:`, mkdirErr);
      // Continuar mesmo assim (Baileys também tentará criar), mas logamos.
    }

    // Listar conteúdo do diretório antes de chamar useMultiFileAuthState (para debug)
    try {
      const parent = path.dirname(authDir);
      if (fs.existsSync(parent)) {
        const beforeList = fs.readdirSync(parent);
        console.log('Conteúdo do diretório auth_info (pai):', beforeList);
      }
    } catch (e) {
      // não crítico
    }

    if (typeof useMultiFileAuthState !== 'function') {
      console.warn('⚠️ useMultiFileAuthState não é uma função — verifique a versão do baileys/da importação.');
    }

    let state, saveCreds;
    try {
      const result = await useMultiFileAuthState(authDir);
      state = result.state;
      saveCreds = result.saveCreds;
      console.log(`✅ useMultiFileAuthState OK — authDir: ${authDir}`);
      try {
        const authFiles = fs.readdirSync(authDir);
        console.log(`Conteúdo authDir ${authDir}:`, authFiles);
      } catch (e) {
        console.warn(`⚠️ Falha ao listar conteúdo de ${authDir}:`, e?.message || e);
      }
    } catch (err) {
      console.error('❌ Erro em useMultiFileAuthState:', err && err.stack ? err.stack : err);
      // Re-throw para ser tratado pelo chamador
      throw err;
    }

    if (!makeWASocket || typeof makeWASocket !== 'function') {
      console.warn('⚠️ makeWASocket parece indefinido — checar import do baileys. Valor:', makeWASocket);
    }

    // NOTE: coloquei printQRInTerminal: true para debugging local — remove/ajuste em produção
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      defaultQueryTimeoutMs: undefined
    });

    // Salvar credenciais
    try {
      sock.ev.on('creds.update', saveCreds);
    } catch (e) {
      console.warn('⚠️ Não foi possível registrar handler de creds.update:', e?.message || e);
    }

    // Processar mensagens recebidas
    sock.ev.on('messages.upsert', async (m) => {
      try {
        const message = m.messages[0];
        if (!message || !message.message) return;
        if (isJidBroadcast(message.key.remoteJid)) return;

        const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
        const conteudo = message.message.conversation ||
                         message.message.extendedTextMessage?.text || '';

        console.log(`📨 [${tenantId}] ${phoneNumber}: ${conteudo}`);

        try {
          await processarMensagemWhatsApp(tenantId, phoneNumber, conteudo, sock);
        } catch (error) {
          console.error(`❌ Erro ao processar mensagem:`, error?.message || error);
        }
      } catch (err) {
        console.error('❌ Erro em messages.upsert handler:', err);
      }
    });

    // Atualizar status de conexão
    sock.ev.on('connection.update', async (update) => {
      try {
        // DUMP completo do evento para inspeção
        try {
          safeDump(update, `connection.update tenant=${tenantId}`);
        } catch (e) {
          console.warn('⚠️ Falha ao dumpar update:', e);
        }

        // Mantemos compatibilidade com as props usadas antes
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`\n📱 QR Code para tenant=${tenantId} recebido no evento connection.update`);
          // Mostra no terminal (útil para debugging local)
          try {
            qrcodeTerminal.generate(qr, { small: true });
          } catch (e) {
            console.warn('⚠️ Não foi possível renderizar QR no terminal:', e?.message || e);
          }

          try {
            // Gerar QR em base64 para o painel
            const qrBase64 = await QRCode.toDataURL(qr);

            console.log(`🔄 [DEBUG] Tentando salvar whatsapp_qrcode no Supabase para tenantId=${tenantId}...`);

            // Retornar data/error para inspeção
            const { data, error } = await supabase
              .from('tenants')
              .update({ whatsapp_qrcode: qrBase64 })
              .eq('id', tenantId)
              .select();

            console.log('🔍 Supabase update result (whatsapp_qrcode):', { data, error });

            if (error) {
              console.error(`❌ [DEBUG] Erro do Supabase ao salvar whatsapp_qrcode:`, error);
            } else if (!data || (Array.isArray(data) && data.length === 0)) {
              console.warn(`⚠️ [DEBUG] Nenhuma linha atualizada na tabela 'tenants' para id=${tenantId}. Verifique se o tenantId existe no Supabase.`);
              // Escreve um log extra para inspeção: buscar o tenant
              try {
                const { data: tenantRow, error: tenantErr } = await supabase
                  .from('tenants')
                  .select('id')
                  .eq('id', tenantId)
                  .single();

                if (tenantErr) {
                  console.error(`❌ [DEBUG] Erro ao buscar tenant (para debug):`, tenantErr);
                } else {
                  console.log(`ℹ️ [DEBUG] tenant encontrado para debug:`, tenantRow);
                }
              } catch (innerErr) {
                console.error('❌ [DEBUG] Erro interno ao consultar tenant para debug:', innerErr);
              }
            } else {
              console.log(`✅ [DEBUG] QR code salvo no banco para tenantId=${tenantId}.`);
            }
          } catch (e) {
            console.error(`❌ [DEBUG] Erro ao converter/salvar QR code para ${tenantId}:`, e);
          }
        }

        if (connection === 'open') {
          console.log(`✅ WhatsApp conectado para tenant=${tenantId}`);
          try {
            const { data, error } = await supabase
              .from('tenants')
              .update({
                whatsapp_conectado: true,
                whatsapp_conectado_em: new Date().toISOString(),
                whatsapp_qrcode: null
              })
              .eq('id', tenantId)
              .select();

            console.log('🔍 Supabase update result (connected=true):', { data, error });

            if (error) {
              console.error(`❌ Erro ao atualizar estado conectado no Supabase para ${tenantId}:`, error);
            } else {
              console.log(`✅ Atualizado estado conectado no Supabase para ${tenantId}`);
            }
          } catch (e) {
            console.error('❌ Erro ao atualizar estado conectado (catch):', e);
          }
        }

        if (connection === 'close') {
          const shouldReconnect =
            lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

          if (shouldReconnect) {
            console.log(`🔄 Reconectando tenant=${tenantId} em 5s...`);
            // aguarda um pouco e reconecta com backoff
            setTimeout(() => conectarWhatsAppTenant(tenantId).catch(err => {
              console.error(`❌ Erro ao tentar reconectar tenant ${tenantId}:`, err);
            }), 5000);
          } else {
            console.log(`❌ tenant ${tenantId} desconectado (logged out). Atualizando estado no DB.`);
            try {
              const { data, error } = await supabase
                .from('tenants')
                .update({ whatsapp_conectado: false })
                .eq('id', tenantId)
                .select();

              console.log('🔍 Supabase update result (connected=false):', { data, error });

            } catch (e) {
              console.error('❌ Erro ao atualizar estado desconectado no DB:', e);
            }
          }
        }
      } catch (handlerErr) {
        console.error('❌ Erro no connection.update handler:', handlerErr);
      }
    });

    conexoesWhatsApp[tenantId] = sock;
    console.log(`ℹ️  Conexão Baileys criada para tenant=${tenantId} e armazenada em conexoesWhatsApp.`);

    // Após criar socket, listar authDir (novamente) e permissões do arquivo (para debug)
    try {
      const files = fs.readdirSync(authDir);
      console.log(`Conteúdo final authDir ${authDir}:`, files);
      try {
        files.forEach(f => {
          const full = path.join(authDir, f);
          const stat = fs.statSync(full);
          console.log(` - ${f}: mode=${stat.mode.toString(8)}, size=${stat.size}`);
        });
      } catch (inner) {
        // não crítico
      }
    } catch (e) {
      console.warn('⚠️ Falha ao listar conteúdo de authDir após criar socket:', e?.message || e);
    }

    return sock;
  } catch (error) {
    console.error(`❌ Erro ao conectar WhatsApp para ${tenantId}:`, error && error.stack ? error.stack : error);
    // Tentativa de limpar a conexão caso tenha sido parcialmente criada
    if (conexoesWhatsApp[tenantId]) {
      try {
        delete conexoesWhatsApp[tenantId];
      } catch (e) {
        console.warn('⚠️ Erro ao deletar conexoesWhatsApp[tenantId] no catch:', e);
      }
    }
    throw error;
  }
}

// ============================================
// PROCESSAR MENSAGEM WHATSAPP
// (o resto do código mantém a lógica original — não alterei a implementação das funções já existentes)
// ============================================

async function processarMensagemWhatsApp(tenantId, phoneNumber, conteudo, sock) {
  // Buscar ou criar cliente
  const cliente = await buscarOuCriarCliente(phoneNumber, tenantId);

  // Buscar contexto do salão
  const contextoSalao = await buscarContextoSalao(tenantId);

  // Se é primeiro atendimento, fazer cadastro
  if (cliente.primeiro_atendimento) {
    await processarPrimeiroAtendimento(tenantId, phoneNumber, conteudo, cliente, contextoSalao, sock);
  } else {
    // Análise inteligente da intenção
    const historico = await buscarHistoricoConversas(cliente.id, 15);
    const agendamentos = await buscarAgendamentosCliente(cliente.id);

    const resposta = await gerarRespostaComClaude(
      conteudo,
      cliente,
      historico,
      contextoSalao,
      agendamentos
    );

    // Enviar resposta
    await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
      text: resposta
    });

    // Registrar conversa
    await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'conversa_ia');

    // Detectar intenções
    await detectarIntencoes(tenantId, phoneNumber, conteudo, cliente, contextoSalao, sock);
  }
}

// ============================================
// ENDPOINTS REST
// ============================================

app.post('/api/whatsapp/connect/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log(`📥 POST /api/whatsapp/connect/${tenantId} recebido`);

    // Inicia/garante a conexão Baileys para esse tenant
    try {
      await conectarWhatsAppTenant(tenantId);
    } catch (connErr) {
      console.error(`❌ Erro ao iniciar/conectar Baileys para tenant ${tenantId}:`, connErr && connErr.stack ? connErr.stack : connErr);
      return res.status(500).json({ error: 'Erro ao iniciar conexão WhatsApp. Verifique logs do servidor.' });
    }

    // Tenta buscar QR code imediatamente
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('whatsapp_qrcode')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error(`❌ Erro ao buscar whatsapp_qrcode no Supabase para ${tenantId}:`, error);
      return res.status(500).json({ error: 'Erro ao buscar status no banco.' });
    }

    if (tenant?.whatsapp_qrcode) {
      return res.json({ status: 'qr_generated', qrCode: tenant.whatsapp_qrcode });
    }

    // Se não tiver, aguarda até ~30s (ou menos) para o QR ser gerado e salvo
    let qrCode = null;
    let tentativas = 0;
    const maxTentativas = 30;
    while (!qrCode && tentativas < maxTentativas) {
      const { data: tenant2, error: err2 } = await supabase
        .from('tenants')
        .select('whatsapp_qrcode')
        .eq('id', tenantId)
        .single();

      if (err2) {
        console.error(`❌ Erro ao buscar whatsapp_qrcode (tentativa ${tentativas}) para ${tenantId}:`, err2);
      } else {
        qrCode = tenant2?.whatsapp_qrcode;
      }

      if (!qrCode) {
        await new Promise(r => setTimeout(r, 1000));
        tentativas++;
      }
    }

    if (qrCode) {
      return res.json({ status: 'qr_generated', qrCode });
    } else {
      return res.json({ status: 'waiting_qr', message: 'Gerando/aguardando QR (verifique logs do servidor)' });
    }
  } catch (error) {
    console.error('Erro /api/whatsapp/connect/:tenantId', error && error.stack ? error.stack : error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/whatsapp/status/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('whatsapp_conectado, whatsapp_conectado_em, whatsapp_qrcode')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error(`❌ Erro ao buscar status do tenant ${tenantId}:`, error);
      return res.status(500).json({ error: error.message || 'Erro ao buscar tenant' });
    }

    return res.json({
      connected: tenant?.whatsapp_conectado || false,
      connectedAt: tenant?.whatsapp_conectado_em || null,
      qrCode: tenant?.whatsapp_qrcode || null
    });
  } catch (error) {
    console.error('❌ Erro GET /api/whatsapp/status/:tenantId', error && error.stack ? error.stack : error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// EVOLUTION API PROXY ENDPOINTS (CORRIGIDO)
// ============================================

// Utility: normalize EVOLUTION_URL (ensure has protocol)
function normalizedEvolutionBase() {
  if (!EVOLUTION_URL) return null;
  let url = EVOLUTION_URL.trim();
  // add https if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  // remove trailing slash
  url = url.replace(/\/$/, '');
  return url;
}

/**
 * POST /api/evolution/instance/create
 * 
 * Frontend envia: { instanceName: "xxx" }
 * Server transforma em: { name: "xxx" }
 * Server envia para Evolution com apikey header
 */
app.post('/api/evolution/instance/create', async (req, res) => {
  try {
    console.log('📥 POST /api/evolution/instance/create recebido');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      console.error('❌ EVOLUTION_URL ou EVOLUTION_API_KEY não configurado');
      return res.status(500).json({ 
        error: 'evolution_not_configured', 
        message: 'EVOLUTION_URL ou EVOLUTION_API_KEY ausente no servidor.' 
      });
    }

    const body = req.body || {};
    
    // CORREÇÃO CRÍTICA: transformar instanceName em name
    const payload = {
      name: body.instanceName || body.name || 'reddito',
      // remover campos que podem causar "Invalid integration"
      qrcode: true  // Manter apenas campos válidos
    };

    console.log('📤 Payload transformado para Evolution:', JSON.stringify(payload, null, 2));

    const base = normalizedEvolutionBase();
    if (!base) {
      console.error('❌ EVOLUTION_URL inválido ou vazio');
      return res.status(500).json({ 
        error: 'invalid_evolution_url', 
        message: 'EVOLUTION_URL inválido ou vazio.' 
      });
    }

    const url = `${base}/instance/create`;
    console.log('🌐 URL completa Evolution:', url);

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
        validateStatus: () => true // we'll forward status back
      });

      console.log('✅ Resposta Evolution recebida, status:', r.status);
      console.log('📥 Response data:', JSON.stringify(r.data, null, 2));
    } catch (axiosErr) {
      console.error('❌ Erro na requisição axios:', axiosErr?.message || axiosErr);
      console.error('Detalhes do erro:', axiosErr);
      return res.status(502).json({ 
        error: 'proxy_network_error', 
        detail: axiosErr?.message || String(axiosErr) 
      });
    }

    // If the evolution returns non-JSON, attempt to forward text
    const respData = r.data !== undefined ? r.data : { raw: r.statusText || '' };
    
    console.log(`📊 Reenviando para client: status=${r.status || 200}`);
    return res.status(r.status || 200).json(respData);
  } catch (err) {
    console.error('❌ Erro em /api/evolution/instance/create:', err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: 'proxy_error', detail: String(err?.message || err) };
    return res.status(status).json(data);
  }
});

/**
 * GET /api/evolution/instance/connect/:id
 * 
 * Busca status da instância e QR code da Evolution API
 */
app.get('/api/evolution/instance/connect/:id', async (req, res) => {
  try {
    const id = req.params.id;
    console.log(`📥 GET /api/evolution/instance/connect/${id} recebido`);

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
    console.log('🌐 URL completa Evolution:', url);

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

      console.log('✅ Resposta Evolution recebida, status:', r.status);
      console.log('📥 Response data:', JSON.stringify(r.data, null, 2));
    } catch (axiosErr) {
      console.error('❌ Erro na requisição axios:', axiosErr?.message || axiosErr);
      return res.status(502).json({ 
        error: 'proxy_network_error', 
        detail: axiosErr?.message || String(axiosErr) 
      });
    }

    const respData = r.data !== undefined ? r.data : { raw: r.statusText || '' };
    
    console.log(`📊 Reenviando para client: status=${r.status || 200}`);
    return res.status(r.status || 200).json(respData);
  } catch (err) {
    console.error('❌ Erro em /api/evolution/instance/connect/:id:', err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: 'proxy_error', detail: String(err?.message || err) };
    return res.status(status).json(data);
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'Servidor rodando! ✅',
    timestamp: new Date().toISOString(),
    whatsappConnections: Object.keys(conexoesWhatsApp).length,
    evolutionConfigured: !!EVOLUTION_URL && !!EVOLUTION_API_KEY
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp IA rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📱 Conectar WhatsApp: POST /api/whatsapp/connect/:tenantId`);
  console.log(`✅ Status WhatsApp: GET /api/whatsapp/status/:tenantId`);
  console.log(`🔁 Evolution proxy: POST /api/evolution/instance/create`);
  console.log(`🔁 Evolution proxy: GET  /api/evolution/instance/connect/:id`);
  console.log(`\n🔑 Evolution API Status:`);
  console.log(`   EVOLUTION_URL: ${EVOLUTION_URL ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   EVOLUTION_API_KEY: ${EVOLUTION_API_KEY ? '✅ Configurado' : '❌ Não configurado'}`);
});

export default app;
