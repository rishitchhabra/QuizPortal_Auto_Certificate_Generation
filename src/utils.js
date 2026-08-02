import { isAdminLoggedIn } from './auth.js';

let toastContainer = null;

export function showToast(message, type = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || '💡'}</span><span>${message}</span>`;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

export function renderNavbar() {
  const isAdmin = isAdminLoggedIn();
  return `
    <div class="top-announcement-strip">Gyan International School</div>
    <nav class="navbar">
      <a class="navbar-brand" href="/#/">
        <div class="logo-clay-wrapper">
          <img src="logo.png" alt="Gyan International School Logo" class="brand-logo-img">
        </div>
        <div style="display:flex; flex-direction:column">
          <span class="brand-title">Gyan's Quiz Arena</span>
          <span class="brand-subtitle">Gyan International School</span>
        </div>
      </a>
      <div class="navbar-actions">
        <a href="/#/" class="btn btn-ghost btn-sm">Home</a>
        ${isAdmin ? `
          <a href="/#/admin" class="btn btn-primary btn-sm">⚙️ Admin Portal</a>
        ` : `
          <a href="/#/admin-login" class="btn btn-secondary btn-sm">🔒 Admin Login</a>
        `}
      </div>
    </nav>`;
}

export function showModal(title, content, onConfirm) {
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal-clay scale-in">
    <h3 style="font-size: 1.3rem; margin-bottom: 0.75rem; font-weight:800">${title}</h3>
    <div style="font-size: 0.95rem; color: var(--text-sub); margin-bottom: 1.5rem">${content}</div>
    <div style="display:flex; gap: 0.75rem; justify-content: center">
      <button class="btn btn-secondary btn-sm" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary btn-sm" id="modal-confirm">Confirm</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add('active'));
  const close = () => {
    o.classList.remove('active');
    setTimeout(() => o.remove(), 300);
  };
  o.querySelector('#modal-cancel').onclick = close;
  o.querySelector('#modal-confirm').onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };
  o.addEventListener('click', e => {
    if (e.target === o) close();
  });
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
  // Prefer modern clipboard API when available (requires secure context)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard.writeText failed:', e);
      // fall through to legacy approach
    }
  }

  // Legacy fallback using a temporary textarea and execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // Prevent scrolling to bottom
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
