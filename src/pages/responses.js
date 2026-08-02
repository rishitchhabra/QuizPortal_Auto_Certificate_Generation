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
          <!-- 🏆 LEADERBOARD / HALL OF FAME -->
          <div class="clay-card" style="margin-bottom: 2.5rem; background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(240,249,255,0.98))">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem">
              <h2 style="font-size: 1.35rem; font-weight: 900; display:flex; align-items:center; gap: 0.5rem">
                🏆 Evaluation Leaderboard & Hall of Fame
              </h2>
              <span class="badge badge-success" style="font-weight:800">${submissions.length} Ranked</span>
            </div>

            <!-- Top 3 Podium Cards -->
            ${(() => {
              const leaderboard = [...submissions].sort((a, b) => {
                if (b.percent !== a.percent) return b.percent - a.percent;
                if (a.timeTaken !== b.timeTaken) return (a.timeTaken || 0) - (b.timeTaken || 0);
                return new Date(a.submittedAt) - new Date(b.submittedAt);
              });
              return `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem">
                  ${leaderboard.slice(0, 3).map((sub, rank) => {
                    const medals = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
                    const colors = ['#f59e0b', '#64748b', '#d97706'];
                    const customDetails = sub.participant?.custom ? Object.entries(sub.participant.custom).map(([k, v]) => `${k}: ${v}`).join(' | ') : (sub.participant?.org || '');
                    return `
                      <div class="clay-card" style="text-align:center; padding: 1.25rem; border: 2px solid ${colors[rank]}; background: #ffffff">
                        <div style="font-size: 2.2rem; margin-bottom: 0.2rem">${medals[rank].split(' ')[0]}</div>
                        <div style="font-weight: 900; font-size: 0.8rem; color: ${colors[rank]}; text-transform:uppercase">${medals[rank]}</div>
                        <h3 style="font-size: 1.1rem; font-weight: 800; margin: 0.4rem 0 0.2rem">${escapeHtml(sub.participant?.name || 'Anonymous')}</h3>
                        <div style="font-size: 0.75rem; color: var(--text-sub); margin-bottom: 0.4rem">${escapeHtml(sub.participant?.email || '')}</div>
                        ${customDetails ? `<div style="font-size: 0.75rem; font-weight: 700; color: var(--clay-primary); margin-bottom: 0.5rem">${escapeHtml(customDetails)}</div>` : ''}
                        <div style="display:flex; justify-content:center; gap: 0.5rem; font-size: 0.85rem">
                          <span class="badge badge-success" style="font-weight:900">${sub.percent}% (${sub.score}/${sub.totalPoints})</span>
                          <span class="badge badge-clay">⏱️ ${formatTime(sub.timeTaken || 0)}</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <div style="overflow-x:auto">
                  <table style="width:100%; border-collapse:collapse; font-size: 0.85rem">
                    <thead>
                      <tr style="border-bottom: 2px solid rgba(0,0,0,0.08); text-align:left; color: var(--text-sub)">
                        <th style="padding: 0.75rem">Rank</th>
                        <th style="padding: 0.75rem">Student Name</th>
                        <th style="padding: 0.75rem">Class / Custom Details</th>
                        <th style="padding: 0.75rem">Email</th>
                        <th style="padding: 0.75rem; text-align:center">Score</th>
                        <th style="padding: 0.75rem; text-align:center">Percent</th>
                        <th style="padding: 0.75rem; text-align:center">Time Taken</th>
                        <th style="padding: 0.75rem; text-align:center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${leaderboard.map((sub, i) => {
                        const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                        const customStr = sub.participant?.custom ? Object.entries(sub.participant.custom).map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`).join(' · ') : (escapeHtml(sub.participant?.org || '-'));
                        return `
                          <tr style="border-bottom: 1px solid rgba(0,0,0,0.04); ${i < 3 ? 'font-weight:700; background: rgba(2,132,199,0.03)' : ''}">
                            <td style="padding: 0.75rem; font-size: 1rem">${rankIcon}</td>
                            <td style="padding: 0.75rem; font-weight:800">${escapeHtml(sub.participant?.name || 'Anonymous')}</td>
                            <td style="padding: 0.75rem; font-size: 0.8rem; color: var(--clay-primary)">${customStr}</td>
                            <td style="padding: 0.75rem; color: var(--text-sub); font-size: 0.8rem">${escapeHtml(sub.participant?.email || '-')}</td>
                            <td style="padding: 0.75rem; text-align:center; font-weight:800">${sub.score}/${sub.totalPoints}</td>
                            <td style="padding: 0.75rem; text-align:center">
                              <span class="badge ${sub.percent >= 80 ? 'badge-success' : sub.percent >= 50 ? 'badge-warning' : 'badge-danger'}">${sub.percent}%</span>
                            </td>
                            <td style="padding: 0.75rem; text-align:center">${formatTime(sub.timeTaken || 0)}</td>
                            <td style="padding: 0.75rem; text-align:center">
                              <button class="btn btn-secondary btn-sm view-sub-detail" data-subidx="${i}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem">🔍 View Answers</button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `;
            })()}
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

  // Bind view details modal
  const leaderboard = [...submissions].sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    if (a.timeTaken !== b.timeTaken) return (a.timeTaken || 0) - (b.timeTaken || 0);
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });

  app.querySelectorAll('.view-sub-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = leaderboard[parseInt(btn.dataset.subidx)];
      if (!sub) return;
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.innerHTML = `
        <div class="modal-clay scale-in" style="max-width: 650px; text-align:left">
          <h3 style="font-size: 1.3rem; font-weight:800; margin-bottom: 0.4rem">📋 Submission Details: ${escapeHtml(sub.participant?.name || 'Participant')}</h3>
          <p style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 1rem">
            Email: <strong>${escapeHtml(sub.participant?.email || '-')}</strong> | Score: <strong>${sub.score}/${sub.totalPoints} (${sub.percent}%)</strong> | Time: <strong>${formatTime(sub.timeTaken || 0)}</strong>
          </p>

          <div style="max-height: 400px; overflow-y:auto; display:flex; flex-direction:column; gap: 0.75rem; margin-bottom: 1.5rem">
            ${(sub.questionResults || []).map((qr, qi) => `
              <div style="padding: 0.85rem; background: var(--bg-input); border-radius: var(--radius-sm); border-left: 4px solid ${qr.correct ? 'var(--clay-success)' : 'var(--clay-danger)'}">
                <div style="font-weight:700; font-size: 0.9rem; margin-bottom: 0.3rem">Q${qi + 1}. ${escapeHtml(qr.question)}</div>
                <div style="font-size: 0.8rem; margin-bottom: 0.2rem">
                  Student Answer: <span style="font-weight:700; color:${qr.correct ? 'var(--clay-success)' : 'var(--clay-danger)'}">${escapeHtml(qr.type === 'tf' ? qr.userAnswer : qr.options?.[parseInt(qr.userAnswer)] || qr.userAnswer || 'None')}</span>
                </div>
                ${!qr.correct ? `
                  <div style="font-size: 0.8rem; color: var(--clay-success); font-weight:700">
                    Correct Answer: ${escapeHtml(qr.type === 'tf' ? qr.correctAnswer : qr.options?.[parseInt(qr.correctAnswer)] || qr.correctAnswer)}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <div style="text-align:right">
            <button class="btn btn-primary btn-sm modal-close-btn">Close Window</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    });
  });
}
