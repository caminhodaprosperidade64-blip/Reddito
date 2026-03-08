# 🚀 GUIA DE INTEGRAÇÃO SUPABASE - SISTEMA COMPLETO

## 📋 CHECKLIST DE CONFIGURAÇÃO

### 1️⃣ CONFIGURAR SUPABASE (OBRIGATÓRIO)

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em "SQL Editor" e execute o arquivo `supabase-setup.sql` completo
4. Abra o arquivo `js/supabase-config.js` e substitua:
   ```javascript
   url: 'https://SEU_PROJECT_ID.supabase.co',
   anonKey: 'SUA_ANON_KEY'
   ```
5. Para obter as credenciais:
   - Vá em Settings → API
   - Copie "Project URL" → cole em `url`
   - Copie "anon/public key" → cole em `anonKey`

### 2️⃣ ADICIONAR CDN DO SUPABASE NOS HTMLS

Adicione esta linha no `<head>` de TODOS os arquivos HTML **ANTES** dos scripts locais:

```html
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Scripts -->
<script src="js/supabase-config.js"></script>
<script src="js/supabase-db.js"></script>
<script src="js/pro-ui.js"></script>
```

### 3️⃣ ARQUIVOS QUE PRECISAM SER ATUALIZADOS

#### ✅ Já Criados/Atualizados:
- `supabase-setup.sql` - SQL completo para criar tabelas
- `js/supabase-config.js` - Configuração do Supabase
- `js/supabase-db.js` - Funções de acesso ao banco (32KB)
- `agendar.html` - Página pública de agendamento

#### 🔧 Precisam ser Atualizados (trocar LocalDB por SupabaseDB):

**dashboard.html**:
```javascript
// ANTES:
const stats = LocalDB.getDashboardStats();
const agendamentos = LocalDB.getProximosAgendamentos(5);

// DEPOIS:
async function loadDashboard() {
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    // Agendamentos de hoje
    const hojeAgendamentos = await SupabaseDB.Agendamentos.listarPorData(hoje);
    const amanhaAgendamentos = await SupabaseDB.Agendamentos.listarPorData(amanha);
    
    // Financeiro
    const financeiroHoje = await SupabaseDB.Financeiro.resumoDiario(hoje);
    const financeiroMes = await SupabaseDB.Financeiro.resumoMensal(
        new Date().getFullYear(),
        new Date().getMonth() + 1
    );
    
    // Próximos agendamentos
    const proximos = await SupabaseDB.Agendamentos.proximosAgendamentos(10);
    
    // Atualizar UI
    document.getElementById('hoje-count').textContent = hojeAgendamentos.length;
    document.getElementById('amanha-count').textContent = amanhaAgendamentos.length;
    document.getElementById('faturamento-hoje').textContent = ProUI.Format.currency(financeiroHoje.receitas);
    document.getElementById('faturamento-mes').textContent = ProUI.Format.currency(financeiroMes.receitas);
}

// Chamar ao carregar
window.addEventListener('DOMContentLoaded', async () => {
    await loadDashboard();
});
```

**agenda.html**:
```javascript
// ANTES:
const appointments = LocalDB.getAgendamentos().filter(a => a.data === dateStr);

// DEPOIS:
async function loadAgenda() {
    const data = currentDate.toISOString().split('T')[0];
    const agendamentos = await SupabaseDB.Agendamentos.listarPorData(data);
    // Renderizar agenda...
}

// Criar agendamento
async function salvarAgendamento() {
    const dados = {
        cliente_id: document.getElementById('cliente').value,
        servico_id: document.getElementById('servico').value,
        profissional_id: document.getElementById('profissional').value,
        data_hora: `${data}T${hora}:00`,
        duracao_minutos: parseInt(document.getElementById('duracao').value),
        valor_servico: parseFloat(document.getElementById('valor').value),
        status: 'agendado'
    };
    
    await SupabaseDB.Agendamentos.criar(dados);
    ProUI.Toast.success('Agendamento criado!');
    await loadAgenda();
}
```

**clientes.html**:
```javascript
// ANTES:
let clientes = LocalDB.getClientes();

// DEPOIS:
async function loadClientes() {
    const clientes = await SupabaseDB.Clientes.listar();
    // Renderizar tabela...
}

// Salvar cliente
async function salvarCliente() {
    const dados = {
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        email: document.getElementById('email').value
    };
    
    if (editingId) {
        await SupabaseDB.Clientes.atualizar(editingId, dados);
        ProUI.Toast.success('Cliente atualizado!');
    } else {
        await SupabaseDB.Clientes.criar(dados);
        ProUI.Toast.success('Cliente criado!');
    }
    
    await loadClientes();
}

// Excluir cliente
async function excluirCliente(id) {
    if (await ProUI.Confirm('Deseja excluir este cliente?')) {
        await SupabaseDB.Clientes.excluir(id);
        ProUI.Toast.success('Cliente excluído!');
        await loadClientes();
    }
}
```

**servicos.html**:
```javascript
// ANTES:
let servicos = LocalDB.getServicos();

// DEPOIS:
async function loadServicos() {
    const servicos = await SupabaseDB.Servicos.listar();
    // Renderizar tabela...
}

// Salvar serviço
async function salvarServico() {
    const dados = {
        nome: document.getElementById('nome').value,
        duracao_minutos: parseInt(document.getElementById('duracao').value),
        preco: parseFloat(document.getElementById('preco').value),
        categoria: document.getElementById('categoria').value
    };
    
    if (editingId) {
        await SupabaseDB.Servicos.atualizar(editingId, dados);
    } else {
        await SupabaseDB.Servicos.criar(dados);
    }
    
    await loadServicos();
}
```

**profissionais.html**:
```javascript
// ANTES:
let profissionais = LocalDB.getProfissionais();

// DEPOIS:
async function loadProfissionais() {
    const profissionais = await SupabaseDB.Profissionais.listar();
    // Renderizar tabela...
}

// Salvar profissional
async function salvarProfissional() {
    const dados = {
        nome: document.getElementById('nome').value,
        especialidade: document.getElementById('especialidade').value,
        tipo_comissao: document.getElementById('tipo_comissao').value,
        valor_comissao: parseFloat(document.getElementById('valor_comissao').value)
    };
    
    if (editingId) {
        await SupabaseDB.Profissionais.atualizar(editingId, dados);
    } else {
        await SupabaseDB.Profissionais.criar(dados);
    }
    
    await loadProfissionais();
}
```

**financeiro.html**:
```javascript
// ANTES:
const report = LocalDB.getRelatorioFinanceiro();

// DEPOIS:
async function loadFinanceiro() {
    const hoje = new Date().toISOString().split('T')[0];
    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();
    
    const resumoHoje = await SupabaseDB.Financeiro.resumoDiario(hoje);
    const resumoMes = await SupabaseDB.Financeiro.resumoMensal(ano, mes);
    const movimentos = await SupabaseDB.Financeiro.listar();
    
    // Atualizar UI...
    document.getElementById('receitas-mes').textContent = ProUI.Format.currency(resumoMes.receitas);
    document.getElementById('comissoes-mes').textContent = ProUI.Format.currency(resumoMes.comissoes);
    document.getElementById('lucro-mes').textContent = ProUI.Format.currency(resumoMes.lucro);
}
```

**relatorios.html**:
```javascript
// ANTES:
const data = LocalDB.getReceitaUltimos7Dias();

// DEPOIS:
async function loadRelatorios() {
    const dataFim = new Date().toISOString().split('T')[0];
    const dataInicio = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
    
    // Faturamento por dia
    const faturamentoDias = await SupabaseDB.Relatorios.faturamentoPorDia(dataInicio, dataFim);
    
    // Serviços mais vendidos
    const topServicos = await SupabaseDB.Relatorios.servicosMaisVendidos(dataInicio, dataFim);
    
    // Clientes recorrentes
    const clientesRecorrentes = await SupabaseDB.Relatorios.clientesRecorrentes(dataInicio, dataFim);
    
    // Relatório por profissional
    const porProfissional = await SupabaseDB.Financeiro.relatorioPorProfissional(dataInicio, dataFim);
    
    // Renderizar gráficos...
}
```

**whatsapp.html**:
```javascript
async function loadAutomacoes() {
    const automacoes = await SupabaseDB.WhatsApp.listarAutomacoes();
    // Renderizar automações...
}

async function salvarAutomacao(tipo, mensagem) {
    const automacao = await SupabaseDB.WhatsApp.buscarAutomacao(tipo);
    if (automacao) {
        await SupabaseDB.WhatsApp.atualizarAutomacao(automacao.id, {
            mensagem: mensagem,
            ativo: true
        });
    }
}
```

**configuracoes.html**:
```javascript
async function popularDados() {
    ProUI.Loading.show('Populando dados...');
    try {
        await SupabaseDB.Utils.popularDadosExemplo();
        ProUI.Toast.success('Dados de exemplo criados!');
    } catch (error) {
        ProUI.Toast.error('Erro: ' + error.message);
    } finally {
        ProUI.Loading.hide();
    }
}
```

### 4️⃣ PADRÃO DE CONVERSÃO

**IMPORTANTE**: Todas as funções que acessam dados agora são **async/await**

```javascript
// ❌ ERRADO (LocalDB - síncrono)
const clientes = LocalDB.getClientes();
renderizarTabela(clientes);

// ✅ CORRETO (SupabaseDB - assíncrono)
async function loadData() {
    const clientes = await SupabaseDB.Clientes.listar();
    renderizarTabela(clientes);
}

// ❌ ERRADO
LocalDB.createCliente(dados);
ProUI.Toast.success('Criado!');

// ✅ CORRETO
async function criar() {
    await SupabaseDB.Clientes.criar(dados);
    ProUI.Toast.success('Criado!');
}
```

### 5️⃣ TESTAR INTEGRAÇÃO

1. Abra `dashboard.html`
2. Abra o Console do navegador (F12)
3. Execute:
   ```javascript
   // Testar conexão
   await SupabaseUtils.test()
   
   // Popular dados de exemplo
   await SupabaseDB.Utils.popularDadosExemplo()
   
   // Listar clientes
   await SupabaseDB.Clientes.listar()
   ```

4. Se tudo funcionar, você verá:
   ```
   ✅ Conexão com Supabase OK!
   ✅ Empresa configurada: Salão Exemplo
   🔄 Populando dados de exemplo...
   ✅ Dados de exemplo criados com sucesso!
   ```

### 6️⃣ FUNCIONALIDADES AUTOMÁTICAS DO SUPABASE

✅ **Cálculo automático de comissões**:
- Ao criar agendamento, o trigger cria automaticamente registros financeiros
- Calcula comissão baseado em tipo (percentual ou fixo)
- Cria registro de receita e comissão separadamente

✅ **Atualização de estatísticas de cliente**:
- Ao concluir agendamento, atualiza automaticamente:
  - `total_visitas` (incrementa)
  - `total_gasto` (soma valor do serviço)
  - `ultima_visita` (atualiza data/hora)

✅ **Horários disponíveis**:
- Função `buscar_horarios_disponiveis(profissional_id, data, duracao)`
- Retorna lista de horários livres e ocupados

✅ **Views úteis**:
- `v_proximos_agendamentos` - próximos agendamentos com todos os dados
- `v_clientes_inativos` - clientes que não retornam há muito tempo

### 7️⃣ PÁGINA PÚBLICA DE AGENDAMENTO

**URL**: `agendar.html` (ou `agendar/{slug-empresa}.html` em produção)

**Fluxo**:
1. Cliente escolhe serviço
2. Cliente escolhe profissional (apenas profissionais que fazem aquele serviço)
3. Cliente escolhe data e horário (apenas horários disponíveis)
4. Cliente preenche dados (nome, telefone, email opcional)
5. Sistema busca cliente por telefone:
   - Se existir: reutiliza
   - Se não existir: cria novo
6. Sistema cria agendamento
7. Trigger automático cria registros financeiros

### 8️⃣ ESTRUTURA DE DADOS

**empresas** → Configurações do estabelecimento
**clientes** → Base de clientes (com estatísticas)
**profissionais** → Equipe (com comissões e horários)
**servicos** → Catálogo de serviços
**profissional_servico** → Relação muitos-para-muitos
**agendamentos** → Agenda completa
**financeiro** → Movimentações financeiras (criado automaticamente)
**whatsapp_automacoes** → Templates de mensagens

### 9️⃣ SEGURANÇA (PRODUÇÃO)

🔴 **ATENÇÃO**: As políticas RLS atuais permitem acesso total (desenvolvimento).

**Para produção, implemente**:
```sql
-- Políticas por empresa_id
CREATE POLICY "Usuários veem apenas sua empresa" ON clientes
  FOR ALL USING (empresa_id = auth.jwt() ->> 'empresa_id');

-- Implementar autenticação
-- Adicionar coluna user_id em empresas
-- Criar tabela de permissões
```

### 🎯 RESUMO RÁPIDO

1. ✅ Execute `supabase-setup.sql` no Supabase
2. ✅ Configure `js/supabase-config.js` com suas credenciais
3. ✅ Adicione CDN do Supabase em todos os HTMLs
4. ✅ Substitua todas as chamadas `LocalDB.*` por `SupabaseDB.*`
5. ✅ Adicione `async/await` em todas as funções que acessam dados
6. ✅ Teste com `SupabaseDB.Utils.popularDadosExemplo()`
7. ✅ Link público: `agendar.html` (configure empresa no código)

### 📊 VANTAGENS DO SUPABASE

- ✅ Dados persistem entre sessões
- ✅ Múltiplos usuários/dispositivos
- ✅ Cálculos automáticos (triggers)
- ✅ Real-time (opcional)
- ✅ Backup automático
- ✅ API REST completa
- ✅ Escalável para produção
- ✅ Grátis até 500MB

### 🚨 PROBLEMAS COMUNS

**Erro: "supabase is not defined"**
→ Adicione CDN do Supabase no HTML

**Erro: "YOUR_PROJECT_ID"**
→ Configure as credenciais em `js/supabase-config.js`

**Erro: "relation does not exist"**
→ Execute `supabase-setup.sql` no SQL Editor

**Erro: "Cannot read property 'from' of null"**
→ CDN do Supabase não foi carregado antes dos scripts locais

**Dados não aparecem**
→ Execute `await SupabaseDB.Utils.popularDadosExemplo()` no console

---

## 🎉 PRONTO PARA USO!

Após seguir este guia, você terá um sistema profissional completo com:
- ✅ Dashboard com métricas em tempo real
- ✅ Agenda visual com slots
- ✅ CRUD completo de clientes/serviços/profissionais
- ✅ Financeiro com cálculos automáticos
- ✅ Relatórios com gráficos
- ✅ Página pública de agendamento
- ✅ Estrutura para WhatsApp automações
- ✅ Dados persistentes no Supabase
