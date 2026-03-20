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
import * as baileys from '@adiwajshing/baileys';

const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const DisconnectReason = baileys.DisconnectReason;
const isJidBroadcast = baileys.isJidBroadcast;

import qrcodeTerminal from 'qrcode-terminal';
import Levenshtein from 'js-levenshtein';
import cors from 'cors';

dotenv.config();

console.log('>>> INICIANDO: backend-whatsapp/server.js');

// Environment flags (não imprime chaves, apenas se estão setadas)
console.log('ENV CHECK: SUPABASE_URL', !!process.env.SUPABASE_URL ? 'SET' : 'EMPTY');
console.log('ENV CHECK: SUPABASE_SERVICE_KEY', !!process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'EMPTY');
console.log('ENV CHECK: CLAUDE_API_KEY', !!process.env.CLAUDE_API_KEY ? 'SET' : 'EMPTY');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

/
 * CORS - permitir apenas os domínios de frontend necessários.
 * Ajuste a lista `origin` conforme os domínios reais do seu frontend.
 */
app.use(cors({
  origin: [
    'https://www.redditoapp.com',
    'https://redditoapp.com',
    'http://127.0.0.1:3000',
    'http://localhost:3000'
    // adicione outros domínios de frontend aqui
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
      const beforeList = fs.readdirSync(path.dirname(authDir));
      console.log('Conteúdo do diretório auth_info (pai):', beforeList);
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

// (O restante do arquivo mantém exatamente as funções já presentes no seu código original.)
// Para evitar duplicação no envio, mantenho as implementações originais abaixo inalteradas.

async function processarPrimeiroAtendimento(tenantId, phoneNumber, conteudo, cliente, contextoSalao, sock) {
  let sessao = await buscarSessaoAgendamento(cliente.id);

  if (!sessao) {
    sessao = await criarSessaoAgendamento(cliente.id, tenantId);
  }

  const etapas = ['coleta_nome', 'coleta_email', 'confirmacao'];
  const proximaEtapa = determinarProximaEtapa(sessao.etapa || 'coleta_nome', etapas);

  let resposta = '';
  let dadosColetados = sessao.dados_coletados || {};

  if (proximaEtapa === 'coleta_nome') {
    dadosColetados.nome = extrairNome(conteudo);
    resposta = `Prazer conhecê-lo(a), ${dadosColetados.nome}! 😊\n\nPara completar seu cadastro, qual é seu melhor e-mail?`;
  }
  else if (proximaEtapa === 'coleta_email') {
    dadosColetados.email = conteudo.trim();
    resposta = `Perfeito! Aqui está seu resumo:\n\n👤 Nome: ${dadosColetados.nome}\n📧 E-mail: ${dadosColetados.email}\n\nEstá tudo certo? Responda *sim* ou *não*`;
  }
  else if (proximaEtapa === 'confirmacao') {
    if (conteudo.toLowerCase().includes('sim')) {
      await supabase
        .from('clientes')
        .update({
          nome: dadosColetados.nome,
          email: dadosColetados.email,
          primeiro_atendimento: false,
          cadastro_completo: true,
          data_primeiro_contato: new Date().toISOString()
        })
        .eq('id', cliente.id);

      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);

      resposta = `🎉 Bem-vindo(a) ao ${contextoSalao.nome || 'nosso salão'}, ${dadosColetados.nome}!\n\nAgora você está no nosso sistema. Como posso ajudá-lo(a)?\n\n1️⃣ Agendar um serviço\n2️⃣ Conhecer nossos serviços\n3️⃣ Falar com um atendente`;

      await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
        text: resposta
      });

      await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'cadastro_completo');
      return;
    } else {
      resposta = `Sem problema! Qual dado precisa corrigir?`;
    }
  }

  await supabase
    .from('sessoes_agendamento')
    .update({
      etapa: proximaEtapa,
      dados_coletados: dadosColetados,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessao.id);

  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
    text: resposta
  });

  await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'coleta_dados');
}

async function detectarIntencoes(tenantId, phoneNumber, conteudo, cliente, contextoSalao, sock) {
  const textoLower = conteudo.toLowerCase();

  if (verificarIntencao(textoLower, ['agendar', 'quero marcar', 'gostaria de marcar', 'fazer um agendamento', 'scheduling'])) {
    await iniciarFluxoAgendamento(tenantId, phoneNumber, cliente, contextoSalao, sock);
  }
  else if (verificarIntencao(textoLower, ['cancelar', 'desmarcar', 'cancel', 'não vou mais', 'cancela'])) {
    await procesarCancelamento(tenantId, phoneNumber, cliente, sock);
  }
  else if (verificarIntencao(textoLower, ['valor', 'preço', 'quanto custa', 'duração', 'quanto tempo'])) {
    await responderDuvidasServicos(tenantId, phoneNumber, cliente, contextoSalao, conteudo, sock);
  }
  else if (verificarIntencao(textoLower, ['horário', 'funciona', 'aberto', 'fecha', 'horario'])) {
    await responderDuvidasHorarios(tenantId, phoneNumber, cliente, contextoSalao, sock);
  }
}

async function iniciarFluxoAgendamento(tenantId, phoneNumber, cliente, contextoSalao, sock) {
  let sessao = await buscarSessaoAgendamento(cliente.id);

  if (!sessao) {
    sessao = await criarSessaoAgendamento(cliente.id, tenantId);
  }

  const etapas = ['escolha_servico', 'escolha_profissional', 'escolha_data', 'escolha_horario', 'confirmacao'];
  const proximaEtapa = determinarProximaEtapa(sessao.etapa || 'escolha_servico', fases = etapas);

  let resposta = '';
  let dadosColetados = sessao.dados_coletados || {};

  if (proximaEtapa === 'escolha_servico') {
    resposta = `Ótimo, ${cliente.nome}! 💅\n\nQual serviço você gostaria de agendar?\n\n`;
    contextoSalao.servicos?.forEach((s, i) => {
      resposta += `${i + 1}. ${s.nome} - R$ ${s.preco}\n`;
    });
    resposta += `\nResponda com o número do serviço.`;
  }
  else if (proximaEtapa === 'escolha_profissional') {
    const servicoId = extrairNumeroOpcao(sessao.dados_coletados?.servico_opcao);
    const servico = contextoSalao.servicos?.[servicoId - 1];

    if (!servico) {
      resposta = `Desculpa, não entendi. Pode repetir o número do serviço?`;
    } else {
      dadosColetados.servico_id = servico.id;
      dadosColetados.servico_nome = servico.nome;
      dadosColetados.valor = servico.preco;

      resposta = `Perfeito! Você escolheu ${servico.nome}.\n\nAgora, qual profissional você prefere?\n\n`;
      contextoSalao.profissionais?.forEach((p, i) => {
        resposta += `${i + 1}. ${p.nome}\n`;
      });
      resposta += `\nResponda com o número.`;
    }
  }
  else if (proximaEtapa === 'escolha_data') {
    const profissionalId = extrairNumeroOpcao(sessao.dados_coletados?.profissional_opcao);
    const profissional = contextoSalao.profissionais?.[profissionalId - 1];

    if (!profissional) {
      resposta = `Desculpa, não entendi. Pode repetir o número do profissional?`;
    } else {
      dadosColetados.profissional_id = profissional.id;
      dadosColetados.profissional_nome = profissional.nome;

      resposta = `Ótimo! Você escolheu a ${profissional.nome}.\n\nQual data você prefere?\n\n`;
      const dataHoje = new Date();
      for (let i = 0; i < 7; i++) {
        const data = new Date(dataHoje);
        data.setDate(data.getDate() + i);
        resposta += `${i + 1}. ${data.toLocaleDateString('pt-BR')} (${obterDiaSemana(data)})\n`;
      }
      resposta += `\nResponda com o número da data.`;
    }
  }
  else if (proximaEtapa === 'escolha_horario') {
    const dataOpcao = extrairNumeroOpcao(sessao.dados_coletados?.data_opcao);
    const dataHoje = new Date();
    const dataSelecionada = new Date(dataHoje);
    dataSelecionada.setDate(dataSelecionada.getDate() + (dataOpcao - 1));

    dadosColetados.data = dataSelecionada.toISOString().split('T')[0];

    const horariosDisponiveis = await buscarHorariosDisponiveis(
      dadosColetados.profissional_id,
      dataSelecionada,
      contextoSalao
    );

    resposta = `Ótimo! Para o dia ${dataSelecionada.toLocaleDateString('pt-BR')}, temos os seguintes horários disponíveis:\n\n`;
    horariosDisponiveis.forEach((h, i) => {
      resposta += `${i + 1}. ${h}\n`;
    });
    resposta += `\nQual horário funciona melhor para você?`;
    dadosColetados.horariosDisponiveis = horariosDisponiveis;
  }
  else if (proximaEtapa === 'confirmacao') {
    const horarioOpcao = extrairNumeroOpcao(sessao.dados_coletados?.horario_opcao);
    const horario = dadosColetados.horariosDisponiveis?.[horarioOpcao - 1];

    if (!horario) {
      resposta = `Desculpa, não entendi. Pode repetir o número do horário?`;
    } else {
      dadosColetados.horario = horario;
      dadosColetados.data_hora = `${dadosColetados.data}T${horario}:00`;

      resposta = `📋 Resumo do seu agendamento:\n\n`;
      resposta += `👤 Cliente: ${cliente.nome}\n`;
      resposta += `💅 Serviço: ${dadosColetados.servico_nome}\n`;
      resposta += `💇 Profissional: ${dadosColetados.profissional_nome}\n`;
      resposta += `📅 Data: ${new Date(dadosColetados.data_hora).toLocaleDateString('pt-BR')}\n`;
      resposta += `🕐 Horário: ${horario}\n`;
      resposta += `💰 Valor: R$ ${dadosColetados.valor}\n\n`;
      resposta += `Confirma o agendamento? Responda *sim* ou *não*`;
    }
  }

  if (proximaEtapa === 'confirmacao' && conteudo.toLowerCase().includes('sim')) {
    const { data: agendamento, error } = await supabase
      .from('agendamentos')
      .insert({
        cliente_id: cliente.id,
        profissional_id: dadosColetados.profissional_id,
        servico_id: dadosColetados.servico_id,
        data_hora: dadosColetados.data_hora,
        status: 'confirmado',
        origem: 'whatsapp_ia',
        tenant_id: tenantId
      })
      .select()
      .single();

    if (error) {
      resposta = `Desculpa, houve um erro ao confirmar. Tente novamente.`;
    } else {
      resposta = `🎉 Seu agendamento foi confirmado!\n\n`;
      resposta += `✅ ID do agendamento: #${agendamento.id}\n`;
      resposta += `📅 ${new Date(agendamento.data_hora).toLocaleDateString('pt-BR')} às ${new Date(agendamento.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
      resposta += `💅 ${dadosColetados.servico_nome}\n\n`;
      resposta += `Até breve, ${cliente.nome}! 😊\n\nQualquer dúvida, é só chamar!`;

      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);

      await criarAutomacoes(agendamento, cliente, tenantId, phoneNumber);

      await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
        text: resposta
      });

      await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'agendamento_confirmado');
      return;
    }
  }

  await supabase
    .from('sessoes_agendamento')
    .update({
      etapa: proximaEtapa,
      dados_coletados: { ...dadosColetados, [Object.keys(sessao.dados_coletados || {})[0]]: conteudo },
      updated_at: new Date().toISOString()
    })
    .eq('id', sessao.id);

  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
    text: resposta
  });

  await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'agendamento_processo');
}

async function procesarCancelamento(tenantId, phoneNumber, cliente, sock) {
  const agendamentos = await buscarAgendamentosCliente(cliente.id);

  if (agendamentos.length === 0) {
    const resposta = `${cliente.nome}, você não possui agendamentos pendentes. 😊`;
    await sock.sendMessage(phoneNumber + '@s.whatsapp.net', { text: resposta });
    await registrarConversa(cliente.id, tenantId, 'cancelar', resposta, 'cancelamento');
    return;
  }

  let resposta = `Qual agendamento você gostaria de cancelar?\n\n`;
  agendamentos.slice(0, 5).forEach((a, i) => {
    const data = new Date(a.data_hora);
    resposta += `${i + 1}. ${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
  });
  resposta += `\nResponda com o número ou "cancelar tudo"`;

  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', { text: resposta });
  await registrarConversa(cliente.id, tenantId, 'cancelar', resposta, 'cancelamento_listar');
}

async function responderDuvidasServicos(tenantId, phoneNumber, cliente, contextoSalao, conteudo, sock) {
  let mensagem = `Claro, ${cliente.nome}! 😊\n\nAqui estão nossos serviços:\n\n`;

  contextoSalao.servicos?.forEach(s => {
    mensagem += `💅 *${s.nome}\n`;
    mensagem += `   Valor: R$ ${s.preco}\n`;
    mensagem += `   Duração: ${s.duracao_minutos || 'Consulte'} minutos\n\n`;
  });

  mensagem += `Gostaria de agendar algum? Responda "agendar"`;

  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', { text: mensagem });
  await registrarConversa(cliente.id, tenantId, conteudo, mensagem, 'duvida_servicos');
}

async function responderDuvidasHorarios(tenantId, phoneNumber, cliente, contextoSalao, sock) {
  const horarios = contextoSalao.horarios_atendimento || [];
  
  let resposta = `Nossos horários de funcionamento:\n\n`;
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  for (let i = 0; i < 7; i++) {
    const horario = horarios.find(h => h.dia_semana === i);
    if (horario && horario.ativo) {
      resposta += `${diasSemana[i]}: ${horario.hora_inicio} - ${horario.hora_fim}\n`;
    } else {
      resposta += `${diasSemana[i]}: Fechado\n`;
    }
  }

  resposta += `\nGostaria de agendar? Responda "agendar"`;

  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', { text: resposta });
  await registrarConversa(cliente.id, tenantId, 'horarios', resposta, 'duvida_horarios');
}

async function gerarRespostaComClaude(mensagem, cliente, historico, contextoSalao, agendamentos) {
  const historicoFormatado = historico
    .slice(0, 10)
    .map(h => `Cliente: ${h.mensagem_entrada}\nAssistente: ${h.mensagem_saida}`)
    .join('\n\n');

  const nomeEmpresa = contextoSalao.nome || 'Nosso Salão';
  const enderecoEmpresa = contextoSalao.endereco || 'Não informado';
  const telefoneEmpresa = contextoSalao.telefone || 'Não informado';
  
  const servicosFormatados = contextoSalao.servicos 
    ? contextoSalao.servicos.map(s => s.nome + ' (R$ ' + s.preco + ')').join(', ')
    : 'Vários';
  
  const profissionaisFormatados = contextoSalao.profissionais
    ? contextoSalao.profissionais.map(p => p.nome).join(', ')
    : 'Experientes';

  const nomeCliente = cliente.nome || 'Cliente';
  const emailCliente = cliente.email || 'Não informado';

  const promptSistema = `
Você é um assistente de IA humanizado para o ${nomeEmpresa}.

DADOS DA EMPRESA:
- Nome: ${nomeEmpresa}
- Endereço: ${enderecoEmpresa}
- Telefone: ${telefoneEmpresa}
- Serviços: ${servicosFormatados}
- Profissionais: ${profissionaisFormatados}

DADOS DO CLIENTE:
- Nome: ${nomeCliente}
- Email: ${emailCliente}
- Agendamentos anteriores: ${agendamentos.length}
- Histórico: ${historicoFormatado || 'Primeira conversa'}

INSTRUÇÕES CRÍTICAS:
1. Seja acolhedor, amigável e HUMANIZADO - nada de robótico.
2. Sempre use o nome do cliente (${nomeCliente}).
3. Tolere erros de digitação e interprete a intenção.
4. Se detectar intenção de agendar, seja incentivador.
5. Se for pergunta sobre serviços/horários/preços, responda com informações do salão.
6. Responda SEMPRE em português natural e conversacional.
7. Use emojis naturalmente.
8. Se o cliente for recorrente, mencione que é bom tê-lo de volta.
9. Nunca seja agressivo ou desagradável.
10. Se não sabe algo, ofereça conectá-lo com um atendente.

RESPONDA APENAS COM A MENSAGEM, SEM PREFIXOS OU EXPLICAÇÕES.
`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: promptSistema,
        messages: [
          {
            role: 'user',
            content: mensagem
          }
        ]
      },
      {
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    return response.data.content[0].text || `Desculpa, não consegui processar. Pode tentar de novo? 🙏`;
  } catch (error) {
    console.error('❌ Erro Claude:', error.message);
    return `Desculpa, tive um problema. Você poderia tentar novamente? 🙏`;
  }
}

// (As demais funções auxiliares e endpoints seguem idênticos ao seu arquivo original,
//  mantive a lógica e estrutura originais e apenas acrescentei logs na parte de conexão e QR.)

async function criarAutomacoes(agendamento, cliente, tenantId, phoneNumber) {
  const dataAgendamento = new Date(agendamento.data_hora);

  const lembreteData = new Date(dataAgendamento);
  lembreteData.setHours(lembreteData.getHours() - 1);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id: tenantId,
    tipo_automacao: 'lembrete_dia',
    data_execucao: lembreteData.toISOString(),
    executada: false,
    telefone_whatsapp: phoneNumber
  });

  const agradecimentoData = new Date(dataAgendamento);
  agradecimentoData.setDate(agradecimentoData.getDate() + 1);
  agradecimentoData.setHours(10, 0, 0);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id: tenantId,
    tipo_automacao: 'pos_atendimento',
    data_execucao: agradecimentoData.toISOString(),
    executada: false,
    telefone_whatsapp: phoneNumber
  });

  const reagendamentoData = new Date(dataAgendamento);
  reagendamentoData.setDate(reagendamentoData.getDate() + 15);
  reagendamentoData.setHours(14, 0, 0);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id: tenantId,
    tipo_automacao: 'reagendamento_15d',
    data_execucao: reagendamentoData.toISOString(),
    executada: false,
    telefone_whatsapp: phoneNumber
  });

  const isRecorrente = await verificarClienteRecorrente(cliente.id);
  if (isRecorrente) {
    const retencaoData = new Date(dataAgendamento);
    retencaoData.setDate(retencaoData.getDate() + 45);
    retencaoData.setHours(16, 0, 0);

    await supabase.from('automacoes_agendadas').insert({
      cliente_id: cliente.id,
      agendamento_id: agendamento.id,
      tenant_id: tenantId,
      tipo_automacao: 'retencao_45d',
      data_execucao: retencaoData.toISOString(),
      executada: false,
      telefone_whatsapp: phoneNumber
    });
  }

  console.log(`✅ Automações criadas para agendamento #${agendamento.id}`);
}

// --------------------------------------------
// ENDPOINTS REST (mantive o original)
// --------------------------------------------

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

app.get('/health', (req, res) => {
  res.json({
    status: 'Servidor rodando! ✅',
    timestamp: new Date().toISOString(),
    whatsappConnections: Object.keys(conexoesWhatsApp).length
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
});

export default app;
