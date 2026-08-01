import { 
  getAdminConfig, saveAdminConfig, getAllQuizzes, saveQuiz, deleteQuiz, getSubmissions, 
  getAllCertTemplates, deleteCertTemplate, getIdToken, setAuthSession
} from '../store.js';
import { renderNavbar, showToast, showModal, escapeHtml, copyTextToClipboard } from '../utils.js';
import { adminLogout, isAdminLoggedIn, initGoogleAuth, renderGoogleButton, hashPassword } from '../auth.js';

const SERVER_BASE = window.SERVER_BASE || '';

async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {};
  const token = getIdToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (SERVER_BASE) return fetch(`${SERVER_BASE}${path}`, { ...opts, headers });
  // no server: fallback to local operations (not implemented here)
  return Promise.reject(new Error('No server'));
}

export async function renderAdminLogin(app) {
  // Fetch server config to get Google Client ID if available
  let clientId = '';
  try {
    if (SERVER_BASE) {
      const r = await fetch(`${SERVER_BASE}/api/config`);
      if (r.ok) {
        const cfg = await r.json();
        clientId = cfg.googleClientId || '';
      }
    }
  } catch (e) { console.warn('Could not fetch server config', e); }

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-sm" style="padding-top: 50px">
        <div class="clay-card" style="padding: 3rem 2.5rem">
          <div style="text-align:center; margin-bottom: 0.75rem">
            <img src="logo.png" alt="Logo" style="height: 65px; object-fit: contain">
          </div>
          <h2 style="text-align:center; margin-bottom: 0.25rem; font-weight: 800; font-size: 1.75rem">Gyan Admin Login</h2>
          <p style="text-align:center; color: var(--text-sub); font-size: 0.9rem; margin-bottom: 2rem">Sign in with your Google account to access admin controls.</p>
          <div id="admin-google-btn" style="display:flex; justify-content:center"></div>
        </div>
      </div>
    </div>
  `;

  // Use provided clientId (server) or fall back to local admin config
  if (!clientId) clientId = getAdminConfig().googleClientId || '';
  const onSignIn = async (user) => {
    // After sign-in, check server config for admin emails
    try {
      let allowed = false;
      let adminEmails = [];
      if (SERVER_BASE) {
        const r = await fetch(`${SERVER_BASE}/api/config`);
        if (r.ok) {
          const cfg = await r.json();
          adminEmails = cfg.adminEmails || [];
        }
      } else {
        adminEmails = getAdminConfig().adminEmails || [];
      }
      if (adminEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
        // mark session as admin
        setAuthSession({ type: 'admin', id: user.email });
        showToast('Welcome, Admin!');
        window.location.hash = '#/admin';
      } else {
        showToast('Your Google account is not authorized as admin', 'error');
      }
    } catch (e) { showToast('Sign-in error', 'error'); console.error(e); }
  };

  initGoogleAuth(clientId, onSignIn);
  setTimeout(() => renderGoogleButton('admin-google-btn', clientId), 200);
}

export async function renderAdminPanel(app) {
  if (!isAdminLoggedIn()) {
    window.location.hash = '#/admin-login';
    return;
  }

  const cfg = getAdminConfig();
  const quizzes = await getAllQuizzes();
  const templates = await getAllCertTemplates();

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem">
          <div style="display:flex; align-items:center; gap: 1rem">
            <img src="logo.png" alt="Gyan Logo" style="height: 55px; object-fit: contain">
            <div>
              <h1 style="font-size: 1.8rem; font-weight: 900">⚙️ Admin Control Portal</h1>
              <p style="color: var(--text-sub); font-size: 0.9rem">Gyan's Quiz Arena — Manage quizzes, deadlines, live status & certificates.</p>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-logout">🚪 Logout Admin</button>
        </div>

        <!-- Quick Actions Bar -->
        <div style="display: flex; gap: 1rem; margin-bottom: 2.5rem; flex-wrap: wrap">
          <a href="#/create" class="btn btn-primary btn-lg">+ Create New Quiz</a>
          <a href="#/certificates/new" class="btn btn-success btn-lg">🎨 Design Certificate</a>
        </div>

        <!-- Quizzes & Live Controls -->
        <div style="margin-bottom: 3.5rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.25rem">
            <h2 style="font-size: 1.4rem; font-weight: 800; display:flex; align-items:center; gap: 0.5rem">
              📝 Quizzes & Live Controls
            </h2>
            <span class="badge badge-clay">${quizzes.length} Total</span>
          </div>

          ${quizzes.length > 0 ? `
            <div class="grid grid-2">
              ` + (await Promise.all(quizzes.map(async q => renderAdminQuizCard(q, (await getSubmissions(q.id)).length)))).join('') + `
            </div>
          ` : `
            <div class="clay-card" style="text-align:center; padding: 3rem">
              <div style="font-size: 3rem; margin-bottom: 0.5rem">📝</div>
              <h3>No Quizzes Created Yet</h3>
              <p style="color: var(--text-sub); margin: 0.5rem 0 1.5rem">Create your first quiz for Gyan's Quiz Arena.</p>
              <a href="#/create" class="btn btn-primary">+ Create First Quiz</a>
            </div>
          `}
        </div>

        <!-- Certificate Templates -->
        <div style="margin-bottom: 3.5rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.25rem">
            <h2 style="font-size: 1.4rem; font-weight: 800; display:flex; align-items:center; gap: 0.5rem">
              🎨 Certificate Templates
            </h2>
            <span class="badge badge-clay">${templates.length} Templates</span>
          </div>

          ${templates.length > 0 ? `
            <div class="grid grid-3">
              ${templates.map(t => `
                <div class="clay-card" style="display:flex; flex-direction:column; justify-content:space-between">
                  <div>
                    <div style="height: 110px; background: ${t.backgroundColor || '#fffdf7'}; border: 3px ${t.borderStyle || 'double'} ${t.borderColor || '#c8a96e'}; border-radius: var(--radius-sm); margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; color: #c8a96e; font-weight: 700; font-size: 0.95rem">
                      CERTIFICATE PREVIEW
                    </div>
                    <h4 style="font-size: 1.1rem; font-weight: 800">${escapeHtml(t.name)}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-sub); margin-top: 0.2rem">${t.elements?.length || 0} Dynamic Elements</p>
                  </div>
                  <div style="margin-top: 1.25rem; display: flex; gap: 0.5rem">
                    <a href="#/certificates/${t.id}" class="btn btn-secondary btn-sm" style="flex:1">✏️ Edit</a>
                    <button class="btn btn-danger btn-sm del-t" data-id="${t.id}">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="clay-card" style="text-align:center; padding: 2.5rem">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem">🎨</div>
              <h3>No Certificate Templates</h3>
              <p style="color: var(--text-sub); margin: 0.5rem 0 1.25rem">Create custom certificate templates with dynamic school logos & signatures.</p>
              <a href="#/certificates/new" class="btn btn-success btn-sm">+ Create Template</a>
            </div>
          `}
        </div>

        <!-- Platform & Security Settings -->
        <div class="clay-card">
          <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 1.5rem">⚙️ System & Security Settings</h2>
          
          <div class="grid grid-2">
            <!-- Google OAuth Settings -->
            <div style="background: var(--bg-input); padding: 1.5rem; border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.75rem">🔑 Google OAuth Configuration</h3>
              <p style="font-size: 0.8rem; color: var(--text-sub); margin-bottom: 1rem">
                Required for Google Sign-In and single-response enforcement.
              </p>
              <div class="form-group">
                <label class="form-label">Google Client ID</label>
                <input type="text" class="form-input" id="google-client-id" value="${escapeHtml(cfg.googleClientId || '')}" placeholder="xxxx.apps.googleusercontent.com">
              </div>
              <button class="btn btn-primary btn-sm" id="btn-save-oauth">Save OAuth Settings</button>
            </div>

            <!-- Password & Admin Emails -->
            <div style="background: var(--bg-input); padding: 1.5rem; border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.75rem">🔒 Change Admin Password</h3>
              <div class="form-group" style="margin-bottom: 0.75rem">
                <input type="password" class="form-input" id="current-pass" placeholder="Current Password">
              </div>
              <div class="form-group" style="margin-bottom: 0.75rem">
                <input type="password" class="form-input" id="new-pass" placeholder="New Password">
              </div>
              <button class="btn btn-primary btn-sm" id="btn-change-pass">Update Password</button>

              <hr style="border:none; border-top:1px solid rgba(160,195,230,0.3); margin: 1.25rem 0">
              
              <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem">👥 Authorized Admin Emails</h3>
              <div id="admin-emails-list" style="margin-bottom: 0.75rem">
                ${(cfg.adminEmails || []).map((e, idx) => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.35rem 0.75rem; background: #fff; border-radius: var(--radius-sm); margin-bottom: 0.4rem; font-size: 0.85rem">
                    <span>${escapeHtml(e)}</span>
                    <button class="btn btn-danger btn-sm remove-email" data-idx="${idx}" style="padding: 0.2rem 0.5rem; font-size: 0.7rem">✕</button>
                  </div>
                `).join('')}
              </div>
              <div style="display:flex; gap: 0.5rem">
                <input type="email" class="form-input" id="new-admin-email" placeholder="admin@gyan.edu" style="flex:1">
                <button class="btn btn-secondary btn-sm" id="btn-add-email">+ Add</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Bind Logout
  app.querySelector('#btn-logout').addEventListener('click', () => {
    adminLogout();
    showToast('Logged out of Admin Portal');
    window.location.hash = '#/';
  });

  // Toggle Live / Stop Quiz
  app.querySelectorAll('.toggle-live').forEach(b => {
    b.addEventListener('click', () => {
      const q = quizzes.find(x => x.id === b.dataset.id);
      if (q) {
        q.isPublished = !q.isPublished;
        saveQuiz(q);
        showToast(q.isPublished ? 'Quiz is now LIVE! 🚀' : 'Quiz STOPPED (Inactive)');
        renderAdminPanel(app);
      }
    });
  });

  // Delete Quiz
  app.querySelectorAll('.del-quiz').forEach(b => {
    b.addEventListener('click', () => {
      showModal('Delete Quiz?', '<p>This quiz and all participant responses will be permanently deleted.</p>', () => {
        deleteQuiz(b.dataset.id);
        showToast('Quiz deleted');
        renderAdminPanel(app);
      });
    });
  });

  // Share Quiz Link
  app.querySelectorAll('.share-quiz').forEach(b => {
    b.addEventListener('click', () => {
      const url = `${window.location.origin}${window.location.pathname}#/take/${b.dataset.id}`;
      copyTextToClipboard(url).then(ok => {
        if (ok) showToast('Quiz link copied to clipboard! 📋');
        else showToast(url, 'info');
      });
    });
  });

  // Delete Template
  app.querySelectorAll('.del-t').forEach(b => {
    b.addEventListener('click', () => {
      showModal('Delete Template?', '<p>Delete this certificate template permanently?</p>', () => {
        deleteCertTemplate(b.dataset.id);
        showToast('Template deleted');
        renderAdminPanel(app);
      });
    });
  });

  // OAuth save
  app.querySelector('#btn-save-oauth').addEventListener('click', () => {
    const c = getAdminConfig();
    c.googleClientId = app.querySelector('#google-client-id').value.trim();
    saveAdminConfig(c);
    showToast('Google OAuth Client ID saved!');
  });

  // Password update
  app.querySelector('#btn-change-pass').addEventListener('click', async () => {
    const cur = app.querySelector('#current-pass').value;
    const nw = app.querySelector('#new-pass').value;
    if (!cur || !nw) { showToast('Fill current and new password', 'error'); return; }
    if (nw.length < 4) { showToast('Min 4 characters', 'error'); return; }
    const c = getAdminConfig();
    const curHash = await hashPassword(cur);
    if (curHash !== c.passwordHash) { showToast('Current password is incorrect', 'error'); return; }
    c.passwordHash = await hashPassword(nw);
    saveAdminConfig(c);
    showToast('Admin password updated successfully!');
    app.querySelector('#current-pass').value = '';
    app.querySelector('#new-pass').value = '';
  });

  // Add Admin Email
  app.querySelector('#btn-add-email').addEventListener('click', () => {
    const email = app.querySelector('#new-admin-email').value.trim().toLowerCase();
    if (!email || !email.includes('@')) { showToast('Enter a valid email address', 'error'); return; }
    const c = getAdminConfig();
    if (!c.adminEmails) c.adminEmails = [];
    if (c.adminEmails.includes(email)) { showToast('Email already in admin list', 'error'); return; }
    c.adminEmails.push(email);
    saveAdminConfig(c);
    showToast('Admin email added!');
    renderAdminPanel(app);
  });

  // Remove Admin Email
  app.querySelectorAll('.remove-email').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getAdminConfig();
      c.adminEmails.splice(parseInt(btn.dataset.idx), 1);
      saveAdminConfig(c);
      showToast('Admin email removed');
      renderAdminPanel(app);
    });
  });
}

function renderAdminQuizCard(quiz, subsCount) {
  const qCount = quiz.questions?.length || 0;
  const totalPts = quiz.questions?.reduce((s, q) => s + (q.points || 1), 0) || 0;
  const isLive = quiz.isPublished;

  let deadlineTxt = 'No deadline';
  if (quiz.deadline) {
    const d = new Date(quiz.deadline);
    if (!isNaN(d.getTime())) deadlineTxt = `Deadline: ${d.toLocaleString()}`;
  }

  return `
    <div class="clay-card quiz-card">
      <div>
        <div class="quiz-card-header">
          <div>
            <div class="quiz-card-title">${escapeHtml(quiz.title || 'Untitled Quiz')}</div>
            <div style="color: var(--text-sub); font-size: 0.8rem; margin-top: 0.2rem">
              ${escapeHtml(quiz.description || 'No description provided')}
            </div>
          </div>
          <span class="badge ${isLive ? 'badge-success' : 'badge-danger'}">
            ${isLive ? '🟢 LIVE' : '⏸️ STOPPED'}
          </span>
        </div>

        <div class="quiz-card-meta">
          <span>📋 ${qCount} Questions</span>
          <span>⭐ ${totalPts} Points</span>
          <span>⏱️ ${quiz.timerMinutes || 30} min</span>
          <span>👥 ${subsCount || 0} Responses</span>
          <span>⏰ ${deadlineTxt}</span>
        </div>
      </div>

      <div style="display:flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem">
        <button class="btn ${isLive ? 'btn-secondary' : 'btn-primary'} btn-sm toggle-live" data-id="${quiz.id}">
          ${isLive ? '⏸️ Stop Quiz' : '🚀 Make Live'}
        </button>
        <a href="#/edit/${quiz.id}" class="btn btn-secondary btn-sm">✏️ Edit</a>
        <button class="btn btn-secondary btn-sm share-quiz" data-id="${quiz.id}">🔗 Copy Link</button>
        <a href="#/responses/${quiz.id}" class="btn btn-secondary btn-sm">📊 Responses (${subsCount || 0})</a>
        <button class="btn btn-danger btn-sm del-quiz" data-id="${quiz.id}" style="margin-left:auto">🗑️</button>
      </div>
    </div>
  `;
}
