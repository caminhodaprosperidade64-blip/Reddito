// ─── GERENCIAR DARK MODE GLOBALMENTE ─────────────────────────────
function initDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    updateThemeButton();
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
  updateThemeButton();
}

function updateThemeButton() {
  const btn = document.querySelector('.theme-toggle') || document.getElementById('themeToogle');
  if (btn) {
    const isDark = document.body.classList.contains('dark-mode');
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    if (btn.textContent.includes('Claro')) {
      btn.innerHTML += ' Claro';
    } else if (btn.textContent.includes('Escuro')) {
      btn.innerHTML += ' Escuro';
    }
  }
}

// Sincronizar dark mode entre abas
window.addEventListener('storage', (e) => {
  if (e.key === 'darkMode') {
    if (e.newValue === 'true') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    updateThemeButton();
  }
});

// Inicializar ao carregar a página
document.addEventListener('DOMContentLoaded', initDarkMode);
