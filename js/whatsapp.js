// js/whatsapp.js
// Integração com Evolution API - tenta usar proxy backend seguro em /api/evolution/*
// Se o proxy não existir, (APENAS PARA TESTE) tenta conectar diretamente à EVOLUTION_URL
// Ajuste EVOLUTION_URL apenas para testes (NÃO COLOQUE CHAVES NO FRONTEND).

const USE_DIRECT_EVOLUTION_FALLBACK = false; // deixar false em produção
const DIRECT_EVOLUTION_URL = "https://evolution-api-production-692fd.up.railway.app"; // sua URL evolution (apenas teste)

// === ALTERE AQUI SE MUDAR O HOST DO BACKEND (Railway) ===
const PROXY_BASE = "https://reddito-production.up.railway.app";
// =======================================================

// utilitários DOM
function $id(id){ return document.getElementById(id); }

// perfil carregado por auth-guard.js será armazenado aqui
let perfilLocal = null;
let perfilPromiseResolve = null;
let perfilPromise = new Promise((resolve) => { perfilPromiseResolve = resolve; });

// escuta o evento global disparado por auth-guard.js (ou por auth.js)
window.addEventListener("perfilCarregado", (e) => {
  try {
    perfilLocal = e?.detail || null;
    console.log("✅ [WhatsApp] perfilCarregado recebido:", perfilLocal);
  } catch (err) {
    perfilLocal = null;
  }
  if (perfilPromiseResolve) {
    perfilPromiseResolve(perfilLocal);
    // evita re-resolver no futuro, mantemos a promise resolvida
    perfilPromiseResolve = null;
  }
});

// tenta obter tenantId; espera pelo evento perfilCarregado por até 'timeoutMs'
async function getTenantIdFromFrontend(timeoutMs = 5000) {
  // checa global window.perfil (compatibilidade)
  if (window.perfil && (window.perfil.tenant_id || window.perfil.id)) {
    return window.perfil.tenant_id || window.perfil.id;
  }
  // checa variável local já recebida
  if (perfilLocal && (perfilLocal.tenant_id || perfilLocal.id)) {
    return perfilLocal.tenant_id || perfilLocal.id;
  }

  // se tiver função getTenantId definida no frontend (compatibilidade)
  if (typeof getTenantId === 'function') {
    try {
      const val = await Promise.race([
        getTenantId(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout_getTenantId')), timeoutMs))
      ]);
      if (val) return val;
    } catch (e) { /* continua para aguardar evento */ }
  }

  // aguarda evento perfilCarregado até timeout
  try {
    const p = perfilPromise || new Promise((resolve) => { perfilPromiseResolve = resolve; });
    const val = await Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout_perfil')), timeoutMs))
    ]);
    if (val && (val.tenant_id || val.id)) return val.tenant_id || val.id;
  } catch (e) {
    // timeout ou erro - retorna null
  }

  return null;
}

// Faz fetch e tenta parsear JSON; retorna objeto com parsed JSON ou { ok:false, raw, status }
async function fetchJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { ok: false, raw: text, status: res.status };
    }
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

// Prefixa base64 com data URL se necessário
function toDataUrl(maybeBase64) {
  if (!maybeBase64) return null;
  if (maybeBase64.startsWith('data:')) return maybeBase64;
  // assume PNG se não vier com prefixo
  return `data:image/png;base64,${maybeBase64}`;
}

let isConnecting = false;

async function startConnectFlow() {
  if (isConnecting) {
    console.log('[WhatsApp] Já há tentativa de conexão em andamento.');
    return;
  }
  isConnecting = true;

  const btn = $id('btnConnect');
  const qrImg = $id('qrImage');
  const qrPlaceholder = $id('qrPlaceholder');
  const statusValue = $id('statusValue');
  const logText = $id('logText');

  // valida elementos mínimos - se não existirem, tenta continuar mas loga
  if (!btn) {
    console.error('[WhatsApp] Botão btnConnect não encontrado.');
  }
  if (!qrImg) console.warn('[WhatsApp] qrImage não encontrado.');
  if (!qrPlaceholder) console.warn('[WhatsApp] qrPlaceholder não encontrado.');
  if (!statusValue) console.warn('[WhatsApp] statusValue não encontrado.');

  try {
    if (btn) {
      btn.disabled = true;
      btn.dataset.origText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inicializando...';
    }
    if (statusValue) statusValue.textContent = 'Inicializando...';
    if (qrImg) qrImg.style.display = 'none';
    if (qrPlaceholder) { qrPlaceholder.style.display = 'block'; qrPlaceholder.textContent = 'Gerando QR...'; }

    // tenta obter tenantId (espera até 5s por padrão)
    const tenantId = await getTenantIdFromFrontend(5000);
    if (!tenantId) {
      const msg = 'Erro: tenant não identificado';
      console.error('[WhatsApp] ' + msg);
      if (statusValue) statusValue.textContent = msg;
      if (logText) logText.textContent = 'tenant_id ausente. Verifique se o perfil foi carregado corretamente.';
      return;
    }

    if (statusValue) statusValue.textContent = 'Iniciando conexão para tenant: ' + tenantId;
    if (logText) logText.textContent = `Solicitando criação de instância para tenant ${tenantId}...`;

    // 1) Tenta usar o proxy backend seguro (recomendado)
    try {
      const proxyCreate = await fetchJson(`${PROXY_BASE}/api/evolution/instance/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ instanceName: tenantId, token: tenantId, qrcode: true })
      });

      // proxyCreate pode vir como { ok:false, status:404 } caso rota não exista
      if (proxyCreate && proxyCreate.status === 404) {
        throw new Error('proxy_not_found');
      }

      // deu certo criar/ensuring instance no proxy - agora pedimos conexão (connect)
      if (logText) logText.textContent = 'Instância solicitada ao proxy. Aguardando QR...';

      // permitir que o backend gere o QR e retorne (alguns backends geram async, então podemos tentar 2-3x)
      let proxyConnect = await fetchJson(`${PROXY_BASE}/api/evolution/instance/connect/${tenantId}`, { method: 'GET' });

      // se o proxy retornar um status indicando que ainda não tem QR, podemos fazer retry curto
      let retries = 0;
      while (retries < 4 && !(proxyConnect && (proxyConnect.base64 || proxyConnect.qrcode))) {
        retries++;
        await new Promise(r => setTimeout(r, 800)); // aguarda 800ms
        proxyConnect = await fetchJson(`${PROXY_BASE}/api/evolution/instance/connect/${tenantId}`, { method: 'GET' });
      }

      const base64FromProxy = (proxyConnect && (proxyConnect.base64 || proxyConnect.qrcode)) ? (proxyConnect.base64 || proxyConnect.qrcode) : null;
      if (base64FromProxy) {
        const dataUrl = toDataUrl(base64FromProxy);
        if (qrPlaceholder) qrPlaceholder.style.display = 'none';
        if (qrImg) {
          qrImg.src = dataUrl;
          qrImg.style.display = 'block';
        }
        if (statusValue) statusValue.textContent = 'QR gerado — escaneie com WhatsApp';
        if (logText) logText.textContent = 'QR recebido do proxy backend.';
        return;
      } else {
        // proxy respondeu, mas sem QR; exibe para debug
        if (logText) logText.textContent = 'Resposta proxy sem QR: ' + JSON.stringify(proxyConnect || proxyCreate);
        console.warn('[WhatsApp] Proxy respondeu sem QR:', proxyConnect || proxyCreate);
        // segue para fallback direto se configurado
      }
    } catch (err) {
      console.warn('[WhatsApp] Proxy backend não disponível ou retornou erro:', err?.message || err);
      if (logText) logText.textContent = 'Proxy indisponível: ' + (err?.message || String(err));
      // continua para fallback direto se permitido
    }

    // 2) FALLBACK DIRETO (APENAS PARA TESTE) — NÃO COLOCAR CHAVE EM PRODUÇÃO
    if (USE_DIRECT_EVOLUTION_FALLBACK) {
      try {
        if (statusValue) statusValue.textContent = 'Usando fallback direto (teste)';
        if (logText) logText.textContent = 'Tentando comunicação direta com Evolution (fallback).';

        const evoCreate = await fetchJson(`${DIRECT_EVOLUTION_URL}/instance/create`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'apikey': window.EVOLUTION_API_KEY || ''},
          body: JSON.stringify({ instanceName: tenantId, token: tenantId, qrcode: true })
        });

        // aguarda um pouco e tenta obter o QR
        let evoQr = await fetchJson(`${DIRECT_EVOLUTION_URL}/instance/connect/${tenantId}`, {
          method: 'GET',
          headers: {'apikey': window.EVOLUTION_API_KEY || ''}
        });

        let retriesDirect = 0;
        while (retriesDirect < 4 && !(evoQr && (evoQr.base64 || evoQr.qrcode))) {
          retriesDirect++;
          await new Promise(r => setTimeout(r, 800));
          evoQr = await fetchJson(`${DIRECT_EVOLUTION_URL}/instance/connect/${tenantId}`, {
            method: 'GET',
            headers: {'apikey': window.EVOLUTION_API_KEY || ''}
          });
        }

        const base64FromEvo = (evoQr && (evoQr.base64 || evoQr.qrcode)) ? (evoQr.base64 || evoQr.qrcode) : null;
        if (base64FromEvo) {
          const dataUrl = toDataUrl(base64FromEvo);
          if (qrPlaceholder) qrPlaceholder.style.display = 'none';
          if (qrImg) { qrImg.src = dataUrl; qrImg.style.display = 'block'; }
          if (statusValue) statusValue.textContent = 'QR gerado — escaneie';
          if (logText) logText.textContent = 'QR recebido diretamente da Evolution (fallback).';
          return;
        } else {
          console.warn('[WhatsApp] Evolution direto respondeu sem QR:', evoQr, evoCreate);
          if (statusValue) statusValue.textContent = 'Erro: sem QR do Evolution (ver console)';
          if (logText) logText.textContent = 'Resposta evolution (direct): ' + JSON.stringify(evoQr || evoCreate);
        }
      } catch (e) {
        console.error('[WhatsApp] Erro direto Evolution:', e);
        if (statusValue) statusValue.textContent = 'Erro ao acessar Evolution diretamente';
        if (logText) logText.textContent = 'Erro direto Evolution: ' + (e?.message || String(e));
      }
    } else {
      if (statusValue) statusValue.textContent = 'Erro: proxy indisponível — configure o proxy backend (recomendado)';
      if (logText) logText.textContent = 'Proxy indisponível e fallback direto desativado.';
    }
  } catch (outerErr) {
    console.error('[WhatsApp] Erro inesperado no fluxo de conexão:', outerErr);
    const statusValueElem = $id('statusValue');
    if (statusValueElem) statusValueElem.textContent = 'Erro ao iniciar conexão (ver console)';
    const logText = $id('logText');
    if (logText) logText.textContent = 'Erro inesperado: ' + (outerErr?.message || String(outerErr));
  } finally {
    if (btn) {
      btn.disabled = false;
      // restaura texto original se existia
      if (btn.dataset && btn.dataset.origText) {
        btn.innerHTML = btn.dataset.origText;
        delete btn.dataset.origText;
      } else {
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Conectar WhatsApp';
      }
    }
    isConnecting = false;
  }
}

// liga no botão (se existir) - garante que o listener seja adicionado mesmo se o DOM estiver pronto antes do auth
function attachButton() {
  const btn = $id('btnConnect');
  if (btn && !btn._whatsappAttached) {
    btn.addEventListener('click', (e) => { e.preventDefault(); startConnectFlow(); });
    btn._whatsappAttached = true;
  }
}

// tenta anexar no DOMContentLoaded e também imediatamente (caso o script seja carregado após DOM)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    attachButton();
  });
} else {
  // DOM já carregado
  attachButton();
}

// Expor função para testar manualmente via console (opcional)
window.WhatsApp_connect = startConnectFlow;
