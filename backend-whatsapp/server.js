// backend-whatsapp/server.js
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuração Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configuração Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:3001';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Configuração Claude
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// ============================================
// 1. GERAR QR CODE PARA CLIENTE ESCANEAR
// ============================================

app.get('/qrcode/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Iniciar instância do WhatsApp
    const response = await axios.post(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        instanceName: `reddito-${tenantId}`,
        qrcode: true
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const { qrcode } = response.data;

    // Gerar imagem QR Code
    const qrcodeImage = await QRCode.toDataURL(qrcode);

    res.json({
      success: true,
      qrcode: qrcodeImage,
      instanceName: `reddito-${tenantId}`,
      mensagem: 'Escaneie o QR Code com seu WhatsApp para conectar'
    });

    console.log(`✅ QR Code gerado para tenant ${tenantId}`);
  } catch (error) {
    console.error('❌ Erro ao gerar QR Code:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 2. VERIFICAR STATUS DA CONEXÃO
// ============================================

app.get('/status/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const instanceName = `reddito-${tenantId}`;

    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY
        }
      }
    );

    const { state } = response.data;

    // Se conectado, salvar no banco
    if (state === 'open') {
      await supabase.from('tenants').update({
        whatsapp_conectado: true,
        whatsapp_instancia: instanceName
      }).eq('id', tenantId);

      console.log(`✅ WhatsApp conectado para tenant ${tenantId}`);
    }

    res.json({
      status: state,
      conectado: state === 'open',
      instanceName
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 3. WEBHOOK - RECEBER MENSAGENS
// ============================================

app.post('/webhook/message', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !data.message) {
      return res.sendStatus(200);
    }

    const { instanceName, message } = data;
    const phoneNumber = message.from?.split('@')[0]; // Remove @s.whatsapp.net
    const conteudo = message.body;

    console.log(`📨 Mensagem de ${phoneNumber}: ${conteudo}`);

    // Extrair tenant_id do instanceName
    const tenantId = instanceName.replace('reddito-', '');

    // Buscar ou criar cliente
    let cliente = await buscarOuCriarCliente(phoneNumber, tenantId);

    // Processar mensagem
    if (cliente.primeiro_atendimento) {
      await procesarPrimeiroAtendimento(instanceName, phoneNumber, conteudo, cliente);
    } else if (cliente.cadastro_completo) {
      await processarConversa(instanceName, phoneNumber, conteudo, cliente);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.sendStatus(500);
  }
});

// ============================================
// 4. PRIMEIRO ATENDIMENTO - COLETA DE DADOS
// ============================================

async function procesarPrimeiroAtendimento(instanceName, phoneNumber, conteudo, cliente) {
  let sessao = await buscarSessaoAgendamento(cliente.id);
  
  if (!sessao) {
    sessao = await criarSessaoAgendamento(cliente.id, cliente.tenant_id);
  }

  const etapas = ['coleta_nome', 'coleta_email', 'coleta_cpf', 'confirmacao_dados'];
  const proximaEtapa = determinarProximaEtapa(sessao.etapa, etapas);
  
  let resposta = '';
  let dadosColetados = sessao.dados_coletados || {};

  if (proximaEtapa === 'coleta_nome') {
    dadosColetados.nome = conteudo;
    resposta = `Prazer, ${conteudo}! 😊\n\nAgora preciso do seu e-mail para salvar seus dados:`;
  } 
  else if (proximaEtapa === 'coleta_email') {
    dadosColetados.email = conteudo;
    resposta = `Ótimo! E qual é o seu CPF?\n(Vou usar para identificar você melhor)`;
  } 
  else if (proximaEtapa === 'coleta_cpf') {
    dadosColetados.cpf = conteudo;
    resposta = `Perfeito!\n\nResumo dos seus dados:\n👤 Nome: ${dadosColetados.nome}\n📧 E-mail: ${dadosColetados.email}\n🆔 CPF: ${conteudo}\n\nEstá tudo certo? Responda *sim* ou *não*`;
  } 
  else if (proximaEtapa === 'confirmacao_dados') {
    if (conteudo.toLowerCase().includes('sim')) {
      await supabase.from('clientes').update({
        nome: dadosColetados.nome,
        email: dadosColetados.email,
        cpf: dadosColetados.cpf,
        cadastro_completo: true,
        primeiro_atendimento: false,
        data_primeiro_contato: new Date().toISOString()
      }).eq('id', cliente.id);

      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);

      resposta = `Excelente, ${dadosColetados.nome}! 🎉\n\nAgora você está registrado no nosso sistema!\n\nO que você gostaria de fazer?\n1️⃣ Agendar um serviço\n2️⃣ Saber mais sobre nossos serviços\n3️⃣ Falar com um atendente`;
      
      await registrarConversa(cliente.id, cliente.tenant_id, conteudo, resposta, 'primeiro_atendimento');
      await enviarWhatsAppEvolution(instanceName, phoneNumber, resposta);
      return;
    } else {
      resposta = `Sem problema! Me diga qual dado precisa corrigir.`;
    }
  }

  await supabase.from('sessoes_agendamento').update({
    etapa: proximaEtapa,
    dados_coletados: dadosColetados,
    updated_at: new Date().toISOString()
  }).eq('id', sessao.id);

  await enviarWhatsAppEvolution(instanceName, phoneNumber, resposta);
  await registrarConversa(cliente.id, cliente.tenant_id, conteudo, resposta, 'coleta_dados');
}

// ============================================
// 5. FLUXO DE AGENDAMENTO
// ============================================

async function processarConversa(instanceName, phoneNumber, conteudo, cliente) {
  const tenant_id = cliente.tenant_id;

  const historico = await buscarHistoricoConversas(cliente.id, 10);
  const contextoSalao = await buscarContextoSalao(tenant_id);
  const agendamentosCliente = await buscarAgendamentosCliente(cliente.id);

  const resposta = await gerarRespostaComClaude(
    conteudo,
    cliente,
    historico,
    contextoSalao,
    agendamentosCliente
  );

  if (resposta.includes('agendamento_detectado')) {
    await processarAgendamento(instanceName, phoneNumber, conteudo, cliente, resposta);
  } else {
    await enviarWhatsAppEvolution(instanceName, phoneNumber, resposta);
    await registrarConversa(cliente.id, tenant_id, conteudo, resposta, 'conversa_normal');
  }
}

async function processarAgendamento(instanceName, phoneNumber, conteudo, cliente, respostaInicial) {
  let sessao = await buscarSessaoAgendamento(cliente.id);
  
  if (!sessao) {
    sessao = await criarSessaoAgendamento(cliente.id, cliente.tenant_id);
  }

  const etapas = ['escolha_servico', 'escolha_profissional', 'escolha_horario', 'confirmacao'];
  const proximaEtapa = determinarProximaEtapa(sessao.etapa || 'inicio', etapas);

  let resposta = '';
  let dadosColetados = sessao.dados_coletados || {};
  const contextoSalao = await buscarContextoSalao(cliente.tenant_id);

  if (proximaEtapa === 'escolha_servico') {
    const servicos = contextoSalao.servicos || [];
    resposta = `Ótimo, ${cliente.nome}! 💅\n\nQual serviço você gostaria de agendar?\n`;
    servicos.forEach((s, i) => {
      resposta += `${i + 1}. ${s.nome} - R$ ${s.preco}\n`;
    });
    resposta += `\nResponda com o número do serviço.`;
  }
  else if (proximaEtapa === 'escolha_profissional') {
    const servico = contextoSalao.servicos.find(s => s.id === dadosColetados.servico_id);
    const profissionais = contextoSalao.profissionais.filter(p => p.especialidades && p.especialidades.includes(servico.id));
    
    resposta = `Perfeito! Vou agendar ${servico.nome}.\n\nQual profissional você prefere?\n`;
    profissionais.forEach((p, i) => {
      resposta += `${i + 1}. ${p.nome}\n`;
    });
    resposta += `\nResponda com o número.`;
  }
  else if (proximaEtapa === 'escolha_horario') {
    const profissional = contextoSalao.profissionais.find(p => p.id === dadosColetados.profissional_id);
    const horariosDisponiveis = await buscarHorariosDisponiveis(
      dadosColetados.profissional_id,
      contextoSalao
    );
    
    resposta = `Ótimo! A ${profissional.nome} está disponível nos seguintes horários:\n\n`;
    horariosDisponiveis.forEach((h, i) => {
      resposta += `${i + 1}. ${h.data} às ${h.hora}\n`;
    });
    resposta += `\nQual horário funciona melhor para você?`;
    dadosColetados.horariosDisponiveis = horariosDisponiveis;
  }
  else if (proximaEtapa === 'confirmacao') {
    resposta = `Resumo do seu agendamento:\n\n📅 Data/Hora: ${dadosColetados.data_hora}\n💅 Serviço: ${dadosColetados.servico_nome}\n💇 Profissional: ${dadosColetados.profissional_nome}\n💰 Valor: R$ ${dadosColetados.valor}\n\nConfirma? Responda *sim* ou *não*`;
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
        tenant_id: cliente.tenant_id
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar agendamento:', error);
      resposta = `Desculpa, houve um erro ao confirmar. Tente novamente.`;
    } else {
      resposta = `🎉 Seu agendamento foi confirmado!\n\n✅ ID: ${agendamento.id}\n📅 ${dadosColetados.data_hora}\n💅 ${dadosColetados.servico_nome}\n\nAté breve, ${cliente.nome}! 😊`;

      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);
      await criarAutomacoes(agendamento, cliente, instanceName);
    }
  }

  if (sessao && proximaEtapa !== 'confirmacao') {
    await supabase.from('sessoes_agendamento').update({
      etapa: proximaEtapa,
      dados_coletados: dadosColetados,
      updated_at: new Date().toISOString()
    }).eq('id', sessao.id);
  }

  await enviarWhatsAppEvolution(instanceName, phoneNumber, resposta);
  await registrarConversa(cliente.id, cliente.tenant_id, conteudo, resposta, 'agendamento');
}

// ============================================
// 6. GERAR RESPOSTA COM CLAUDE
// ============================================

async function gerarRespostaComClaude(mensagem, cliente, historico, contextoSalao, agendamentos) {
  const historicoFormatado = historico
    .map(h => `Cliente: ${h.mensagem_entrada}\nAssistente: ${h.mensagem_saida}`)
    .join('\n\n');

  const promptSistema = `
Você é um assistente de IA de um salão/spa chamado "${contextoSalao.nome || 'Nosso Salão'}".

DADOS DO SALÃO:
- Serviços: ${contextoSalao.servicos ? contextoSalao.servicos.map(s => \`\${s.nome} (R$ \${s.preco})\`).join(', ') : 'Nenhum'}
- Profissionais: ${contextoSalao.profissionais ? contextoSalao.profissionais.map(p => p.nome).join(', ') : 'Nenhum'}
- Endereço: ${contextoSalao.endereco || 'Não informado'}
- Telefone: ${contextoSalao.telefone || 'Não informado'}

DADOS DO CLIENTE:
- Nome: ${cliente.nome || 'Cliente'}
- Histórico: ${agendamentos.length > 0 ? agendamentos.length + ' agendamentos' : 'Novo cliente'}

INSTRUÇÕES:
1. Sempre seja acolhedor e humanizado.
2. Use o nome do cliente.
3. Se detectar intenção de agendar, inicie com [agendamento_detectado].
4. Nunca seja robotizado.
5. Responda com emojis naturais.
`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
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

    return response.data.content[0].text;
  } catch (error) {
    console.error('❌ Erro Claude:', error.message);
    return `Desculpa, tive um problema. Pode tentar novamente? 🙏`;
  }
}

// ============================================
// 7. AUTOMAÇÕES AGENDADAS
// ============================================

async function criarAutomacoes(agendamento, cliente, instanceName) {
  const tenant_id = agendamento.tenant_id;
  const dataAgendamento = new Date(agendamento.data_hora);

  // Automação 1: Lembrete 1h antes
  const lembreteData = new Date(dataAgendamento);
  lembreteData.setHours(lembreteData.getHours() - 1);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id,
    tipo_automacao: 'lembrete_dia',
    data_execucao: lembreteData.toISOString(),
    executada: false,
    instancia_whatsapp: instanceName
  });

  // Automação 2: Agradecimento dia +1
  const agradecimentoData = new Date(dataAgendamento);
  agradecimentoData.setDate(agradecimentoData.getDate() + 1);
  agradecimentoData.setHours(10, 0, 0);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id,
    tipo_automacao: 'pos_atendimento',
    data_execucao: agradecimentoData.toISOString(),
    executada: false,
    instancia_whatsapp: instanceName
  });

  // Automação 3: Reagendamento 15 dias
  const reagendamentoData = new Date(dataAgendamento);
  reagendamentoData.setDate(reagendamentoData.getDate() + 15);
  reagendamentoData.setHours(14, 0, 0);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id,
    tipo_automacao: 'reagendamento_15d',
    data_execucao: reagendamentoData.toISOString(),
    executada: false,
    instancia_whatsapp: instanceName
  });

  // Automação 4: Retenção 45 dias
  const isClienteRecorrente = await verificarClienteRecorrente(cliente.id);
  if (isClienteRecorrente) {
    const retencaoData = new Date(dataAgendamento);
    retencaoData.setDate(retencaoData.getDate() + 45);
    retencaoData.setHours(16, 0, 0);

    await supabase.from('automacoes_agendadas').insert({
      cliente_id: cliente.id,
      agendamento_id: agendamento.id,
      tenant_id,
      tipo_automacao: 'retencao_45d',
      data_execucao: retencaoData.toISOString(),
      executada: false,
      instancia_whatsapp: instanceName
    });
  }

  console.log('✅ Automações criadas:', agendamento.id);
}

// ============================================
// 8. CRON JOB - EXECUTAR AUTOMAÇÕES
// ============================================

cron.schedule('* * * * *', async () => {
  try {
    const agora = new Date().toISOString();

    const { data: automacoes } = await supabase
      .from('automacoes_agendadas')
      .select('*, clientes(nome, telefone), agendamentos(*)')
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
  const { tipo_automacao, clientes, agendamentos, instancia_whatsapp } = automacao;
  const cliente = clientes;
  const agendamento = agendamentos;

  let mensagem = '';

  if (tipo_automacao === 'lembrete_dia') {
    mensagem = `👋 Oi ${cliente.nome}!\n\nQue tal um lembretinho?\n\n📅 Você tem agendamento HOJE!\n\nNão perca! 😊`;
  } 
  else if (tipo_automacao === 'pos_atendimento') {
    mensagem = `✨ ${cliente.nome}, tudo bem?\n\nQueremos agradecer sua visita! 🙏\n\nSua experiência foi ótima?\n\nQualquer coisa, é só chamar! 💕`;
  } 
  else if (tipo_automacao === 'reagendamento_15d') {
    mensagem = `💅 Oi ${cliente.nome}!\n\nJá faz 15 dias do seu último agendamento.\n\nQue tal agendar novamente? 📅\n\nResponda "agendar" se tiver interesse!`;
  } 
  else if (tipo_automacao === 'retencao_45d') {
    mensagem = `🌟 ${cliente.nome}, sentimos sua falta!\n\nQueremos te presentear com 10% de desconto! ✨\n\nResponda "agendar" para aproveitar!`;
  }

  if (mensagem && instancia_whatsapp) {
    await enviarWhatsAppEvolution(instancia_whatsapp, cliente.telefone, mensagem);

    await supabase
      .from('automacoes_agendadas')
      .update({ executada: true })
      .eq('id', automacao.id);

    console.log(`✅ Automação: ${tipo_automacao} → ${cliente.nome}`);
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function buscarOuCriarCliente(phoneNumber, tenantId) {
  let { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('telefone', phoneNumber)
    .eq('tenant_id', tenantId)
    .single();

  if (!cliente) {
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
    .single();

  return sessao;
}

function determinarProximaEtapa(etapaAtual, etapas) {
  const index = etapas.indexOf(etapaAtual);
  return index + 1 < etapas.length ? etapas[index + 1] : etapas[0];
}

async function buscarHistoricoConversas(cliente_id, limite = 10) {
  const { data: historico } = await supabase
    .from('conversas_whatsapp')
    .select('*')
    .eq('cliente_id', cliente_id)
    .order('timestamp', { ascending: false })
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
    .order('data_hora', { ascending: false })
    .limit(5);

  return agendamentos || [];
}

async function buscarHorariosDisponiveis(profissional_id, contextoSalao) {
  const dataHoje = new Date();
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + 7);

  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('data_hora')
    .eq('profissional_id', profissional_id)
    .gte('data_hora', dataHoje.toISOString())
    .lte('data_hora', dataFim.toISOString());

  const horariosDisponiveis = [];
  for (let i = 0; i < 7; i++) {
    const data = new Date(dataHoje);
    data.setDate(data.getDate() + i);
    
    horariosDisponiveis.push({
      data: data.toLocaleDateString('pt-BR'),
      hora: '10:00'
    });
    horariosDisponiveis.push({
      data: data.toLocaleDateString('pt-BR'),
      hora: '14:00'
    });
  }

  return horariosDisponiveis;
}

async function registrarConversa(cliente_id, tenant_id, entrada, saida, tipo) {
  await supabase.from('conversas_whatsapp').insert({
    cliente_id,
    tenant_id,
    mensagem_entrada: entrada,
    mensagem_saida: saida,
    tipo_interacao: tipo
  });
}

async function enviarWhatsAppEvolution(instanceName, phoneNumber, mensagem) {
  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        number: phoneNumber,
        text: mensagem
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Mensagem enviada para ${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem:`, error.message);
    throw error;
  }
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
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'Servidor rodando! ✅',
    evolution: EVOLUTION_API_URL
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp IA rodando na porta ${PORT}`);
  console.log(`📍 Evolution API: ${EVOLUTION_API_URL}`);
  console.log(`📲 Webhook de mensagens: /webhook/message`);
  console.log(`📱 Gerar QR Code: GET /qrcode/:tenantId`);
});
