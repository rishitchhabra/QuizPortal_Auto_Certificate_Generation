import { getAdminConfigAsync, saveAdminConfig, getAuthSession, setAuthSession, clearAuthSession, getGoogleUser, setGoogleUser, adminLoginWithToken, staffLogin, fetchMe, logoutSession } from './store.js';

// SHA-256 hash
export async function hashPassword(password) {
  // Use Web Crypto when available (requires secure context). Otherwise
  // fall back to a small deterministic JS hash so the app still works
  // on non-HTTPS hosts or IP addresses during development.
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
      const data = new TextEncoder().encode(password);
      const buf = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('Web Crypto unavailable or error, using fallback hash:', e);
  }

  // Fallback: DJB2-like hash (deterministic, not cryptographically secure)
  let h = 5381;
  for (let i = 0; i < password.length; i++) {
    h = ((h << 5) + h) + password.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Admin Setup (first time)
export async function setupAdmin(id, password) {
  const hash = await hashPassword(password);
  await saveAdminConfig({ id, passwordHash: hash, adminEmails: [], googleClientId: '' });
  setAuthSession({ type: 'admin', id });
  return true;
}

// Admin Login (returns a server-issued session token)
export async function adminLogin(id, password) {
  const hash = await hashPassword(password);
  try {
    const r = await adminLoginWithToken(id, hash);
    if (r.ok && r.token) {
      setAuthSession({ type: 'admin', id, token: r.token, permissions: r.permissions || null });
      return true;
    }
  } catch {}
  return false;
}

// Teacher / Staff Login
export async function teacherLogin(userId, password) {
  const hash = await hashPassword(password);
  try {
    const r = await staffLogin(userId, hash);
    if (r.ok && r.token) {
      setAuthSession({ type: 'staff', token: r.token, staff: r.staff || null });
      return true;
    }
  } catch {}
  return false;
}

// Restore a session from a stored token (called on startup)
export async function restoreSession() {
  const session = getAuthSession();
  if (!session) return null;
  // Legacy sessions (pre-token format) or malformed ones are invalid.
  if (!session.token) { clearAuthSession(); return null; }
  try {
    const me = await fetchMe();
    if (me?.ok) {
      if (me.type === 'admin') {
        setAuthSession({ type: 'admin', id: me.id, token: session.token, permissions: me.permissions || null });
      } else if (me.type === 'staff') {
        setAuthSession({ type: 'staff', token: session.token, staff: me.staff || null });
      }
      return me;
    }
  } catch {
    clearAuthSession();
  }
  return null;
}

export async function adminLogout() {
  try { await logoutSession(); } catch {}
  clearAuthSession();
}

export function isAdminLoggedIn() {
  const session = getAuthSession();
  if (session?.type === 'admin') return true;
  return false;
}

export function currentUser() {
  return getAuthSession();
}

export function hasPermission(moduleKey, action) {
  const session = getAuthSession();
  if (!session) return false;
  if (session.type === 'admin') return true;
  const perms = session.staff?.permissions || {};
  const module = perms[moduleKey];
  if (!module) return false;
  if (module.full === true) return true;
  if (action) return module[action] === true;
  return Object.values(module).some(Boolean);
}

export function requireAdmin() {
  const session = getAuthSession();
  if (!session || (session.type !== 'admin' && session.type !== 'staff')) {
    window.location.hash = '#/admin-login';
    return false;
  }
  return true;
}

// Google OAuth
export function initGoogleAuth(clientId, callback) {
  if (!clientId || typeof google === 'undefined') return false;
  try {
    google.accounts.id.initialize({ client_id: clientId, callback: (response) => {
      const payload = parseJwt(response.credential);
      if (payload) {
        const user = { email: payload.email, name: payload.name, picture: payload.picture, sub: payload.sub };
        setGoogleUser(user);
        if (callback) callback(user);
      }
    }});
    return true;
  } catch (e) { console.error('Google Auth init error:', e); return false; }
}

export function renderGoogleButton(elementId, clientId) {
  if (!clientId || typeof google === 'undefined') return false;
  try {
    google.accounts.id.renderButton(document.getElementById(elementId), {
      theme: 'outline', size: 'large', text: 'signin_with', width: 300
    });
    return true;
  } catch (e) { console.error('Google button render error:', e); return false; }
}

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch { return null; }
}

export async function getGoogleClientId() {
  try {
    const cfg = await getAdminConfigAsync();
    return cfg.googleClientId || '';
  } catch {
    return '';
  }
}
