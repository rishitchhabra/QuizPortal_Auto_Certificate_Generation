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

export function renderAccessDenied(app, title, reason) {
  app.innerHTML = `
    <div class="container">
      ${renderNavbar()}
      <div class="card" style="max-width:520px; margin:48px auto; text-align:center; padding:40px 28px">
        <div class="stat-icon stat-red" style="width:52px; height:52px; margin:0 auto 16px">${lockIcon()}</div>
        <h2 style="font-size:18px; font-weight:700; margin-bottom:6px">${escapeHtml(title)}</h2>
        <p class="muted sm" style="margin-bottom:20px">${escapeHtml(reason)}</p>
        <a href="#/admin" class="btn btn-secondary btn-sm">${backIcon()}<span>Back to Dashboard</span></a>
      </div>
    </div>`;
  bindNavbar(app);
}

function lockIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
}

function backIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
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

// Sort batch / class-section labels: numeric part before the hyphen ascending,
// then the word after the hyphen alphabetically. "Unassigned" (empty) goes last.
export function sortBatches(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice().sort((a, b) => {
    const ka = (a === '' || a == null) ? Infinity : (parseInt(a, 10) || 0);
    const kb = (b === '' || b == null) ? Infinity : (parseInt(b, 10) || 0);
    if (ka !== kb) return ka - kb;
    const sa = String(a).split('-').slice(1).join('-').toLowerCase();
    const sb = String(b).split('-').slice(1).join('-').toLowerCase();
    if (sa !== sb) return sa < sb ? -1 : 1;
    return String(a).localeCompare(String(b));
  });
}

const PICKER_ICONS = {
  search: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'
};

// Reusable multi-select picker for batches/class-sections — searchable, scrollable,
// with select-all / clear. Works well for 20-40+ batches.
export function batchPickerHTML({ id, label, hint = '', selected = [], batches = [] }) {
  const sel = new Set(selected || []);
  const sorted = sortBatches(batches);
  return `
    <div class="batch-picker" id="${id}">
      <div class="batch-picker-head">
        <label class="field-label" style="margin:0">${label}</label>
        <span class="xs muted" data-pk="count">${sel.size} of ${sorted.length} selected</span>
      </div>
      <div class="batch-picker-tools">
        <div class="search-wrap">
          ${PICKER_ICONS.search}
          <input type="text" class="input" data-pk="search" placeholder="Search batches…" aria-label="Search batches" style="height:36px" autocomplete="off">
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-pk="all">Select all</button>
        <button type="button" class="btn btn-ghost btn-sm" data-pk="none">Clear</button>
      </div>
      <div class="batch-picker-list" data-pk="list">
        ${sorted.length ? sorted.map(b => `
          <label class="batch-picker-item ${sel.has(b) ? 'sel' : ''}">
            <input type="checkbox" value="${escapeHtml(b)}" ${sel.has(b) ? 'checked' : ''}>
            <span class="checkbox-box">${Icon('check', 12)}</span>
            <span class="batch-picker-name">${escapeHtml(b)}</span>
          </label>
        `).join('') : `<span class="xs muted" style="padding:14px">No batches yet — import students to create batches.</span>`}
      </div>
      ${hint ? `<p class="hint" style="margin-top:8px">${hint}</p>` : ''}
    </div>
  `;
}

// Wires the picker: reads the current selection into `onChange(selectedArray)`.
export function bindBatchPicker(root, { onSelected } = {}) {
  const search = root.querySelector('[data-pk="search"]');
  const list = root.querySelector('[data-pk="list"]');
  const countEl = root.querySelector('[data-pk="count"]');
  const allBtn = root.querySelector('[data-pk="all"]');
  const noneBtn = root.querySelector('[data-pk="none"]');
  if (!list) return;
  const items = Array.from(list.querySelectorAll('.batch-picker-item'));
  const total = items.length;

  const read = () => items
    .filter(i => i.querySelector('input').checked)
    .map(i => i.querySelector('input').value);
  const update = () => {
    const picked = new Set(read());
    if (countEl && total) countEl.textContent = `${picked.size} of ${total} selected`;
    items.forEach(i => i.classList.toggle('sel', picked.has(i.querySelector('input').value)));
  };

  if (search) search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    items.forEach(i => {
      const name = i.querySelector('.batch-picker-name').textContent.toLowerCase();
      i.style.display = !q || name.includes(q) ? '' : 'none';
    });
  });
  allBtn?.addEventListener('click', () => { items.forEach(i => { i.querySelector('input').checked = true; }); update(); onSelected?.(read()); });
  noneBtn?.addEventListener('click', () => { items.forEach(i => { i.querySelector('input').checked = false; }); update(); onSelected?.(read()); });
  items.forEach(i => i.querySelector('input').addEventListener('change', () => { update(); onSelected?.(read()); }));
  update();
  onSelected?.(read());
}
