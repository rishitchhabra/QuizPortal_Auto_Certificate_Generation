import { getUsers, addUser, deleteUser, bulkDeleteUsers, getBatches, importUsers } from '../store.js';
import { renderNavbar, showToast, escapeHtml, bindNavbar, renderAccessDenied, showModal, sortBatches } from '../utils.js';
import { Icon, Badge, StatCard, EmptyState, SectionHead } from '../components.js';
import { requireAdmin, hasPermission } from '../auth.js';
import * as XLSX from 'xlsx';

let filter = { classSection: '', search: '' };

export async function renderUsers(app) {
  if (!requireAdmin()) return;
  if (!hasPermission('users', 'view')) {
    renderAccessDenied(app, 'Students Master', 'Your account does not have permission to view the students database.');
    return;
  }

  const batches = await getBatches().catch(() => []);
  const users = await getUsers(filter).catch(() => []);

  const distinctClasses = Array.from(new Set(users.map(u => u.classSection || '')));
  const groupKeys = sortBatches(distinctClasses);
  const grouped = {};
  groupKeys.forEach(c => { grouped[c] = []; });
  users.forEach(u => { (grouped[u.classSection || ''] = grouped[u.classSection || ''] || []).push(u); });
  const batchCount = distinctClasses.filter(Boolean).length;

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
            <p class="page-sub" style="margin-top:6px; font-size:15px">${users.length} students · ${batchCount} batches (Class-Section)</p>
          </div>
          <div class="page-head-actions">
            <a href="#/admin" class="btn btn-ghost btn-sm">${Icon('arrow-left', 14)}<span>Back</span></a>
            <button class="btn btn-ghost btn-sm" id="btn-export">${Icon('download', 14)}<span>Export Excel</span></button>
            ${canImport ? `<button class="btn btn-secondary btn-sm" id="btn-import">${Icon('upload', 14)}<span>Import Excel</span></button>` : ''}
            ${canAdd ? `<button class="btn btn-primary" id="btn-add-user">${Icon('plus', 15)}<span>Add Student</span></button>` : ''}
          </div>
        </div>

        <div class="stat-row" style="margin-bottom:24px">
          ${StatCard({ icon: 'users', label: 'Total students', value: users.length, tone: 'blue' })}
          ${StatCard({ icon: 'layers', label: 'Batches', value: batchCount, tone: 'violet' })}
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
            ${sortBatches(batches).map(b => `<option value="${escapeHtml(b)}" ${filter.classSection === b ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
          </select>
        </div>

        ${canDel ? `<div id="bulk-bar" class="bulk-bar" style="display:none">
          <span class="bulk-count" id="bulk-count">0 selected</span>
          <button class="btn btn-danger btn-sm" id="btn-bulk-delete">${Icon('trash', 14)}<span>Delete Selected</span></button>
          <button class="btn btn-ghost btn-sm" id="btn-bulk-clear">${Icon('x', 14)}<span>Clear</span></button>
        </div>` : ''}

        ${users.length > 0 ? `
          ${groupKeys.map(cls => `
            <div style="margin-bottom:28px">
              <div class="section-head" style="margin:0 0 14px">
                <div>
                  <h2 class="section-title" style="font-size:20px">${escapeHtml(cls || 'Unassigned')}</h2>
                  <p class="section-sub">${grouped[cls].length} students${cls ? '' : ' · no Class-Section set — add one by editing the student'}</p>
                </div>
              </div>
              <div class="table-wrap">
                <div class="table-wrap-scroll">
                  <table class="table">
                    <thead>
                      <tr>
                        ${canDel ? `<th style="width:40px"><input type="checkbox" class="table-check select-all-group" data-group="${escapeHtml(cls)}" aria-label="Select all in ${escapeHtml(cls || 'Unassigned')}"></th>` : ''}
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
                          ${canDel ? `<td><input type="checkbox" class="table-check user-check" data-id="${u.id}" data-group="${escapeHtml(cls)}" aria-label="Select ${escapeHtml(u.name)}"></td>` : ''}
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
  app.querySelector('#btn-export')?.addEventListener('click', () => exportExcel(app, users));

  // Single delete
  if (canDel) {
    app.querySelectorAll('.user-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm(`Delete ${btn.dataset.name}? This cannot be undone.`)) {
          await deleteUser(btn.dataset.id).catch(() => { });
          showToast('Student removed');
          renderUsers(app);
        }
      });
    });

    // Checkbox selection logic
    const bulkBar = app.querySelector('#bulk-bar');
    const bulkCount = app.querySelector('#bulk-count');
    const allChecks = app.querySelectorAll('.user-check');
    const groupSelects = app.querySelectorAll('.select-all-group');

    function updateBulkBar() {
      const checked = app.querySelectorAll('.user-check:checked');
      const count = checked.length;
      if (bulkBar) {
        bulkBar.style.display = count > 0 ? 'flex' : 'none';
        if (bulkCount) bulkCount.textContent = `${count} selected`;
      }
      // Update group select-all checkboxes
      groupSelects.forEach(gs => {
        const group = gs.dataset.group;
        const groupChecks = app.querySelectorAll(`.user-check[data-group="${CSS.escape(group)}"]`);
        const groupChecked = app.querySelectorAll(`.user-check[data-group="${CSS.escape(group)}"]:checked`);
        gs.checked = groupChecks.length > 0 && groupChecks.length === groupChecked.length;
        gs.indeterminate = groupChecked.length > 0 && groupChecked.length < groupChecks.length;
      });
      // Highlight selected rows
      allChecks.forEach(ch => {
        const row = ch.closest('tr');
        if (row) row.classList.toggle('selected', ch.checked);
      });
    }

    allChecks.forEach(ch => ch.addEventListener('change', updateBulkBar));

    groupSelects.forEach(gs => {
      gs.addEventListener('change', () => {
        const group = gs.dataset.group;
        const groupChecks = app.querySelectorAll(`.user-check[data-group="${CSS.escape(group)}"]`);
        groupChecks.forEach(ch => { ch.checked = gs.checked; });
        updateBulkBar();
      });
    });

    app.querySelector('#btn-bulk-delete')?.addEventListener('click', () => {
      const checked = app.querySelectorAll('.user-check:checked');
      const ids = Array.from(checked).map(ch => ch.dataset.id);
      if (!ids.length) return;
      showModal(`Delete ${ids.length} students?`, `This will permanently remove <strong>${ids.length}</strong> students from the database. This action cannot be undone.`, async () => {
        try {
          const res = await bulkDeleteUsers(ids);
          showToast(`${res.deleted || ids.length} students deleted`);
          renderUsers(app);
        } catch (e) {
          showToast(e.message || 'Bulk delete failed', 'error');
        }
      }, { danger: true, confirmText: `Delete ${ids.length} students` });
    });

    app.querySelector('#btn-bulk-clear')?.addEventListener('click', () => {
      allChecks.forEach(ch => { ch.checked = false; });
      groupSelects.forEach(gs => { gs.checked = false; gs.indeterminate = false; });
      updateBulkBar();
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

// Export the currently visible students to Excel. `users` is already batch-filtered
// server-side; the active search text is re-applied client-side so the downloaded
// file matches exactly what is shown on screen.
function exportExcel(app, users) {
  const searchInput = app.querySelector('#user-search');
  const q = (searchInput?.value || '').trim().toLowerCase();

  let rows = users;
  if (q) {
    rows = users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.userId || '').toLowerCase().includes(q) ||
      (u.classSection || '').toLowerCase().includes(q) ||
      (u.parentMobile || '').toLowerCase().includes(q)
    );
  }

  if (!rows.length) {
    showToast('No students match the current filters', 'error');
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `student_master${q ? '_filtered' : ''}_${stamp}.xlsx`;
  const wb = XLSX.utils.book_new();

  const headers = ['#', 'Name', 'User ID', 'Class-Section', "Parent's Mobile"];
  const groupKeys = sortBatches(Array.from(new Set(rows.map(u => u.classSection || ''))));
  const aoa = [];
  const sectionRows = [];
  const headerRows = [];

  groupKeys.forEach(batch => {
    const group = rows.filter(u => (u.classSection || '') === batch);
    sectionRows.push(aoa.length);
    aoa.push([`${batch || 'Unassigned'} — ${group.length} student${group.length === 1 ? '' : 's'}`]);
    headerRows.push(aoa.length);
    aoa.push(headers);
    group.forEach((u, i) => aoa.push([i + 1, u.name, u.userId, u.classSection, u.parentMobile || '']));
    aoa.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 18 }];
  sectionRows.forEach(ri => styleSheetRow(ws, ri, { bold: true, fill: 'EEF0FF', color: '3B3FE0' }));
  headerRows.forEach(ri => styleSheetRow(ws, ri, { bold: true, fill: 'F1F5F9' }));
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  XLSX.writeFile(wb, filename);
  showToast(`Exported ${rows.length} student${rows.length === 1 ? '' : 's'} to Excel`);
}

function styleSheetRow(ws, r, { bold, fill, color }) {
  for (let c = 0; c < 5; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell) continue;
    cell.s = {
      font: { bold, color: { rgb: color || '1E293B' } },
      fill: fill ? { fgColor: { rgb: fill } } : undefined
    };
  }
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
          <div class="field-hint">User ID auto-generates as first name + random 3-digit suffix.</div>
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
  requestAnimationFrame(() => modal.classList.add('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

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
      <p class="muted sm" style="margin:6px 0 16px">Upload an <strong>.xlsx</strong>, <strong>.xls</strong> or <strong>.csv</strong> file. Recognized columns: <strong>Name</strong> (required), <strong>Class-Section / Batch</strong>, <strong>Parent's Mobile</strong>. A <strong>User ID</strong> (first name + 3-digit suffix) is generated automatically.</p>
      <div class="file-upload-area" id="file-drop-area">
        <input type="file" id="import-file" accept=".xlsx,.xls,.csv">
        <div class="file-label" id="file-label">${Icon('upload', 20)}<br><strong>Click to choose file</strong> or drag & drop<br><span class="xs muted">.xlsx, .xls, .csv</span></div>
      </div>
      <div id="import-status" style="margin-top:12px"></div>
      <div class="flex" style="gap:10px; justify-content:flex-end; margin-top:18px">
        <button class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button class="btn btn-primary" id="m-upload">${Icon('upload', 15)}<span>Import</span></button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // File upload area visual feedback
  const fileInput = modal.querySelector('#import-file');
  const dropArea = modal.querySelector('#file-drop-area');
  const fileLabel = modal.querySelector('#file-label');
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      dropArea.classList.add('has-file');
      fileLabel.innerHTML = `${Icon('check-circle', 20)}<br><strong>${escapeHtml(fileInput.files[0].name)}</strong><br><span class="xs muted">${(fileInput.files[0].size / 1024).toFixed(1)} KB</span>`;
    } else {
      dropArea.classList.remove('has-file');
      fileLabel.innerHTML = `${Icon('upload', 20)}<br><strong>Click to choose file</strong> or drag & drop<br><span class="xs muted">.xlsx, .xls, .csv</span>`;
    }
  });

  modal.querySelector('#m-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#m-upload').addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) { showToast('Choose a file first', 'error'); return; }
    const status = modal.querySelector('#import-status');
    status.innerHTML = `<div class="flex items-center gap-sm"><svg class="icon icon-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span class="sm muted">Importing…</span></div>`;
    try {
      const res = await importUsers(file);
      status.innerHTML = `
        <div class="info" style="margin-top:12px">
          ${Icon('check-circle', 16)}<span><strong>${res.inserted}</strong> added · <strong>${res.duplicates || 0}</strong> duplicates skipped · <strong>${res.skipped}</strong> empty rows${res.errors?.length ? ` · ${res.errors.length} errors` : ''}.</span>
        </div>
        ${res.detectedColumns ? `<div class="sm muted" style="margin-top:8px">Detected columns — Name: <strong>${escapeHtml(res.detectedColumns.name || '—')}</strong>, Batch: <strong>${escapeHtml(res.detectedColumns.batch || '—')}</strong>, Mobile: <strong>${escapeHtml(res.detectedColumns.mobile || '—')}</strong></div>` : ''}
        ${res.batches?.length ? `<div class="sm muted" style="margin-top:4px">Batches now available: ${res.batches.map(b => escapeHtml(b)).join(', ')}</div>` : ''}`;
      showToast(`${res.inserted} students imported${res.duplicates ? `, ${res.duplicates} duplicates skipped` : ''}`);
      setTimeout(() => { modal.remove(); renderUsers(app); }, 1800);
    } catch (e) {
      status.innerHTML = `<div class="info" style="margin-top:12px; color:var(--red); border-color:var(--red-border); background:var(--red-soft)">${Icon('alert-circle', 16)}<span>${escapeHtml(e.message || 'Import failed')}</span></div>`;
    }
  });
}