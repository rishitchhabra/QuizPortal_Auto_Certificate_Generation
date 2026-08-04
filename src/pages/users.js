import { getUsers, addUser, deleteUser, getBatches, importUsers } from '../store.js';
import { renderNavbar, showToast, escapeHtml, bindNavbar } from '../utils.js';
import { Icon, Badge, StatCard, EmptyState, SectionHead } from '../components.js';
import { requireAdmin, hasPermission } from '../auth.js';

let filter = { classSection: '', search: '' };

export async function renderUsers(app) {
  if (!requireAdmin()) return;

  const batches = await getBatches().catch(() => []);
  const users = await getUsers(filter).catch(() => []);

  const distinctClasses = Array.from(new Set(users.map(u => u.classSection).filter(Boolean)));
  const grouped = {};
  distinctClasses.forEach(c => { grouped[c] = []; });
  users.forEach(u => { if (u.classSection) (grouped[u.classSection] = grouped[u.classSection] || []).push(u); });

  const canAdd = hasPermission('users', 'add');
  const canDel = hasPermission('users', 'delete');
  const canImport = hasPermission('users', 'import');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">

        <div class="page-head" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px">
          <div>
            <div class="eyebrow">${Icon('users', 14)}<span>Student Master</span></div>
            <h1 class="page-title" style="font-size:32px">Students &amp; Batches</h1>
            <p class="page-sub" style="margin-top:6px; font-size:15px">${users.length} students · ${batches.length} batches (Class-Section)</p>
          </div>
          <div class="page-head-actions">
            <a href="#/admin" class="btn btn-ghost btn-sm">${Icon('arrow-left', 14)}<span>Back</span></a>
            ${canImport ? `<button class="btn btn-secondary btn-sm" id="btn-import">${Icon('upload', 14)}<span>Import Excel</span></button>` : ''}
            ${canAdd ? `<button class="btn btn-primary" id="btn-add-user">${Icon('plus', 15)}<span>Add Student</span></button>` : ''}
          </div>
        </div>

        <div class="stat-row" style="margin-bottom:24px">
          ${StatCard({ icon: 'users', label: 'Total students', value: users.length, tone: 'blue' })}
          ${StatCard({ icon: 'layers', label: 'Batches', value: distinctClasses.length, tone: 'violet' })}
          ${StatCard({ icon: 'check-circle', label: 'With IDs', value: users.filter(u => u.userId).length, tone: 'green' })}
          ${StatCard({ icon: 'phone', label: 'Phones collected', value: users.filter(u => u.parentMobile).length, tone: 'amber' })}
        </div>

        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap">
          <div class="search-wrap" style="flex:1; max-width:340px">
            ${Icon('search', 16)}
            <input type="text" class="input" id="user-search" placeholder="Search name, user ID or mobile…" aria-label="Search students" style="height:40px">
          </div>
          <select class="input select" id="batch-filter" style="width:auto" aria-label="Filter by batch">
            <option value="">All batches</option>
            ${batches.map(b => `<option value="${escapeHtml(b)}" ${filter.classSection === b ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
          </select>
        </div>

        ${users.length > 0 ? `
          ${distinctClasses.map(cls => `
            <div style="margin-bottom:28px">
              <div class="section-head" style="margin:0 0 14px">
                <div>
                  <h2 class="section-title" style="font-size:20px">${escapeHtml(cls || 'Unassigned')}</h2>
                  <p class="section-sub">${grouped[cls].length} students · auto User-ID: name + 3-digit suffix</p>
                </div>
              </div>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th style="width:40px">#</th>
                      <th>Name</th>
                      <th style="width:170px">User ID</th>
                      <th style="width:60px">Batch</th>
                      <th style="width:170px">Parent mobile</th>
                      ${canDel ? `<th style="width:80px; text-align:right">Actions</th>` : ''}
                    </tr>
                  </thead>
                  <tbody>
                    ${grouped[cls].map((u, i) => `
                      <tr data-id="${u.id}">
                        <td class="mono muted">${i + 1}</td>
                        <td><span style="font-weight:600">${escapeHtml(u.name)}</span></td>
                        <td>${Badge(u.userId, { tone: 'violet' })}</td>
                        <td class="muted sm">${escapeHtml(u.classSection)}</td>
                        <td class="muted sm">${escapeHtml(u.parentMobile || '—')}</td>
                        ${canDel ? `<td style="text-align:right"><button class="icon-btn icon-btn-danger user-del" data-id="${u.id}" data-name="${escapeHtml(u.name)}" aria-label="Delete ${escapeHtml(u.name)}" >${Icon('trash', 15)}</button></td>` : ''}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}
        ` : `
          <div class="card">
            ${EmptyState({
              icon: 'users',
              title: 'No students yet',
              desc: 'Import students in bulk from Excel, or add a single student manually to start building your master database.',
              action: canImport ? `<button class="btn btn-primary" id="btn-import">${Icon('upload', 15)}<span>Import Excel</span></button>` : undefined
            })}
          </div>
        `}
      </div>
    </div>`;

  bindNavbar(app);

  applyFilters(app);
  if (canAdd) app.querySelector('#btn-add-user')?.addEventListener('click', () => openAddModal(app, batches));
  if (canImport) app.querySelectorAll('#btn-import').forEach(btn => btn.addEventListener('click', () => openImportModal(app)));
  if (canDel) {
    app.querySelectorAll('.user-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm(`Delete ${btn.dataset.name}? This cannot be undone.`)) {
          await deleteUser(btn.dataset.id).catch(() => {});
          showToast('Student removed');
          renderUsers(app);
        }
      });
    });
  }
}

function applyFilters(app) {
  const search = app.querySelector('#user-search');
  const filterSel = app.querySelector('#batch-filter');
  if (search) search.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    app.querySelectorAll('tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  if (filterSel) filterSel.addEventListener('change', () => {
    filter.classSection = filterSel.value;
    renderUsers(app);
  });
}

function openAddModal(app, batches) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Add student">
      <div class="modal-title">Add student</div>
      <div style="display:flex; flex-direction:column; gap:14px; margin:20px 0">
        <div class="field">
          <label class="field-label">Full name <span class="field-req">*</span></label>
          <input type="text" class="input" id="m-name" placeholder="e.g. Aarav Sharma">
          <div class="field-hint">User ID auto-generates as name + random 3-digit suffix.</div>
        </div>
        <div class="field">
          <label class="field-label">Class-Section</label>
          <input type="text" class="input" id="m-class" list="batch-list" placeholder="e.g. 7-B" aria-label="Class-Section">
          <datalist id="batch-list">${batches.map(b => `<option value="${escapeHtml(b)}">`).join('')}</datalist>
        </div>
        <div class="field">
          <label class="field-label">Parent's mobile number</label>
          <input type="tel" class="input" id="m-mobile" placeholder="e.g. 98XXXXXX00">
        </div>
      </div>
      <div class="flex" style="gap:10px; justify-content:flex-end">
        <button class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button class="btn btn-primary" id="m-save">${Icon('check', 15)}<span>Add Student</span></button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#m-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#m-save').addEventListener('click', async () => {
    const name = modal.querySelector('#m-name').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    try {
      await addUser({ name, classSection: modal.querySelector('#m-class').value.trim(), parentMobile: modal.querySelector('#m-mobile').value.trim() });
      showToast('Student added');
      modal.remove();
      renderUsers(app);
    } catch (e) {
      showToast(e.message || 'Failed to add student', 'error');
    }
  });
  setTimeout(() => modal.querySelector('#m-name').focus(), 30);
}

function openImportModal(app) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Import students">
      <div class="modal-title">Import students from Excel</div>
      <p class="muted sm" style="margin:6px 0 16px">Upload an <strong>.xlsx</strong>, <strong>.xls</strong> or <strong>.csv</strong> file. Recognized columns: <strong>Name</strong> (required), <strong>Class-Section</strong> (e.g. <code>7-B</code> or <code>Class 7</code>), <strong>Parent's Mobile</strong>. A <strong>User ID</strong> (name + 3-digit suffix) is generated automatically for each student.</p>
      <div class="flex" style="gap:10px">
        <input type="file" class="input" id="import-file" accept=".xlsx,.xls,.csv" style="flex:1">
      </div>
      <div id="import-status" style="margin-top:12px"></div>
      <div class="flex" style="gap:10px; justify-content:flex-end; margin-top:18px">
        <button class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button class="btn btn-primary" id="m-upload">${Icon('upload', 15)}<span>Import</span></button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#m-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#m-upload').addEventListener('click', async () => {
    const file = modal.querySelector('#import-file').files[0];
    if (!file) { showToast('Choose a file first', 'error'); return; }
    const status = modal.querySelector('#import-status');
    status.innerHTML = `<div class="flex items-center gap-sm"><svg class="icon icon-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span class="sm muted">Importing…</span></div>`;
    try {
      const res = await importUsers(file);
      status.innerHTML = `
        <div class="info" style="margin-top:12px">
          ${Icon('check-circle', 16)}<span><strong>${res.inserted}</strong> added · <strong>${res.skipped}</strong> skipped${res.errors?.length ? ` · ${res.errors.length} errors` : ''}.</span>
        </div>
        ${res.batches?.length ? `<div class="sm muted" style="margin-top:8px">Batches now available: ${res.batches.map(b => escapeHtml(b)).join(', ')}</div>` : ''}`;
      showToast(`${res.inserted} students imported`);
      setTimeout(() => { modal.remove(); renderUsers(app); }, 1800);
    } catch (e) {
      status.innerHTML = `<div class="info" style="margin-top:12px; color:var(--red); border-color:var(--red-border); background:var(--red-soft)">${Icon('alert-circle', 16)}<span>${escapeHtml(e.message || 'Import failed')}</span></div>`;
    }
  });
}