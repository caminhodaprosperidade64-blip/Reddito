// js/whatsapp.js
// Integração com Evolution API - tenta usar proxy backend seguro em /api/evolution/*
// Se o proxy não existir, (APENAS PARA TESTE) tenta conectar diretamente à EVOLUTION_URL
// Ajuste EVOLUTION_URL apenas para testes (NÃO COLOQUE CHAVES NO FRONTEND).

const USE_DIRECT_EVOLUTION_FALLBACK = false; // deixar false em produção
const DIRECT_EVOLUTION_URL = "https://evolution-api-production-692fd.up.railway.app"; // sua URL evolution
// const DIRECT_EVOLUTION_API_KEY = "COLE_AQUI_SUA_AUTH_KEY_APENAS_PARA_TESTE"; // não recomendado

function $id(id){ return document.getElementById(id); }

async function getTenantIdFromFrontend() {
  // Tenta pegar tenant do perfil (conforme seu auth.js)
  if (window.perfil) return window.perfil.tenant_id || window.perfil.id;
  if (typeof getTenantId === 'function') {
    try { return await getTenantId(); } catch(e){ /* ignore */ }
  }
  // fallback de teste:
  return null;
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { ok: false, raw: text, status: res.status }; }
}

async function startConnectFlow() {
  const btn = $id('btnConnect');
  const qrImg = $id('qrImage');
  const qrPlaceholder = $id('qrPlaceholder');
  const statusValue = $id('statusValue');
  const logText = $id('logText');

  if (!btn || !qrImg || !qrPlaceholder || !statusValue) {
    console.error('Elementos UI esperados não encontrados. IDs esperados: btnConnect, qrImage, qrPlaceholder, statusValue');
    return;
  }

  btn.disabled = true;
  statusValue.textContent = 'Inicializando...';
  qrImg.style.display = 'none';
  qrPlaceholder.style.display = 'block';
  qrPlaceholder.textContent = 'Gerando QR...';

  const tenantId = await getTenantIdFromFrontend();
  if (!tenantId) {
    statusValue.textContent = 'Erro: tenant não identificado';
    btn.disabled = false;
    return;
  }

  // Primeiro tenta o proxy seguro no seu backend
  try {
    const proxyCreate = await fetchJson(`/api/evolution/instance/create`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ instanceName: tenantId, token: tenantId, qrcode: true })
    });

    if (proxyCreate && proxyCreate.ok === false && proxyCreate.status === 404) {
      // proxy não existe — fallback abaixo
      throw new Error('proxy_not_found');
    }

    // Se proxy retornou JSON com sucesso (mesmo que diga "already exists"), agora pedimos connect
    const proxyConnect = await fetchJson(`/api/evolution/instance/connect/${tenantId}`, { method: 'GET' });

    if (proxyConnect && proxyConnect.base64) {
      qrPlaceholder.style.display = 'none';
      qrImg.src = proxyConnect.base64;
      qrImg.style.display = 'block';
      statusValue.textContent = 'QR gerado — escaneie com WhatsApp';
      logText && (logText.textContent = 'QR recebido do proxy backend.');
      btn.disabled = false;
      return;
    }

    // se proxy retornou outra forma de resposta, exibimos info pra debug
    logText && (logText.textContent = 'Resposta proxy: ' + JSON.stringify(proxyCreate || proxyConnect));
  } catch (err) {
    console.warn('Proxy backend não disponível ou erro:', err?.message || err);
    // continua para fallback (direto ao Evolution) se permitido
  }

  // FALLBACK DIRETO (APENAS PARA TESTE) — NÃO COLOCAR CHAVE EM PRODUÇÃO
  if (USE_DIRECT_EVOLUTION_FALLBACK) {
    try {
      statusValue.textContent = 'Usando fallback direto (teste)';
      const evoCreate = await fetchJson(`${DIRECT_EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'apikey': window.EVOLUTION_API_KEY || ''},
        body: JSON.stringify({ instanceName: tenantId, token: tenantId, qrcode: true })
      });

      // pegar QR
      const evoQr = await fetchJson(`${DIRECT_EVOLUTION_URL}/instance/connect/${tenantId}`, {
        method: 'GET',
        headers: {'apikey': window.EVOLUTION_API_KEY || ''}
      });

      if (evoQr && evoQr.base64) {
        qrPlaceholder.style.display = 'none';
        qrImg.src = evoQr.base64;
        qrImg.style.display = 'block';
        statusValue.textContent = 'QR gerado — escaneie';
        return;
      } else {
        statusValue.textContent = 'Erro: sem QR do Evolution (ver console)';
        console.warn('Resposta evolution (direct):', evoQr, evoCreate);
      }
    } catch (e) {
      console.error('Erro direto Evolution:', e);
      statusValue.textContent = 'Erro ao acessar Evolution diretamente';
    }
  } else {
    statusValue.textContent = 'Erro: proxy indisponível — configure o proxy backend (recomendado)';
  }

  btn.disabled = false;
}

// liga no botão (se existir)
document.addEventListener('DOMContentLoaded', () => {
  const btn = $id('btnConnect');
  if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); startConnectFlow(); });
});
