import { getStaff, addStaff, updateStaff, deleteStaff, getBatches, resetStaffPassword } from '../store.js';
import { renderNavbar, showToast, escapeHtml, bindNavbar, showModal, renderAccessDenied, batchPickerHTML, bindBatchPicker } from '../utils.js';
import { Icon, Badge, StatCard } from '../components.js';
import { requireAdmin, hashPassword, hasPermission } from '../auth.js';

const MODULES = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    icon: 'home',
    desc: 'Home & overview',
    perms: [{ key: 'view', label: 'View Dashboard' }]
  },
  {
    key: 'quizzes',
    name: 'Quizzes',
    icon: 'list-checks',
    desc: 'Create, edit & manage quizzes',
    perms: [
      { key: 'view', label: 'View quizzes' },
      { key: 'create', label: 'Create quiz' },
      { key: 'edit', label: 'Edit quiz' },
      { key: 'delete', label: 'Delete quiz' },
      { key: 'publish', label: 'Publish / unpublish' },
      { key: 'leaderboard', label: 'View leaderboard' }
    ]
  },
  {
    key: 'reports',
    name: 'Reports',
    icon: 'bar-chart',
    desc: 'Batch-wise & quiz-wise analytics',
    perms: [
      { key: 'batchWise', label: 'Batch-wise report' },
      { key: 'quizWise', label: 'Quiz-wise report' },
      { key: 'notAttempted', label: 'See who did not attempt' },
      { key: 'export', label: 'Export report' }
    ]
  },
  {
    key: 'users',
    name: 'Students',
    icon: 'users',
    desc: 'Student master database',
    perms: [
      { key: 'view', label: 'View students' },
      { key: 'add', label: 'Add student' },
      { key: 'edit', label: 'Edit student' },
      { key: 'delete', label: 'Delete student' },
      { key: 'import', label: 'Bulk import (Excel)' }
    ]
  },
  {
    key: 'settings',
    name: 'Settings',
    icon: 'settings',
    desc: 'Teachers, roles, templates & system',
    perms: [
      { key: 'manageStaff', label: 'Manage teachers' },
      { key: 'manageRoles', label: 'Manage permissions' },
      { key: 'manageTemplates', label: 'Manage certificate templates' },
      { key: 'system', label: 'System & OAuth settings' }
    ]
  }
];

const FULL_ACCESS = {};
MODULES.forEach(m => {
  FULL_ACCESS[m.key] = { full: true };
  m.perms.forEach(p => { FULL_ACCESS[m.key][p.key] = true; });
});

export async function renderRoles(app) {
  if (!requireAdmin()) return;
  if (!hasPermission('settings', 'manageStaff')) {
    renderAccessDenied(app, 'Roles & Permissions', 'Your account does not have permission to manage staff accounts and roles.');
    return;
  }

  const [staff, batches] = await Promise.all([getStaff().catch(() => []), getBatches().catch(() => [])]);

  const adminCount = 1;
  const teacherCount = staff.length;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">

        <div class="page-head" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px">
          <div>
            <div class="eyebrow">${Icon('settings', 14)}<span>Access Control</span></div>
            <h1 class="page-title" style="font-size:32px">Roles &amp; Permissions</h1>
            <p class="page-sub" style="margin-top:6px; font-size:15px">Control module-level access for teachers. Admin always has full access.</p>
          </div>
          <div class="page-head-actions">
            <a href="#/admin" class="btn btn-ghost btn-sm">${Icon('arrow-left', 14)}<span>Back</span></a>
            <button class="btn btn-primary" id="btn-new-teacher">${Icon('plus', 15)}<span>New Teacher</span></button>
          </div>
        </div>

        <div class="stat-row" style="margin-bottom:24px">
          ${StatCard({ icon: 'shield', label: 'Admin accounts', value: adminCount, tone: 'violet' })}
          ${StatCard({ icon: 'user', label: 'Teachers', value: teacherCount, tone: 'blue' })}
          ${StatCard({ icon: 'layers', label: 'Batches', value: batches.length, tone: 'green' })}
        </div>

        <div class="grid grid-2" style="align-items:start">
          <div class="card card-pad" style="min-width:0">
            <div class="section-head" style="margin:0 0 16px">
              <div>
                <h2 class="section-title" style="font-size:20px">Teacher accounts</h2>
                <p class="section-sub">Each teacher logs in with User ID + password. Assign permissions and the batches whose reports they may view.</p>
              </div>
            </div>
            ${staff.length > 0 ? `
              <div style="display:flex; flex-direction:column; gap:10px">
                ${staff.map(t => `
                  <div class="card" style="padding:14px 16px; box-shadow:none; display:flex; align-items:center; gap:12px">
                    <span class="stat-icon stat-blue" style="width:40px; height:40px; flex:none">${Icon('user', 18)}</span>
                    <div style="flex:1; min-width:0">
                      <div style="font-weight:700; font-size:14.5px">${escapeHtml(t.name)}</div>
                      <div class="xs muted" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px">
                        <span style="font-weight:600; color:var(--text)">User ID: <code style="background:var(--surface-subtle); padding:1px 6px; border-radius:4px; font-family:var(--font-mono); font-size:12px">${escapeHtml(t.userId)}</code></span>
                        <span>·</span>
                        <span>${(t.assignedBatches || []).length ? `Batches: ${t.assignedBatches.map(escapeHtml).join(', ')}` : 'All batches'}</span>
                      </div>
                    </div>
                    <div class="flex" style="gap:8px">
                      <button class="btn btn-secondary btn-sm t-edit" data-id="${t.id}">${Icon('edit', 13)}<span>Permissions</span></button>
                      <button class="btn btn-secondary btn-sm t-reset-pw" data-id="${t.id}" data-name="${escapeHtml(t.name)}">${Icon('lock', 13)}<span>Reset Password</span></button>
                      <button class="icon-btn icon-btn-danger t-del" data-id="${t.id}" data-name="${escapeHtml(t.name)}" aria-label="Delete ${escapeHtml(t.name)}">${Icon('trash', 15)}</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p class="muted sm">No teachers yet. Create one to start delegating quiz and report access.</p>
            `}
          </div>

          <div class="card card-pad">
            <div class="section-head" style="margin:0 0 12px">
              <div>
                <h2 class="section-title" style="font-size:20px">Permission matrix</h2>
                <p class="section-sub">Modules &amp; actions you can grant per teacher.</p>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px">
              ${MODULES.map(m => `
                <div style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--surface-subtle)">
                  <span class="stat-icon stat-violet" style="width:36px; height:36px; flex:none">${Icon(m.icon, 16)}</span>
                  <div style="flex:1; min-width:0">
                    <div style="font-weight:700; font-size:14px">${m.name}</div>
                    <div class="xs muted">${m.desc}</div>
                  </div>
                  <span class="badge badge-gray">${m.perms.length} actions</span>
                </div>
              `).join('')}
            </div>
            <div class="info" style="margin-top:16px">
              ${Icon('shield', 16)}<span>Open a teacher's <strong>Permissions</strong> to toggle every module action, assign report batches, and enable the "Full module access" flag.</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  bindNavbar(app);

  app.querySelector('#btn-new-teacher')?.addEventListener('click', () => openTeacherEditor(app, null, batches));
  app.querySelectorAll('.t-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = staff.find(x => x.id === btn.dataset.id);
      if (t) openTeacherEditor(app, t, batches);
    });
  });
  app.querySelectorAll('.t-del').forEach(btn => {
    btn.addEventListener('click', () => {
      showModal('Delete this teacher?', `<p>Remove <strong>${btn.dataset.name}</strong>? They will lose access to the admin portal immediately.</p>`, async () => {
        await deleteStaff(btn.dataset.id).catch(() => {});
        showToast('Teacher removed');
        renderRoles(app);
      }, { confirmText: 'Delete', danger: true });
    });
  });

  // Reset password
  app.querySelectorAll('.t-reset-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const staffId = btn.dataset.id;
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal" style="max-width:440px" role="dialog" aria-modal="true" aria-label="Reset password">
          <div class="modal-title">Reset Password · ${escapeHtml(name)}</div>
          <div class="field" style="margin:16px 0">
            <label class="field-label" for="rp-pass">New Password <span class="field-req">*</span></label>
            <input type="text" class="input" id="rp-pass" placeholder="Min 4 characters" autocomplete="off">
          </div>
          <div class="flex" style="gap:10px; justify-content:flex-end">
            <button class="btn btn-ghost" id="rp-cancel">Cancel</button>
            <button class="btn btn-primary" id="rp-save">${Icon('check', 15)}<span>Reset Password</span></button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      requestAnimationFrame(() => modal.classList.add('active'));
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      modal.querySelector('#rp-cancel').addEventListener('click', () => modal.remove());
      modal.querySelector('#rp-save').addEventListener('click', async () => {
        const pass = modal.querySelector('#rp-pass').value;
        if (!pass || pass.length < 4) { showToast('Password must be at least 4 characters', 'error'); return; }
        try {
          const pw = await hashPassword(pass);
          await resetStaffPassword(staffId, pw);
          showToast('Password reset successfully');
          modal.remove();
        } catch (e) {
          showToast(e.message || 'Reset failed', 'error');
        }
      });
      setTimeout(() => modal.querySelector('#rp-pass')?.focus(), 30);
    });
  });
}

// Build a default permission object from the module definitions
function defaultPermissions() {
  const perms = {};
  MODULES.forEach(m => {
    perms[m.key] = { full: false };
    m.perms.forEach(p => { perms[m.key][p.key] = m.key === 'dashboard' || m.key === 'reports'; });
  });
  return perms;
}

function openTeacherEditor(app, teacher, batches) {
  const isNew = !teacher;
  const perms = teacher ? JSON.parse(JSON.stringify(teacher.permissions || defaultPermissions())) : defaultPermissions();
  const assigned = new Set(teacher?.assignedBatches || []);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:860px; max-height:90vh; overflow:auto" role="dialog" aria-modal="true" aria-label="${isNew ? 'New teacher' : 'Edit teacher'}">
      <div class="modal-title">${isNew ? 'Create teacher account' : `Permissions · ${escapeHtml(teacher.name)}`}</div>

      ${isNew ? `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:18px 0; align-items:end">
          <div class="field">
            <label class="field-label">Full name <span class="field-req">*</span></label>
            <input type="text" class="input" id="t-name" placeholder="e.g. Mrs. Priya Verma">
          </div>
          <div class="field">
            <label class="field-label">Login User ID <span class="field-req">*</span></label>
            <input type="text" class="input" id="t-userid" placeholder="e.g. priya.verma" autocomplete="off">
          </div>
          <div class="field">
            <label class="field-label">Password <span class="field-req">*</span></label>
            <input type="text" class="input" id="t-pass" placeholder="Min 4 characters" autocomplete="off">
          </div>
        </div>
      ` : ''}

      <div style="margin:16px 0">
        ${batchPickerHTML({
          id: 't-batch-picker',
          label: 'Assigned report batches',
          hint: 'Teachers can view reports only for the batches selected here.',
          selected: Array.from(assigned),
          batches
        })}
      </div>

      <div style="display:flex; flex-direction:column; gap:12px">
        ${MODULES.map(m => {
          const mod = perms[m.key] || { full: false };
          return `
            <div class="perm-module" data-module="${m.key}">
              <div class="perm-module-head">
                <div class="flex items-center gap-sm" style="min-width:0">
                  <span class="stat-icon stat-violet" style="width:34px; height:34px; flex:none">${Icon(m.icon, 15)}</span>
                  <div style="min-width:0">
                    <div style="font-weight:700; font-size:14px">${m.name}</div>
                    <div class="xs muted">${m.desc}</div>
                  </div>
                </div>
                <div class="flex items-center gap-sm">
                  <label class="checkbox-row perm-full" style="margin:0">
                    <input type="checkbox" data-module="${m.key}" ${mod.full ? 'checked' : ''}>
                    <span class="checkbox-box">${Icon('check', 12)}</span>
                    <span class="xs" style="font-weight:700">Full access</span>
                  </label>
                </div>
              </div>
              <div class="perm-chips">
                ${m.perms.map(p => {
                  const on = mod[p.key] === true;
                  return `
                    <button type="button" class="chip-toggle perm-chip ${on ? 'on' : ''}" data-module="${m.key}" data-perm="${p.key}">
                      ${on ? Icon('check', 12) : ''}<span>${escapeHtml(p.label)}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="flex" style="gap:10px; justify-content:flex-end; margin-top:20px">
        <button class="btn btn-ghost" id="t-cancel">Cancel</button>
        ${!isNew ? `<button class="btn btn-danger-outline" id="t-reset">Reset to defaults</button>` : ''}
        <button class="btn btn-primary" id="t-save">${Icon('check', 15)}<span>${isNew ? 'Create Teacher' : 'Save Permissions'}</span></button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Batch picker — keeps `assigned` in sync
  const picker = modal.querySelector('#t-batch-picker');
  if (picker) bindBatchPicker(picker, {
    onSelected: (sel) => { assigned.clear(); sel.forEach(x => assigned.add(x)); }
  });

  // Full module toggle: toggling enables/disables all its chips
  modal.querySelectorAll('.perm-full input').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.module;
      perms[key].full = input.checked;
      const chips = modal.querySelectorAll(`.perm-chip[data-module="${key}"]`);
      chips.forEach(c => {
        perms[key][c.dataset.perm] = input.checked;
        c.classList.toggle('on', input.checked);
        c.innerHTML = input.checked ? `${Icon('check', 12)}<span>${c.dataset.permLabel || c.textContent.trim()}</span>` : `<span>${c.dataset.permLabel || c.textContent.trim()}</span>`;
      });
    });
  });

  // Individual chip toggles
  modal.querySelectorAll('.perm-chip').forEach(chip => {
    chip.dataset.permLabel = chip.textContent.trim();
    chip.addEventListener('click', () => {
      const key = chip.dataset.module;
      const perm = chip.dataset.perm;
      const on = !chip.classList.contains('on');
      perms[key][perm] = on;
      chip.classList.toggle('on', on);
      chip.innerHTML = on ? `${Icon('check', 12)}<span>${chip.dataset.permLabel}</span>` : `<span>${chip.dataset.permLabel}</span>`;
      // If every action in a module is on, we can also mark full; keep it simple: turn full off when any single toggle is used
      perms[key].full = false;
      const fullInput = modal.querySelector(`.perm-full input[data-module="${key}"]`);
      if (fullInput) fullInput.checked = false;
    });
  });

  modal.querySelector('#t-cancel')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#t-reset')?.addEventListener('click', () => {
    Object.assign(perms, defaultPermissions());
    modal.querySelectorAll('.perm-module').forEach(moduleEl => {
      const key = moduleEl.dataset.module;
      const mod = perms[key];
      const fullInput = moduleEl.querySelector('.perm-full input');
      if (fullInput) fullInput.checked = !!mod.full;
      moduleEl.querySelectorAll('.perm-chip').forEach(c => {
        const on = mod[c.dataset.perm] === true;
        c.classList.toggle('on', on);
        c.innerHTML = on ? `${Icon('check', 12)}<span>${c.dataset.permLabel}</span>` : `<span>${c.dataset.permLabel}</span>`;
      });
    });
    showToast('Permissions reset to teacher defaults');
  });

  modal.querySelector('#t-save').addEventListener('click', async () => {
    const name = modal.querySelector('#t-name')?.value.trim();
    const userId = modal.querySelector('#t-userid')?.value.trim();
    const pass = modal.querySelector('#t-pass')?.value;
    if (isNew && (!name || !userId || !pass)) { showToast('Fill name, User ID and password', 'error'); return; }
    if (isNew && pass.length < 4) { showToast('Password must be at least 4 characters', 'error'); return; }
    const payload = {
      permissions: perms,
      assignedBatches: Array.from(assigned)
    };
    try {
      if (isNew) {
        const passwordHash = await hashPassword(pass);
        await addStaff({ name, userId, passwordHash, ...payload });
        showToast('Teacher created');
      } else {
        await updateStaff(teacher.id, { name: teacher.name, userId: teacher.userId, ...payload });
        showToast('Permissions saved');
      }
      modal.remove();
      renderRoles(app);
    } catch (e) {
      showToast(e.message || 'Save failed', 'error');
    }
  });

  setTimeout(() => modal.querySelector('#t-name')?.focus(), 30);
}
