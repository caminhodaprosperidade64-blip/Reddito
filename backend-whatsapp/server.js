console.log('>>> INICIANDO: backend-whatsapp/server.js');
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
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  isJidBroadcast 
} from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import Levenshtein from 'js-levenshtein';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

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

// ============================================
// CONECTAR WHATSAPP BAILEYS MULTI-TENANT
// ============================================

async function conectarWhatsAppTenant(tenantId) {
  try {
    const authDir = path.join(__dirname, 'auth_info', tenantId);
    
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      defaultQueryTimeoutMs: undefined
    });

    // Salvar credenciais
    sock.ev.on('creds.update', saveCreds);

    // Processar mensagens recebidas
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.message || isJidBroadcast(message.key.remoteJid)) return;

      const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
      const conteudo = message.message.conversation || 
                       message.message.extendedTextMessage?.text || '';

      console.log(`📨 [${tenantId}] ${phoneNumber}: ${conteudo}`);

      try {
        await processarMensagemWhatsApp(tenantId, phoneNumber, conteudo, sock);
      } catch (error) {
        console.error(`❌ Erro ao processar mensagem:`, error.message);
      }
    });

    // Atualizar status de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`\n📱 QR Code para ${tenantId}:\n`);
        qrcodeTerminal.generate(qr, { small: true });

        // Gerar QR em base64 para o painel
        const qrBase64 = await QRCode.toDataURL(qr);
        await supabase
          .from('tenants')
          .update({ whatsapp_qrcode: qrBase64 })
          .eq('id', tenantId);

        console.log(`✅ QR code salvo no banco para ${tenantId}`);
      }

      if (connection === 'open') {
        console.log(`✅ WhatsApp conectado para ${tenantId}`);
        await supabase
          .from('tenants')
          .update({
            whatsapp_conectado: true,
            whatsapp_conectado_em: new Date().toISOString(),
            whatsapp_qrcode: null
          })
          .eq('id', tenantId);
      }

      if (connection === 'close') {
        const shouldReconnect = 
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log(`🔄 Reconectando ${tenantId}...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          conectarWhatsAppTenant(tenantId);
        } else {
          console.log(`❌ ${tenantId} desconectado.`);
          await supabase
            .from('tenants')
            .update({ whatsapp_conectado: false })
            .eq('id', tenantId);
        }
      }
    });

    conexoesWhatsApp[tenantId] = sock;
    return sock;
  } catch (error) {
    console.error(`❌ Erro ao conectar WhatsApp para ${tenantId}:`, error);
    throw error;
  }
}

// ============================================
// PROCESSAR MENSAGEM WHATSAPP
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
// PRIMEIRO ATENDIMENTO - CADASTRO AUTOMÁTICO
// ============================================

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
    // Extrair nome do conteúdo (mesmo com erros)
    dadosColetados.nome = extrairNome(conteudo);
    resposta = `Prazer conhecê-lo(a), ${dadosColetados.nome}! 😊\n\nPara completar seu cadastro, qual é seu melhor e-mail?`;
  }
  else if (proximaEtapa === 'coleta_email') {
    dadosColetados.email = conteudo.trim();
    resposta = `Perfeito! Aqui está seu resumo:\n\n👤 Nome: ${dadosColetados.nome}\n📧 E-mail: ${dadosColetados.email}\n\nEstá tudo certo? Responda *sim* ou *não*`;
  }
  else if (proximaEtapa === 'confirmacao') {
    if (conteudo.toLowerCase().includes('sim')) {
      // Atualizar cliente no banco
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

      // Deletar sessão
      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);

      resposta = `🎉 Bem-vindo(a) ao ${contextoSalao.nome || 'nosso salão'}, ${dadosColetados.nome}!\n\nAgora você está no nosso sistema. Como posso ajudá-lo(a)?\n\n1️⃣ Agendar um serviço\n2️⃣ Conhecer nossos serviços\n3️⃣ Falar com um atendente`;

      // Enviar mensagem
      await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
        text: resposta
      });

      // Registrar conversa
      await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'cadastro_completo');
      return;
    } else {
      resposta = `Sem problema! Qual dado precisa corrigir?`;
    }
  }

  // Atualizar sessão
  await supabase
    .from('sessoes_agendamento')
    .update({
      etapa: proximaEtapa,
      dados_coletados: dadosColetados,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessao.id);

  // Enviar resposta
  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
    text: resposta
  });

  // Registrar conversa
  await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'coleta_dados');
}

// ============================================
// DETECTAR INTENÇÕES (Agendar, Cancelar, Dúvidas)
// ============================================

async function detectarIntencoes(tenantId, phoneNumber, conteudo, cliente, contextoSalao, sock) {
  const textoLower = conteudo.toLowerCase();

  // Intenção: Agendar
  if (verificarIntencao(textoLower, ['agendar', 'quero marcar', 'gostaria de marcar', 'fazer um agendamento', 'scheduling'])) {
    await iniciarFluxoAgendamento(tenantId, phoneNumber, cliente, contextoSalao, sock);
  }
  // Intenção: Cancelar
  else if (verificarIntencao(textoLower, ['cancelar', 'desmarcar', 'cancel', 'não vou mais', 'cancela'])) {
    await procesarCancelamento(tenantId, phoneNumber, cliente, sock);
  }
  // Intenção: Dúvidas sobre serviços
  else if (verificarIntencao(textoLower, ['valor', 'preço', 'quanto custa', 'duração', 'quanto tempo'])) {
    await responderDuvidasServicos(tenantId, phoneNumber, cliente, contextoSalao, conteudo, sock);
  }
  // Intenção: Dúvidas sobre horários
  else if (verificarIntencao(textoLower, ['horário', 'funciona', 'aberto', 'fecha', 'horario'])) {
    await responderDuvidasHorarios(tenantId, phoneNumber, cliente, contextoSalao, sock);
  }
}

// ============================================
// FLUXO DE AGENDAMENTO
// ============================================

async function iniciarFluxoAgendamento(tenantId, phoneNumber, cliente, contextoSalao, sock) {
  let sessao = await buscarSessaoAgendamento(cliente.id);

  if (!sessao) {
    sessao = await criarSessaoAgendamento(cliente.id, tenantId);
  }

  const etapas = ['escolha_servico', 'escolha_profissional', 'escolha_data', 'escolha_horario', 'confirmacao'];
  const proximaEtapa = determinarProximaEtapa(sessao.etapa || 'escolha_servico', etapas);

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

  // Se confirmação e resposta positiva
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

      // Deletar sessão
      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);

      // Criar automações
      await criarAutomacoes(agendamento, cliente, tenantId, phoneNumber);

      // Enviar mensagem
      await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
        text: resposta
      });

      // Registrar conversa
      await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'agendamento_confirmado');
      return;
    }
  }

  // Atualizar sessão com a próxima etapa
  await supabase
    .from('sessoes_agendamento')
    .update({
      etapa: proximaEtapa,
      dados_coletados: { ...dadosColetados, [Object.keys(sessao.dados_coletados || {})[0]]: conteudo },
      updated_at: new Date().toISOString()
    })
    .eq('id', sessao.id);

  // Enviar resposta
  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
    text: resposta
  });

  // Registrar conversa
  await registrarConversa(cliente.id, tenantId, conteudo, resposta, 'agendamento_processo');
}

// ============================================
// CANCELAMENTO DE AGENDAMENTOS
// ============================================

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

// ============================================
// RESPONDER DÚVIDAS SOBRE SERVIÇOS
// ============================================

async function responderDuvidasServicos(tenantId, phoneNumber, cliente, contextoSalao, conteudo, sock) {
  let mensagem = `Claro, ${cliente.nome}! 😊\n\nAqui estão nossos serviços:\n\n`;

  contextoSalao.servicos?.forEach(s => {
    mensagem += `💅 *${s.nome}*\n`;
    mensagem += `   Valor: R$ ${s.preco}\n`;
    mensagem += `   Duração: ${s.duracao_minutos || 'Consulte'} minutos\n\n`;
  });

  mensagem += `Gostaria de agendar algum? Responda "agendar"`;

  await sock.sendMessage(phoneNumber + '@s.whatsapp.net', { text: mensagem });
  await registrarConversa(cliente.id, tenantId, conteudo, mensagem, 'duvida_servicos');
}

// ============================================
// RESPONDER DÚVIDAS SOBRE HORÁRIOS
// ============================================

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

// ============================================
// GERAR RESPOSTA COM CLAUDE
// ============================================

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

// ============================================
// CRIAR AUTOMAÇÕES AGENDADAS
// ============================================

async function criarAutomacoes(agendamento, cliente, tenantId, phoneNumber) {
  const dataAgendamento = new Date(agendamento.data_hora);

  // Lembrete 1h antes
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

  // Agradecimento dia +1
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

  // Reagendamento 15 dias
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

  // Retenção 45 dias (apenas clientes recorrentes)
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

// ============================================
// CRON JOB - EXECUTAR AUTOMAÇÕES
// ============================================

cron.schedule('*/5 * * * *', async () => {
  try {
    const agora = new Date().toISOString();

    const { data: automacoes } = await supabase
      .from('automacoes_agendadas')
      .select('*, clientes(nome), agendamentos(servicos(nome))')
      .eq('executada', false)
      .lte('data_execucao', agora);

    for (const automacao of automacoes || []) {
      await executarAutomacao(automacao);
    }
  } catch (error) {
    console.error('❌ Erro cron:', error);
  }
});

async function executarAutomacao(automacao) {
  try {
    const { tipo_automacao, cliente_id, agendamento_id, tenant_id, telefone_whatsapp, clientes, agendamentos } = automacao;
    const cliente = clientes;
    const agendamento = agendamentos;

    let mensagem = '';

    if (tipo_automacao === 'lembrete_dia') {
      mensagem = `👋 Oi ${cliente.nome}!\n\n📅 Você tem agendamento HOJE em ${agendamento.servicos?.nome || 'seu serviço'}!\n\nNão se atrase! 😊`;
    }
    else if (tipo_automacao === 'pos_atendimento') {
      mensagem = `✨ ${cliente.nome}, tudo bem?\n\nQueremos agradecer sua visita! 🙏\n\nVocê gostou?\n\nQualquer feedback, é só chamar! 💕`;
    }
    else if (tipo_automacao === 'reagendamento_15d') {
      mensagem = `💅 Oi ${cliente.nome}!\n\nJá faz 15 dias que nos vimos.\n\nQue tal agendar novamente? 📅\n\nResponda "agendar" se quiser marcar!`;
    }
    else if (tipo_automacao === 'retencao_45d') {
      mensagem = `🌟 ${cliente.nome}, sentimos sua falta!\n\n🎁 Temos uma promoção exclusiva para você:\n\n*10% DE DESCONTO* em seu próximo agendamento!\n\nResponda "agendar" para aproveitar! ✨`;
    }

    if (mensagem && telefone_whatsapp && conexoesWhatsApp[tenant_id]) {
      const sock = conexoesWhatsApp[tenant_id];
      await sock.sendMessage(telefone_whatsapp + '@s.whatsapp.net', { text: mensagem });

      await supabase
        .from('automacoes_agendadas')
        .update({ executada: true, data_envio: new Date().toISOString() })
        .eq('id', automacao.id);

      console.log(`✅ Automação ${tipo_automacao} enviada para ${cliente.nome}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao executar automação:`, error.message);
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function extrairNome(texto) {
  const primeiraPalavra = texto.split(' ')[0];
  return primeiraPalavra.charAt(0).toUpperCase() + primeiraPalavra.slice(1).toLowerCase();
}

function verificarIntencao(textoLower, palavrasChave) {
  return palavrasChave.some(palavra => textoLower.includes(palavra));
}

function extrairNumeroOpcao(texto) {
  if (!texto) return null;
  const numero = parseInt(texto.toString().split(' ')[0]);
  return isNaN(numero) ? null : numero;
}

function determinarProximaEtapa(etapaAtual, etapas) {
  const index = etapas.indexOf(etapaAtual);
  return index + 1 < etapas.length ? etapas[index + 1] : etapas[0];
}

function obterDiaSemana(data) {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dias[data.getDay()];
}

async function buscarOuCriarCliente(phoneNumber, tenantId) {
  let { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('telefone', phoneNumber)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !cliente) {
    const { data: clienteCriado } = await supabase
      .from('clientes')
      .insert({
        telefone: phoneNumber,
        tenant_id: tenantId,
        primeiro_atendimento: true,
        cadastro_completo: false
      })
      .select()
      .single();

    return clienteCriado;
  }

  return cliente;
}

async function criarSessaoAgendamento(cliente_id, tenant_id) {
  const { data: sessao } = await supabase
    .from('sessoes_agendamento')
    .insert({
      cliente_id,
      tenant_id,
      etapa: 'coleta_nome',
      dados_coletados: {}
    })
    .select()
    .single();

  return sessao;
}

async function buscarSessaoAgendamento(cliente_id) {
  const { data: sessao } = await supabase
    .from('sessoes_agendamento')
    .select('*')
    .eq('cliente_id', cliente_id)
    .maybeSingle();

  return sessao;
}

async function buscarHistoricoConversas(cliente_id, limite = 10) {
  const { data: historico } = await supabase
    .from('conversas_whatsapp')
    .select('*')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
    .limit(limite);

  return historico || [];
}

async function buscarContextoSalao(tenant_id) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*, servicos(*), profissionais(*), horarios_atendimento(*)')
    .eq('id', tenant_id)
    .single();

  return tenant || {};
}

async function buscarAgendamentosCliente(cliente_id) {
  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('*')
    .eq('cliente_id', cliente_id)
    .in('status', ['confirmado', 'pendente'])
    .order('data_hora', { ascending: false })
    .limit(10);

  return agendamentos || [];
}

async function buscarHorariosDisponiveis(profissional_id, data, contextoSalao) {
  // Horários padrão
  const horarios = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

  // Buscar agendamentos existentes
  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('data_hora')
    .eq('profissional_id', profissional_id)
    .gte('data_hora', data.toISOString())
    .lt('data_hora', new Date(data.getTime() + 86400000).toISOString());

  const horariosOcupados = agendamentos?.map(a => new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) || [];

  return horarios.filter(h => !horariosOcupados.includes(h));
}

async function registrarConversa(cliente_id, tenant_id, entrada, saida, tipo) {
  await supabase.from('conversas_whatsapp').insert({
    cliente_id,
    tenant_id,
    mensagem_entrada: entrada,
    mensagem_saida: saida,
    tipo_interacao: tipo,
    created_at: new Date().toISOString()
  });
}

async function verificarClienteRecorrente(cliente_id) {
  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('cliente_id', cliente_id)
    .eq('status', 'realizado');

  return (agendamentos?.length || 0) >= 2;
}

// ============================================
// ENDPOINTS REST
// ============================================

app.post('/api/whatsapp/connect/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Conectar WhatsApp
    const sock = await conectarWhatsAppTenant(tenantId);

    // Aguardar QR code (máx 30 segundos)
    let qrCode = null;
    let tentativas = 0;
    while (!qrCode && tentativas < 30) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('whatsapp_qrcode')
        .eq('id', tenantId)
        .single();

      qrCode = tenant?.whatsapp_qrcode;
      if (!qrCode) {
        await new Promise(r => setTimeout(r, 1000));
        tentativas++;
      }
    }

    if (qrCode) {
      res.json({ status: 'qr_generated', qrCode });
    } else {
      res.json({ status: 'waiting_qr', message: 'Escaneie o QR code no terminal' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/whatsapp/status/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { data: tenant } = await supabase
      .from('tenants')
      .select('whatsapp_conectado, whatsapp_conectado_em')
      .eq('id', tenantId)
      .single();

    res.json({
      connected: tenant?.whatsapp_conectado || false,
      connectedAt: tenant?.whatsapp_conectado_em || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

