const STORE_KEY = 'sciquiz_data';
const ADMIN_KEY = 'sciquiz_admin';
const AUTH_KEY = 'sciquiz_auth';

function getDefaultStore() { return { quizzes: [], submissions: [], certificateTemplates: [] }; }

export function loadStore() {
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : getDefaultStore(); }
  catch { return getDefaultStore(); }
}
export function saveStore(data) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
export function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Quiz CRUD
export function saveQuiz(quiz) {
  const s = loadStore(); const i = s.quizzes.findIndex(q => q.id === quiz.id);
  if (i >= 0) s.quizzes[i] = quiz; else s.quizzes.push(quiz); saveStore(s); return quiz;
}
export function getQuiz(id) { return loadStore().quizzes.find(q => q.id === id) || null; }
export function getAllQuizzes() { return loadStore().quizzes; }
export function deleteQuiz(id) { const s = loadStore(); s.quizzes = s.quizzes.filter(q => q.id !== id); saveStore(s); }

// Submissions
export function saveSubmission(sub) { const s = loadStore(); s.submissions.push(sub); saveStore(s); return sub; }
export function getSubmissions(quizId) { return loadStore().submissions.filter(s => s.quizId === quizId); }
export function getSubmissionsByEmail(quizId, email) {
  return loadStore().submissions.filter(s => s.quizId === quizId && s.participant?.email === email);
}

// Certificate Templates
export function saveCertTemplate(t) {
  const s = loadStore(); const i = s.certificateTemplates.findIndex(x => x.id === t.id);
  if (i >= 0) s.certificateTemplates[i] = t; else s.certificateTemplates.push(t); saveStore(s); return t;
}
export function getCertTemplate(id) { return loadStore().certificateTemplates.find(t => t.id === id) || null; }
export function getAllCertTemplates() { return loadStore().certificateTemplates; }
export function deleteCertTemplate(id) { const s = loadStore(); s.certificateTemplates = s.certificateTemplates.filter(t => t.id !== id); saveStore(s); }

// Admin Config
function getDefaultAdmin() {
  return { id: 'admin', passwordHash: '', adminEmails: [], googleClientId: '', isSetup: false };
}
export function getAdminConfig() {
  try { const r = localStorage.getItem(ADMIN_KEY); return r ? JSON.parse(r) : getDefaultAdmin(); }
  catch { return getDefaultAdmin(); }
}
export function saveAdminConfig(cfg) { localStorage.setItem(ADMIN_KEY, JSON.stringify(cfg)); }

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
