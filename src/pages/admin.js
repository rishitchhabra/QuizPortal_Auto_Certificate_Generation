import { 
  getAdminConfigAsync, saveAdminConfig, getAllQuizzes, saveQuiz, deleteQuiz, getSubmissions, 
  getAllCertTemplates, deleteCertTemplate 
} from '../store.js';
import { renderNavbar, showToast, showModal, escapeHtml, copyTextToClipboard } from '../utils.js';
import { setupAdmin, adminLogin, adminLogout, isAdminLoggedIn, hashPassword } from '../auth.js';

export async function renderAdminLogin(app) {
  let cfg;
  try {
    cfg = await getAdminConfigAsync();
  } catch (err) {
    console.error('Admin login load error:', err);
    app.innerHTML = `
      ${renderNavbar()}
      <div class="page fade-in">
        <div class="container-sm" style="padding-top: 60px">
          <div class="clay-card" style="text-align:center; padding: 3rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem">⚠️</div>
            <h2 style="margin-bottom: 0.5rem">Server Unavailable</h2>
            <p style="color: var(--text-sub); margin-bottom: 0.5rem">Cannot reach the server. Please check if the backend is running.</p>
            <p style="color: var(--text-sub); font-size: 0.8rem; margin-bottom: 1.5rem">Error: ${escapeHtml(err.message || 'Unknown error')}</p>
            <button class="btn btn-primary" onclick="location.reload()">🔄 Retry</button>
          </div>
        </div>
      </div>
    `;
    return;
  }
  const needsSetup = !cfg.isSetup;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-sm" style="padding-top: 50px">
        <div class="clay-card" style="padding: 3rem 2.5rem">
          <div style="text-align:center; margin-bottom: 0.75rem">
            <img src="logo.png" alt="Logo" style="height: 65px; object-fit: contain">
          </div>
          <h2 style="text-align:center; margin-bottom: 0.25rem; font-weight: 800; font-size: 1.75rem">
            ${needsSetup ? 'Gyan Admin Setup' : 'Gyan Admin Portal'}
          </h2>
          <p style="text-align:center; color: var(--text-sub); font-size: 0.9rem; margin-bottom: 2rem">
            ${needsSetup ? 'Create your master admin ID and password.' : 'Enter your admin credentials.'}
          </p>
          
          <div class="form-group">
            <label class="form-label">Admin ID</label>
            <input type="text" class="form-input" id="admin-id" value="${needsSetup ? 'admin' : ''}" placeholder="Enter Admin ID">
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="admin-pass" placeholder="Enter Password">
          </div>
          
          ${needsSetup ? `
            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <input type="password" class="form-input" id="admin-pass2" placeholder="Confirm Password">
            </div>
          ` : ''}
          
          <button class="btn btn-primary btn-lg" style="width: 100%; margin-top: 0.5rem" id="btn-admin-submit">
            ${needsSetup ? '🚀 Setup Admin Portal' : '🔓 Login to Admin Portal'}
          </button>
        </div>
      </div>
    </div>
  `;

  app.querySelector('#btn-admin-submit').addEventListener('click', async () => {
    const id = app.querySelector('#admin-id').value.trim();
    const pass = app.querySelector('#admin-pass').value;
    if (!id || !pass) { showToast('Please fill all fields', 'error'); return; }

    if (needsSetup) {
      const pass2 = app.querySelector('#admin-pass2').value;
      if (pass !== pass2) { showToast('Passwords do not match', 'error'); return; }
      if (pass.length < 4) { showToast('Password must be at least 4 characters', 'error'); return; }
      await setupAdmin(id, pass);
      showToast('Admin setup complete! Welcome 🎉');
      window.location.hash = '#/admin';
    } else {
      const ok = await adminLogin(id, pass);
      if (ok) {
        showToast('Welcome back Admin!');
        window.location.hash = '#/admin';
      } else {
        showToast('Invalid ID or Password', 'error');
      }
    }
  });

  app.querySelector('#admin-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') app.querySelector('#btn-admin-submit').click();
  });
}

export async function renderAdminPanel(app) {
  if (!isAdminLoggedIn()) {
    window.location.hash = '#/admin-login';
    return;
  }

  // Show loading state immediately so the page isn't blank
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container" style="text-align:center; padding-top: 100px;">
        <div class="clay-card" style="max-width: 400px; margin: 0 auto; padding: 3rem;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite">⚙️</div>
          <h3>Loading Admin Panel...</h3>
          <p style="color: var(--text-sub); font-size: 0.85rem; margin-top: 0.5rem">Fetching data from server</p>
        </div>
      </div>
    </div>
  `;

  let cfg, quizzes, templates;
  try {
    [cfg, quizzes, templates] = await Promise.all([
      getAdminConfigAsync(),
      getAllQuizzes(),
      getAllCertTemplates()
    ]);
    if (!cfg) cfg = {};
    if (!Array.isArray(cfg.adminEmails)) {
      if (typeof cfg.adminEmails === 'string') {
        try { cfg.adminEmails = JSON.parse(cfg.adminEmails); } catch { cfg.adminEmails = []; }
      } else {
        cfg.adminEmails = [];
      }
    }
    if (!Array.isArray(quizzes)) quizzes = [];
    if (!Array.isArray(templates)) templates = [];
  } catch (err) {
    console.error('Admin panel load error:', err);
    app.innerHTML = `
      ${renderNavbar()}
      <div class="page fade-in">
        <div class="container" style="text-align:center; padding-top: 80px;">
          <div class="clay-card" style="max-width: 500px; margin: 0 auto; padding: 3rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem">⚠️</div>
            <h2 style="margin-bottom: 0.5rem">Failed to Load Admin Panel</h2>
            <p style="color: var(--text-sub); margin-bottom: 0.5rem">Could not connect to the server. Please check if the backend is running.</p>
            <p style="color: var(--text-sub); font-size: 0.8rem; margin-bottom: 1.5rem">Error: ${escapeHtml(err.message || 'Unknown error')}</p>
            <button class="btn btn-primary" onclick="location.reload()">🔄 Retry</button>
            <a href="#/" class="btn btn-secondary" style="margin-left: 0.5rem">Go Home</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

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
          <a href="#/certificates/new" class="btn btn-success btn-lg">📤 Upload Certificate Template</a>
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
              🎓 Certificate Templates
            </h2>
            <div style="display:flex; gap: 0.5rem; align-items:center">
              <span class="badge badge-clay">${templates.length} Templates</span>
              <a href="#/certificates/new" class="btn btn-success btn-sm">+ Upload New Template</a>
            </div>
          </div>

          ${templates.length > 0 ? `
            <div class="grid grid-3">
              ${templates.map(t => {
                const isPptx = t.type === 'pptx';
                return `
                <div class="clay-card" style="display:flex; flex-direction:column; justify-content:space-between">
                  <div>
                    ${isPptx ? `
                      <div style="height: 110px; background: linear-gradient(135deg, #fff1f2, #fef3c7); border: 2px solid rgba(234,88,12,0.2); border-radius: var(--radius-sm); margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 0.3rem">
                        <div style="font-size: 2.5rem">📄</div>
                        <div style="font-size: 0.78rem; font-weight: 800; color: #ea580c">PPTX Template</div>
                      </div>
                    ` : t.backgroundImage ? `
                      <div style="height: 140px; border-radius: var(--radius-sm); margin-bottom: 1rem; overflow:hidden; background: #f1f5f9">
                        <img class="tmpl-preview-img" data-tmplid="${t.id}" style="width:100%; height:100%; object-fit:cover" alt="Certificate Preview">
                      </div>
                    ` : `
                      <div style="height: 110px; background: #fffdf7; border: 3px double #c8a96e; border-radius: var(--radius-sm); margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; color: #c8a96e; font-weight: 700; font-size: 0.95rem">
                        CERTIFICATE PREVIEW
                      </div>
                    `}
                    <h4 style="font-size: 1.1rem; font-weight: 800">${escapeHtml(t.name || 'Untitled Template')}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-sub); margin-top: 0.2rem">
                      ${isPptx ? '📄 PowerPoint Template — Auto Placeholder Replacement' : t.backgroundImage ? '🖼️ Image + Text Overlay Template' : `${t.elements?.length || 0} Text Elements`}
                    </p>
                  </div>
                  <div style="margin-top: 1.25rem; display: flex; gap: 0.5rem">
                    <a href="#/certificates/${t.id}" class="btn btn-secondary btn-sm" style="flex:1">✏️ Edit</a>
                    <button class="btn btn-danger btn-sm del-t" data-id="${t.id}">🗑️</button>
                  </div>
                </div>
              `}).join('')}
            </div>
          ` : `
            <div class="clay-card" style="text-align:center; padding: 2.5rem">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem">🎓</div>
              <h3>No Certificate Templates</h3>
              <p style="color: var(--text-sub); margin: 0.5rem 0 1.25rem">Upload custom certificate designs with your school logo & branding.</p>
              <a href="#/certificates/new" class="btn btn-success btn-sm">+ Upload First Template</a>
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
                ${(Array.isArray(cfg.adminEmails) ? cfg.adminEmails : []).map((e, idx) => `
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

  // Set template preview images programmatically (base64 too large for innerHTML)
  app.querySelectorAll('.tmpl-preview-img').forEach(img => {
    const tmpl = templates.find(t => t.id === img.dataset.tmplid);
    if (tmpl?.backgroundImage) img.src = tmpl.backgroundImage;
  });

  // Bind Logout
  app.querySelector('#btn-logout').addEventListener('click', () => {
    adminLogout();
    showToast('Logged out of Admin Portal');
    window.location.hash = '#/';
  });

  // Toggle Live / Stop Quiz
  app.querySelectorAll('.toggle-live').forEach(b => {
    b.addEventListener('click', async () => {
      const q = quizzes.find(x => x.id === b.dataset.id);
      if (q) {
        q.isPublished = !q.isPublished;
        await saveQuiz(q);
        showToast(q.isPublished ? 'Quiz is now LIVE! 🚀' : 'Quiz STOPPED (Inactive)');
        renderAdminPanel(app);
      }
    });
  });

  // Delete Quiz
  app.querySelectorAll('.del-quiz').forEach(b => {
    b.addEventListener('click', () => {
      showModal('Delete Quiz?', '<p>This quiz and all participant responses will be permanently deleted.</p>', async () => {
        await deleteQuiz(b.dataset.id);
        showToast('Quiz deleted');
        renderAdminPanel(app);
      });
    });
  });

  // Share Quiz Link
  app.querySelectorAll('.share-quiz').forEach(b => {
    b.addEventListener('click', () => {
      const url = `${window.location.origin}/#/take/${b.dataset.id}`;
      copyTextToClipboard(url).then(ok => {
        if (ok) showToast('Quiz link copied to clipboard! 📋');
        else showToast(url, 'info');
      });
    });
  });

  // Delete Template
  app.querySelectorAll('.del-t').forEach(b => {
    b.addEventListener('click', () => {
      showModal('Delete Template?', '<p>Delete this certificate template permanently?</p>', async () => {
        await deleteCertTemplate(b.dataset.id);
        showToast('Template deleted');
        renderAdminPanel(app);
      });
    });
  });

  // OAuth save
  app.querySelector('#btn-save-oauth').addEventListener('click', async () => {
    const c = await getAdminConfigAsync();
    c.googleClientId = app.querySelector('#google-client-id').value.trim();
    const cur = prompt('Enter current admin password to save settings');
    if (!cur) { showToast('Password required', 'error'); return; }
    const curHash = await hashPassword(cur);
    await saveAdminConfig({ id: c.id, currentPasswordHash: curHash, adminEmails: c.adminEmails || [], googleClientId: c.googleClientId || '' });
    showToast('Google OAuth Client ID saved!');
  });

  // Password update
  app.querySelector('#btn-change-pass').addEventListener('click', async () => {
    const cur = app.querySelector('#current-pass').value;
    const nw = app.querySelector('#new-pass').value;
    if (!cur || !nw) { showToast('Fill current and new password', 'error'); return; }
    if (nw.length < 4) { showToast('Min 4 characters', 'error'); return; }
    const c = await getAdminConfigAsync();
    const curHash = await hashPassword(cur);
    const newHash = await hashPassword(nw);
    await saveAdminConfig({ id: c.id, currentPasswordHash: curHash, passwordHash: newHash, adminEmails: c.adminEmails || [], googleClientId: c.googleClientId || '' });
    showToast('Admin password updated successfully!');
    app.querySelector('#current-pass').value = '';
    app.querySelector('#new-pass').value = '';
  });

  // Add Admin Email
  app.querySelector('#btn-add-email').addEventListener('click', async () => {
    const email = app.querySelector('#new-admin-email').value.trim().toLowerCase();
    if (!email || !email.includes('@')) { showToast('Enter a valid email address', 'error'); return; }
    const c = await getAdminConfigAsync();
    if (!c.adminEmails) c.adminEmails = [];
    if (c.adminEmails.includes(email)) { showToast('Email already in admin list', 'error'); return; }
    c.adminEmails.push(email);
    const cur = prompt('Enter current admin password to update admin emails');
    if (!cur) { showToast('Password required', 'error'); return; }
    const curHash = await hashPassword(cur);
    await saveAdminConfig({ id: c.id, currentPasswordHash: curHash, adminEmails: c.adminEmails, googleClientId: c.googleClientId || '' });
    showToast('Admin email added!');
    renderAdminPanel(app);
  });

  // Remove Admin Email
  app.querySelectorAll('.remove-email').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = await getAdminConfigAsync();
      c.adminEmails.splice(parseInt(btn.dataset.idx), 1);
      const cur = prompt('Enter current admin password to update admin emails');
      if (!cur) { showToast('Password required', 'error'); return; }
      const curHash = await hashPassword(cur);
      await saveAdminConfig({ id: c.id, currentPasswordHash: curHash, adminEmails: c.adminEmails, googleClientId: c.googleClientId || '' });
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
