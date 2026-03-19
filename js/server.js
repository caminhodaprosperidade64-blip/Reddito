import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import Boom from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import leven from 'js-levenshtein';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino();
const app = express();

// ============================================
// CORS CONFIGURATION
// ============================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false,
  maxAge: 86400
}));

app.options('*', cors());

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// SUPABASE CLIENT
// ============================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('❌ Variáveis Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// GLOBAL STATE
// ============================================
const conexoesWhatsApp = {};
const sessoes = {};

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'Servidor rodando! ✅',
    timestamp: new Date().toISOString(),
    whatsappConnections: Object.keys(conexoesWhatsApp).length
  });
});

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function buscarTenant(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error({ tenantId, error }, 'Erro ao buscar tenant');
    return null;
  }
}

async function buscarHistoricoCliente(tenantId, telefone) {
  try {
    const { data, error } = await supabase
      .from('conversas_whatsapp')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('cliente_telefone', telefone)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error({ tenantId, telefone, error }, 'Erro ao buscar histórico');
    return [];
  }
}

async function buscarAgendamentosPorCliente(tenantId, telefone) {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('cliente_telefone', telefone);

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error({ tenantId, telefone, error }, 'Erro ao buscar agendamentos');
    return [];
  }
}

async function buscarServicos(tenantId) {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error({ tenantId, error }, 'Erro ao buscar serviços');
    return [];
  }
}

async function buscarHorariosDisponiveis(tenantId, profissionalId, data) {
  try {
    const { data: horarios, error } = await supabase
      .from('horarios_atendimento')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('profissional_id', profissionalId)
      .eq('data', data);

    if (error) throw error;
    return horarios || [];
  } catch (error) {
    logger.error({ tenantId, profissionalId, data, error }, 'Erro ao buscar horários');
    return [];
  }
}

async function buscarProfissionais(tenantId) {
  try {
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error({ tenantId, error }, 'Erro ao buscar profissionais');
    return [];
  }
}

async function cadastrarCliente(tenantId, nome, telefone, email, tipoServico) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        tenant_id: tenantId,
        nome,
        telefone,
        email,
        tipo_servico: tipoServico,
        data_cadastro: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    logger.error({ tenantId, nome, telefone, error }, 'Erro ao cadastrar cliente');
    return null;
  }
}

async function salvarConversa(tenantId, clienteTelefone, clienteNome, mensagem, tipo) {
  try {
    await supabase
      .from('conversas_whatsapp')
      .insert([{
        tenant_id: tenantId,
        cliente_telefone: clienteTelefone,
        cliente_nome: clienteNome,
        mensagem,
        tipo,
        timestamp: new Date().toISOString()
      }]);
  } catch (error) {
    logger.error({ tenantId, clienteTelefone, error }, 'Erro ao salvar conversa');
  }
}

async function criarAgendamento(tenantId, clienteTelefone, clienteNome, servico, profissional, data, horario) {
  try {
    const { data: agendamento, error } = await supabase
      .from('agendamentos')
      .insert([{
        tenant_id: tenantId,
        cliente_telefone: clienteTelefone,
        cliente_nome: clienteNome,
        servico,
        profissional_id: profissional,
        data,
        horario,
        status: 'confirmado',
        data_agendamento: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    return agendamento?.[0] || null;
  } catch (error) {
    logger.error({ tenantId, clienteTelefone, error }, 'Erro ao criar agendamento');
    return null;
  }
}

async function cancelarAgendamento(tenantId, clienteTelefone) {
  try {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado' })
      .eq('tenant_id', tenantId)
      .eq('cliente_telefone', clienteTelefone)
      .eq('status', 'confirmado');

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error({ tenantId, clienteTelefone, error }, 'Erro ao cancelar agendamento');
    return false;
  }
}

async function gerarRespostaComClaude(sistemaPrompt, historico) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: sistemaPrompt,
        messages: historico
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    return response.data.content[0].text;
  } catch (error) {
    logger.error({ error }, 'Erro ao gerar resposta com Claude');
    return 'Desculpe, não consegui processar sua solicitação. Tente novamente.';
  }
}

function detectarIntencao(mensagem) {
  const lower = mensagem.toLowerCase();
  
  if (leven(lower, 'agendar') <= 2 || leven(lower, 'marcar') <= 2 || /quer|quero|gostaria|agendar|marcar|reservar|hora/.test(lower)) {
    return 'agendar';
  }
  if (leven(lower, 'cancelar') <= 2 || leven(lower, 'desmarca') <= 2 || /cancel|desmark|remov/.test(lower)) {
    return 'cancelar';
  }
  if (/duvida|pergunta|qual|quanto|quando|como|telefone|endereco|horario|aberto|atendimento/.test(lower)) {
    return 'faq';
  }
  return 'geral';
}

// ============================================
// SISTEMA PROMPT HUMANIZADO
// ============================================
const SYSTEM_PROMPT = `Você é um assistente de atendimento humanizado, cordial e atencioso para um estabelecimento. Seu objetivo é:

1. **Identificar intenção**: Detecte automaticamente se o cliente quer agendar, cancelar ou tirar dúvidas, mesmo com erros de digitação.
2. **Cadastro (primeiro atendimento)**: Se for a primeira mensagem do cliente, colete nome, telefone, email e tipo de serviço desejado de forma natural, sem parecer um formulário.
3. **Personalisação**: Após o cadastro, sempre trate o cliente pelo nome nos próximos atendimentos.
4. **Humanização**: Seja natural, educado e conversacional. Evite respostas robóticas.
5. **Agendamentos**: Ajude o cliente a agendar serviços, sugerindo datas e horários disponíveis. Se o horário desejado não estiver disponível, ofereça as 3 opções mais próximas.
6. **Cancelamentos**: Processe cancelamentos de forma simples e amigável.
7. **FAQ**: Responda perguntas sobre serviços, preços, políticas e horários de funcionamento.
8. **Análise de histórico**: Considere conversas anteriores do cliente para oferecer melhor atendimento.

Mantenha sempre um tom profissional, mas jamais robótico.`;

// ============================================
// CONEXÃO WHATSAPP COM BAILEYS
// ============================================
async function conectarWhatsApp(tenantId) {
  try {
    const authPath = path.join(__dirname, `auth_info/${tenantId}`);
    
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info({ tenantId }, '📱 QR Code gerado');
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          await supabase
            .from('tenants')
            .update({ whatsapp_qrcode: qrDataUrl, conexao_status: 'pendente' })
            .eq('id', tenantId);
        } catch (error) {
          logger.error({ tenantId, error }, 'Erro ao salvar QR code');
        }
      }

      if (connection === 'open') {
        logger.info({ tenantId }, '✅ WhatsApp conectado');
        conexoesWhatsApp[tenantId] = socket;
        await supabase
          .from('tenants')
          .update({ conexao_status: 'conectado' })
          .eq('id', tenantId);
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        logger.warn({ tenantId, shouldReconnect }, '🔌 WhatsApp desconectado');
        
        if (shouldReconnect) {
          setTimeout(() => conectarWhatsApp(tenantId), 3000);
        }
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const clienteId = msg.key.remoteJid.split('@')[0];
        const mensagemTexto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        logger.info({ tenantId, clienteId, mensagem: mensagemTexto }, '📨 Mensagem recebida');

        // Buscar histórico
        const historico = await buscarHistoricoCliente(tenantId, clienteId);
        const agendamentos = await buscarAgendamentosPorCliente(tenantId, clienteId);
        
        // Determinar nome do cliente
        let clienteNome = msg.pushName || 'Cliente';
        
        // Se for primeira mensagem, cadastrar
        if (historico.length === 0) {
          clienteNome = msg.pushName || 'Novo Cliente';
          await cadastrarCliente(tenantId, clienteNome, clienteId, '', 'geral');
        }

        // Montar contexto para Claude
        const contexto = `
Cliente: ${clienteNome}
Histórico: ${historico.map(h => `${h.tipo}: ${h.mensagem}`).join('\n')}
Agendamentos: ${agendamentos.map(a => `${a.data} às ${a.horario} - ${a.servico}`).join('\n') || 'Nenhum'}
Mensagem atual: ${mensagemTexto}
`;

        // Gerar resposta com Claude
        const resposta = await gerarRespostaComClaude(SYSTEM_PROMPT, [
          {
            role: 'user',
            content: contexto
          }
        ]);

        // Salvar conversa
        await salvarConversa(tenantId, clienteId, clienteNome, mensagemTexto, 'cliente');
        await salvarConversa(tenantId, clienteId, clienteNome, resposta, 'ia');

        // Enviar resposta
        await socket.sendMessage(msg.key.remoteJid, { text: resposta });
      }
    });

    return socket;
  } catch (error) {
    logger.error({ tenantId, error }, 'Erro ao conectar WhatsApp');
    throw error;
  }
}

// ============================================
// API ENDPOINTS
// ============================================

app.post('/api/whatsapp/connect/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (conexoesWhatsApp[tenantId]) {
      return res.status(400).json({ error: 'WhatsApp já está conectado para este tenant' });
    }

    const socket = await conectarWhatsApp(tenantId);
    res.json({ success: true, message: 'WhatsApp conectando...' });
  } catch (error) {
    logger.error({ error }, 'Erro no endpoint /api/whatsapp/connect');
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/whatsapp/status/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await buscarTenant(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }

    const isConnected = !!conexoesWhatsApp[tenantId];

    res.json({
      tenantId,
      isConnected,
      status: tenant.conexao_status,
      qrCode: tenant.whatsapp_qrcode
    });
  } catch (error) {
    logger.error({ error }, 'Erro no endpoint /api/whatsapp/status');
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CRON JOBS
// ============================================
cron.schedule('*/5 * * * *', async () => {
  logger.info('⏰ Executando verificação de agendamentos...');
  try {
    const { data: automacoes } = await supabase
      .from('automacoes_agendadas')
      .select('*')
      .eq('ativo', true);

    for (const automacao of automacoes || []) {
      // Lógica de automação aqui
      logger.debug({ automacao }, 'Automação executada');
    }
  } catch (error) {
    logger.error({ error }, 'Erro no cron job');
  }
});

// ============================================
// INICIALIZAÇÃO
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 Servidor WhatsApp IA rodando na porta ${PORT}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/health`);
  logger.info(`📱 Conectar WhatsApp: POST /api/whatsapp/connect/:tenantId`);
  logger.info(`✅ Status WhatsApp: GET /api/whatsapp/status/:tenantId`);
  logger.info(`🌐 CORS habilitado para todas as origens`);
});

export default app;
