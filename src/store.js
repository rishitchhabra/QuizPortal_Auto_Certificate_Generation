const AUTH_KEY = 'sciquiz_auth';

// Server base. In production this defaults to the same VPS origin.
// For Vite dev with a separate API server, set window.SERVER_BASE = 'http://localhost:3001'.
const SERVER_BASE = window.SERVER_BASE ?? '';

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const session = getAuthSession();
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${SERVER_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {}
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function getServerTime() {
  try {
    const data = await apiRequest('/api/time');
    if (data?.timestamp) return new Date(data.timestamp);
    if (data?.now) return new Date(data.now);
  } catch (e) {
    console.warn('Failed to fetch server time, using local fallback:', e);
  }
  return new Date();
}

export async function apiRequestRaw(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const session = getAuthSession();
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${SERVER_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {}
    throw new Error(message);
  }
  return response;
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
export async function getSubmissionsByUserId(quizId, userId) {
  return apiRequest(`/api/submissions?quizId=${encodeURIComponent(quizId)}&userId=${encodeURIComponent(userId)}`);
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

// PPTX Certificate Upload
export async function uploadPptxTemplate(file, name, id) {
  const formData = new FormData();
  formData.append('pptx', file);
  formData.append('name', name || 'Untitled PPTX Template');
  if (id) formData.append('id', id);
  const response = await fetch(`${SERVER_BASE}/api/cert-templates/upload-pptx`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    let message = response.statusText;
    try { const body = await response.json(); message = body.error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}

// Enqueue a certificate generation. Returns { success, jobId, status: 'queued' }
// immediately (HTTP 202); the server generates the PDF in a background worker.
// Poll getCertificateStatus(jobId) until status is 'done', then use downloadUrl.
export async function createCertificateJob(templateId, data) {
  const response = await fetch(`${SERVER_BASE}/api/generate-certificate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, data })
  });
  if (!response.ok) {
    let message = response.statusText;
    try { const body = await response.json(); message = body.error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}

// Poll status: { success, jobId, status: queued|processing|done|failed, downloadUrl?, previewUrl? }
export async function getCertificateStatus(jobId) {
  const response = await fetch(`${SERVER_BASE}/api/certificate-status/${jobId}`);
  if (!response.ok) {
    let message = response.statusText;
    try { const body = await response.json(); message = body.error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}

// Returns the absolute streaming URL for a certificate download/preview.
export function certificateUrl(path) {
  if (!path) return null;
  return `${SERVER_BASE}${path}`;
}

// Admin Config
export async function getAdminConfigAsync() {
  return apiRequest('/api/admin-config');
}

export async function saveAdminConfig(cfg) {
  return apiRequest('/api/admin-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
}

// Auth Session (Persisted across tabs & browser restarts)
export function getAuthSession() {
  try {
    const r = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
export function setAuthSession(data) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(data)); } catch {}
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(data)); } catch {}
}
export function clearAuthSession() {
  try { localStorage.removeItem(AUTH_KEY); } catch {}
  try { sessionStorage.removeItem(AUTH_KEY); } catch {}
}

// Google User Session (for quiz takers)
const GUSER_KEY = 'sciquiz_guser';
export function getGoogleUser() {
  try {
    const r = localStorage.getItem(GUSER_KEY) || sessionStorage.getItem(GUSER_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
export function setGoogleUser(u) {
  try { localStorage.setItem(GUSER_KEY, JSON.stringify(u)); } catch {}
  try { sessionStorage.setItem(GUSER_KEY, JSON.stringify(u)); } catch {}
}
export function clearGoogleUser() {
  try { localStorage.removeItem(GUSER_KEY); } catch {}
  try { sessionStorage.removeItem(GUSER_KEY); } catch {}
}

// Students (master database)
export async function getUsers(filters = {}) {
  const qs = new URLSearchParams();
  if (filters.classSection) qs.set('classSection', filters.classSection);
  if (filters.search) qs.set('search', filters.search);
  return apiRequest(`/api/users?${qs.toString()}`);
}
export async function addUser(data) {
  return apiRequest('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
export async function deleteUser(id) {
  return apiRequest(`/api/users/${id}`, { method: 'DELETE' });
}
export async function bulkDeleteUsers(ids) {
  return apiRequest('/api/users/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
}
export async function getBatches() {
  return apiRequest('/api/batches');
}
export async function importUsers(file) {
  const formData = new FormData();
  formData.append('file', file);
  const headers = new Headers();
  const session = getAuthSession();
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${SERVER_BASE}/api/users/import`, { method: 'POST', headers, body: formData });
  if (!response.ok) {
    let message = response.statusText;
    try { const body = await response.json(); message = body.error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}
export async function verifyUserId(userId) {
  return apiRequest('/api/users/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
}

// Staff / teachers
export async function getStaff() {
  return apiRequest('/api/staff');
}
export async function addStaff(data) {
  return apiRequest('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
export async function updateStaff(id, data) {
  return apiRequest(`/api/staff/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
export async function deleteStaff(id) {
  return apiRequest(`/api/staff/${id}`, { method: 'DELETE' });
}
export async function resetStaffPassword(id, passwordHash) {
  return apiRequest(`/api/staff/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passwordHash }) });
}

// Question image upload
export async function uploadQuestionImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const headers = new Headers();
  const session = getAuthSession();
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${SERVER_BASE}/api/question-images`, { method: 'POST', headers, body: formData });
  if (!response.ok) {
    let message = response.statusText;
    try { const body = await response.json(); message = body.error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}

// Reports
export async function getQuizReport(quizId) {
  return apiRequest(`/api/reports/${quizId}`);
}

// Session auth
export async function staffLogin(userId, passwordHash) {
  return apiRequest('/api/staff-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, passwordHash }) });
}
export async function adminLoginWithToken(id, passwordHash) {
  return apiRequest('/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, passwordHash }) });
}
export async function fetchMe() {
  return apiRequest('/api/auth/me');
}
export async function logoutSession() {
  try { return await apiRequest('/api/auth/logout', { method: 'POST' }); }
  catch { return null; }
}
