// ============================================
// REDDITOAPP - MÓDULO DE PAGAMENTOS MERCADO PAGO
// ============================================

class MercadoPagoPayment {
    constructor() {
        this.mp = null;
        this.initialized = false;
        this.pendingPayments = new Map(); // Armazenar pagamentos pendentes
    }
    
    // Inicializar SDK do Mercado Pago
    async initialize() {
        if (this.initialized) {
            console.log('✅ Mercado Pago já inicializado');
            return;
        }
        
        try {
            // Verificar se o SDK está carregado
            if (typeof MercadoPago === 'undefined') {
                throw new Error('SDK do Mercado Pago não está carregado. Adicione <script src="https://sdk.mercadopago.com/js/v2"></script> no HTML.');
            }
            
            const credentials = PaymentConfig.getCredentials();
            
            // Validar credenciais
            if (!credentials.publicKey || credentials.publicKey.includes('xxxxxxxx')) {
                console.warn('⚠️ Credenciais do Mercado Pago não configuradas. Configure em js/payment-config.js');
                // Continuar para permitir testes da interface
            }
            
            this.mp = new MercadoPago(credentials.publicKey, {
                locale: 'pt-BR'
            });
            
            this.initialized = true;
            console.log('✅ Mercado Pago inicializado -', PaymentConfig.isProduction() ? 'PRODUÇÃO' : 'SANDBOX');
        } catch (error) {
            console.error('❌ Erro ao inicializar Mercado Pago:', error);
            throw error;
        }
    }
    
    // Criar pagamento único (para compras avulsas)
    async createPayment(planId) {
        await this.initialize();
        
        const plan = PaymentConfig.getPlan(planId);
        if (!plan) {
            throw new Error('Plano não encontrado: ' + planId);
        }
        
        const preference = {
            items: [{
                title: plan.name + ' - RedditoApp',
                description: plan.features.join(' | '),
                quantity: 1,
                currency_id: 'BRL',
                unit_price: plan.price
            }],
            back_urls: {
                success: window.location.origin + '/payment-success.html?plan=' + planId,
                failure: window.location.origin + '/payment-failure.html?plan=' + planId,
                pending: window.location.origin + '/payment-pending.html?plan=' + planId
            },
            auto_return: 'approved',
            notification_url: PaymentConfig.webhookUrl,
            statement_descriptor: 'REDDITOAPP',
            metadata: {
                tenant_id: AppState.currentTenant?.id || 'new_signup',
                user_id: AppState.currentUser?.id || 'new_user',
                plan_id: planId,
                app: 'redditoapp',
                version: '3.0.0'
            },
            external_reference: 'RDA-' + Date.now(), // Referência única
            expires: true,
            expiration_date_from: new Date().toISOString(),
            expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
        };
        
        try {
            console.log('📤 Criando preferência de pagamento...', preference);
            const response = await this.createPreference(preference);
            console.log('✅ Preferência criada:', response.id);
            return response.init_point; // URL de checkout
        } catch (error) {
            console.error('❌ Erro ao criar pagamento:', error);
            throw error;
        }
    }
    
    // Criar assinatura recorrente (recomendado para SaaS)
    async createSubscription(planId) {
        await this.initialize();
        
        const plan = PaymentConfig.getPlan(planId);
        if (!plan) {
            throw new Error('Plano não encontrado: ' + planId);
        }
        
        const tenantId = AppState.signupData?.business_name 
            ? 'TNT-' + AppState.signupData.business_name.toLowerCase().replace(/\s/g, '-') + '-' + Date.now()
            : 'TNT-' + Date.now();
        
        const subscriptionData = {
            reason: plan.name + ' - RedditoApp',
            auto_recurring: {
                frequency: plan.interval === 'monthly' ? 1 : 12,
                frequency_type: 'months',
                transaction_amount: plan.price,
                currency_id: 'BRL',
                free_trial: {
                    frequency: plan.trial_days,
                    frequency_type: 'days'
                }
            },
            back_url: window.location.origin + '/payment-success.html?subscription=true&plan=' + planId + '&tenant=' + tenantId,
            payer_email: AppState.signupData?.owner_email || AppState.currentUser?.email,
            status: 'pending',
            external_reference: 'RDA-SUB-' + Date.now(),
            metadata: {
                tenant_id: tenantId,
                user_id: AppState.signupData?.owner_email || 'new_user',
                plan_id: planId,
                app: 'redditoapp',
                version: '3.0.0',
                trial_days: plan.trial_days
            }
        };
        
        try {
            console.log('📤 Criando assinatura recorrente...', subscriptionData);
            const response = await this.createSubscriptionPreference(subscriptionData);
            console.log('✅ Assinatura criada:', response.id);
            
            // Salvar dados localmente para recuperar após pagamento
            this.saveSubscriptionData(response.id, {
                subscription_id: response.id,
                plan_id: planId,
                tenant_id: tenantId,
                created_at: Date.now()
            });
            
            return response.init_point; // URL de checkout
        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error);
            throw error;
        }
    }
    
    // Criar preferência de pagamento (API Mercado Pago)
    async createPreference(preferenceData) {
        const credentials = PaymentConfig.getCredentials();
        
        // Validar se está configurado
        if (!credentials.accessToken || credentials.accessToken.includes('xxxxxxxx')) {
            // Modo simulação - retornar URL fake
            console.warn('⚠️ Modo simulação - Access Token não configurado');
            return {
                id: 'PREF-SIMULATED-' + Date.now(),
                init_point: window.location.origin + '/payment-success.html?simulation=true&plan=' + preferenceData.metadata.plan_id
            };
        }
        
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.accessToken}`
            },
            body: JSON.stringify(preferenceData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error('Erro API Mercado Pago:', error);
            throw new Error('Erro ao criar preferência: ' + (error.message || response.statusText));
        }
        
        return await response.json();
    }
    
    // Criar preferência de assinatura (API Mercado Pago)
    async createSubscriptionPreference(subscriptionData) {
        const credentials = PaymentConfig.getCredentials();
        
        // Validar se está configurado
        if (!credentials.accessToken || credentials.accessToken.includes('xxxxxxxx')) {
            // Modo simulação - retornar URL fake
            console.warn('⚠️ Modo simulação - Access Token não configurado');
            return {
                id: 'SUB-SIMULATED-' + Date.now(),
                init_point: window.location.origin + '/payment-success.html?simulation=true&subscription=true&plan=' + subscriptionData.metadata.plan_id
            };
        }
        
        const response = await fetch('https://api.mercadopago.com/preapproval', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.accessToken}`
            },
            body: JSON.stringify(subscriptionData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error('Erro API Mercado Pago (assinatura):', error);
            throw new Error('Erro ao criar assinatura: ' + (error.message || response.statusText));
        }
        
        return await response.json();
    }
    
    // Cancelar assinatura
    async cancelSubscription(subscriptionId) {
        const credentials = PaymentConfig.getCredentials();
        
        const response = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.accessToken}`
            },
            body: JSON.stringify({ 
                status: 'cancelled',
                reason: 'Cancelamento solicitado pelo cliente'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error('Erro ao cancelar assinatura: ' + (error.message || response.statusText));
        }
        
        console.log('✅ Assinatura cancelada:', subscriptionId);
        return await response.json();
    }
    
    // Consultar status de pagamento
    async getPaymentStatus(paymentId) {
        const credentials = PaymentConfig.getCredentials();
        
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${credentials.accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao consultar pagamento');
        }
        
        return await response.json();
    }
    
    // Consultar status de assinatura
    async getSubscriptionStatus(subscriptionId) {
        const credentials = PaymentConfig.getCredentials();
        
        const response = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${credentials.accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao consultar assinatura');
        }
        
        return await response.json();
    }
    
    // Salvar dados da assinatura localmente
    saveSubscriptionData(subscriptionId, data) {
        const subscriptions = JSON.parse(localStorage.getItem('redditoapp_subscriptions') || '{}');
        subscriptions[subscriptionId] = {
            ...data,
            saved_at: Date.now()
        };
        localStorage.setItem('redditoapp_subscriptions', JSON.stringify(subscriptions));
        console.log('💾 Dados da assinatura salvos localmente:', subscriptionId);
    }
    
    // Recuperar dados da assinatura
    getSubscriptionData(subscriptionId) {
        const subscriptions = JSON.parse(localStorage.getItem('redditoapp_subscriptions') || '{}');
        return subscriptions[subscriptionId] || null;
    }
    
    // Atualizar status da assinatura no banco de dados
    async updateSubscriptionStatus(tenantId, status, subscriptionId) {
        try {
            const response = await fetch(`tables/tenants/${tenantId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_status: status,
                    subscription_id: subscriptionId,
                    last_payment_at: Date.now(),
                    updated_at: Date.now()
                })
            });
            
            if (response.ok) {
                console.log('✅ Status da assinatura atualizado no banco:', status);
                return await response.json();
            } else {
                console.error('❌ Erro ao atualizar status no banco');
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar assinatura:', error);
        }
    }
    
    // Verificar se trial expirou
    isTrialExpired(trialEndsAt) {
        return Date.now() > trialEndsAt;
    }
    
    // Calcular dias restantes de trial
    getTrialDaysRemaining(trialEndsAt) {
        const remaining = trialEndsAt - Date.now();
        return Math.ceil(remaining / (24 * 60 * 60 * 1000));
    }
}

// Instância global do módulo de pagamentos
const mpPayment = new MercadoPagoPayment();

// Auto-inicializar quando a página carregar
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Verificar se estamos em uma página que precisa de pagamentos
        const needsPayment = window.location.hash.includes('signup') || 
                            window.location.pathname.includes('payment');
        
        if (needsPayment) {
            mpPayment.initialize().catch(err => {
                console.warn('Não foi possível inicializar Mercado Pago:', err.message);
            });
        }
    });
}

console.log('✅ Módulo MercadoPagoPayment carregado');
