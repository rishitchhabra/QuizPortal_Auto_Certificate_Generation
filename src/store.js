const AUTH_KEY = 'sciquiz_auth';

// Server base. In production this defaults to the same VPS origin.
// For Vite dev with a separate API server, set window.SERVER_BASE = 'http://localhost:3001'.
const SERVER_BASE = window.SERVER_BASE ?? '';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${SERVER_BASE}${path}`, options);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Quiz CRUD
export async function saveQuiz(quiz) {
  const url = quiz.id ? `/api/quizzes/${quiz.id}` : '/api/quizzes';
  const method = quiz.id ? 'PUT' : 'POST';
  return apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quiz) });
}
export async function getQuiz(id) {
  try { return await apiRequest(`/api/quizzes/${id}`); }
  catch { return null; }
}
export async function getAllQuizzes() {
  return apiRequest('/api/quizzes');
}
export async function deleteQuiz(id) {
  return apiRequest(`/api/quizzes/${id}`, { method: 'DELETE' });
}

// Submissions
export async function saveSubmission(sub) {
  return apiRequest('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
}
export async function getSubmissions(quizId) {
  return apiRequest(`/api/submissions?quizId=${encodeURIComponent(quizId)}`);
}
export async function getSubmissionsByEmail(quizId, email) {
  return apiRequest(`/api/submissions?quizId=${encodeURIComponent(quizId)}&email=${encodeURIComponent(email)}`);
}

// Certificate Templates
export async function saveCertTemplate(t) {
  const url = t.id ? `/api/cert-templates/${t.id}` : '/api/cert-templates';
  const method = t.id ? 'PUT' : 'POST';
  return apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
}
export async function getCertTemplate(id) {
  const all = await getAllCertTemplates();
  return all.find(t => t.id === id) || null;
}
export async function getAllCertTemplates() {
  return apiRequest('/api/cert-templates');
}
export async function deleteCertTemplate(id) {
  return apiRequest(`/api/cert-templates/${id}`, { method: 'DELETE' });
}

// Admin Config
export async function getAdminConfigAsync() {
  return apiRequest('/api/admin-config');
}

export async function saveAdminConfig(cfg) {
  return apiRequest('/api/admin-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
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
