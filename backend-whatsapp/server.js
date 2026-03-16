// backend-whatsapp/server.js
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuração Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configuração WhatsApp
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

// Configuração Claude
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// ============================================
// 1. WEBHOOK - RECEBER MENSAGENS
// ============================================

app.post('/webhook/whatsapp', async (req, res) => {
  console.log('📨 Webhook recebido:', JSON.stringify(req.body, null, 2));

  try {
    const { entry } = req.body;
    
    if (!entry || !entry[0].changes[0].value.messages) {
      return res.sendStatus(200);
    }

    const msg = entry[0].changes[0].value.messages[0];
    const phoneNumber = msg.from;
    const conteudo = msg.text.body;
    const timestamp = msg.timestamp;

    // Buscar ou criar cliente
    let cliente = await buscarOuCriarCliente(phoneNumber);
    const tenant_id = cliente.tenant_id;

    console.log(`📱 Mensagem de ${cliente.nome || 'Novo cliente'}: ${conteudo}`);

    // Verificar se é primeiro contato
    if (cliente.primeiro_atendimento) {
      await procesarPrimeiroAtendimento(phoneNumber, conteudo, cliente);
    } else if (cliente.cadastro_completo) {
      await processarConversa(phoneNumber, conteudo, cliente);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.sendStatus(500);
  }
});

// ============================================
// 2. PRIMEIRO ATENDIMENTO - COLETA DE DADOS
// ============================================

async function procesarPrimeiroAtendimento(phoneNumber, conteudo, cliente) {
  // Buscar ou criar sessão de agendamento
  let sessao = await buscarSessaoAgendamento(cliente.id);
  
  if (!sessao) {
    sessao = await criarSessaoAgendamento(cliente.id, cliente.tenant_id);
  }

  const etapas = ['coleta_nome', 'coleta_email', 'coleta_cpf', 'confirmacao_dados'];
  
  // Determinar próxima etapa
  const proximaEtapa = determinarProximaEtapa(sessao.etapa, etapas);
  
  let resposta = '';
  let dadosColetados = sessao.dados_coletados || {};

  // Coletar dados conforme a etapa
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
      // Salvar cliente no banco
      await supabase.from('clientes').update({
        nome: dadosColetados.nome,
        email: dadosColetados.email,
        cpf: dadosColetados.cpf,
        cadastro_completo: true,
        primeiro_atendimento: false,
        data_primeiro_contato: new Date().toISOString()
      }).eq('id', cliente.id);

      // Deletar sessão
      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);

      resposta = `Excelente, ${dadosColetados.nome}! 🎉\n\nAgora você está registrado no nosso sistema!\n\nO que você gostaria de fazer?\n1️⃣ Agendar um serviço\n2️⃣ Saber mais sobre nossos serviços\n3️⃣ Falar com um atendente`;
      
      // Registrar conversa
      await registrarConversa(cliente.id, cliente.tenant_id, conteudo, resposta, 'primeiro_atendimento');

      await enviarWhatsApp(phoneNumber, resposta);
      return;
    } else {
      resposta = `Sem problema! Me diga qual dado precisa corrigir.\n\n${JSON.stringify(dadosColetados, null, 2)}`;
    }
  }

  // Atualizar sessão
  await supabase.from('sessoes_agendamento').update({
    etapa: proximaEtapa,
    dados_coletados: dadosColetados,
    updated_at: new Date().toISOString()
  }).eq('id', sessao.id);

  // Enviar resposta
  await enviarWhatsApp(phoneNumber, resposta);
  
  // Registrar conversa
  await registrarConversa(cliente.id, cliente.tenant_id, conteudo, resposta, 'coleta_dados');
}

function determinarProximaEtapa(etapaAtual, etapas) {
  const index = etapas.indexOf(etapaAtual);
  return index + 1 < etapas.length ? etapas[index + 1] : etapas[0];
}

// ============================================
// 3. FLUXO DE AGENDAMENTO
// ============================================

async function processarConversa(phoneNumber, conteudo, cliente) {
  const tenant_id = cliente.tenant_id;

  // Buscar contexto
  const historico = await buscarHistoricoConversas(cliente.id, 10);
  const contextoSalao = await buscarContextoSalao(tenant_id);
  const agendamentosCliente = await buscarAgendamentosCliente(cliente.id);

  // Gerar resposta com Claude
  const resposta = await gerarRespostaComClaude(
    conteudo,
    cliente,
    historico,
    contextoSalao,
    agendamentosCliente
  );

  // Verificar se está agendando
  if (resposta.includes('agendamento_detectado')) {
    await processarAgendamento(phoneNumber, conteudo, cliente, resposta);
  } else {
    // Enviar resposta normal
    await enviarWhatsApp(phoneNumber, resposta);
    
    // Registrar conversa
    await registrarConversa(cliente.id, tenant_id, conteudo, resposta, 'conversa_normal');
  }
}

async function processarAgendamento(phoneNumber, conteudo, cliente, respostaInicial) {
  // Buscar ou criar sessão
  let sessao = await buscarSessaoAgendamento(cliente.id);
  
  if (!sessao) {
    sessao = await criarSessaoAgendamento(cliente.id, cliente.tenant_id);
  }

  const etapas = ['escolha_servico', 'escolha_profissional', 'escolha_horario', 'confirmacao'];
  const proximaEtapa = determinarProximaEtapa(sessao.etapa || 'inicio', etapas);

  let resposta = '';
  let dadosColetados = sessao.dados_coletados || {};

  const contextoSalao = await buscarContextoSalao(cliente.tenant_id);

  // ETAPA 1: Escolher serviço
  if (proximaEtapa === 'escolha_servico') {
    const servicos = contextoSalao.servicos || [];
    resposta = `Ótimo, ${cliente.nome}! 💅\n\nQual serviço você gostaria de agendar?\n`;
    servicos.forEach((s, i) => {
      resposta += `${i + 1}. ${s.nome} - R$ ${s.preco}\n`;
    });
    resposta += `\nResponda com o número do serviço.`;
  }
  // ETAPA 2: Escolher profissional
  else if (proximaEtapa === 'escolha_profissional') {
    const servico = contextoSalao.servicos.find(s => s.id === dadosColetados.servico_id);
    const profissionais = contextoSalao.profissionais.filter(p => p.especialidades.includes(servico.id));
    
    resposta = `Perfeito! Vou agendar ${servico.nome}.\n\nQual profissional você prefere?\n`;
    profissionais.forEach((p, i) => {
      resposta += `${i + 1}. ${p.nome}\n`;
    });
    resposta += `\nResponda com o número.`;
  }
  // ETAPA 3: Escolher horário
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
  // ETAPA 4: Confirmação
  else if (proximaEtapa === 'confirmacao') {
    resposta = `Resumo do seu agendamento:\n\n📅 Data/Hora: ${dadosColetados.data_hora}\n💅 Serviço: ${dadosColetados.servico_nome}\n💇 Profissional: ${dadosColetados.profissional_nome}\n💰 Valor: R$ ${dadosColetados.valor}\n\nConfirma? Responda *sim* ou *não*`;
  }

  // Se confirmar agendamento
  if (proximaEtapa === 'confirmacao' && conteudo.toLowerCase().includes('sim')) {
    // Criar agendamento no banco
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
      resposta = `Desculpa, houve um erro ao confirmar. Tente novamente ou fale com um atendente.`;
    } else {
      resposta = `🎉 Seu agendamento foi confirmado!\n\n✅ ID: ${agendamento.id}\n📅 ${dadosColetados.data_hora}\n💅 ${dadosColetados.servico_nome}\n\nAté breve, ${cliente.nome}! 😊`;

      // Deletar sessão
      await supabase.from('sessoes_agendamento').delete().eq('id', sessao.id);

      // Criar automações para este agendamento
      await criarAutomacoes(agendamento, cliente);
    }
  }

  // Atualizar sessão
  if (sessao && proximaEtapa !== 'confirmacao') {
    await supabase.from('sessoes_agendamento').update({
      etapa: proximaEtapa,
      dados_coletados: dadosColetados,
      updated_at: new Date().toISOString()
    }).eq('id', sessao.id);
  }

  // Enviar resposta
  await enviarWhatsApp(phoneNumber, resposta);
  
  // Registrar conversa
  await registrarConversa(cliente.id, cliente.tenant_id, conteudo, resposta, 'agendamento');
}

// ============================================
// 4. GERAR RESPOSTA COM CLAUDE
// ============================================

async function gerarRespostaComClaude(mensagem, cliente, historico, contextoSalao, agendamentos) {
  const historicoFormatado = historico
    .map(h => `Cliente: ${h.mensagem_entrada}\nAssistente: ${h.mensagem_saida}`)
    .join('\n\n');

  const promptSistema = `
Você é um assistente de IA de um salão/spa chamado "${contextoSalao.nome}".

DADOS DO SALÃO:
- Serviços: ${contextoSalao.servicos ? contextoSalao.servicos.map(s => \`\${s.nome} (R$ \${s.preco})\`).join(', ') : 'Nenhum'}
- Profissionais: ${contextoSalao.profissionais ? contextoSalao.profissionais.map(p => p.nome).join(', ') : 'Nenhum'}
- Horários: ${contextoSalao.horarios_atendimento ? contextoSalao.horarios_atendimento.map(h => \`\${h.dia_semana}: \${h.horario_abertura}-\${h.horario_fechamento}\`).join(', ') : 'Não informado'}
- Endereço: ${contextoSalao.endereco || 'Não informado'}
- Telefone: ${contextoSalao.telefone || 'Não informado'}

DADOS DO CLIENTE:
- Nome: ${cliente.nome || 'Cliente'}
- E-mail: ${cliente.email || 'Não informado'}
- Histórico de agendamentos: ${agendamentos.length > 0 ? agendamentos.map(a => a.data_hora).join(', ') : 'Nenhum'}

INSTRUÇÕES:
1. Sempre seja acolhedor, humanizado e natural.
2. Use o nome do cliente quando apropriado.
3. Se o cliente quiser agendar, responda com a tag [agendamento_detectado] antes da resposta.
4. Responda com emojis naturais quando apropriado.
5. Oferça soluções baseadas nos serviços reais do salão.
6. Seja honesto sobre disponibilidade.
7. Se não souber algo específico, sugira contato com um profissional.
8. Nunca seja robotizado ou repetitivo.
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
    console.error('❌ Erro ao chamar Claude:', error.message);
    return `Desculpa, tive um problema técnico. Pode tentar novamente ou falar com um atendente? 🙏`;
  }
}

// ============================================
// 5. AUTOMAÇÕES AGENDADAS
// ============================================

async function criarAutomacoes(agendamento, cliente) {
  const tenant_id = agendamento.tenant_id;
  const dataAgendamento = new Date(agendamento.data_hora);

  // Automação 1: Lembrete no dia do agendamento (1 hora antes)
  const lembreteData = new Date(dataAgendamento);
  lembreteData.setHours(lembreteData.getHours() - 1);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id,
    tipo_automacao: 'lembrete_dia',
    data_execucao: lembreteData.toISOString(),
    executada: false
  });

  // Automação 2: Agradecimento no dia seguinte
  const agradecimentoData = new Date(dataAgendamento);
  agradecimentoData.setDate(agradecimentoData.getDate() + 1);
  agradecimentoData.setHours(10, 0, 0);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id,
    tipo_automacao: 'pos_atendimento',
    data_execucao: agradecimentoData.toISOString(),
    executada: false
  });

  // Automação 3: Reagendamento em 15 dias
  const reagendamentoData = new Date(dataAgendamento);
  reagendamentoData.setDate(reagendamentoData.getDate() + 15);
  reagendamentoData.setHours(14, 0, 0);

  await supabase.from('automacoes_agendadas').insert({
    cliente_id: cliente.id,
    agendamento_id: agendamento.id,
    tenant_id,
    tipo_automacao: 'reagendamento_15d',
    data_execucao: reagendamentoData.toISOString(),
    executada: false
  });

  // Automação 4: Retenção em 45 dias (apenas se cliente recorrente)
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
      executada: false
    });
  }

  console.log('✅ Automações criadas para agendamento:', agendamento.id);
}

// ============================================
// 6. CRON JOB - EXECUTAR AUTOMAÇÕES
// ============================================

// Executar a cada 1 minuto
cron.schedule('* * * * *', async () => {
  try {
    const agora = new Date().toISOString();

    // Buscar automações que devem ser executadas
    const { data: automacoes } = await supabase
      .from('automacoes_agendadas')
      .select('*, clientes(nome, telefone), agendamentos(*)')
      .eq('executada', false)
      .lte('data_execucao', agora);

    for (const automacao of automacoes || []) {
      await executarAutomacao(automacao);
    }
  } catch (error) {
    console.error('❌ Erro no cron:', error);
  }
});

async function executarAutomacao(automacao) {
  const { tipo_automacao, cliente_id, agendamento_id, clientes, agendamentos } = automacao;
  const cliente = clientes;
  const agendamento = agendamentos;

  let mensagem = '';

  if (tipo_automacao === 'lembrete_dia') {
    mensagem = `👋 Oi ${cliente.nome}!\n\nQue tal um lembretinho?\n\n📅 Você tem agendamento HOJE!\n🕐 Horário: ${new Date(agendamento.data_hora).toLocaleString('pt-BR')}\n\nNão perca! 😊`;
  } 
  else if (tipo_automacao === 'pos_atendimento') {
    mensagem = `✨ ${cliente.nome}, tudo bem?\n\nQueremos agradecer sua visita! 🙏\n\nSua experiência foi ótima? Adoraríamos saber sua opinião!\n\nQualquer dúvida ou agendamento novo, é só chamar! 💕`;
  } 
  else if (tipo_automacao === 'reagendamento_15d') {
    mensagem = `💅 Oi ${cliente.nome}!\n\nJá faz 15 dias do seu último agendamento conosco.\n\nQue tal agendar novamente? Estamos com ótimos horários disponíveis! 📅\n\nResponda com "agendar" se tiver interesse.`;
  } 
  else if (tipo_automacao === 'retencao_45d') {
    mensagem = `🌟 ${cliente.nome}, sentimos sua falta!\n\nJá faz 45 dias que não te vemos por aqui... 😢\n\nQueremos te presentear com 10% de desconto na próxima visita!\n\nVem resgatar? ✨\n\nResponda "agendar" para aproveitar!`;
  }

  if (mensagem) {
    // Enviar mensagem
    await enviarWhatsApp(cliente.telefone, mensagem);

    // Marcar como executada
    await supabase
      .from('automacoes_agendadas')
      .update({ executada: true })
      .eq('id', automacao.id);

    console.log(`✅ Automação executada: ${tipo_automacao} para ${cliente.nome}`);
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function buscarOuCriarCliente(phoneNumber) {
  let { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('telefone', phoneNumber)
    .single();

  if (error || !cliente) {
    // Criar novo cliente
    const novoCliente = {
      telefone: phoneNumber,
      primeiro_atendimento: true,
      cadastro_completo: false
    };

    const { data: clienteCriado } = await supabase
      .from('clientes')
      .insert(novoCliente)
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
  // Buscar agendamentos do profissional dos próximos 7 dias
  const dataHoje = new Date();
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + 7);

  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('data_hora')
    .eq('profissional_id', profissional_id)
    .gte('data_hora', dataHoje.toISOString())
    .lte('data_hora', dataFim.toISOString());

  // Gerar horários disponíveis (simplificado)
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

async function enviarWhatsApp(phoneNumber, mensagem) {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: mensagem }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Mensagem enviada:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
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
// WEBHOOK VALIDAÇÃO (GET)
// ============================================

app.get('/webhook/whatsapp', (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verify_token) {
    console.log('✅ Webhook validado');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Servidor rodando! ✅' });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp IA rodando na porta ${PORT}`);
  console.log(`📍 Webhook disponível em: /webhook/whatsapp`);
});
