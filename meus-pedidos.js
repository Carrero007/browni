/**
 * ============================================================
 * BROWNÍ — meus-pedidos.js
 * Lista, edita, exclui e repete pedidos do usuário
 * ============================================================
 */

// ── API ──────────────────────────────────────────────────

async function apiMeusPedidos(telefone) {
  const url = `${GOOGLE_SCRIPT_URL}?acao=meusPedidos&telefone=${encodeURIComponent(normalizarTel(telefone))}`;
  const r = await fetch(url);
  return await r.json();
}

// ── HELPERS ──────────────────────────────────────────────

function statusLabel(status) {
  const map = {
    pendente:  { texto: 'Pendente',  classe: 'badge--pendente' },
    entregue:  { texto: 'Entregue',  classe: 'badge--entregue' },
    cancelado: { texto: 'Cancelado', classe: 'badge--cancelado' },
  };
  return map[(status || 'pendente').toLowerCase()] || map['pendente'];
}

// ── RENDER ───────────────────────────────────────────────

function criarCardPedido(pedido) {
  const s          = statusLabel(pedido.status);
  const isPendente = (pedido.status || 'pendente').toLowerCase() === 'pendente';
  const isEntregue = (pedido.status || '').toLowerCase() === 'entregue';
  const total      = Number(pedido.quantidade) || 1;
  const valorTotal = (total * 7).toFixed(2).replace('.', ',');

  const card = document.createElement('article');
  card.className = `pedido-card${isPendente ? ' pedido-card--pendente' : ''} reveal`;
  card.setAttribute('role', 'listitem');

  card.innerHTML = `
    <div class="pedido-card__header">
      <div class="pedido-card__info">
        <span class="badge ${s.classe}">${s.texto}</span>
        <p class="pedido-card__data">${pedido.data || '—'}</p>
      </div>
      <div class="pedido-card__valor">
        <span class="pedido-card__qtd">${total}x brownie${total > 1 ? 's' : ''}</span>
        <span class="pedido-card__preco">R$ ${valorTotal}</span>
      </div>
    </div>

    <div class="pedido-card__body">
      <div class="pedido-card__row">
        <span class="pedido-card__label">Nome</span>
        <span class="pedido-card__value">${pedido.nome || '—'}</span>
      </div>
      ${pedido.instagram && pedido.instagram !== '-' ? `
      <div class="pedido-card__row">
        <span class="pedido-card__label">Instagram</span>
        <span class="pedido-card__value">${pedido.instagram}</span>
      </div>` : ''}
      ${isEntregue ? `
      <div class="pedido-card__row pedido-card__row--selos">
        <span class="pedido-card__label">Selos ganhos</span>
        <span class="pedido-card__value">+${total} 🍫</span>
      </div>` : ''}
    </div>

    <div class="pedido-card__actions">
      ${isPendente ? `
        <button class="btn btn--outline btn--sm" data-action="editar" aria-label="Editar pedido">
          ✏️ Editar
        </button>
        <button class="btn btn--danger btn--sm" data-action="excluir" aria-label="Cancelar pedido">
          🗑️ Cancelar
        </button>
      ` : `
        <button class="btn btn--outline btn--sm" data-action="repetir" aria-label="Repetir pedido">
          🔁 Repetir pedido
        </button>
      `}
    </div>
  `;

  card.querySelector('[data-action="editar"]')?.addEventListener('click',  () => abrirEditarPedido(pedido));
  card.querySelector('[data-action="excluir"]')?.addEventListener('click', () => abrirExcluirPedido(pedido));
  card.querySelector('[data-action="repetir"]')?.addEventListener('click', () => repetirPedido(pedido));

  return card;
}

// ── CARREGAR PEDIDOS ──────────────────────────────────────

async function carregarPedidos() {
  const usuario = getUsuarioLogado();

  if (!usuario) {
    sessionStorage.setItem('browniRedirect', 'meus-pedidos.html');
    window.location.href = 'login.html';
    return;
  }

  const loading  = document.getElementById('pedidosLoading');
  const vazio    = document.getElementById('pedidosVazio');
  const lista    = document.getElementById('pedidosLista');
  const novoWrap = document.getElementById('pedidosNovoWrap');

  loading.hidden = false;
  vazio.hidden   = true;
  lista.hidden   = true;
  if (novoWrap) novoWrap.hidden = true;

  try {
    const res = await apiMeusPedidos(usuario.telefone);
    loading.hidden = true;

    if (!res.ok || !res.pedidos || res.pedidos.length === 0) {
      vazio.hidden = false;
      return;
    }

    lista.innerHTML = '';
    res.pedidos.forEach(pedido => lista.appendChild(criarCardPedido(pedido)));
    lista.hidden = false;

    const temPendente = res.pedidos.some(p => (p.status || 'pendente').toLowerCase() === 'pendente');
    if (novoWrap) novoWrap.hidden = temPendente;

    setTimeout(() => {
      lista.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    }, 50);

  } catch (err) {
    loading.hidden = true;
    vazio.hidden   = false;
    mostrarToast('❌ Erro ao carregar pedidos. Verifique sua conexão.');
    console.error(err);
  }
}

// ── EDITAR PEDIDO ────────────────────────────────────────

function abrirEditarPedido(pedido) {
  const usuario  = getUsuarioLogado();
  const telefone = usuario?.telefone || pedido.telefone;

  document.getElementById('mpEditNome').value       = pedido.nome || '';
  document.getElementById('mpEditInstagram').value  = (pedido.instagram && pedido.instagram !== '-') ? pedido.instagram : '';
  document.getElementById('mpEditQuantidade').value = pedido.quantidade || 1;

  clonarBotao('mpEditDecrementar', () => {
    const el = document.getElementById('mpEditQuantidade');
    const v  = parseInt(el.value) || 1;
    if (v > 1) el.value = v - 1;
  });
  clonarBotao('mpEditIncrementar', () => {
    const el = document.getElementById('mpEditQuantidade');
    const v  = parseInt(el.value) || 1;
    if (v < 99) el.value = v + 1;
  });

  const instaEl = document.getElementById('mpEditInstagram');
  instaEl.oninput = () => {
    if (instaEl.value && !instaEl.value.startsWith('@')) instaEl.value = '@' + instaEl.value;
  };

  const form  = document.getElementById('formEditarPedido');
  const clone = form.cloneNode(true);
  form.parentNode.replaceChild(clone, form);

  clonarBotao('mpEditDecrementar', () => {
    const el = document.getElementById('mpEditQuantidade');
    const v  = parseInt(el.value) || 1;
    if (v > 1) el.value = v - 1;
  });
  clonarBotao('mpEditIncrementar', () => {
    const el = document.getElementById('mpEditQuantidade');
    const v  = parseInt(el.value) || 1;
    if (v < 99) el.value = v + 1;
  });

  clone.addEventListener('submit', async (e) => {
    e.preventDefault();
    await salvarEdicaoPedido(telefone);
  });

  abrirModal('modalEditarPedido');
}

async function salvarEdicaoPedido(telefone) {
  const nome      = document.getElementById('mpEditNome').value.trim();
  const instagram = document.getElementById('mpEditInstagram').value.trim();
  const qtd       = parseInt(document.getElementById('mpEditQuantidade').value) || 1;

  if (!nome || nome.length < 3) { mostrarToast('⚠️ Nome muito curto'); return; }

  let insta = instagram;
  if (insta && !insta.startsWith('@')) insta = '@' + insta;

  const btn = document.getElementById('mpBtnSalvar');
  if (btn) { btn.classList.add('btn-loading'); btn.setAttribute('disabled', 'true'); }

  try {
    const res = await executarAcao({
      acao:       'alterar',
      nome,
      telefone,
      instagram:  insta || '-',
      quantidade: qtd,
      data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });

    if (res) {
      fecharModal('modalEditarPedido');
      abrirModal('modalPedidoAtualizado');
    } else {
      mostrarToast('❌ Erro ao salvar. Tente novamente.');
    }
  } catch {
    mostrarToast('❌ Erro de conexão. Tente novamente.');
  } finally {
    if (btn) { btn.classList.remove('btn-loading'); btn.removeAttribute('disabled'); }
  }
}

// ── EXCLUIR PEDIDO ───────────────────────────────────────

function abrirExcluirPedido(pedido) {
  const usuario  = getUsuarioLogado();
  const telefone = usuario?.telefone || pedido.telefone;

  const resumo = document.getElementById('mpResumoExclusao');
  if (resumo) {
    resumo.innerHTML = `
      <div class="resumo-item">
        <span class="resumo-item__label">Nome</span>
        <span class="resumo-item__value">${pedido.nome || '—'}</span>
      </div>
      <div class="resumo-item">
        <span class="resumo-item__label">Qtd.</span>
        <span class="resumo-item__value">${pedido.quantidade} brownie${Number(pedido.quantidade) > 1 ? 's' : ''}</span>
      </div>
    `;
  }

  clonarBotao('mpBtnConfirmarExclusao', async () => {
    const btn = document.getElementById('mpBtnConfirmarExclusao');
    if (btn) { btn.classList.add('btn-loading'); btn.setAttribute('disabled', 'true'); }

    try {
      const ok = await executarAcao({
        acao:       'excluir',
        telefone,
        nome:       pedido.nome,
        instagram:  pedido.instagram || '-',
        quantidade: pedido.quantidade,
        data:       '',
      });

      if (ok) {
        fecharModal('modalExcluirPedido');
        abrirModal('modalPedidoCancelado');
      } else {
        mostrarToast('❌ Erro ao cancelar. Tente novamente.');
      }
    } catch {
      mostrarToast('❌ Erro de conexão. Tente novamente.');
    } finally {
      if (btn) { btn.classList.remove('btn-loading'); btn.removeAttribute('disabled'); }
    }
  });

  abrirModal('modalExcluirPedido');
}

// ── REPETIR PEDIDO ───────────────────────────────────────

function repetirPedido(pedido) {
  sessionStorage.setItem('browniRepetirPedido', JSON.stringify({
    nome:       pedido.nome,
    instagram:  pedido.instagram,
    quantidade: pedido.quantidade,
  }));
  window.location.href = 'cadastro.html';
}

// ── INIT ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (!estaLogado()) {
    sessionStorage.setItem('browniRedirect', 'meus-pedidos.html');
    window.location.href = 'login.html';
    return;
  }
  carregarPedidos();
});