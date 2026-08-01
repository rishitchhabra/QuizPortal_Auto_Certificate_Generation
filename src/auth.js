import { getAdminConfig, saveAdminConfig, getAuthSession, setAuthSession, clearAuthSession, getGoogleUser, setGoogleUser } from './store.js';

// SHA-256 hash
export async function hashPassword(password) {
  // Use Web Crypto when available (requires secure context). Otherwise
  // fall back to a small deterministic JS hash so the app still works
  // on non-HTTPS hosts or IP addresses during development.
  try {
    if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
      const data = new TextEncoder().encode(password);
      const buf = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('Web Crypto unavailable, using fallback hash:', e);
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
  const cfg = getAdminConfig();
  cfg.id = id; cfg.passwordHash = hash; cfg.isSetup = true;
  saveAdminConfig(cfg);
  setAuthSession({ type: 'admin', id });
  return true;
}

// Admin Login
export async function adminLogin(id, password) {
  const cfg = getAdminConfig();
  if (!cfg.isSetup) return false;
  const hash = await hashPassword(password);
  if (cfg.id === id && cfg.passwordHash === hash) {
    setAuthSession({ type: 'admin', id });
    return true;
  }
  // Check if google user email is admin
  return false;
}

export function adminLogout() { clearAuthSession(); }

export function isAdminLoggedIn() {
  const session = getAuthSession();
  if (session?.type === 'admin') return true;
  // Check Google user in admin emails
  const guser = getGoogleUser();
  const cfg = getAdminConfig();
  if (guser && cfg.adminEmails.includes(guser.email)) return true;
  return false;
}

export function requireAdmin() {
  if (!isAdminLoggedIn()) { window.location.hash = '#/admin-login'; return false; }
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

export function getGoogleClientId() { return getAdminConfig().googleClientId || ''; }
