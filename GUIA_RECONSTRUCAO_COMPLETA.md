# 🔧 GUIA DE RECONSTRUÇÃO COMPLETA - BANCO PADRONIZADO

## ✅ ARQUIVOS CRIADOS

1. **`supabase-schema-padronizado.sql`** - Schema limpo apenas com tabelas em português
2. **`js/auth.js`** - Autenticação e gerenciamento de tenant_id
3. **`js/database.js`** - CRUD 100% Supabase com tabelas padronizadas

---

## 📋 IMPLEMENTAÇÃO PASSO A PASSO

### **PASSO 1: LIMPAR E RECRIAR BANCO** ⚠️ OBRIGATÓRIO

1. Acesse: https://app.supabase.com/project/tnbdfoanjvrepgdmdakahjcd/sql
2. Abra o arquivo `supabase-schema-padronizado.sql`
3. Copie **TODO** o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **RUN**
6. Aguarde "Success. No rows returned"

**O que isso faz:**
- ❌ Remove tabelas antigas (clients, services, appointments, profissionals)
- ✅ Cria tabelas padronizadas (clientes, servicos, profissionais, agendamentos)
- ✅ Configura RLS com tenant_id
- ✅ Cria views úteis (v_agendamentos_completos, v_financeiro_diario)

---

### **PASSO 2: ATUALIZAR SCRIPTS EM TODAS AS PÁGINAS**

**Em TODAS as páginas HTML**, substitua:

❌ **REMOVER:**
```html
<script src="js/local-db.js"></script>
<script src="js/supabase-db.js"></script>
<script src="js/db.js"></script>
```

✅ **ADICIONAR (nesta ordem):**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>
<script src="js/auth.js"></script>
<script src="js/database.js"></script>
<script src="js/pro-ui.js"></script>
```

**Páginas que precisam ser atualizadas:**
- dashboard.html
- agenda.html
- clientes.html
- servicos.html
- profissionais.html
- financeiro.html
- relatorios.html
- whatsapp.html
- configuracoes.html

---

### **PASSO 3: CRIAR PÁGINA DE LOGIN**

Crie `index.html` ou `login.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Login - Sistema Pro</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/supabase-config.js"></script>
    <script src="js/auth.js"></script>
    <style>
        body {
            font-family: sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
        }
        h1 { margin-bottom: 30px; color: #333; }
        input {
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-bottom: 10px;
        }
        button:hover { background: #5568d3; }
        .link {
            text-align: center;
            margin-top: 15px;
            color: #666;
            cursor: pointer;
        }
        .link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Login</h1>
        <form id="loginForm">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="password" placeholder="Senha" required>
            <button type="submit">Entrar</button>
        </form>
        <div class="link" onclick="mostrarCadastro()">Criar nova conta</div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const resultado = await Auth.signIn(email, password);

            if (resultado.success) {
                alert('Login realizado!');
                window.location.href = '/dashboard.html';
            } else {
                alert('Erro: ' + resultado.error);
            }
        });

        function mostrarCadastro() {
            const email = prompt('Digite seu email:');
            if (!email) return;
            
            const password = prompt('Digite sua senha (mínimo 6 caracteres):');
            if (!password || password.length < 6) {
                alert('Senha deve ter no mínimo 6 caracteres');
                return;
            }

            Auth.signUp(email, password).then(resultado => {
                if (resultado.success) {
                    alert('Conta criada! Verifique seu email para confirmar e depois faça login.');
                } else {
                    alert('Erro: ' + resultado.error);
                }
            });
        }
    </script>
</body>
</html>
```

---

### **PASSO 4: ATUALIZAR CÓDIGO DAS PÁGINAS**

#### **4.1 Clientes (clientes.html)**

```javascript
// Carregar lista
async function carregarClientes() {
    const clientes = await DB.clientes.listar();
    renderizarClientes(clientes);
}

// Criar cliente
async function salvarCliente() {
    const dados = {
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        email: document.getElementById('email').value
    };
    
    const resultado = await DB.clientes.criar(dados);
    if (resultado.success) {
        alert('Cliente criado!');
        await carregarClientes();
    }
}

// Atualizar cliente
async function atualizarCliente(id) {
    const dados = {
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        email: document.getElementById('email').value
    };
    
    const resultado = await DB.clientes.atualizar(id, dados);
    if (resultado.success) {
        alert('Cliente atualizado!');
        await carregarClientes();
    }
}

// Excluir cliente
async function excluirCliente(id) {
    if (!confirm('Deseja excluir este cliente?')) return;
    
    const resultado = await DB.clientes.excluir(id);
    if (resultado.success) {
        alert('Cliente excluído!');
        await carregarClientes();
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', carregarClientes);
```

#### **4.2 Serviços (servicos.html)**

```javascript
async function carregarServicos() {
    const servicos = await DB.servicos.listar();
    renderizarServicos(servicos);
}

async function salvarServico() {
    const dados = {
        nome: document.getElementById('nome').value,
        preco: document.getElementById('preco').value,
        duracao: document.getElementById('duracao').value
    };
    
    const resultado = await DB.servicos.criar(dados);
    if (resultado.success) {
        alert('Serviço criado!');
        await carregarServicos();
    }
}

document.addEventListener('DOMContentLoaded', carregarServicos);
```

#### **4.3 Profissionais (profissionais.html)**

```javascript
async function carregarProfissionais() {
    const profissionais = await DB.profissionais.listar();
    renderizarProfissionais(profissionais);
}

async function salvarProfissional() {
    const dados = {
        nome: document.getElementById('nome').value,
        comissao_percentual: document.getElementById('comissao').value,
        cor_agenda: document.getElementById('cor').value
    };
    
    const resultado = await DB.profissionais.criar(dados);
    if (resultado.success) {
        alert('Profissional criado!');
        await carregarProfissionais();
    }
}

document.addEventListener('DOMContentLoaded', carregarProfissionais);
```

#### **4.4 Agenda (agenda.html)** ⚠️ IMPORTANTE

```javascript
async function carregarAgenda() {
    const hoje = new Date().toISOString().split('T')[0];
    const agendamentos = await DB.agendamentos.listarPorData(hoje);
    renderizarAgenda(agendamentos);
}

async function carregarDropdowns() {
    // Carregar clientes
    const clientes = await DB.clientes.listar();
    const selectCliente = document.getElementById('cliente_id');
    clientes.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.nome;
        selectCliente.appendChild(option);
    });
    
    // Carregar serviços
    const servicos = await DB.servicos.listar();
    const selectServico = document.getElementById('servico_id');
    servicos.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.nome} - R$ ${s.preco}`;
        selectServico.appendChild(option);
    });
    
    // Carregar profissionais
    const profissionais = await DB.profissionais.listar();
    const selectProfissional = document.getElementById('profissional_id');
    profissionais.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nome;
        selectProfissional.appendChild(option);
    });
}

async function salvarAgendamento() {
    const dados = {
        cliente_id: document.getElementById('cliente_id').value,
        servico_id: document.getElementById('servico_id').value,
        profissional_id: document.getElementById('profissional_id').value,
        data: document.getElementById('data').value,
        hora: document.getElementById('hora').value,
        valor: parseFloat(document.getElementById('valor').value),
        status: 'confirmado'
    };
    
    const resultado = await DB.agendamentos.criar(dados);
    if (resultado.success) {
        alert('Agendamento criado com sucesso!');
        await carregarAgenda();
        fecharModal();
    } else {
        alert('Erro: ' + resultado.error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await carregarDropdowns();
    await carregarAgenda();
});
```

#### **4.5 Dashboard (dashboard.html)**

```javascript
async function carregarDashboard() {
    const stats = await DB.dashboard.estatisticas();
    
    document.getElementById('totalClientes').textContent = stats.totalClientes;
    document.getElementById('totalServicos').textContent = stats.totalServicos;
    document.getElementById('totalProfissionais').textContent = stats.totalProfissionais;
    document.getElementById('agendamentosHoje').textContent = stats.agendamentosHoje;
    document.getElementById('faturamentoDia').textContent = 'R$ ' + stats.faturamentoDia.toFixed(2);
    document.getElementById('faturamentoMes').textContent = 'R$ ' + stats.faturamentoMes.toFixed(2);
}

document.addEventListener('DOMContentLoaded', carregarDashboard);
```

#### **4.6 Financeiro (financeiro.html)**

```javascript
async function carregarFinanceiro() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    
    // Resumo do mês
    const resumo = await DB.financeiro.faturamentoMes(ano, mes);
    
    document.getElementById('faturamentoBruto').textContent = 'R$ ' + resumo.faturamentoBruto.toFixed(2);
    document.getElementById('totalComissoes').textContent = 'R$ ' + resumo.totalComissoes.toFixed(2);
    document.getElementById('lucroLiquido').textContent = 'R$ ' + resumo.lucroLiquido.toFixed(2);
    document.getElementById('totalAgendamentos').textContent = resumo.totalAgendamentos;
    
    // Por profissional
    const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`;
    
    const porProfissional = await DB.financeiro.porProfissional(primeiroDia, dataFim);
    
    const tbody = document.getElementById('tabelaFinanceiro');
    tbody.innerHTML = '';
    
    porProfissional.forEach(prof => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${prof.nome}</td>
            <td>${prof.totalAgendamentos}</td>
            <td>R$ ${prof.faturamento.toFixed(2)}</td>
            <td>R$ ${prof.comissao.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', carregarFinanceiro);
```

---

### **PASSO 5: TESTAR PERSISTÊNCIA** ✅ OBRIGATÓRIO

#### **Teste 1: Criar dados via console**
```javascript
// Abra o console (F12) em qualquer página do sistema

// 1. Criar cliente
await DB.clientes.criar({ 
    nome: 'João Silva', 
    telefone: '11999990000', 
    email: 'joao@email.com' 
});

// 2. Criar serviço
await DB.servicos.criar({ 
    nome: 'Corte de Cabelo', 
    preco: 50, 
    duracao: 30 
});

// 3. Criar profissional
await DB.profissionais.criar({ 
    nome: 'Ana Costa', 
    comissao_percentual: 40, 
    cor_agenda: '#FF6B6B' 
});

// 4. Listar para pegar IDs
const clientes = await DB.clientes.listar();
const servicos = await DB.servicos.listar();
const profissionais = await DB.profissionais.listar();

console.log('Cliente ID:', clientes[0].id);
console.log('Serviço ID:', servicos[0].id);
console.log('Profissional ID:', profissionais[0].id);

// 5. Criar agendamento (substitua os IDs)
await DB.agendamentos.criar({
    cliente_id: 'cole-id-do-cliente-aqui',
    servico_id: 'cole-id-do-servico-aqui',
    profissional_id: 'cole-id-do-profissional-aqui',
    data: '2026-03-10',
    hora: '14:00',
    valor: 50,
    status: 'confirmado'
});
```

#### **Teste 2: Recarregar página**
- Pressione **F5**
- Execute novamente: `await DB.clientes.listar()`
- Os dados devem estar lá! ✅

#### **Teste 3: Limpar cookies**
- Pressione **Ctrl+Shift+Delete**
- Limpe todos os cookies
- Faça login novamente
- Execute: `await DB.clientes.listar()`
- Os dados ainda devem estar lá! ✅

#### **Teste 4: Verificar isolamento**
- Crie outra conta (outro email)
- Faça login com a nova conta
- Execute: `await DB.clientes.listar()`
- Deve retornar **array vazio** (novo tenant não vê dados do outro) ✅

---

## 🚫 PROIBIÇÕES

**NUNCA USAR:**
- ❌ `localStorage.setItem()`
- ❌ `sessionStorage.setItem()`
- ❌ Arrays em memória
- ❌ Dados mockados/fixos
- ❌ Tabelas antigas (clients, services, appointments, profissionals)

**SEMPRE USAR:**
- ✅ `await DB.clientes.listar()`
- ✅ `await DB.servicos.criar(dados)`
- ✅ `await DB.agendamentos.listarPorData(data)`
- ✅ Apenas tabelas em português

---

## 🎯 CHECKLIST FINAL

- [ ] SQL executado no Supabase
- [ ] Tabelas antigas removidas
- [ ] Tabelas novas criadas (clientes, servicos, profissionais, agendamentos)
- [ ] Scripts atualizados em todas as páginas
- [ ] Página de login criada
- [ ] Código das páginas atualizado
- [ ] Teste 1 executado (criar dados)
- [ ] Teste 2 executado (recarregar página)
- [ ] Teste 3 executado (limpar cookies)
- [ ] Teste 4 executado (isolamento de dados)
- [ ] Sistema 100% persistente funcionando

---

## 🎉 RESULTADO ESPERADO

✅ Dados salvos no Supabase  
✅ Recarregar mantém dados  
✅ Limpar cookies mantém dados (após login)  
✅ Cada usuário vê apenas seus dados  
✅ Agendamentos funcionando  
✅ Financeiro calculado automaticamente  
✅ Zero uso de LocalStorage  
✅ Sistema pronto para produção  

**Sucesso! Sistema reconstruído com banco padronizado! 🚀**
