import { getQuiz, getSubmissions } from '../store.js';
import { renderNavbar, formatTime, escapeHtml } from '../utils.js';
import { requireAdmin } from '../auth.js';

export async function renderResponses(app, params) {
  if (!requireAdmin()) return;

  const quizId = params[0];
  const quiz = await getQuiz(quizId);
  if (!quiz) { window.location.hash = '#/admin'; return; }

  const submissions = await getSubmissions(quizId);
  const avgScore = submissions.length > 0 ? Math.round(submissions.reduce((s, sub) => s + sub.percent, 0) / submissions.length) : 0;
  const passCount = submissions.filter(s => s.passed).length;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem">
          <div>
            <a href="#/admin" class="btn btn-ghost btn-sm" style="margin-bottom: 0.4rem">← Back to Admin Portal</a>
            <h1 style="font-size: 1.75rem; font-weight: 900">📊 ${escapeHtml(quiz.title)} — Participant Analytics</h1>
          </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-3" style="margin-bottom: 2rem">
          <div class="clay-card" style="text-align:center">
            <div style="font-size: 2.2rem; font-weight: 900; color: var(--clay-primary); margin-bottom: 0.2rem">${submissions.length}</div>
            <div style="font-size: 0.85rem; color: var(--text-sub)">Total Responses</div>
          </div>
          <div class="clay-card" style="text-align:center">
            <div style="font-size: 2.2rem; font-weight: 900; color: var(--clay-success); margin-bottom: 0.2rem">${avgScore}%</div>
            <div style="font-size: 0.85rem; color: var(--text-sub)">Average Score</div>
          </div>
          <div class="clay-card" style="text-align:center">
            <div style="font-size: 2.2rem; font-weight: 900; color: var(--clay-warning); margin-bottom: 0.2rem">${passCount}/${submissions.length}</div>
            <div style="font-size: 0.85rem; color: var(--text-sub)">Passed Threshold</div>
          </div>
        </div>

        ${submissions.length > 0 ? `
          <!-- Table Card -->
          <div class="clay-card" style="overflow-x:auto; margin-bottom: 2rem">
            <table style="width:100%; border-collapse:collapse; font-size: 0.85rem">
              <thead>
                <tr style="border-bottom: 2px solid rgba(255,255,255,0.06); text-align:left; color: var(--text-sub)">
                  <th style="padding: 0.8rem">#</th>
                  <th style="padding: 0.8rem">Participant Name</th>
                  <th style="padding: 0.8rem">Google Email</th>
                  <th style="padding: 0.8rem; text-align:center">Score</th>
                  <th style="padding: 0.8rem; text-align:center">Percent</th>
                  <th style="padding: 0.8rem; text-align:center">Status</th>
                  <th style="padding: 0.8rem; text-align:center">Time Taken</th>
                  <th style="padding: 0.8rem">Submitted At</th>
                </tr>
              </thead>
              <tbody>
                ${submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).map((sub, i) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04)">
                    <td style="padding: 0.8rem; color: var(--text-muted)">${i + 1}</td>
                    <td style="padding: 0.8rem; font-weight: 700">${escapeHtml(sub.participant?.name || 'Anonymous')}</td>
                    <td style="padding: 0.8rem; color: var(--text-sub)">${escapeHtml(sub.participant?.email || '-')}</td>
                    <td style="padding: 0.8rem; text-align:center; font-weight: 700">${sub.score}/${sub.totalPoints}</td>
                    <td style="padding: 0.8rem; text-align:center">
                      <span class="badge ${sub.percent >= 80 ? 'badge-success' : sub.percent >= 50 ? 'badge-warning' : 'badge-danger'}">${sub.percent}%</span>
                    </td>
                    <td style="padding: 0.8rem; text-align:center">
                      <span class="badge ${sub.passed ? 'badge-success' : 'badge-danger'}">${sub.passed ? '✓ Passed' : '✗ Failed'}</span>
                    </td>
                    <td style="padding: 0.8rem; text-align:center">${formatTime(sub.timeTaken || 0)}</td>
                    <td style="padding: 0.8rem; color: var(--text-muted); font-size: 0.75rem">${new Date(sub.submittedAt).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Question Difficulty Analysis -->
          <div class="clay-card">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem">📈 Question Breakdown & Accuracy</h3>
            ${quiz.questions.map((q, qi) => {
              const correctCount = submissions.filter(s => s.questionResults?.[qi]?.correct).length;
              const correctPct = submissions.length > 0 ? Math.round((correctCount / submissions.length) * 100) : 0;
              return `
                <div style="padding: 0.85rem; margin-bottom: 0.75rem; background: var(--bg-input); border-radius: var(--radius-sm); box-shadow: var(--clay-shadow-input)">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.4rem">
                    <span style="font-weight: 600; font-size: 0.9rem">Q${qi + 1}. ${escapeHtml(q.text).substring(0, 80)}</span>
                    <span class="badge ${correctPct >= 70 ? 'badge-success' : correctPct >= 40 ? 'badge-warning' : 'badge-danger'}">${correctPct}% Accuracy</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${correctPct}%; background:${correctPct >= 70 ? 'var(--clay-success)' : correctPct >= 40 ? 'var(--clay-warning)' : 'var(--clay-danger)'}"></div></div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="clay-card" style="text-align:center; padding: 3rem">
            <div style="font-size: 3rem; margin-bottom: 0.5rem">📭</div>
            <h3>No Responses Yet</h3>
            <p style="color: var(--text-sub); margin-top: 0.5rem">Share your quiz link to start collecting responses.</p>
          </div>
        `}

      </div>
    </div>
  `;
}
