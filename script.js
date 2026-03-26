/**
 * ============================================================
 * BROWNIE DO PRETÃO — script.js
 * Versão 2.0 — Validação server-side via Google Sheets
 *
 * Fluxo:
 *  1. Ao submeter, consulta a planilha (GET) para verificar
 *     se o telefone já existe ANTES de gravar.
 *  2. Se não existe → grava linha nova (acao=novo).
 *  3. Se já existe  → bloqueia e pergunta: alterar ou excluir.
 *     Alterar → atualiza a linha na planilha (acao=alterar).
 *     Excluir → remove a linha na planilha (acao=excluir).
 *  4. localStorage é usado apenas como cache local para
 *     pré-preencher o formulário na próxima visita.
 * ============================================================
 */

// ──────────────────────────────────────────────────────────
//  ⚙️  CONFIGURAÇÃO
// ──────────────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwz1N5fOWSCDpL2exqALdnkayiQ29sO2bBD43jmklwzP1disYIvgrxiLpXuPUvrdP7KqQ/exec';

// Chave do cache local
const STORAGE_KEY = 'browniePedido';


// ──────────────────────────────────────────────────────────
//  🔧  UTILITÁRIOS GERAIS
// ──────────────────────────────────────────────────────────

/** Lê pedido do cache local */
function getPedidoLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
}

/** Salva pedido no cache local */
function salvarPedidoLocal(pedido) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pedido));
}

/** Remove pedido do cache local */
function removerPedidoLocal() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Formata telefone → (00) 00000-0000 */
function formatarTelefone(valor) {
  if (!valor) return '';

  valor = String(valor); // 🔥 CORREÇÃO AQUI

  valor = valor.replace(/\D/g, '');

  if (valor.length <= 10) {
    return valor.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
  } else {
    return valor.replace(/(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
  }
}

/** Remove formatação do telefone para comparação */
function normalizarTel(tel) {
  if (!tel) return '';
  return String(tel).replace(/\D/g, '');
}

/** Exibe toast temporário */
function mostrarToast(msg, duracao = 3500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duracao);
}

/** Abre modal */
function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  const first = el.querySelector('button, a');
  if (first) setTimeout(() => first.focus(), 60);
  el._handler = (e) => { if (e.target === el) fecharModal(id); };
  el.addEventListener('click', el._handler);
}

/** Fecha modal */
function fecharModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  if (el._handler) el.removeEventListener('click', el._handler);
}

/** Fecha todos os modais */
function fecharTodosModais() {
  document.querySelectorAll('.modal-overlay.active')
    .forEach(m => m.classList.remove('active'));
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharTodosModais();
});

/** Liga/desliga estado de loading no botão de envio */
function setLoading(ativo) {
  const btn = document.getElementById('btnEnviar');
  if (!btn) return;
  if (ativo) {
    btn.classList.add('btn-loading');
    btn.setAttribute('disabled', 'true');
  } else {
    btn.classList.remove('btn-loading');
    btn.removeAttribute('disabled');
  }
}


// ──────────────────────────────────────────────────────────
//  🌐  API — Comunicação com Google Apps Script
//
//  O Apps Script expõe dois endpoints:
//    GET  ?acao=consultar&telefone=XXX  → retorna se existe
//    POST acao=novo|alterar|excluir     → grava/edita/remove
//
//  Por causa do no-cors, o POST não retorna resposta legível.
//  Já o GET usa um iframe trick via JSONP não disponível aqui,
//  então usamos fetch com cors normal no GET (o Apps Script
//  retorna CORS no doGet quando configurado corretamente).
// ──────────────────────────────────────────────────────────

/**
 * Consulta a planilha para verificar se o telefone já existe.
 * Retorna: { existe: true, dados: {...} } ou { existe: false }
 */
async function consultarTelefone(telefone) {
  if (GOOGLE_SCRIPT_URL === 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT') {
    // Modo dev: simula que não existe pedido
    console.warn('[Brownie] URL não configurada — simulando consulta vazia.');
    return { existe: false };
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?acao=consultar&telefone=${encodeURIComponent(normalizarTel(telefone))}`;
    const resp = await fetch(url);
    const json = await resp.json();
    return json; // { existe: boolean, dados?: {...} }
  } catch (err) {
    console.error('[Brownie] Erro na consulta:', err);
    // Em caso de falha na consulta, deixa prosseguir
    // o Apps Script vai rejeitar duplicata de qualquer forma
    return { existe: false };
  }
}

/**
 * Envia ação para o Apps Script (novo / alterar / excluir).
 * Usa no-cors + FormData (único método confiável com Apps Script).
 */
async function executarAcao(dados) {
  if (GOOGLE_SCRIPT_URL === 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT') {
    console.warn('[Brownie] URL não configurada — simulando envio OK.');
    return true;
  }

  try {
    const params = new URLSearchParams({
      acao:       dados.acao,
      nome:       dados.nome       || '',
      telefone:   normalizarTel(dados.telefone),
      instagram:  dados.instagram  || '-',
      quantidade: dados.quantidade || 1,
      data:       dados.data       || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });

    const resp = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const json = await resp.json();
    return json.ok === true;

  } catch (err) {
    console.error('[Brownie] Erro ao executar ação:', err);
    return false;
  }
}


// ──────────────────────────────────────────────────────────
//  📋  FORMULÁRIO
// ──────────────────────────────────────────────────────────

/** Preenche o formulário com dados existentes */
function preencherFormulario(pedido) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('nome',       pedido.nome);
  set('telefone',   pedido.telefone);
  set('instagram',  pedido.instagram);
  set('quantidade', pedido.quantidade || 1);
}

/** Limpa o formulário */
function limparFormulario() {
  const form = document.getElementById('pedidoForm');
  if (form) form.reset();
  const qty = document.getElementById('quantidade');
  if (qty) qty.value = 1;
}

/** Coleta e valida os dados do formulário */
function coletarDados() {
  const nome      = document.getElementById('nome').value.trim();
  const telefone  = document.getElementById('telefone').value.trim();
  const instagram = document.getElementById('instagram').value.trim();
  const quantidade = parseInt(document.getElementById('quantidade').value) || 1;

  if (!nome || nome.length < 3) {
    mostrarToast('⚠️ Digite seu nome completo');
    document.getElementById('nome').focus();
    return null;
  }

  if (normalizarTel(telefone).length < 10) {
    mostrarToast('⚠️ Digite um telefone válido com DDD');
    document.getElementById('telefone').focus();
    return null;
  }

  if (quantidade < 1 || quantidade > 99) {
    mostrarToast('⚠️ Quantidade inválida');
    return null;
  }

  // Garante @ no Instagram
  let insta = instagram;
  if (insta && !insta.startsWith('@')) insta = `@${insta}`;

  return {
    nome,
    telefone: formatarTelefone(telefone),
    instagram: insta,
    quantidade,
    data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  };
}


// ──────────────────────────────────────────────────────────
//  📤  SUBMIT — fluxo principal
// ──────────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();

  const dados = coletarDados();
  if (!dados) return;

  setLoading(true);

  // 1. Consulta a planilha para ver se o telefone já existe
  const resultado = await consultarTelefone(dados.telefone);

  setLoading(false);

  if (resultado.existe) {
    // Telefone já cadastrado → mostra modal com opções
    // Preenche o formulário com os dados que vieram da planilha
    // para o cliente ver o que está registrado
    if (resultado.dados) preencherFormulario(resultado.dados);
    abrirModal('modalExistente');
    configurarBotoesExistente(dados, resultado.dados);
  } else {
    // Novo pedido → grava
    setLoading(true);
    const ok = await executarAcao({ ...dados, acao: 'novo' });
    setLoading(false);

    if (ok) {
      salvarPedidoLocal(dados);
      abrirModal('modalSucesso');
    } else {
      mostrarToast('❌ Erro ao enviar. Verifique sua conexão.');
    }
  }
}


// ──────────────────────────────────────────────────────────
//  🔁  MODAL EXISTENTE — roteamento para editar ou excluir
// ──────────────────────────────────────────────────────────

function configurarBotoesExistente(dadosDigitados, dadosPlanilha) {
  // Dados reais = planilha tem prioridade; fallback para o digitado
  const dadosAtuais = dadosPlanilha || dadosDigitados;

  // Clona para limpar listeners antigos
  ['btnAbrirEdicao', 'btnAbrirExclusao'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });

  // ── Abre modal de edição ──
  document.getElementById('btnAbrirEdicao').addEventListener('click', () => {
    fecharModal('modalExistente');
    abrirModalEdicao(dadosAtuais);
  });

  // ── Abre modal de confirmação de exclusão ──
  document.getElementById('btnAbrirExclusao').addEventListener('click', () => {
    fecharModal('modalExistente');
    abrirModalExclusao(dadosAtuais);
  });
}

// ──────────────────────────────────────────────────────────
//  ✏️  MODAL EDIÇÃO — abre e configura
// ──────────────────────────────────────────────────────────

function abrirModalEdicao(dados) {
  document.getElementById('editNome').value       = dados.nome      || '';
  document.getElementById('editTelefone').value   = dados.telefone  || '';
  document.getElementById('editInstagram').value  = dados.instagram || '';
  document.getElementById('editQuantidade').value = dados.quantidade || 1;

  // Controles de quantidade
  clonarBotao('editDecrementar', () => {
    const el = document.getElementById('editQuantidade');
    const v  = parseInt(el.value) || 1;
    if (v > 1) el.value = v - 1;
  });

  clonarBotao('editIncrementar', () => {
    const el = document.getElementById('editQuantidade');
    const v  = parseInt(el.value) || 1;
    if (v < 99) el.value = v + 1;
  });

  // Máscara Instagram
  const instaEl = document.getElementById('editInstagram');
  instaEl.oninput = () => {
    if (instaEl.value && !instaEl.value.startsWith('@')) {
      instaEl.value = '@' + instaEl.value;
    }
  };

  // Botão salvar — clona apenas uma vez
  clonarBotao('btnSalvarEdicao', async () => {
    await salvarEdicao(dados.telefone);
  });

  abrirModal('modalEditar');
}

async function salvarEdicao(telefoneOriginal) {
  const nome      = document.getElementById('editNome').value.trim();
  const instagram = document.getElementById('editInstagram').value.trim();
  const quantidade = parseInt(document.getElementById('editQuantidade').value) || 1;

  if (!nome || nome.length < 3) {
    mostrarToast('⚠️ Digite seu nome completo');
    document.getElementById('editNome').focus();
    return;
  }

  let insta = instagram;
  if (insta && !insta.startsWith('@')) insta = `@${insta}`;

  // Garante que pega o telefone do campo readonly do modal
  const telEl = document.getElementById('editTelefone');
  const telFinal = telefoneOriginal || (telEl ? telEl.value.trim() : '');

  if (!telFinal) {
    mostrarToast('❌ Telefone não encontrado. Feche e tente novamente.');
    return;
  }

  const dadosAtualizados = {
    acao:       'alterar',
    nome,
    telefone:   telFinal,
    instagram:  insta || '-',
    quantidade,
    data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  };

  console.log('[Brownie] Enviando edição:', dadosAtualizados);

  const btn = document.getElementById('btnSalvarEdicao');
  if (btn) { btn.classList.add('btn-loading'); btn.setAttribute('disabled','true'); }

  const ok = await executarAcao(dadosAtualizados);

  if (btn) { btn.classList.remove('btn-loading'); btn.removeAttribute('disabled'); }

  if (ok) {
    salvarPedidoLocal(dadosAtualizados);
    fecharModal('modalEditar');
    abrirModal('modalAtualizado');
  } else {
    mostrarToast('❌ Erro ao salvar. Tente novamente.');
  }
}

// ──────────────────────────────────────────────────────────
//  🗑️  MODAL EXCLUSÃO — abre com resumo e confirma
// ──────────────────────────────────────────────────────────

function abrirModalExclusao(dados) {
  console.log('[Brownie] Abrindo exclusão com dados:', dados);

  const resumo = document.getElementById('resumoExclusao');
  if (resumo) {
    resumo.innerHTML = `
      <div class="resumo-item">
        <span class="resumo-item__label">Nome</span>
        <span class="resumo-item__value">${dados.nome || '—'}</span>
      </div>
      <div class="resumo-item">
        <span class="resumo-item__label">Telefone</span>
        <span class="resumo-item__value">${dados.telefone || '—'}</span>
      </div>
      <div class="resumo-item">
        <span class="resumo-item__label">Instagram</span>
        <span class="resumo-item__value">${dados.instagram || '—'}</span>
      </div>
      <div class="resumo-item">
        <span class="resumo-item__label">Quantidade</span>
        <span class="resumo-item__value">${dados.quantidade || 1} brownie${dados.quantidade > 1 ? 's' : ''}</span>
      </div>
    `;
  }

  clonarBotao('btnConfirmarExclusao', async () => {
    // Captura o telefone direto do resumo visual como fallback
    const telDados = dados.telefone;

    if (!telDados) {
      mostrarToast('❌ Telefone não encontrado. Feche e tente novamente.');
      return;
    }

    console.log('[Brownie] Confirmando exclusão do tel:', telDados);

    const btn = document.getElementById('btnConfirmarExclusao');
    if (btn) { btn.classList.add('btn-loading'); btn.setAttribute('disabled','true'); }

    const ok = await executarAcao({
      acao:       'excluir',
      telefone:   telDados,
      nome:       dados.nome       || '',
      instagram:  dados.instagram  || '-',
      quantidade: dados.quantidade || 1,
      data:       '',
    });

    if (btn) { btn.classList.remove('btn-loading'); btn.removeAttribute('disabled'); }

    if (ok) {
      removerPedidoLocal();
      fecharModal('modalConfirmarExclusao');
      limparFormulario();
      abrirModal('modalCancelado');
    } else {
      mostrarToast('❌ Erro ao cancelar. Tente novamente.');
    }
  });

  abrirModal('modalConfirmarExclusao');
}

// ──────────────────────────────────────────────────────────
//  🔧  HELPER — clona botão e atribui novo listener
// ──────────────────────────────────────────────────────────

function clonarBotao(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  const clone = el.cloneNode(true);
  el.parentNode.replaceChild(clone, el);
  clone.addEventListener('click', handler);
}


// ──────────────────────────────────────────────────────────
//  ➕  CONTROLE DE QUANTIDADE
// ──────────────────────────────────────────────────────────

function initQuantidade() {
  const input = document.getElementById('quantidade');
  const mais  = document.getElementById('incrementar');
  const menos = document.getElementById('decrementar');
  if (!input || !mais || !menos) return;

  mais.addEventListener('click', () => {
    const v = parseInt(input.value) || 1;
    if (v < 99) input.value = v + 1;
  });

  menos.addEventListener('click', () => {
    const v = parseInt(input.value) || 1;
    if (v > 1) input.value = v - 1;
  });
}


// ──────────────────────────────────────────────────────────
//  📞  MÁSCARA DE TELEFONE
// ──────────────────────────────────────────────────────────

function initMascaraTelefone() {
  const el = document.getElementById('telefone');
  if (!el) return;
  el.addEventListener('input', e => {
    e.target.value = formatarTelefone(e.target.value);
  });
}


// ──────────────────────────────────────────────────────────
//  🧭  NAVBAR SCROLL
// ──────────────────────────────────────────────────────────

function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const fn = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', fn, { passive: true });
  fn();
}


// ──────────────────────────────────────────────────────────
//  🎞️  ANIMAÇÕES DE REVEAL
// ──────────────────────────────────────────────────────────

function initRevealAnimations() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => obs.observe(el));
}


// ──────────────────────────────────────────────────────────
//  🚀  INICIALIZAÇÃO
// ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initRevealAnimations();

  const form = document.getElementById('pedidoForm');
  if (!form) return;

  initQuantidade();
  initMascaraTelefone();
  // Pré-preenche nome e telefone do usuário logado
  const usuarioLogado = typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null;
  if (usuarioLogado) {
    const nomeEl = document.getElementById('nome');
    const telEl  = document.getElementById('telefone');
    if (nomeEl && !nomeEl.value) { 
      nomeEl.value = usuarioLogado.nome || ''; 
      nomeEl.classList.add('form-input--prefilled');
    }
    if (telEl && !telEl.value) { 
      telEl.value = formatarTelefone(usuarioLogado.telefone || ''); 
      telEl.classList.add('form-input--prefilled');
    }
  }
  form.addEventListener('submit', handleSubmit);

  // Pré-preenche apenas quando o usuário clicou em "Repetir pedido"
  const repetir = sessionStorage.getItem('browniRepetirPedido');
  if (repetir) {
    try {
      const dados = JSON.parse(repetir);
      sessionStorage.removeItem('browniRepetirPedido');
      const set = (id, val) => { const el = document.getElementById(id); if (el && val) { el.value = val; el.classList.add('form-input--prefilled'); } };
      set('instagram', dados.instagram !== '-' ? dados.instagram : '');
      const qty = document.getElementById('quantidade');
      if (qty) qty.value = dados.quantidade || 1;
      mostrarToast('📋 Dados do pedido anterior carregados!');
    } catch(e) {}
  }
});

// ── CONTADOR ANIMADO ──────────────────────────────────────
function initContadores() {
  const nums = document.querySelectorAll('.contador-num');
  if (!nums.length) return;

  const animarContador = (el) => {
    const target = parseInt(el.dataset.target) || 0;
    const duracao = 1800;
    const inicio = performance.now();

    const step = (agora) => {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      const ease = 1 - Math.pow(1 - progresso, 3); // ease-out cubic
      el.textContent = Math.floor(ease * target);
      if (progresso < 1) requestAnimationFrame(step);
      else el.textContent = target;
    };

    requestAnimationFrame(step);
  };

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animarContador(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  nums.forEach(el => obs.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  initContadores();
});
// Botão flutuante WhatsApp
  const btnWpp = document.getElementById('btnWhatsappFloat');
  if (btnWpp) {
    btnWpp.addEventListener('click', () => abrirModal('modalWhatsapp'));
  }