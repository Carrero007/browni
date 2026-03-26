/**
 * ============================================================
 * BROWNÍ — auth.js
 * Gerencia sessão do usuário via sessionStorage
 * Integra com Google Sheets (aba Usuarios)
 * ============================================================
 */

const AUTH_KEY = 'browniUsuario';

// ── Sessão ───────────────────────────────────────────────

function getUsuarioLogado() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)); }
  catch { return null; }
}

function salvarSessao(usuario) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(usuario));
}

function removerSessao() {
  sessionStorage.removeItem(AUTH_KEY);
}

function estaLogado() {
  return !!getUsuarioLogado();
}

// Retorna apenas o primeiro nome
function primeiroNome(nomeCompleto) {
  if (!nomeCompleto) return '';
  return nomeCompleto.trim().split(/\s+/)[0];
}

// ── API Calls ─────────────────────────────────────────────

async function apiLogin(telefone) {
  const url = `${GOOGLE_SCRIPT_URL}?acao=login&telefone=${encodeURIComponent(normalizarTel(telefone))}`;
  const r = await fetch(url);
  return await r.json();
}

async function apiCadastrarUsuario(nome, telefone) {
  const url = `${GOOGLE_SCRIPT_URL}?acao=cadastrarUsuario&nome=${encodeURIComponent(nome)}&telefone=${encodeURIComponent(normalizarTel(telefone))}`;
  const r = await fetch(url);
  return await r.json();
}

async function apiAtualizarUsuario(nome, telefone) {
  const url = `${GOOGLE_SCRIPT_URL}?acao=atualizarUsuario&nome=${encodeURIComponent(nome)}&telefone=${encodeURIComponent(normalizarTel(telefone))}`;
  const r = await fetch(url);
  return await r.json();
}

async function apiConsultarSelos(telefone) {
  const url = `${GOOGLE_SCRIPT_URL}?acao=consultarSelos&telefone=${encodeURIComponent(normalizarTel(telefone))}`;
  const r = await fetch(url);
  return await r.json();
}

// ── Init: página de login ─────────────────────────────────

(function initLoginPage() {
  // Só executa se estiver na página de login
  const formEntrar = document.getElementById('panel-entrar');
  if (!formEntrar) return;

  // Se já logado, redireciona para onde veio
  if (estaLogado()) {
    const destino = sessionStorage.getItem('browniRedirect') || 'cadastro.html';
    sessionStorage.removeItem('browniRedirect');
    window.location.href = destino;
    return;
  }

  // Máscara de telefone
  ['loginTelefone', 'criarTelefone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', e => { e.target.value = formatarTelefone(e.target.value); });
  });

  // Tabs
  const tabs   = document.querySelectorAll('.login-tab');
  const panels = document.querySelectorAll('.login-panel');
  const ink    = document.querySelector('.login-tab__ink');

  function ativarTab(idx) {
    tabs.forEach((t, i) => {
      t.classList.toggle('active', i === idx);
      t.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
    panels.forEach((p, i) => {
      p.classList.toggle('active', i === idx);
      p.hidden = i !== idx;
    });
    if (ink) {
      ink.style.left  = idx === 0 ? '4px' : 'calc(50% + 2px)';
      ink.style.width = `calc(50% - 6px)`;
    }
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => ativarTab(i)));
  document.getElementById('irParaCriar')?.addEventListener('click', () => ativarTab(1));
  document.getElementById('irParaEntrar')?.addEventListener('click', () => ativarTab(0));

  // Botão: Entrar
  document.getElementById('btnEntrar')?.addEventListener('click', async () => {
    const tel = document.getElementById('loginTelefone').value.trim();
    if (normalizarTel(tel).length < 10) {
      mostrarToast('⚠️ Digite um telefone válido com DDD');
      return;
    }
    const btn = document.getElementById('btnEntrar');
    btn.classList.add('btn-loading');
    btn.setAttribute('disabled', 'true');
    try {
      const res = await apiLogin(tel);
      if (res.ok) {
        salvarSessao(res.usuario);
        const destino = sessionStorage.getItem('browniRedirect') || 'cadastro.html';
        sessionStorage.removeItem('browniRedirect');
        window.location.href = destino;
      } else {
        mostrarToast('❌ Telefone não cadastrado. Crie uma conta primeiro!');
        ativarTab(1);
        document.getElementById('criarTelefone').value = tel;
      }
    } catch {
      mostrarToast('❌ Erro de conexão. Tente novamente.');
    } finally {
      btn.classList.remove('btn-loading');
      btn.removeAttribute('disabled');
    }
  });

  // Botão: Criar conta
  document.getElementById('btnCriar')?.addEventListener('click', async () => {
    const nome = document.getElementById('criarNome').value.trim();
    const tel  = document.getElementById('criarTelefone').value.trim();
    if (!nome || nome.length < 3) { mostrarToast('⚠️ Digite seu nome completo'); return; }
    if (normalizarTel(tel).length < 10) { mostrarToast('⚠️ Digite um telefone válido com DDD'); return; }

    const btn = document.getElementById('btnCriar');
    btn.classList.add('btn-loading');
    btn.setAttribute('disabled', 'true');
    try {
      const res = await apiCadastrarUsuario(nome, tel);
      if (res.ok) {
        salvarSessao(res.usuario);
        const destino = sessionStorage.getItem('browniRedirect') || 'cadastro.html';
        sessionStorage.removeItem('browniRedirect');
        window.location.href = destino;
      } else {
        mostrarToast('❌ Erro ao criar conta. Tente novamente.');
      }
    } catch {
      mostrarToast('❌ Erro de conexão. Tente novamente.');
    } finally {
      btn.classList.remove('btn-loading');
      btn.removeAttribute('disabled');
    }
  });

  // Init ink
  if (ink) { ink.style.left = '4px'; ink.style.width = 'calc(50% - 6px)'; }
})();

// ── Init: navbar com sanduíche ────────────────────────────

(function initNavAuth() {
  const hamburger      = document.getElementById('hamburger');
  const sideMenu       = document.getElementById('sideMenu');
  const sideOverlay    = document.getElementById('sideMenuOverlay');
  const sideClose      = document.getElementById('sideMenuClose');
  const sideGreeting   = document.getElementById('sideGreeting');
  const sideLogout     = document.getElementById('sideLogout');
  const sideEditPerfil = document.getElementById('sideEditarPerfil');

  if (!hamburger) return;

  const usuario = getUsuarioLogado();

  // Greeting
  if (sideGreeting) {
    sideGreeting.textContent = usuario
      ? `Olá, ${primeiroNome(usuario.nome)}! 👋`
      : 'Olá! 👋';
  }

  function abrirMenu() {
    sideMenu.hidden = false;
    sideMenu.removeAttribute('aria-hidden');
    sideOverlay.setAttribute('aria-hidden', 'false');
    sideOverlay.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('menu-aberto');
  }

  function fecharMenu() {
    sideMenu.hidden = true;
    sideMenu.setAttribute('aria-hidden', 'true');
    sideOverlay.setAttribute('aria-hidden', 'true');
    sideOverlay.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
    document.body.classList.remove('menu-aberto');
  }

  hamburger.addEventListener('click', () => {
    if (sideMenu.hidden) abrirMenu(); else fecharMenu();
  });
  sideClose?.addEventListener('click', fecharMenu);
  sideOverlay?.addEventListener('click', fecharMenu);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMenu(); });

  // Logout
  sideLogout?.addEventListener('click', () => {
    fecharMenu();
    abrirModal('modalLogout');
  });

  document.getElementById('btnConfirmarLogout')?.addEventListener('click', () => {
    removerSessao();
    fecharModal('modalLogout');
    window.location.href = 'index.html';
  });

  // Editar perfil
  sideEditPerfil?.addEventListener('click', (e) => {
    e.preventDefault();
    fecharMenu();
    abrirModalEditarPerfil();
  });
})();

// ── Modal: Editar Perfil ──────────────────────────────────

function abrirModalEditarPerfil() {
  const usuario = getUsuarioLogado();
  if (!usuario) {
    window.location.href = 'login.html';
    return;
  }
  const nomeEl = document.getElementById('editPerfilNome');
  const telEl  = document.getElementById('editPerfilTelefone');
  if (nomeEl) nomeEl.value = usuario.nome || '';
  if (telEl)  telEl.value  = formatarTelefone(usuario.telefone || '');
  abrirModal('modalEditarPerfil');

  const form = document.getElementById('formEditarPerfil');
  if (!form) return;
  const clone = form.cloneNode(true);
  form.parentNode.replaceChild(clone, form);
  clone.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('editPerfilNome').value.trim();
    if (!nome || nome.length < 3) { mostrarToast('⚠️ Nome muito curto'); return; }
    const btn = document.getElementById('btnSalvarPerfil');
    if (btn) { btn.classList.add('btn-loading'); btn.setAttribute('disabled','true'); }
    try {
      const res = await apiAtualizarUsuario(nome, usuario.telefone);
      if (res.ok) {
        const novoUsuario = { ...usuario, nome };
        salvarSessao(novoUsuario);
        fecharModal('modalEditarPerfil');
        mostrarToast('✅ Perfil atualizado!');
        // Atualiza saudação
        const greeting = document.getElementById('sideGreeting');
        if (greeting) greeting.textContent = `Olá, ${primeiroNome(nome)}! 👋`;
      } else {
        mostrarToast('❌ Erro ao salvar. Tente novamente.');
      }
    } catch {
      mostrarToast('❌ Erro de conexão.');
    } finally {
      if (btn) { btn.classList.remove('btn-loading'); btn.removeAttribute('disabled'); }
    }
  });
}

// ── Guard: protege páginas que exigem login ───────────────

(function authGuard() {
  const paginasProtegidas = ['cadastro.html', 'fidelidade.html', 'meus-pedidos.html'];
  const paginaAtual = window.location.pathname.split('/').pop() || 'index.html';

  if (paginasProtegidas.includes(paginaAtual) && !estaLogado()) {
    sessionStorage.setItem('browniRedirect', paginaAtual);
    window.location.href = 'login.html';
  }
})();

// ── Injetar nome do usuário logado no header (navbar) ─────

(function injetarNomeNavbar() {
  const usuario = getUsuarioLogado();
  if (!usuario) return;
  // Atualiza saudação se o side menu estiver presente
  const greeting = document.getElementById('sideGreeting');
  if (greeting) {
    greeting.textContent = `Olá, ${primeiroNome(usuario.nome)}! 👋`;
  }
})();