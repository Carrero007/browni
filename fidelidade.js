/**
 * ============================================================
 * BROWNÍ — fidelidade.js
 * Lógica dos selos de fidelidade
 * ============================================================
 */

(async function initFidelidade() {
  const grid       = document.getElementById('selosGrid');
  const progressBar= document.getElementById('fidelidadeProgressBar');
  const selosNum   = document.getElementById('fidelidadeSelosNum');
  const hint       = document.getElementById('fidelidadeHint');
  const nomeEl     = document.getElementById('fidelidadeNome');
  const browniesEl = document.getElementById('browniesGanhosNum');

  if (!grid) return;

  const usuario = getUsuarioLogado();

  // Cria os 12 slots vazios primeiro
  function renderSelos(quantidade) {
    grid.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const li = document.createElement('div');
      li.className = `selo ${i < quantidade ? 'selo--ativo' : 'selo--vazio'}`;
      li.setAttribute('role', 'listitem');
      li.setAttribute('aria-label', i < quantidade ? `Selo ${i + 1} conquistado` : `Selo ${i + 1} pendente`);

      const inner = document.createElement('div');
      inner.className = 'selo__inner';

      if (i < quantidade) {
        inner.innerHTML = `<span class="selo__icon" aria-hidden="true">🍫</span>`;
        // Anima com delay escalonado
        li.style.animationDelay = `${i * 0.06}s`;
        li.classList.add('selo--entrada');
      } else {
        inner.innerHTML = `<span class="selo__num" aria-hidden="true">${i + 1}</span>`;
      }

      li.appendChild(inner);
      grid.appendChild(li);
    }
  }

  function atualizarProgresso(selos) {
    const pct = (selos / 12) * 100;
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
      progressBar.setAttribute('aria-valuenow', selos);
    }
    if (selosNum) selosNum.textContent = selos;
  }

  if (!usuario) {
    renderSelos(0);
    atualizarProgresso(0);
    if (hint) hint.textContent = 'Faça login para ver seus selos 🍫';
    if (nomeEl) nomeEl.textContent = '—';
    return;
  }

  // Usuário logado
  if (nomeEl) nomeEl.textContent = usuario.nome || '—';
  if (hint) hint.style.display = 'none';

  // Busca selos atualizados da planilha
  try {
    const res = await apiConsultarSelos(usuario.telefone);
    if (res.ok) {
      const selos    = res.selos || 0;
      const ganhos   = res.browniesGanhos || 0;
      renderSelos(selos);
      atualizarProgresso(selos);
      if (browniesEl) {
        browniesEl.textContent = ganhos;
        animarNumero(browniesEl, 0, ganhos, 800);
      }
      // Atualiza sessão local com dados frescos
      const novoUsuario = { ...usuario, selos, browniesGanhos: ganhos };
      salvarSessao(novoUsuario);

      if (selos >= 12) {
        if (hint) {
          hint.textContent = '🎉 Parabéns! Você ganhou um brownie grátis!';
          hint.style.display = '';
          hint.classList.add('fidelidade-card__hint--ganhou');
        }
      }
    } else {
      renderSelos(0);
      atualizarProgresso(0);
    }
  } catch {
    // Usa dados da sessão como fallback
    const selos  = usuario.selos || 0;
    const ganhos = usuario.browniesGanhos || 0;
    renderSelos(selos);
    atualizarProgresso(selos);
    if (browniesEl) browniesEl.textContent = ganhos;
  }
})();

// Anima número de 0 até target
function animarNumero(el, de, ate, duracao) {
  if (ate === 0) return;
  const inicio = performance.now();
  const step = (agora) => {
    const p = Math.min((agora - inicio) / duracao, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(de + ease * (ate - de));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = ate;
  };
  requestAnimationFrame(step);
}