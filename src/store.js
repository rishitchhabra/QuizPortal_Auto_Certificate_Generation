const STORE_KEY = 'sciquiz_data';
const ADMIN_KEY = 'sciquiz_admin';
const AUTH_KEY = 'sciquiz_auth';

// Server base (if server is running on same host but different port, set
// window.SERVER_BASE = 'http://your-vps:3001' in a small script or env.
const SERVER_BASE = window.SERVER_BASE || '';

function getDefaultStore() { return { quizzes: [], submissions: [], certificateTemplates: [] }; }

export function loadStore() {
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : getDefaultStore(); }
  catch { return getDefaultStore(); }
}
export function saveStore(data) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
export function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Quiz CRUD
export function saveQuiz(quiz) {
  // Try server first, fallback to localStorage
  if (SERVER_BASE) {
    try {
      const url = quiz.id ? `${SERVER_BASE}/api/quizzes/${quiz.id}` : `${SERVER_BASE}/api/quizzes`;
      const opts = { method: quiz.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quiz) };
      fetch(url, opts).then(r => r.json()).catch(() => {
        const s = loadStore(); const i = s.quizzes.findIndex(q => q.id === quiz.id);
        if (i >= 0) s.quizzes[i] = quiz; else s.quizzes.push(quiz); saveStore(s);
      });
      return quiz;
    } catch (e) { /* fallback */ }
  }
  const s = loadStore(); const i = s.quizzes.findIndex(q => q.id === quiz.id);
  if (i >= 0) s.quizzes[i] = quiz; else s.quizzes.push(quiz); saveStore(s); return quiz;
}
export async function getQuiz(id) {
  if (SERVER_BASE) {
    try {
      const r = await fetch(`${SERVER_BASE}/api/quizzes/${id}`);
      if (r.status === 200) return await r.json();
      return null;
    } catch (e) { /* fallback */ }
  }
  return loadStore().quizzes.find(q => q.id === id) || null;
}
export async function getAllQuizzes() {
  if (SERVER_BASE) {
    try {
      const r = await fetch(`${SERVER_BASE}/api/quizzes`);
      if (r.status === 200) return await r.json();
      return loadStore().quizzes;
    } catch (e) { /* fallback */ }
  }
  return loadStore().quizzes;
}
export function deleteQuiz(id) {
  if (SERVER_BASE) {
    fetch(`${SERVER_BASE}/api/quizzes/${id}`, { method: 'DELETE' }).catch(() => {
      const s = loadStore(); s.quizzes = s.quizzes.filter(q => q.id !== id); saveStore(s);
    });
    return;
  }
  const s = loadStore(); s.quizzes = s.quizzes.filter(q => q.id !== id); saveStore(s);
}

// Submissions
export async function saveSubmission(sub) {
  if (SERVER_BASE) {
    try {
      const r = await fetch(`${SERVER_BASE}/api/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      return await r.json();
    } catch (e) { /* fallback */ }
  }
  const s = loadStore(); s.submissions.push(sub); saveStore(s); return sub;
}
export async function getSubmissions(quizId) {
  if (SERVER_BASE) {
    try {
      const r = await fetch(`${SERVER_BASE}/api/submissions?quizId=${encodeURIComponent(quizId)}`);
      if (r.status === 200) return await r.json();
    } catch (e) { /* fallback */ }
  }
  return loadStore().submissions.filter(s => s.quizId === quizId);
}
export function getSubmissionsByEmail(quizId, email) {
  return loadStore().submissions.filter(s => s.quizId === quizId && s.participant?.email === email);
}

// Certificate Templates
export function saveCertTemplate(t) {
  if (SERVER_BASE) {
    try {
      const url = t.id ? `${SERVER_BASE}/api/cert-templates/${t.id}` : `${SERVER_BASE}/api/cert-templates`;
      const opts = { method: t.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) };
      fetch(url, opts).then(r => r.json()).catch(() => {
        const s = loadStore(); const i = s.certificateTemplates.findIndex(x => x.id === t.id);
        if (i >= 0) s.certificateTemplates[i] = t; else s.certificateTemplates.push(t); saveStore(s);
      });
      return t;
    } catch (e) { /* fallback */ }
  }
  const s = loadStore(); const i = s.certificateTemplates.findIndex(x => x.id === t.id);
  if (i >= 0) s.certificateTemplates[i] = t; else s.certificateTemplates.push(t); saveStore(s); return t;
}
export async function getCertTemplate(id) {
  if (SERVER_BASE) {
    try { const r = await fetch(`${SERVER_BASE}/api/cert-templates`); if (r.status === 200) { const all = await r.json(); return all.find(t => t.id === id) || null; } } catch (e) {}
  }
  return loadStore().certificateTemplates.find(t => t.id === id) || null;
}
export async function getAllCertTemplates() {
  if (SERVER_BASE) {
    try { const r = await fetch(`${SERVER_BASE}/api/cert-templates`); if (r.status === 200) return await r.json(); } catch (e) {}
  }
  return loadStore().certificateTemplates;
}
export function deleteCertTemplate(id) {
  if (SERVER_BASE) {
    fetch(`${SERVER_BASE}/api/cert-templates/${id}`, { method: 'DELETE' }).catch(() => {
      const s = loadStore(); s.certificateTemplates = s.certificateTemplates.filter(t => t.id !== id); saveStore(s);
    });
    return;
  }
  const s = loadStore(); s.certificateTemplates = s.certificateTemplates.filter(t => t.id !== id); saveStore(s);
}

// Admin Config
function getDefaultAdmin() {
  return { id: 'admin', passwordHash: '', adminEmails: [], googleClientId: '', isSetup: false };
}
export function getAdminConfig() {
  try { const r = localStorage.getItem(ADMIN_KEY); return r ? JSON.parse(r) : getDefaultAdmin(); }
  catch { return getDefaultAdmin(); }
}
export async function getAdminConfigAsync() {
  if (SERVER_BASE) {
    try {
      const r = await fetch(`${SERVER_BASE}/api/admin-config`);
      if (r.ok) return await r.json();
    } catch (e) { /* fallback */ }
  }
  return getAdminConfig();
}

export async function saveAdminConfig(cfg) {
  // cfg may include currentPasswordHash for updates
  if (SERVER_BASE) {
    try {
      const r = await fetch(`${SERVER_BASE}/api/admin-config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      if (r.ok) return await r.json();
      throw new Error((await r.json()).error || r.statusText);
    } catch (e) {
      // fallback to local
    }
  }
  localStorage.setItem(ADMIN_KEY, JSON.stringify(cfg));
  return cfg;
}

// Auth Session
export function getAuthSession() {
  try { const r = sessionStorage.getItem(AUTH_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
export function setAuthSession(data) { sessionStorage.setItem(AUTH_KEY, JSON.stringify(data)); }
export function clearAuthSession() { sessionStorage.removeItem(AUTH_KEY); }

// Google User Session (for quiz takers)
const GUSER_KEY = 'sciquiz_guser';
export function getGoogleUser() {
  try { const r = sessionStorage.getItem(GUSER_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
export function setGoogleUser(u) { sessionStorage.setItem(GUSER_KEY, JSON.stringify(u)); }
export function clearGoogleUser() { sessionStorage.removeItem(GUSER_KEY); }
