import { getAllQuizzes, getQuizReport } from '../store.js';
import { renderNavbar, showToast, escapeHtml, bindNavbar, formatTime, copyTextToClipboard, renderAccessDenied, sortBatches } from '../utils.js';
import { Icon, Badge, StatCard, EmptyState } from '../components.js';
import { requireAdmin, hasPermission, currentUser } from '../auth.js';
import * as XLSX from 'xlsx';

export async function renderReports(app, params) {
  if (!requireAdmin()) return;
  if (!hasPermission('reports', 'batchWise') && !hasPermission('reports', 'quizWise')) {
    renderAccessDenied(app, 'Reports', 'Your account does not have permission to view reports.');
    return;
  }

  let quizzes = await getAllQuizzes().catch(() => []);
  const session = currentUser();
  const assigned = (session?.staff?.assignedBatches || []);
  if (session?.type === 'staff' && assigned.length) {
    quizzes = quizzes.filter(q => {
      const qb = Array.isArray(q.allowedBatches) ? q.allowedBatches : [];
      return qb.some(b => assigned.includes(b));
    });
  }
  const quizId = params[0];
  const selectedQuiz = quizId ? quizzes.find(q => q.id === quizId) : null;

  // If a staff member visits, filter to quizzes linked to their batches
  const canQuizWise = hasPermission('reports', 'quizWise');
  const canBatchWise = hasPermission('reports', 'batchWise');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">
        <div class="page-head" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px">
          <div>
            <div class="eyebrow">${Icon('bar-chart', 14)}<span>Reports</span></div>
            <h1 class="page-title" style="font-size:32px">Reports</h1>
            <p class="page-sub" style="margin-top:6px; font-size:15px">Batch / class-wise and quiz-wise analytics with not-attempted tracking.</p>
          </div>
          <div class="page-head-actions">
            <a href="#/admin" class="btn btn-ghost btn-sm">${Icon('arrow-left', 14)}<span>Back</span></a>
          </div>
        </div>

        <div class="section-head">
          <div>
            <h2 class="section-title" style="font-size:20px">Select a quiz</h2>
          </div>
        </div>

        ${quizzes.length > 0 ? `
          <div class="grid grid-3">
            ${quizzes.map(q => `
              <a href="#/reports/${q.id}" class="card card-pad card-hover" style="text-decoration:none; color:var(--text); display:block">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px">
                  <span class="stat-icon stat-${q.isPublished ? 'green' : 'gray'}" style="width:36px; height:36px; flex:none">${Icon(q.isPublished ? 'list-checks' : 'file-text', 16)}</span>
                  <div style="min-width:0">
                    <div style="font-weight:700; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(q.title || 'Untitled')}</div>
                    <div class="xs muted">${q.questions?.length || 0} questions</div>
                  </div>
                </div>
                ${Badge(q.isPublished ? 'Live' : 'Draft', { tone: q.isPublished ? 'green' : 'gray', dot: true })}
              </a>
            `).join('')}
          </div>
        ` : `
          <div class="card">
            ${EmptyState({ icon: 'bar-chart', title: 'No quizzes yet', desc: 'Create and publish a quiz to start generating reports.' })}
          </div>
        `}
      </div>
    </div>`;

  bindNavbar(app);

  if (selectedQuiz) {
    await renderQuizReport(app, quizzes, selectedQuiz, params[0]);
  }
}

async function renderQuizReport(app, quizzes, quiz, quizId) {
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">
        <div class="page-head" style="margin-bottom:20px">
          <a href="#/reports" class="btn btn-ghost btn-sm" style="margin-bottom:12px">${Icon('arrow-left', 14)}<span>All Reports</span></a>
          <div class="eyebrow">${Icon('bar-chart', 14)}<span>Report</span></div>
          <h1 class="page-title" style="font-size:28px">${escapeHtml(quiz.title || 'Quiz report')}</h1>
        </div>
        <div class="card" style="padding:40px; text-align:center">
          <div class="empty-icon" style="margin:0 auto 16px"><svg class="icon icon-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
          <p class="muted sm">Generating report…</p>
        </div>
      </div>
    </div>`;
  bindNavbar(app);

  const report = await getQuizReport(quizId).catch(e => { showToast(e.message || 'Failed to load report', 'error'); return null; });
  if (!report) { window.location.hash = '#/reports'; return; }

  const qAccuracy = report.studentRows.filter(r => r.attempted).length;

  const studentBatches = sortBatches(Array.from(new Set(report.studentRows.map(s => s.classSection || ''))));
  const sortedBatchSummary = sortBatches(report.batches.map(b => b.batch || '')).map(name => report.batches.find(b => (b.batch || '') === name)).filter(Boolean);

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">
        <div class="page-head" style="margin-bottom:20px">
          <a href="#/reports" class="btn btn-ghost btn-sm" style="margin-bottom:12px">${Icon('arrow-left', 14)}<span>All Reports</span></a>
          <div class="eyebrow">${Icon('bar-chart', 14)}<span>Report · ${escapeHtml(report.quiz.title)}</span></div>
          <h1 class="page-title" style="font-size:28px">${escapeHtml(report.quiz.title)}</h1>
        </div>

        <div class="stat-row" style="margin-bottom:28px">
          ${StatCard({ icon: 'users', label: 'Total students', value: report.totalStudents, tone: 'blue' })}
          ${StatCard({ icon: 'check-circle', label: 'Attempted', value: report.totalAttempted, tone: 'green' })}
          ${StatCard({ icon: 'x-circle', label: 'Not attempted', value: report.notAttemptedCount, tone: 'red' })}
          ${StatCard({ icon: 'trending-up', label: 'Avg score', value: `${report.overallAverage}%`, tone: 'violet' })}
          ${StatCard({ icon: 'award', label: 'Passed', value: report.passCount, tone: 'amber' })}
        </div>

        <div class="section-head">
          <div>
            <h2 class="section-title" style="font-size:20px">Batch / class-wise</h2>
            <p class="section-sub">Performance across each class-section</p>
          </div>
          ${hasPermission('reports', 'export') ? `<div class="section-action"><button class="btn btn-secondary btn-sm" id="btn-export-batch">${Icon('download', 14)}<span>Export Excel</span></button></div>` : ''}
        </div>

        ${report.batches.length > 0 ? `
          <div class="table-wrap" style="margin-bottom:32px">
            <div class="table-wrap-scroll">
            <table class="table" id="batch-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Total</th>
                  <th>Attempted</th>
                  <th>Not attempt</th>
                  <th>Passed</th>
                  <th>Avg %</th>
                  <th>Max</th>
                  <th>Min</th>
                </tr>
              </thead>
              <tbody>
                ${sortedBatchSummary.map(b => `
                  <tr>
                    <td><strong>${escapeHtml(b.batch || 'Unassigned')}</strong></td>
                    <td class="mono">${b.totalStudents}</td>
                    <td class="mono" style="color:var(--green)">${b.attempted}</td>
                    <td class="mono" style="color:var(--red)">${b.notAttempted}</td>
                    <td class="mono">${b.passed}</td>
                    <td class="mono">${b.avgPercent}%</td>
                    <td class="mono">${b.maxPercent}%</td>
                    <td class="mono">${b.minPercent}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            </div>
          </div>
        ` : `<p class="muted sm">No batches mapped to this quiz. Map Class-Sections in the quiz's Audience settings first.</p>`}

        <div class="section-head">
          <div>
            <h2 class="section-title" style="font-size:20px">Student-wise</h2>
            <p class="section-sub">Every mapped student — score, pass status, and who did not attempt</p>
          </div>
          ${hasPermission('reports', 'export') ? `<div class="section-action"><button class="btn btn-secondary btn-sm" id="btn-export-students">${Icon('download', 14)}<span>Export Excel</span></button></div>` : ''}
        </div>

        ${report.studentRows.length > 0 ? `
          <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap">
            <div class="search-wrap" style="flex:1; max-width:320px">
              ${Icon('search', 16)}
              <input type="text" class="input" id="student-search" placeholder="Search name or user ID…" style="height:40px" aria-label="Search students">
            </div>
            <select class="input select" id="student-batch-filter" style="width:auto" aria-label="Filter by batch">
              <option value="">All batches</option>
              ${studentBatches.map(b => `<option value="${escapeHtml(b || '')}">${escapeHtml(b || 'Unassigned')}</option>`).join('')}
            </select>
          </div>
          <div id="student-wise-container"></div>
        ` : `<div class="card">${EmptyState({ icon: 'users', title: 'No students mapped', desc: 'Map batches to this quiz to see individual roll-call reports.' })}</div>`}
      </div>
    </div>`;

  bindNavbar(app);

  app.querySelector('#btn-export-batch')?.addEventListener('click', () => {
    exportExcel('batch', report.batches, report.quiz.title);
  });
  app.querySelector('#btn-export-students')?.addEventListener('click', () => {
    exportExcel('students', report.studentRows, report.quiz.title);
  });

  const studentContainer = app.querySelector('#student-wise-container');
  if (studentContainer) {
    const searchInput = app.querySelector('#student-search');
    const batchFilter = app.querySelector('#student-batch-filter');
    let searchTerm = '';
    let selectedBatch = '';

    if (searchInput) searchInput.addEventListener('input', e => { searchTerm = e.target.value; renderStudentGroups(studentContainer, report.studentRows, selectedBatch, searchTerm); });
    if (batchFilter) batchFilter.addEventListener('change', e => { selectedBatch = e.target.value; renderStudentGroups(studentContainer, report.studentRows, selectedBatch, searchTerm); });

    renderStudentGroups(studentContainer, report.studentRows, selectedBatch, searchTerm);
  }
}

function renderStudentGroups(container, rows, batch, term) {
  const q = (term || '').trim().toLowerCase();
  const filtered = rows.filter(s => {
    if (batch && (s.classSection || '') !== batch) return false;
    if (q && !(s.name || '').toLowerCase().includes(q) && !(s.userId || '').toLowerCase().includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="card">${EmptyState({ icon: 'users', title: 'No matching students', desc: 'Try a different batch or search term.' })}</div>`;
    return;
  }

  const groupKeys = sortBatches(Array.from(new Set(filtered.map(s => s.classSection || ''))));
  const grouped = {};
  groupKeys.forEach(k => { grouped[k] = filtered.filter(s => (s.classSection || '') === k); });

  container.innerHTML = groupKeys.map(cls => `
    <div style="margin-bottom:28px">
      <div class="section-head" style="margin:0 0 14px">
        <div>
          <h2 class="section-title" style="font-size:18px">${escapeHtml(cls || 'Unassigned')}</h2>
          <p class="section-sub">${grouped[cls].length} students${cls ? '' : ' · no Class-Section on record'}</p>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-wrap-scroll">
          <table class="table">
            <thead>
              <tr>
                <th style="width:40px">#</th>
                <th>Name</th>
                <th style="width:150px">User ID</th>
                <th style="width:110px">Status</th>
                <th style="width:90px">Score</th>
                <th style="width:80px">%</th>
                <th style="width:100px">Time</th>
              </tr>
            </thead>
            <tbody>
              ${grouped[cls].map((s, i) => {
                const status = s.attempted
                  ? (s.passed ? Badge('Passed / Attempted', { tone: 'green', dot: true }) : Badge('Failed', { tone: 'red', dot: true }))
                  : Badge('Not attempted', { tone: 'gray', dot: true });
                const pctTone = s.percent == null ? 'gray' : s.percent >= 80 ? 'green' : s.percent >= 50 ? 'amber' : 'red';
                return `
                  <tr>
                    <td class="mono muted">${i + 1}</td>
                    <td><span style="font-weight:600">${escapeHtml(s.name)}</span></td>
                    <td>${Badge(s.userId, { tone: 'violet' })}</td>
                    <td>${status}</td>
                    <td class="mono">${s.attempted ? `${s.score}/${s.totalPoints}` : '—'}</td>
                    <td>${s.attempted ? Badge(`${s.percent}%`, { tone: pctTone }) : '—'}</td>
                    <td class="muted sm">${s.attempted ? formatTime(s.timeTaken) : '—'}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `).join('');
}

function exportExcel(kind, rows, quizTitle) {
  const filename = `report_${kind}_${(quizTitle || '').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'quiz'}_${Date.now()}.xlsx`;
  let data;
  if (kind === 'batch') {
    data = rows.map(b => ({
      'Batch': b.batch || 'Unassigned',
      'Total Students': b.totalStudents,
      'Attempted': b.attempted,
      'Not Attempted': b.notAttempted,
      'Passed': b.passed,
      'Avg %': b.avgPercent,
      'Max %': b.maxPercent,
      'Min %': b.minPercent
    }));
  } else {
    data = rows.map(s => ({
      'Name': s.name,
      'User ID': s.userId,
      'Batch': s.classSection,
      'Attempted': s.attempted ? 'Yes' : 'No',
      'Score': s.score ?? '',
      'Percentage': s.percent != null ? `${s.percent}%` : '',
      'Passed': s.passed ? 'Yes' : 'No',
      'Time Taken': s.attempted ? formatTime(s.timeTaken) : ''
    }));
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, kind === 'batch' ? 'Batch Report' : 'Student Report');
  XLSX.writeFile(wb, filename);
  showToast('Report exported as Excel');
}