// ============================================
// REDDITOAPP - CONFIGURAÇÃO DE PAGAMENTOS
// ============================================

const PaymentConfig = {
    // Ambiente (alterar para 'production' ao lançar)
    environment: 'sandbox', // 'sandbox' ou 'production'
    
    // Credenciais Sandbox (TESTE) - Mercado Pago
    // Obtenha suas credenciais em: https://www.mercadopago.com.br/developers/panel/app
    sandbox: {
        publicKey: 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Substituir pela sua Public Key de teste
        accessToken: 'TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxx' // Substituir pelo seu Access Token de teste
    },
    
    // Credenciais Produção (REAL) - Mercado Pago
    production: {
        publicKey: 'APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Substituir pela sua Public Key de produção
        accessToken: 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxx' // Substituir pelo seu Access Token de produção
    },
    
    // Webhook URL (onde receber notificações de pagamento)
    // IMPORTANTE: Webhook requer servidor backend (AWS Lambda, Vercel Functions, etc.)
    webhookUrl: 'https://seu-servidor.com/webhooks/mercadopago',
    
    // Planos do RedditoApp
    plans: {
        basico_mensal: {
            id: 'basico_mensal',
            name: 'Básico Mensal',
            price: 79.90,
            interval: 'monthly',
            interval_count: 1,
            trial_days: 7,
            features: [
                'Até 2 profissionais',
                '500 agendamentos/mês',
                'Suporte por e-mail',
                'App mobile básico'
            ],
            recommended: false
        },
        basico_anual: {
            id: 'basico_anual',
            name: 'Básico Anual',
            price: 799.00,
            interval: 'yearly',
            interval_count: 1,
            trial_days: 7,
            features: [
                'Até 2 profissionais',
                '500 agendamentos/mês',
                'Suporte por e-mail',
                'App mobile básico',
                '💰 Economize 2 meses (R$ 160)'
            ],
            discount_percent: 16,
            recommended: false
        },
        profissional_mensal: {
            id: 'profissional_mensal',
            name: 'Profissional Mensal',
            price: 149.90,
            interval: 'monthly',
            interval_count: 1,
            trial_days: 7,
            features: [
                'Até 5 profissionais',
                'Agendamentos ilimitados',
                'Automação WhatsApp',
                'Relatórios avançados',
                'Suporte prioritário',
                'App mobile completo'
            ],
            recommended: true
        },
        profissional_anual: {
            id: 'profissional_anual',
            name: 'Profissional Anual',
            price: 1499.00,
            interval: 'yearly',
            interval_count: 1,
            trial_days: 7,
            features: [
                'Até 5 profissionais',
                'Agendamentos ilimitados',
                'Automação WhatsApp',
                'Relatórios avançados',
                'Suporte prioritário',
                'App mobile completo',
                '💰 Economize 2 meses (R$ 300)'
            ],
            discount_percent: 16,
            recommended: true
        },
        enterprise_mensal: {
            id: 'enterprise_mensal',
            name: 'Enterprise Mensal',
            price: 299.90,
            interval: 'monthly',
            interval_count: 1,
            trial_days: 7,
            features: [
                '✨ Profissionais ilimitados',
                '✨ Multi-unidade',
                '✨ API personalizada',
                '✨ White-label',
                '✨ Suporte 24/7',
                '✨ Gestor de contas dedicado'
            ],
            recommended: false
        },
        enterprise_anual: {
            id: 'enterprise_anual',
            name: 'Enterprise Anual',
            price: 2999.00,
            interval: 'yearly',
            interval_count: 1,
            trial_days: 7,
            features: [
                '✨ Profissionais ilimitados',
                '✨ Multi-unidade',
                '✨ API personalizada',
                '✨ White-label',
                '✨ Suporte 24/7',
                '✨ Gestor de contas dedicado',
                '💰 Economize 2 meses (R$ 600)'
            ],
            discount_percent: 16,
            recommended: false
        }
    },
    
    // Métodos de pagamento disponíveis
    paymentMethods: {
        credit_card: {
            enabled: true,
            label: 'Cartão de Crédito',
            icon: 'fa-credit-card'
        },
        pix: {
            enabled: true,
            label: 'PIX',
            icon: 'fa-qrcode'
        },
        boleto: {
            enabled: true,
            label: 'Boleto',
            icon: 'fa-barcode'
        }
    },
    
    // Obter credenciais ativas baseado no ambiente
    getCredentials() {
        return this.environment === 'production' ? this.production : this.sandbox;
    },
    
    // Obter plano por ID
    getPlan(planId) {
        return this.plans[planId] || null;
    },
    
    // Obter todos os planos de um intervalo
    getPlansByInterval(interval) {
        return Object.values(this.plans).filter(plan => plan.interval === interval);
    },
    
    // Validar se está em modo de produção
    isProduction() {
        return this.environment === 'production';
    },
    
    // Formatar preço BRL
    formatPrice(price) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(price);
    }
};

// Cartões de teste Mercado Pago
// Use estes cartões no ambiente sandbox para simular pagamentos
const TestCards = {
    approved: {
        number: '5031 4332 1540 6351',
        cvv: '123',
        expiry: '11/25',
        name: 'APRO',
        description: 'Pagamento aprovado'
    },
    rejected: {
        number: '5031 4332 1540 6351',
        cvv: '123',
        expiry: '11/25',
        name: 'OTHE',
        description: 'Pagamento rejeitado'
    },
    pending: {
        number: '5031 4332 1540 6351',
        cvv: '123',
        expiry: '11/25',
        name: 'CONT',
        description: 'Pagamento pendente'
    },
    insufficient_funds: {
        number: '5031 4332 1540 6351',
        cvv: '123',
        expiry: '11/25',
        name: 'FUND',
        description: 'Fundos insuficientes'
    }
};

console.log('✅ PaymentConfig carregado - Ambiente:', PaymentConfig.environment);
