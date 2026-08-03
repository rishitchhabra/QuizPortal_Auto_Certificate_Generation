import {
  getAdminConfigAsync, saveAdminConfig, getAllQuizzes, saveQuiz, deleteQuiz, getSubmissions,
  getAllCertTemplates, deleteCertTemplate
} from '../store.js';
import { renderNavbar, showToast, showModal, escapeHtml, copyTextToClipboard, bindNavbar, subjectFor } from '../utils.js';
import { setupAdmin, adminLogin, adminLogout, isAdminLoggedIn, hashPassword } from '../auth.js';
import { Icon, Badge, Btn, StatCard, EmptyState, SectionHead, Dropdown, IconBtn, Inp, Field } from '../components.js';

export async function renderAdminLogin(app) {
  let cfg;
  try {
    cfg = await getAdminConfigAsync();
  } catch (err) {
    console.error('Admin login load error:', err);
    app.innerHTML = `
      ${renderNavbar()}
      <div class="page fade-in">
        <div class="container-narrow" style="padding-top:40px">
          <div class="card" style="padding:40px; text-align:center">
            <div class="empty-icon" style="margin:0 auto 16px">${Icon('alert-circle', 26)}</div>
            <h2 style="font-size:20px; font-weight:700; margin-bottom:6px">Server Unavailable</h2>
            <p class="muted sm" style="margin-bottom:4px">Cannot reach the server. Please check if the backend is running.</p>
            <p class="xs text-3" style="margin-bottom:20px">${escapeHtml(err.message || 'Unknown error')}</p>
            <button class="btn btn-primary" onclick="location.reload()">${Icon('refresh-cw', 15)}<span>Retry</span></button>
          </div>
        </div>
      </div>`;
    return;
  }
  const needsSetup = !cfg.isSetup;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-narrow" style="padding-top:32px">
        <div class="card card-hover" style="padding:40px 32px">
          <div style="text-align:center; margin-bottom:24px">
            <img src="/logo.png" alt="Gyan International School" style="height:40px; margin:0 auto 16px">
            <h1 style="font-size:22px; font-weight:800; letter-spacing:-0.02em">${needsSetup ? 'Set up the admin portal' : 'Welcome back'}</h1>
            <p class="muted sm" style="margin-top:4px">${needsSetup ? 'Create your master admin ID and password.' : 'Sign in with your admin credentials.'}</p>
          </div>

          ${Field({ label: 'Admin ID', htmlFor: 'admin-id', control: Inp({ id: 'admin-id', value: needsSetup ? 'admin' : '', placeholder: 'Enter Admin ID', attrs: 'autocomplete="username"' }) })}
          ${Field({ label: 'Password', htmlFor: 'admin-pass', control: Inp({ type: 'password', id: 'admin-pass', placeholder: 'Enter Password', attrs: 'autocomplete="current-password"' }) })}
          ${needsSetup ? Field({ label: 'Confirm Password', htmlFor: 'admin-pass2', control: Inp({ type: 'password', id: 'admin-pass2', placeholder: 'Confirm Password' }) }) : ''}

          <button class="btn btn-primary btn-lg btn-block" id="btn-admin-submit">
            ${Icon(needsSetup ? 'shield' : 'log-in', 16)}<span>${needsSetup ? 'Set Up Admin Portal' : 'Sign In'}</span>
          </button>
        </div>
      </div>
    </div>`;

  bindNavbar(app);
  app.querySelector('#btn-admin-submit').addEventListener('click', async () => {
    const id = app.querySelector('#admin-id').value.trim();
    const pass = app.querySelector('#admin-pass').value;
    if (!id || !pass) { showToast('Please fill all fields', 'error'); return; }

    if (needsSetup) {
      const pass2 = app.querySelector('#admin-pass2').value;
      if (pass !== pass2) { showToast('Passwords do not match', 'error'); return; }
      if (pass.length < 4) { showToast('Password must be at least 4 characters', 'error'); return; }
      await setupAdmin(id, pass);
      showToast('Admin setup complete');
      window.location.hash = '#/admin';
    } else {
      const ok = await adminLogin(id, pass);
      if (ok) {
        showToast('Welcome back, Admin');
        window.location.hash = '#/admin';
      } else {
        showToast('Invalid ID or Password', 'error');
      }
    }
  });

  app.querySelector('#admin-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') app.querySelector('#btn-admin-submit').click();
  });
  setTimeout(() => app.querySelector('#admin-id')?.focus(), 30);
}

export async function renderAdminPanel(app) {
  if (!isAdminLoggedIn()) {
    window.location.hash = '#/admin-login';
    return;
  }

  // Loading state
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container" style="padding-top:64px">
        <div class="card" style="max-width:420px; margin:0 auto; padding:40px; text-align:center">
          <div class="empty-icon" style="margin:0 auto 16px"><svg class="icon icon-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
          <h3 style="font-size:16px; font-weight:700">Loading dashboard…</h3>
          <p class="xs muted" style="margin-top:4px">Fetching quizzes, responses and templates</p>
        </div>
      </div>
    </div>`;

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
        <div class="container-narrow" style="padding-top:40px">
          <div class="card" style="padding:40px; text-align:center">
            <div class="empty-icon" style="margin:0 auto 16px">${Icon('alert-circle', 26)}</div>
            <h2 style="font-size:20px; font-weight:700; margin-bottom:6px">Failed to load admin panel</h2>
            <p class="muted sm" style="margin-bottom:4px">Could not connect to the server.</p>
            <p class="xs text-3" style="margin-bottom:20px">${escapeHtml(err.message || 'Unknown error')}</p>
            <div style="display:flex; gap:10px; justify-content:center">
              <button class="btn btn-primary" onclick="location.reload()">${Icon('refresh-cw', 15)}<span>Retry</span></button>
              <a href="#/" class="btn btn-secondary">${Icon('home', 15)}<span>Go Home</span></a>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  // Compute stats
  const liveCount = quizzes.filter(q => q.isPublished).length;
  const draftCount = quizzes.length - liveCount;
  let totalResponses = 0;
  let totalPassed = 0;
  const subsByQuiz = {};
  await Promise.all(quizzes.map(async (q) => {
    try {
      const subs = await getSubmissions(q.id);
      subsByQuiz[q.id] = subs.length;
      totalResponses += subs.length;
      totalPassed += subs.filter(s => s.passed).length;
    } catch { subsByQuiz[q.id] = 0; }
  }));

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">

        <!-- Header -->
        <div class="page-head" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px">
          <div>
            <div class="eyebrow">${Icon('layout', 14)}<span>Admin Portal</span></div>
            <h1 class="page-title" style="font-size:32px">Dashboard</h1>
            <p class="page-sub" style="margin-top:8px">Manage quizzes, live status, responses and certificate templates.</p>
          </div>
          <div class="page-head-actions">
            <button class="btn btn-ghost btn-sm" id="btn-logout">${Icon('log-out', 14)}<span>Logout</span></button>
            <a href="#/create" class="btn btn-primary">${Icon('plus', 15)}<span>New Quiz</span></a>
          </div>
        </div>

        <!-- Stats row -->
        <div class="stat-row" style="margin-bottom:32px">
          ${StatCard({ icon: 'zap', label: 'Live quizzes', value: liveCount, tone: 'green' })}
          ${StatCard({ icon: 'file-text', label: 'Drafts', value: draftCount, tone: 'gray' })}
          ${StatCard({ icon: 'users', label: 'Responses', value: totalResponses, tone: 'blue' })}
          ${StatCard({ icon: 'award', label: 'Certificates issued', value: totalPassed, tone: 'amber' })}
          ${StatCard({ icon: 'layers', label: 'Templates', value: templates.length, tone: 'violet' })}
        </div>

        <!-- Quizzes -->
        <div class="section-head">
          <div>
            <h2 class="section-title">Quizzes</h2>
            <p class="section-sub">${quizzes.length} total · tap a row action to edit, share, or manage responses</p>
          </div>
        </div>

        <div class="toolbar-row" style="margin-bottom:16px">
          <div class="search-wrap" style="flex:1; max-width:340px">
            ${Icon('search', 16)}
            <input type="text" class="input" id="quiz-search" placeholder="Search quizzes…" aria-label="Search quizzes">
          </div>
          <select class="input select" id="quiz-filter" style="width:auto" aria-label="Filter quizzes">
            <option value="all">All statuses</option>
            <option value="live">Live</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        ${quizzes.length > 0 ? `
          <div class="table-wrap">
            <table class="table" id="quiz-table" style="min-width:860px">
              <thead>
                <tr>
                  <th style="width:110px">Status</th>
                  <th>Quiz</th>
                  <th style="width:90px">Questions</th>
                  <th style="width:100px">Responses</th>
                  <th style="width:150px">Deadline</th>
                  <th style="width:140px">Last edited</th>
                  <th style="width:150px; text-align:right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${quizzes.map(q => renderQuizRow(q, subsByQuiz[q.id] || 0)).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="card">
            ${EmptyState({
              icon: 'list-checks',
              title: 'No quizzes yet',
              desc: 'Create your first quiz to start collecting responses and issuing certificates.',
              action: `<a href="#/create" class="btn btn-primary">${Icon('plus', 15)}<span>Create First Quiz</span></a>`
            })}
          </div>
        `}

        <!-- Certificate templates -->
        <div class="section-head">
          <div>
            <h2 class="section-title">Certificate templates</h2>
            <p class="section-sub">${templates.length} template${templates.length === 1 ? '' : 's'} · attach these to quizzes to issue certificates</p>
          </div>
          <div class="section-action">
            <a href="#/certificates/new" class="btn btn-secondary btn-sm">${Icon('upload', 14)}<span>Upload Template</span></a>
          </div>
        </div>

        ${templates.length > 0 ? `
          <div class="grid grid-3">
            ${templates.map(t => renderTemplateCard(t)).join('')}
          </div>
        ` : `
          <div class="card">
            ${EmptyState({
              icon: 'layers',
              title: 'No certificate templates',
              desc: 'Upload a branded certificate design so students can download it after passing.',
              action: `<a href="#/certificates/new" class="btn btn-secondary">${Icon('upload', 15)}<span>Upload First Template</span></a>`
            })}
          </div>
        `}

        <!-- System settings -->
        <div class="section-head">
          <div>
            <h2 class="section-title">System &amp; security</h2>
            <p class="section-sub">Google OAuth configuration, admin password, and authorized admin emails.</p>
          </div>
        </div>

        <div class="grid grid-2" style="align-items:start">
          <div class="card card-pad">
            <h3 style="font-size:15px; font-weight:700; margin-bottom:4px">Google OAuth</h3>
            <p class="muted sm" style="margin-bottom:16px">Required for Google Sign-In and single-response enforcement.</p>
            ${Field({ label: 'Google Client ID', htmlFor: 'google-client-id', control: Inp({ id: 'google-client-id', value: cfg.googleClientId || '', placeholder: 'xxxx.apps.googleusercontent.com' }) })}
            <button class="btn btn-primary btn-sm" id="btn-save-oauth">${Icon('save', 14)}<span>Save OAuth Settings</span></button>
          </div>

          <div class="card card-pad">
            <h3 style="font-size:15px; font-weight:700; margin-bottom:16px">Admin credentials</h3>
            <div class="field-two" style="margin-bottom:14px">
              ${Field({ label: 'Current password', control: Inp({ type: 'password', id: 'current-pass', placeholder: 'Current password' }) })}
              ${Field({ label: 'New password', control: Inp({ type: 'password', id: 'new-pass', placeholder: 'New password' }) })}
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-change-pass">${Icon('lock', 14)}<span>Update Password</span></button>

            <div style="border-top:1px solid var(--border); margin:22px 0 16px"></div>

            <h3 style="font-size:15px; font-weight:700; margin-bottom:4px">Authorized admin emails</h3>
            <p class="muted sm" style="margin-bottom:12px">Users signed in with these Google accounts can access the admin portal.</p>
            <div id="admin-emails-list" style="margin-bottom:12px">
              ${(Array.isArray(cfg.adminEmails) ? cfg.adminEmails : []).map((e, idx) => `
                <div class="flex justify-between items-center" style="padding:8px 12px; border:1px solid var(--border); border-radius:var(--r-sm); margin-bottom:6px">
                  <span class="sm">${escapeHtml(e)}</span>
                  <button class="icon-btn icon-btn-sm icon-btn-danger remove-email" data-idx="${idx}" aria-label="Remove ${escapeHtml(e)}">${Icon('x', 14)}</button>
                </div>
              `).join('')}
            </div>
            <div class="flex" style="gap:8px">
              <input type="email" class="input" id="new-admin-email" placeholder="teacher@gyan.edu" style="height:38px; flex:1" aria-label="New admin email">
              <button class="btn btn-secondary btn-sm" id="btn-add-email">${Icon('plus', 14)}<span>Add</span></button>
            </div>
          </div>
        </div>

      </div>
    </div>`;

  bindNavbar(app);

  // Set template preview images programmatically
  app.querySelectorAll('.tmpl-preview-img').forEach(img => {
    const tmpl = templates.find(t => t.id === img.dataset.tmplid);
    if (tmpl?.backgroundImage) img.src = tmpl.backgroundImage;
  });

  // --- Actions ---
  app.querySelector('#btn-logout').addEventListener('click', () => {
    adminLogout();
    showToast('Logged out of Admin Portal');
    window.location.hash = '#/';
  });

  // Live toggle / archive
  app.querySelectorAll('.toggle-live').forEach(b => {
    b.addEventListener('click', async () => {
      const q = quizzes.find(x => x.id === b.dataset.id);
      if (q) {
        q.isPublished = !q.isPublished;
        await saveQuiz(q);
        showToast(q.isPublished ? 'Quiz is now live' : 'Quiz moved to drafts');
        renderAdminPanel(app);
      }
    });
  });

  // Delete quiz
  app.querySelectorAll('.del-quiz').forEach(b => {
    b.addEventListener('click', () => {
      showModal('Delete this quiz?', '<p>This quiz and all participant responses will be permanently deleted. This cannot be undone.</p>', async () => {
        await deleteQuiz(b.dataset.id);
        showToast('Quiz deleted');
        renderAdminPanel(app);
      }, { confirmText: 'Delete', danger: true });
    });
  });

  // Duplicate quiz
  app.querySelectorAll('.dup-quiz').forEach(b => {
    b.addEventListener('click', async () => {
      const q = quizzes.find(x => x.id === b.dataset.id);
      if (!q) return;
      const copy = JSON.parse(JSON.stringify(q));
      delete copy.createdAt;
      copy.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      copy.title = (q.title || 'Untitled Quiz') + ' (copy)';
      copy.isPublished = false;
      await saveQuiz(copy);
      showToast('Quiz duplicated');
      renderAdminPanel(app);
    });
  });

  // Share link
  app.querySelectorAll('.share-quiz').forEach(b => {
    b.addEventListener('click', () => {
      const url = `${window.location.origin}/#/take/${b.dataset.id}`;
      copyTextToClipboard(url).then(ok => {
        if (ok) showToast('Quiz link copied to clipboard');
        else showToast(url, 'info');
      });
    });
  });

  // Delete template
  app.querySelectorAll('.del-t').forEach(b => {
    b.addEventListener('click', () => {
      showModal('Delete this template?', '<p>Delete this certificate template permanently?</p>', async () => {
        await deleteCertTemplate(b.dataset.id);
        showToast('Template deleted');
        renderAdminPanel(app);
      }, { confirmText: 'Delete', danger: true });
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
    showToast('Google OAuth Client ID saved');
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
    showToast('Admin password updated');
    app.querySelector('#current-pass').value = '';
    app.querySelector('#new-pass').value = '';
  });

  // Add admin email
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
    showToast('Admin email added');
    renderAdminPanel(app);
  });

  // Remove admin email
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

  // Search + filter
  const searchInput = app.querySelector('#quiz-search');
  const filterSelect = app.querySelector('#quiz-filter');
  const applyFilter = () => {
    const q = (searchInput?.value || '').toLowerCase();
    const f = filterSelect?.value || 'all';
    app.querySelectorAll('#quiz-table tbody tr[data-id]').forEach(row => {
      const title = (row.dataset.title || '').toLowerCase();
      const status = row.dataset.status;
      const matchQ = !q || title.includes(q);
      const matchF = f === 'all' || status === f;
      row.style.display = (matchQ && matchF) ? '' : 'none';
    });
  };
  searchInput?.addEventListener('input', applyFilter);
  filterSelect?.addEventListener('change', applyFilter);

  bindDropdowns(app);
}

function renderQuizRow(quiz, subsCount) {
  const isLive = quiz.isPublished;
  const qCount = quiz.questions?.length || 0;
  const deadlineTxt = formatDeadline(quiz.deadline);
  const createdTxt = formatCreated(quiz.createdAt);
  const title = quiz.title || 'Untitled Quiz';
  const desc = quiz.description || 'No description provided';
  const statusTone = isLive ? 'green' : 'gray';
  const statusLabel = isLive ? 'Live' : 'Draft';
  const subj = subjectFor(title);
  const items = [
    { id: 'copy', label: 'Copy link', icon: 'link' },
    { id: 'responses', label: 'Responses', icon: 'users' },
    { id: 'dup', label: 'Duplicate', icon: 'copy' },
    { id: 'toggle', label: isLive ? 'Move to draft' : 'Make live', icon: isLive ? 'archive' : 'play' },
    { id: 'del', label: 'Delete', icon: 'trash', tone: 'danger' }
  ];
  return `
    <tr data-id="${quiz.id}" data-status="${isLive ? 'live' : 'draft'}" data-title="${escapeHtml(title).toLowerCase()}">
      <td>${Badge(statusLabel, { tone: statusTone, dot: true })}</td>
      <td>
        <div class="quiz-name">
          <span class="quiz-name-ic ${subj.cls}" style="${isLive ? '' : 'filter:saturate(.4); opacity:.6'}">${Icon(subj.icon, 18)}</span>
          <div style="min-width:0">
            <div class="quiz-title">${escapeHtml(title)}</div>
            <div class="quiz-desc-sub">${escapeHtml(desc)}</div>
          </div>
        </div>
      </td>
      <td><span class="mono">${qCount}</span></td>
      <td>
        <a href="#/responses/${quiz.id}" class="meta-item" style="text-decoration:none">${Icon('users', 14)}<span>${subsCount || 0}</span></a>
      </td>
      <td class="muted sm">${deadlineTxt}</td>
      <td class="muted sm">${createdTxt}</td>
      <td>
        <div class="flex" style="gap:8px; justify-content:flex-end">
          <a href="#/edit/${quiz.id}" class="btn btn-secondary btn-sm">${Icon('edit', 14)}<span>Edit</span></a>
          ${Dropdown({
            id: `dd-${quiz.id}`,
            trigger: Icon('more-horizontal', 16),
            items
          })}
        </div>
        <button class="toggle-live" data-id="${quiz.id}" style="display:none" aria-hidden="true" tabindex="-1"></button>
        <button class="dup-quiz" data-id="${quiz.id}" style="display:none" aria-hidden="true" tabindex="-1"></button>
        <button class="del-quiz" data-id="${quiz.id}" style="display:none" aria-hidden="true" tabindex="-1"></button>
      </td>
    </tr>`;
}

function renderTemplateCard(t) {
  const isPptx = t.type === 'pptx';
  const preview = isPptx
    ? `<div class="flex items-center" style="height:120px; justify-content:center; background:var(--surface-subtle); gap:8px">${Icon('file-text', 28, 'text-3')}<span class="sm muted">PowerPoint template</span></div>`
    : t.backgroundImage
      ? `<div style="height:120px; border-radius:var(--r-sm); overflow:hidden; background:var(--surface-subtle)"><img class="tmpl-preview-img" data-tmplid="${t.id}" style="width:100%; height:100%; object-fit:cover" alt="Certificate preview"></div>`
      : `<div style="height:120px; background:#fffdf7; border:2px double #c8a96e; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; font-family:'Playfair Display',serif; color:#c8a96e; font-weight:700; font-size:13px">CERTIFICATE</div>`;
  return `
    <div class="card card-pad card-hover" style="display:flex; flex-direction:column; justify-content:space-between">
      <div>
        ${preview}
        <h4 style="font-size:16px; font-weight:700; margin:12px 0 2px">${escapeHtml(t.name || 'Untitled Template')}</h4>
        <p class="xs muted">${isPptx ? 'PowerPoint template' : t.backgroundImage ? 'Image + text overlay' : `${t.elements?.length || 0} text elements`}</p>
      </div>
      <div class="flex" style="gap:8px; margin-top:16px">
        <a href="#/certificates/${t.id}" class="btn btn-secondary btn-sm" style="flex:1">${Icon('edit', 14)}<span>Edit</span></a>
        <button class="icon-btn icon-btn-secondary icon-btn-danger del-t" data-id="${t.id}" aria-label="Delete template">${Icon('trash', 15)}</button>
      </div>
    </div>`;
}

function formatDeadline(deadline) {
  if (!deadline) return 'No deadline';
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return 'No deadline';
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

function formatCreated(created) {
  if (!created) return '—';
  const d = new Date(created);
  if (isNaN(d.getTime())) return '—';
  const opts = { month: 'short', day: 'numeric' };
  return d.toLocaleDateString(undefined, opts);
}

// Global dropdown open/close handling (also used by other admin pages)
// Menus are positioned with `position: fixed` so they always escape any
// ancestor with `overflow: hidden` (e.g. .table-wrap) and are never clipped.
function positionDropdown(dd, menu) {
  const trigger = dd.querySelector('.dropdown-trigger');
  if (!trigger) return;
  const r = trigger.getBoundingClientRect();
  const mw = 190;
  const gap = 6;
  let left = Math.min(r.right - mw, window.innerWidth - mw - 12);
  let top = r.bottom + gap;
  const menuH = menu.offsetHeight || 0;
  if (top + menuH > window.innerHeight - 12) {
    top = Math.max(12, r.top - menuH - gap);
  }
  menu.style.position = 'fixed';
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.right = 'auto';
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
}

export function bindDropdowns(root) {
  root.querySelectorAll('.dropdown-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = btn.closest('.dropdown');
      const wasOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) {
        const menu = dd.querySelector('.dropdown-menu');
        if (menu) {
          menu.style.visibility = 'hidden';
          menu.style.display = 'block';
          positionDropdown(dd, menu);
          menu.style.visibility = '';
        }
        dd.classList.add('open');
      }
    });
  });
  root.querySelectorAll('.dropdown-menu').forEach(menu => {
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      e.stopPropagation();
      const dd = menu.closest('.dropdown');
      dd.classList.remove('open');
      const action = item.dataset.menuAction;
      const id = dd.id.replace(/^dd-/, '');
      if (action === 'copy') {
        const url = `${window.location.origin}/#/take/${id}`;
        copyTextToClipboard(url).then(ok => {
          if (ok) showToast('Quiz link copied to clipboard');
          else showToast(url, 'info');
        });
      } else if (action === 'responses') {
        window.location.hash = `#/responses/${id}`;
      } else if (action === 'dup') {
        const row = root.querySelector(`#quiz-table tr[data-id="${id}"]`);
        const btn = row?.querySelector('.dup-quiz');
        if (btn) btn.click();
      } else if (action === 'toggle') {
        const row = root.querySelector(`#quiz-table tr[data-id="${id}"]`);
        const btn = row?.querySelector('.toggle-live');
        if (btn) btn.click();
      } else if (action === 'del') {
        const row = root.querySelector(`#quiz-table tr[data-id="${id}"]`);
        const btn = row?.querySelector('.del-quiz');
        if (btn) btn.click();
      }
    });
  });
  document.addEventListener('click', closeAllDropdowns);
  document.addEventListener('scroll', closeAllDropdowns, true);
  window.addEventListener('resize', closeAllDropdowns);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });
}
