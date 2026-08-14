import { getQuiz, getSubmissions } from '../store.js';
import { renderNavbar, formatTime, escapeHtml, bindNavbar, copyTextToClipboard, showToast, renderAccessDenied } from '../utils.js';
import { requireAdmin, hasPermission } from '../auth.js';
import { Icon, Badge, StatCard, EmptyState, SectionHead } from '../components.js';

export async function renderResponses(app, params) {
  if (!requireAdmin()) return;
  if (!hasPermission('quizzes', 'leaderboard')) {
    renderAccessDenied(app, 'Responses', 'Your account does not have permission to view quiz responses.');
    return;
  }

  const quizId = params[0];
  const quiz = await getQuiz(quizId);
  if (!quiz) { window.location.hash = '#/admin'; return; }

  const submissions = await getSubmissions(quizId);
  const avgScore = submissions.length > 0 ? Math.round(submissions.reduce((s, sub) => s + sub.percent, 0) / submissions.length) : 0;
  const passCount = submissions.filter(s => s.passed).length;
  const avgTime = submissions.length > 0 ? Math.round(submissions.reduce((s, sub) => s + (sub.timeTaken || 0), 0) / submissions.length) : 0;

  const leaderboard = [...submissions].sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    if (a.timeTaken !== b.timeTaken) return (a.timeTaken || 0) - (b.timeTaken || 0);
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });

  const qAccuracy = (quiz.questions || []).map((q, qi) => {
    const correctCount = submissions.filter(s => s.questionResults?.[qi]?.correct).length;
    const pct = submissions.length > 0 ? Math.round((correctCount / submissions.length) * 100) : 0;
    return { qi, pct };
  });
  const overallAccuracy = qAccuracy.length > 0
    ? Math.round(qAccuracy.reduce((s, x) => s + x.pct, 0) / qAccuracy.length)
    : 0;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">

        <div class="page-head" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px">
          <div>
            <a href="#/admin" class="btn btn-ghost btn-sm" style="margin-bottom:12px">${Icon('arrow-left', 14)}<span>Back to Dashboard</span></a>
            <div class="eyebrow">${Icon('users', 14)}<span>Participant Analytics</span></div>
            <h1 class="page-title" style="font-size:28px; display:flex; align-items:center; gap:8px; flex-wrap:wrap">
              <span>${escapeHtml(quiz.title)}</span>
              ${quiz.nickname ? `<span class="badge badge-purple" style="font-weight:600; font-size:12px; display:inline-flex; align-items:center; gap:4px">${Icon('tag', 12)} ${escapeHtml(quiz.nickname)}</span>` : ''}
            </h1>
            <p class="page-sub" style="margin-top:6px; font-size:15px">${submissions.length} response${submissions.length === 1 ? '' : 's'} · ${quiz.questions?.length || 0} questions</p>
          </div>
          <div class="page-head-actions">
            ${Badge(quiz.isPublished ? 'Live' : 'Draft', { tone: quiz.isPublished ? 'green' : 'gray', dot: true })}
          </div>
        </div>

        <!-- Summary -->
        <div class="stat-row" style="margin-bottom:32px">
          ${StatCard({ icon: 'users', label: 'Total responses', value: submissions.length, tone: 'blue' })}
          ${StatCard({ icon: 'trending-up', label: 'Average score', value: `${avgScore}%`, tone: 'green' })}
          ${StatCard({ icon: 'award', label: 'Passed', value: `${passCount}/${submissions.length}`, tone: 'amber' })}
          ${StatCard({ icon: 'clock', label: 'Avg time', value: formatTime(avgTime), tone: 'gray' })}
          ${StatCard({ icon: 'target', label: 'Accuracy', value: `${overallAccuracy}%`, tone: 'violet' })}
        </div>

        ${submissions.length > 0 ? `
          <div class="grid grid-2" style="align-items:start; margin-bottom:32px">

            <!-- Leaderboard -->
            <div class="card card-pad">
              <div class="section-head" style="margin:0 0 18px">
                <div>
                  <h2 class="section-title" style="font-size:18px">Leaderboard</h2>
                  <p class="section-sub">Ranked by score, then time</p>
                </div>
              </div>
              <div class="accordion">
                ${leaderboard.map((sub, i) => {
                  const passScore = quiz.passingPercent !== undefined && quiz.passingPercent !== null && quiz.passingPercent !== '' ? Number(quiz.passingPercent) : 50;
                  const isPassed = passScore === 0 || sub.percent >= passScore;
                  sub.passed = isPassed;

                  const pctTone = isPassed
                    ? 'green'
                    : (sub.percent >= Math.max(0, passScore - 15) ? 'amber' : 'red');

                  const rankBadge = i === 0
                    ? `<span class="badge badge-amber" style="font-weight:800; font-size:12px; background:linear-gradient(135deg, #fef3c7, #fde68a); color:#92400e; border:1px solid #f59e0b">🥇 1st</span>`
                    : i === 1
                    ? `<span class="badge badge-gray" style="font-weight:800; font-size:12px; background:linear-gradient(135deg, #f3f4f6, #e5e7eb); color:#374151; border:1px solid #9ca3af">🥈 2nd</span>`
                    : i === 2
                    ? `<span class="badge badge-amber" style="font-weight:800; font-size:12px; background:linear-gradient(135deg, #ffedd5, #fed7aa); color:#9a3412; border:1px solid #f97316">🥉 3rd</span>`
                    : `<span class="rank-num" style="font-weight:600; color:var(--text-3); font-size:13px">${i + 1}th</span>`;

                  const studentClass = sub.participant?.classSection || sub.participant?.class || sub.participant?.custom?.['Class / Grade'] || sub.participant?.custom?.['Class'] || sub.participant?.custom?.['Grade'] || sub.participant?.email || '';
                  const displayClass = studentClass.includes('@') ? studentClass : (studentClass.toLowerCase().startsWith('class') ? studentClass : `Class: ${studentClass}`);
                  const customStr = sub.participant?.custom
                    ? Object.entries(sub.participant.custom).filter(([k]) => !['class', 'class / grade', 'grade'].includes(k.toLowerCase())).map(([k, v]) => `${k}: ${v}`).join(' · ')
                    : (sub.participant?.org || '');
                  const detailItems = sub.questionResults || [];
                  return `
                    <div class="acc-item">
                      <button class="acc-header" aria-expanded="false" aria-controls="resp-body-${i}">
                        <span class="acc-icon">${rankBadge}</span>
                        <span class="acc-title">
                          <span style="display:block">${escapeHtml(sub.participant?.name || 'Anonymous')}</span>
                          <span class="xs muted" style="font-weight:500">${escapeHtml(displayClass)}</span>
                        </span>
                        <span class="acc-meta">
                          ${customStr ? `<span class="xs muted" style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(customStr)}</span>` : ''}
                          ${Badge(`${sub.percent}%`, { tone: pctTone })}
                          <span class="acc-toggle">${Icon('chevron-down', 16)}</span>
                        </span>
                      </button>
                      <div class="acc-body" id="resp-body-${i}">
                        <div class="flex" style="gap:18px; flex-wrap:wrap; margin-bottom:14px">
                          <span class="meta-item">${Icon('check-circle', 14)}<span>${sub.score}/${sub.totalPoints} points</span></span>
                          <span class="meta-item">${Icon('clock', 14)}<span>${formatTime(sub.timeTaken || 0)}</span></span>
                          <span class="meta-item">${Icon('calendar', 14)}<span>${new Date(sub.submittedAt).toLocaleString()}</span></span>
                          <span class="meta-item">${Badge(sub.passed ? 'Passed' : 'Not passed', { tone: sub.passed ? 'green' : 'red' })}</span>
                        </div>
                        <div class="result-review" style="gap:8px">
                          ${detailItems.length > 0 ? detailItems.map((qr, qi) => `
                            <div class="review-item" style="display:flex; gap:10px; padding:10px 12px; background:var(--surface-subtle); border-radius:var(--r-sm); border-left:3px solid ${qr.correct ? 'var(--green)' : 'var(--red)'}">
                              <span class="acc-icon">${Icon(qr.correct ? 'check-circle' : 'x', 15, qr.correct ? '' : 'text-3')}</span>
                              <div style="min-width:0; flex:1">
                                <div style="font-size:13.5px; font-weight:600; line-height:1.4">Q${qi + 1}. ${escapeHtml(qr.question)}</div>
                                <div class="review-reason" style="margin-top:4px">
                                  <strong>Answer:</strong> ${escapeHtml(qr.type === 'tf' ? qr.userAnswer : qr.options?.[parseInt(qr.userAnswer)] || qr.userAnswer || 'No answer')}
                                  ${!qr.correct ? ` · <strong>Correct:</strong> ${escapeHtml(qr.type === 'tf' ? qr.correctAnswer : qr.options?.[parseInt(qr.correctAnswer)] || qr.correctAnswer)}` : ''}
                                </div>
                              </div>
                            </div>
                          `).join('') : '<p class="xs muted">No question-level detail recorded.</p>'}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Question breakdown -->
            <div class="card card-pad">
              <div class="section-head" style="margin:0 0 18px">
                <div>
                  <h2 class="section-title" style="font-size:18px">Question breakdown</h2>
                  <p class="section-sub">Accuracy per question across all responses</p>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:14px">
                ${qAccuracy.map(({ qi, pct }) => {
                  const q = quiz.questions[qi];
                  const pctTone = pct >= 70 ? 'green' : pct >= 40 ? 'amber' : 'red';
                  return `
                    <div>
                      <div class="flex justify-between" style="margin-bottom:6px; gap:12px">
                        <span style="font-size:13.5px; font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">Q${qi + 1}. ${escapeHtml(q?.text || '')}</span>
                        ${Badge(`${pct}%`, { tone: pctTone })}
                      </div>
                      <div class="progress">
                        <div class="progress-fill" style="width:${pct}%; background:${pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)'}"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

          </div>
        ` : `
          <div class="card">
            ${EmptyState({
              icon: 'users',
              title: 'No responses yet',
              desc: 'Share your quiz link to start collecting participant responses.',
              action: `<button class="btn btn-primary" id="btn-copy-link">${Icon('link', 15)}<span>Copy Quiz Link</span></button>`
            })}
          </div>
        `}

      </div>
    </div>
  `;

  bindNavbar(app);

  // Accordion toggle
  app.querySelectorAll('.acc-header').forEach(h => {
    h.addEventListener('click', () => {
      const item = h.closest('.acc-item');
      const open = item.classList.contains('open');
      item.classList.toggle('open', !open);
      h.setAttribute('aria-expanded', String(!open));
    });
  });

  // Copy link (empty state)
  const copyBtn = app.querySelector('#btn-copy-link');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const url = `${window.location.origin}/#/take/${quizId}`;
      const ok = await copyTextToClipboard(url);
      if (ok) showToast('Quiz link copied to clipboard');
      else showToast(url, 'info');
    });
  }
}
