import { isAdminLoggedIn, currentUser } from './auth.js';
import { Icon } from './components.js';

let toastContainer = null;

export function showToast(message, type = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-wrap';
    document.body.appendChild(toastContainer);
  }
  const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<span class="toast-icon">${Icon(icons[type] || 'info', 17)}</span><span>${message}</span>`;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s ease';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, 3400);
}

export function renderNavbar() {
  const isAdmin = isAdminLoggedIn();
  const user = currentUser();
  const isStaff = user?.type === 'staff';
  return `
    <nav class="navbar" aria-label="Primary">
      <div class="nav-inner">
        <a class="nav-brand" href="#/">
          <img src="/logo.png" alt="Gyan International School" class="brand-logo">
          <span class="brand-text">
            <span class="brand-title">Gyan's Quiz Arena</span>
            <span class="brand-sub">Gyan International School</span>
          </span>
        </a>
        <div class="nav-actions">
          <a class="nav-link" href="#/">${Icon('home', 15)}<span>Home</span></a>
          ${isAdmin || isStaff ? `
            <a class="nav-link" href="#/admin">${Icon('layout', 15)}<span>Admin</span></a>
            <button class="btn btn-secondary btn-sm" id="btn-nav-logout">${Icon('log-out', 15)}<span>${isStaff ? 'Logout' : 'Logout'}</span></button>
          ` : `
            <a href="#/admin-login" class="btn btn-secondary btn-sm">${Icon('lock', 14)}<span>Admin Login</span></a>
          `}
        </div>
      </div>
    </nav>`;
}

// Post-render hook: bind the navbar logout button when rendered by a page.
export function bindNavbar(app) {
  app.querySelector('#btn-nav-logout')?.addEventListener('click', async () => {
    const { adminLogout } = await import('./auth.js');
    adminLogout();
    showToast('Logged out');
    window.location.hash = '#/';
  });
}

export function showModal(title, content, onConfirm, opts = {}) {
  const confirmText = opts.confirmText || 'Confirm';
  const cancelText = opts.cancelText || 'Cancel';
  const danger = opts.danger ? ' btn-danger' : '';
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  o.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-title">${title}</div>
      <div class="modal-desc">${content}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary btn-sm" id="modal-cancel">${cancelText}</button>
        <button class="btn btn-primary btn-sm ${danger}" id="modal-confirm">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add('active'));
  const close = () => {
    o.classList.remove('active');
    setTimeout(() => o.remove(), 180);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  o.querySelector('#modal-cancel').onclick = () => { document.removeEventListener('keydown', onKey); close(); };
  o.querySelector('#modal-confirm').onclick = () => {
    document.removeEventListener('keydown', onKey);
    close();
    if (onConfirm) onConfirm();
  };
  o.addEventListener('click', e => { if (e.target === o) { document.removeEventListener('keydown', onKey); close(); } });
  setTimeout(() => o.querySelector('#modal-confirm')?.focus(), 20);
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

export async function copyTextToClipboard(text) {
  if (!text) return false;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard.writeText failed:', e);
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (e) {
    console.warn('copy fallback failed:', e);
    return false;
  }
}

/* ==========================================================================
   Gamification helpers
   ========================================================================== */

// Lightweight confetti burst (no dependency). Fades out automatically.
export function burstConfetti({ count = 60, duration = 2000 } = {}) {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#5B5FEF', '#4F8EF7', '#8B5CF6', '#22C7E5', '#22C55E', '#F59E0B', '#FFD54F', '#EC4899'];
  const dir = (n, center) => (Math.random() * (2 * n)) - n + (center || 0);

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.setProperty('--drift', `${dir(260)}px`);
    p.style.animation = `confettiFall ${duration + dir(800, 0)}ms linear ${dir(400, 0)}ms forwards`;
    container.appendChild(p);
  }

  setTimeout(() => container.remove(), duration + 1500);
}

// Animate a number from `from` to `to` inside an element over `ms`.
export function countUp(el, to, { from = 0, ms = 900, suffix = '' } = {}) {
  if (!el) return () => {};
  const start = performance.now();
  const run = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (t < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
  return () => {};
}

// Guess a subject identity (icon + css color class) from a quiz title.
export function subjectFor(title = '') {
  const t = (title || '').toLowerCase();
  if (/(math|maths|algebra|geometry|calculus|arithmetic)/.test(t)) return { icon: 'calculator', cls: 'subject-math', color: 'var(--purple)' };
  if (/(english|grammar|literature|reading|vocab|spelling)/.test(t)) return { icon: 'book-open', cls: 'subject-english', color: 'var(--orange)' };
  if (/(history|social|geography|civics|ancient|world war)/.test(t)) return { icon: 'scroll', cls: 'subject-history', color: 'var(--amber)' };
  if (/(computer|it\b|coding|program|python|tech|digital)/.test(t)) return { icon: 'laptop', cls: 'subject-computer', color: 'var(--primary)' };
  if (/(gk|general|current affairs|knowledge|quiz)/.test(t)) return { icon: 'globe', cls: 'subject-gk', color: 'var(--green)' };
  return { icon: 'flask', cls: 'subject-science', color: 'var(--blue)' };
}
