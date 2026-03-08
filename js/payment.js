/* ===================================
   RedditoApp - Payment Integration
   Mercado Pago Implementation
   =================================== */

// ========== Configuração do Mercado Pago ==========

// ⚠️ ATENÇÃO: Troque pela sua Public Key
// TESTE (desenvolvimento):
const MP_PUBLIC_KEY = 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

// PRODUÇÃO (quando for lançar):
// const MP_PUBLIC_KEY = 'APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

// Inicializar Mercado Pago SDK
let mp = null;

function initMercadoPago() {
    if (typeof MercadoPago !== 'undefined') {
        mp = new MercadoPago(MP_PUBLIC_KEY, {
            locale: 'pt-BR'
        });
        console.log('✅ Mercado Pago inicializado');
    } else {
        console.error('❌ SDK do Mercado Pago não carregado');
    }
}

// Inicializar quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMercadoPago);
} else {
    initMercadoPago();
}

// ========== Criar Preferência de Pagamento ==========
async function createPaymentPreference(planId, tenantData) {
    try {
        // Buscar dados do plano
        const plan = await getPlanById(planId);
        
        if (!plan) {
            throw new Error('Plano não encontrado');
        }
        
        const preference = {
            items: [{
                title: `RedditoApp - Plano ${plan.name}`,
                description: `Assinatura mensal do plano ${plan.name}`,
                unit_price: plan.price_monthly,
                quantity: 1,
                currency_id: 'BRL'
            }],
            payer: {
                name: tenantData.owner_name,
                email: tenantData.email,
                phone: {
                    number: tenantData.phone.replace(/\D/g, '')
                },
                address: {
                    street_name: tenantData.address
                }
            },
            back_urls: {
                success: window.location.origin + '/success.html?tenant=' + tenantData.id,
                failure: window.location.origin + '/failure.html',
                pending: window.location.origin + '/pending.html'
            },
            auto_return: 'approved',
            external_reference: tenantData.id, // ID do tenant para identificar no webhook
            notification_url: 'https://SEU-SERVIDOR.com/webhook/mercadopago', // ⚠️ Configure seu webhook
            statement_descriptor: 'REDDITOAPP',
            payment_methods: {
                excluded_payment_types: [],
                installments: 12 // Parcelamento em até 12x
            }
        };
        
        console.log('📝 Criando preferência de pagamento...', preference);
        
        // ⚠️ IMPORTANTE: Isso precisa de um backend!
        // Por enquanto, vamos simular (você precisa criar o backend)
        
        // Chamada ao seu backend (você precisa criar)
        const response = await fetch('/api/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preference)
        });
        
        if (!response.ok) {
            throw new Error('Erro ao criar preferência');
        }
        
        const data = await response.json();
        return data.preference_id;
        
    } catch (error) {
        console.error('❌ Erro ao criar preferência:', error);
        
        // Se não tiver backend ainda, mostrar instrução
        alert('⚠️ Backend de pagamento não configurado ainda!\n\n' +
              'Para processar pagamentos reais, você precisa:\n' +
              '1. Criar um servidor (Node.js)\n' +
              '2. Configurar o Mercado Pago\n' +
              '3. Implementar o endpoint /api/create-preference\n\n' +
              'Veja o arquivo INTEGRACAO_PAGAMENTO.md para instruções completas.');
        
        return null;
    }
}

// ========== Abrir Checkout do Mercado Pago ==========
async function openCheckout(planId, tenantData) {
    try {
        if (!mp) {
            throw new Error('Mercado Pago não inicializado');
        }
        
        // Mostrar loading
        showPaymentLoading('Preparando pagamento...');
        
        // Criar preferência
        const preferenceId = await createPaymentPreference(planId, tenantData);
        
        if (!preferenceId) {
            hidePaymentLoading();
            return;
        }
        
        // Opção 1: Redirecionar para checkout do Mercado Pago
        window.location.href = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`;
        
        // Opção 2: Abrir modal do Mercado Pago (requer Checkout Pro)
        // mp.checkout({
        //     preference: {
        //         id: preferenceId
        //     },
        //     autoOpen: true
        // });
        
    } catch (error) {
        console.error('❌ Erro no checkout:', error);
        hidePaymentLoading();
        alert('Erro ao abrir checkout. Tente novamente.');
    }
}

// ========== Processar Pagamento PIX ==========
async function processPixPayment(planId, tenantData) {
    try {
        showPaymentLoading('Gerando QR Code PIX...');
        
        const plan = await getPlanById(planId);
        
        const payment = {
            transaction_amount: plan.price_monthly,
            description: `RedditoApp - Plano ${plan.name}`,
            payment_method_id: 'pix',
            payer: {
                email: tenantData.email,
                first_name: tenantData.owner_name.split(' ')[0],
                last_name: tenantData.owner_name.split(' ').slice(1).join(' ')
            },
            external_reference: tenantData.id
        };
        
        // Chamar backend para gerar PIX
        const response = await fetch('/api/create-pix-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payment)
        });
        
        const data = await response.json();
        
        // Mostrar QR Code PIX
        showPixQRCode(data.qr_code, data.qr_code_base64);
        
    } catch (error) {
        console.error('❌ Erro ao gerar PIX:', error);
        hidePaymentLoading();
        alert('Erro ao gerar PIX. Tente novamente.');
    }
}

// ========== UI - Loading ==========
function showPaymentLoading(message) {
    const loading = document.createElement('div');
    loading.id = 'payment-loading';
    loading.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);">
            <div style="background: white; padding: 3rem; border-radius: 1rem; text-align: center; max-width: 400px;">
                <div class="spinner" style="width: 60px; height: 60px; border: 4px solid #f3f4f6; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <p style="margin-top: 1.5rem; font-size: 1.125rem; font-weight: 600; color: #111827;">${message}</p>
                <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">Aguarde um momento...</p>
            </div>
        </div>
    `;
    
    // Add keyframe animation
    if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(loading);
}

function hidePaymentLoading() {
    const loading = document.getElementById('payment-loading');
    if (loading) {
        loading.remove();
    }
}

// ========== UI - Modal de Opções de Pagamento ==========
function showPaymentOptions(planId, tenantData) {
    const plan = getPlanByIdSync(planId);
    
    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <button class="modal-close" onclick="closePaymentModal()">
                <i class="fas fa-times"></i>
            </button>
            
            <h2 style="margin-bottom: 1rem;">Como deseja começar?</h2>
            <p style="color: #6b7280; margin-bottom: 2rem;">Escolha a melhor opção para você</p>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <button class="payment-option-btn trial-btn" onclick="startTrial('${planId}', '${JSON.stringify(tenantData).replace(/"/g, '&quot;')}')">
                    <i class="fas fa-gift"></i>
                    <div>
                        <strong>Teste Grátis 7 Dias</strong>
                        <small>Sem cartão de crédito necessário</small>
                    </div>
                    <span class="badge-free">GRÁTIS</span>
                </button>
                
                <button class="payment-option-btn card-btn" onclick="payWithCard('${planId}', '${JSON.stringify(tenantData).replace(/"/g, '&quot;')}')">
                    <i class="fas fa-credit-card"></i>
                    <div>
                        <strong>Pagar com Cartão</strong>
                        <small>Ativar imediatamente - R$ ${plan.price_monthly.toFixed(2)}</small>
                    </div>
                    <i class="fas fa-arrow-right"></i>
                </button>
                
                <button class="payment-option-btn pix-btn" onclick="payWithPix('${planId}', '${JSON.stringify(tenantData).replace(/"/g, '&quot;')}')">
                    <i class="fas fa-qrcode"></i>
                    <div>
                        <strong>Pagar com PIX</strong>
                        <small>Aprovação instantânea - R$ ${plan.price_monthly.toFixed(2)}</small>
                    </div>
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
            
            <p style="text-align: center; margin-top: 1.5rem; font-size: 0.875rem; color: #9ca3af;">
                <i class="fas fa-lock"></i> Pagamento 100% seguro via Mercado Pago
            </p>
        </div>
    `;
    
    // Add styles
    if (!document.getElementById('payment-modal-style')) {
        const style = document.createElement('style');
        style.id = 'payment-modal-style';
        style.textContent = `
            .modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 1rem;
                backdrop-filter: blur(4px);
            }
            .modal-content {
                background: white;
                padding: 2rem;
                border-radius: 1rem;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                position: relative;
                animation: modalFadeIn 0.3s ease;
            }
            .modal-close {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #9ca3af;
                transition: color 0.2s;
            }
            .modal-close:hover {
                color: #111827;
            }
            .payment-option-btn {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1.25rem;
                background: #f9fafb;
                border: 2px solid #e5e7eb;
                border-radius: 0.75rem;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;
                width: 100%;
                font-family: inherit;
            }
            .payment-option-btn:hover {
                border-color: #6366f1;
                background: white;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                transform: translateY(-2px);
            }
            .payment-option-btn i:first-child {
                font-size: 1.5rem;
                color: #6366f1;
            }
            .payment-option-btn div {
                flex: 1;
            }
            .payment-option-btn strong {
                display: block;
                font-size: 1rem;
                color: #111827;
                margin-bottom: 0.25rem;
            }
            .payment-option-btn small {
                font-size: 0.875rem;
                color: #6b7280;
            }
            .badge-free {
                background: #10b981;
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 999px;
                font-size: 0.75rem;
                font-weight: 700;
            }
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.remove();
    }
}

// ========== Ações de Pagamento ==========
function startTrial(planId, tenantDataStr) {
    closePaymentModal();
    const tenantData = JSON.parse(tenantDataStr.replace(/&quot;/g, '"'));
    
    // Continuar com trial gratuito (fluxo atual)
    alert('✅ Você iniciou o período de teste grátis de 7 dias!\n\nNão será cobrado nada agora. Explore todos os recursos!');
    
    // Completar criação da conta normalmente
    // (já está implementado no completeOnboarding)
}

function payWithCard(planId, tenantDataStr) {
    closePaymentModal();
    const tenantData = JSON.parse(tenantDataStr.replace(/&quot;/g, '"'));
    
    // Abrir checkout com cartão
    openCheckout(planId, tenantData);
}

function payWithPix(planId, tenantDataStr) {
    closePaymentModal();
    const tenantData = JSON.parse(tenantDataStr.replace(/&quot;/g, '"'));
    
    // Processar pagamento PIX
    processPixPayment(planId, tenantData);
}

// ========== Helper Functions ==========
async function getPlanById(planId) {
    try {
        const response = await fetch(`/tables/plans?search=${planId}`);
        const data = await response.json();
        return data.data && data.data.length > 0 ? data.data[0] : null;
    } catch (error) {
        console.error('Erro ao buscar plano:', error);
        return null;
    }
}

function getPlanByIdSync(planId) {
    // Para uso síncrono (busca no state global se disponível)
    const plans = [
        { id: 'plan_basic', name: 'Básico', price_monthly: 79.90 },
        { id: 'plan_pro', name: 'Profissional', price_monthly: 149.90 },
        { id: 'plan_enterprise', name: 'Enterprise', price_monthly: 299.90 }
    ];
    return plans.find(p => p.id === planId) || plans[1];
}

// ========== Exportar Funções ==========
window.RedditoPayment = {
    openCheckout,
    showPaymentOptions,
    startTrial,
    payWithCard,
    payWithPix,
    closePaymentModal
};