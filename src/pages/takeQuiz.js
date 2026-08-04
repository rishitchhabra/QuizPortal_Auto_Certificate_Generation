import { getQuiz, saveSubmission, generateId, getCertTemplate, getSubmissionsByEmail, getSubmissionsByUserId, getGoogleUser, generateCertificatePdf, verifyUserId } from '../store.js';
import { renderNavbar, showToast, formatTime, shuffleArray, showModal, escapeHtml, bindNavbar, subjectFor, burstConfetti } from '../utils.js';
import { initGoogleAuth, renderGoogleButton, getGoogleClientId } from '../auth.js';
import { Icon, Badge } from '../components.js';

let quiz = null, participant = {}, answers = {};
let timerInterval = null, timeLeft = 0, quizStarted = false, quizSubmitted = false;

export async function renderTakeQuiz(app, params) {
  const quizId = params[0];
  quiz = await getQuiz(quizId);

  if (!quiz) {
    renderNotice(app, { icon: Icon('search', 26), title: 'Quiz not found', desc: 'This quiz link may be invalid or deleted.' });
    return;
  }

  if (!quiz.isPublished) {
    renderNotice(app, { icon: Icon('pause', 26), title: 'Quiz currently inactive', desc: 'The quiz organizer has paused or stopped this quiz. Access is currently disabled.' });
    return;
  }

  if (quiz.deadline) {
    const deadlineDate = new Date(quiz.deadline);
    if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
      renderNotice(app, { icon: Icon('clock', 26), title: 'Quiz deadline passed', desc: `The deadline to attempt this quiz was <strong>${deadlineDate.toLocaleString()}</strong>. New attempts are closed.` });
      return;
    }
  }

  answers = {}; quizStarted = false; quizSubmitted = false; participant = {};
  if (timerInterval) clearInterval(timerInterval);

  quiz.authMode = quiz.authMode || 'google';
  quiz.allowedBatches = Array.isArray(quiz.allowedBatches) ? quiz.allowedBatches : [];

  if (quiz.authMode === 'userid') {
    renderUserIdSignIn(app);
  } else {
    const clientId = await getGoogleClientId();
    const guser = getGoogleUser();

    if (!clientId) {
      renderNotice(app, { icon: Icon('shield', 26), title: 'Google Sign-In required', desc: 'Google OAuth configuration is missing in Admin Portal.' });
      return () => {};
    }

    if (!guser) {
      renderGoogleSignIn(app, clientId);
    } else {
      participant.name = guser.name || '';
      participant.email = guser.email || '';
      renderParticipantForm(app);
    }
  }
  return () => { if (timerInterval) clearInterval(timerInterval); };
}

async function renderUserIdSignIn(app) {
  const subj = quizSubject();
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-take" style="padding-top:24px">
        <div class="quiz-panel" style="text-align:left">
          ${quizIntroHeader()}

          <div class="signin-promo ${subj.cls}" style="--subj:${subj.color}">
            <div class="signin-promo-bubbles"></div>
            <div class="signin-promo-inner">
              <div class="signin-promo-icon">${Icon('id-badge', 24)}</div>
              <div class="signin-promo-title">Enter your User ID</div>
              <div class="signin-promo-sub">Type the User ID shared by your school to start the quiz. Your name will be pulled automatically.</div>

              <form id="userid-form" class="userid-form" novalidate>
                <input type="text" id="userid-input" class="input input-lg" placeholder="e.g. aaravsharma291" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="User ID">
                <button type="submit" class="btn btn-primary btn-lg btn-block" style="justify-content:center; margin-top:12px">
                  ${Icon('log-in', 16)}<span>Start Quiz</span>
                </button>
                <p class="xs text-3" id="userid-err" style="margin-top:12px; text-align:center; min-height:16px"></p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  bindNavbar(app);
  const form = app.querySelector('#userid-form');
  const input = app.querySelector('#userid-input');
  const errEl = app.querySelector('#userid-err');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = input.value.trim().toLowerCase();
    if (!raw) { errEl.textContent = 'Please enter your User ID.'; errEl.style.color = 'var(--red)'; return; }
    errEl.textContent = 'Checking…';
    errEl.style.color = 'var(--text-2)';
    submitBtn.disabled = true;
    let student = null;
    try { student = (await verifyUserId(raw))?.user || null; } catch (err) {
      errEl.textContent = err.message || 'Something went wrong. Please try again.';
      errEl.style.color = 'var(--red)';
      submitBtn.disabled = false;
      return;
    }
    if (!student) {
      errEl.textContent = 'No student found with that User ID. Check with your teacher.';
      errEl.style.color = 'var(--red)';
      submitBtn.disabled = false;
      return;
    }

    // Enforce batch restriction for userid-auth quizzes
    if (quiz.allowedBatches.length === 0) {
      errEl.textContent = 'This quiz has no batches mapped yet. Please ask your teacher to assign batches to this quiz.';
      errEl.style.color = 'var(--red)';
      submitBtn.disabled = false;
      return;
    }
    if (!quiz.allowedBatches.includes(student.classSection)) {
      errEl.textContent = `This quiz is only for batches: ${quiz.allowedBatches.join(', ')}. You are in "${student.classSection || 'Unassigned'}".`;
      errEl.style.color = 'var(--red)';
      submitBtn.disabled = false;
      return;
    }

    // Enforce one attempt per student
    if (quiz.limitPerUser) {
      const existing = await getSubmissionsByUserId(quiz.id, student.userId).catch(() => []);
      if (existing.length > 0) {
        renderResults(existing[0]);
        return;
      }
    }

    participant.userId = student.userId;
    participant.name = student.name || '';
    participant.classSection = student.classSection || '';
    if (!participant.email) participant.email = `${student.userId}@student.local`;
    renderParticipantForm(app);
  });

  setTimeout(() => input.focus(), 50);
}

function renderNotice(app, { icon, title, desc }) {
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-narrow" style="padding-top:48px">
        <div class="card" style="padding:48px 32px; text-align:center">
          <div class="empty-icon" style="margin:0 auto 16px">${icon}</div>
          <h2 style="font-size:22px; font-weight:700; margin-bottom:8px">${title}</h2>
          <p style="color:var(--text-2); font-size:15px; max-width:420px; margin:0 auto">${desc}</p>
          <div style="margin-top:24px"><a href="#/" class="btn btn-secondary">${Icon('arrow-left', 15)}<span>Return Home</span></a></div>
        </div>
      </div>
    </div>`;
}

function quizSubject() {
  return subjectFor(quiz?.title || '');
}

// Hero block: quiz title as the hero, student details as a subtle, non-hero strip.
function attemptHeroBlock(p = participant) {
  const subj = quizSubject();
  const name = escapeHtml(p?.name || 'Participant');
  const cls = p?.classSection ? escapeHtml(p.classSection) : '';
  const uid = p?.userId ? escapeHtml(p.userId) : '';
  return `
    <div class="attempt-hero">
      <div class="attempt-hero-eyebrow">${Icon(subj.icon, 13)}<span>${quiz.questions.length} Questions · ${quiz.timerMinutes || 30} min</span></div>
      <h1 class="attempt-hero-title">${escapeHtml(quiz.title || 'Untitled quiz')}</h1>
      ${quiz.description ? `<p class="attempt-hero-desc">${escapeHtml(quiz.description)}</p>` : ''}
    </div>
    <div class="attempt-student">
      <span class="attempt-student-avatar">${Icon('user', 14)}</span>
      <span class="attempt-student-name">${name}</span>
      ${cls ? `<span class="attempt-student-sep">·</span><span class="attempt-student-class">${cls}</span>` : ''}
      ${uid ? `<span class="attempt-student-sep">·</span><span class="attempt-student-uid">${uid}</span>` : ''}
    </div>
  `;
}

function quizIntroHeader() {
  const totalPts = quiz.questions.reduce((s, q) => s + (q.points || 1), 0);
  const hasCert = !!quiz.certificateTemplateId;
  const subj = quizSubject();
  return `
    <div class="quiz-intro">
      <span class="quiz-intro-icon ${subj.cls}" style="--subj:${subj.color}">${Icon(subj.icon, 24)}</span>
      <div class="eyebrow">${Icon('graduation-cap', 13)}<span>Gyan International School · Assessment</span></div>
      <h1 class="quiz-intro-title">${escapeHtml(quiz.title)}</h1>
      ${quiz.description ? `<p class="quiz-intro-desc">${escapeHtml(quiz.description)}</p>` : ''}

      <div class="quiz-intro-stats">
        <div class="stat-card-mini">
          <span class="mini-icon stat-blue">${Icon('list-checks', 15)}</span>
          <span class="mini-val">${quiz.questions.length}</span>
          <span class="mini-label">Questions</span>
        </div>
        <div class="stat-card-mini">
          <span class="mini-icon stat-amber">${Icon('clock', 15)}</span>
          <span class="mini-val">${quiz.timerMinutes || 30} min</span>
          <span class="mini-label">Duration</span>
        </div>
        <div class="stat-card-mini">
          <span class="mini-icon stat-violet">${Icon('target', 15)}</span>
          <span class="mini-val">${totalPts}</span>
          <span class="mini-label">Total points</span>
        </div>
        <div class="stat-card-mini">
          <span class="mini-icon stat-green">${Icon('award', 15)}</span>
          <span class="mini-val">${quiz.passingPercent || 50}%</span>
          <span class="mini-label">Pass mark</span>
        </div>
      </div>

      ${hasCert ? `
        <div class="quiz-cert-note">${Icon('award', 15)}<span>Pass the quiz and download your official certificate instantly.</span></div>
      ` : ''}
      ${quiz.deadline ? `
        <div class="info" style="margin-top:12px">${Icon('clock', 16)}<span>Attempt deadline: <strong>${new Date(quiz.deadline).toLocaleString()}</strong></span></div>
      ` : ''}
    </div>
  `;
}

function renderGoogleSignIn(app, clientId) {
  const subj = quizSubject();
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-take" style="padding-top:24px">
        <div class="quiz-panel" style="text-align:left">
          ${quizIntroHeader()}

          <div class="signin-promo ${subj.cls}" style="--subj:${subj.color}">
            <div class="signin-promo-bubbles"></div>
            <div class="signin-promo-inner">
              <div class="signin-promo-icon">${Icon('sparkles', 24)}</div>
              <div class="signin-promo-title">Almost there — sign in to play!</div>
              <div class="signin-promo-sub">One quick Google sign-in unlocks your attempt, saves your score and lets you download your certificate.</div>
              <div id="google-btn-container" class="google-btn-wrap"></div>
              <p class="xs text-3" style="margin-top:14px; text-align:center">Only your name and email address are recorded with your submission.</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  bindNavbar(app);
  const onSignIn = (user) => {
    participant.name = user.name;
    participant.email = user.email;
    renderParticipantForm(app);
  };

  const inited = initGoogleAuth(clientId, onSignIn);
  if (inited) {
    setTimeout(() => renderGoogleButton('google-btn-container', clientId), 200);
  } else {
    setTimeout(() => {
      const inited2 = initGoogleAuth(clientId, onSignIn);
      if (inited2) renderGoogleButton('google-btn-container', clientId);
    }, 1500);
  }
}

async function renderParticipantForm(app) {
  if (quiz.limitPerUser && participant.email) {
    const existing = await getSubmissionsByEmail(quiz.id, participant.email);
    if (existing.length > 0) {
      const sub = existing[0];
      participant.name = sub.participant?.name || participant.name;
      participant.email = sub.participant?.email || participant.email;
      renderResults(sub);
      return;
    }
  }

  const guser = getGoogleUser();
  const isUserIdAuth = !!participant.userId;
  const instructions = (quiz.instructions || '').trim();

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-take" style="padding-top:24px">
        <div class="quiz-panel" style="text-align:left">
          ${quizIntroHeader()}

          <div class="quiz-account-group">
            <div class="account-group-head">
              ${guser?.picture ? `<img src="${guser.picture}" alt="" style="width:40px; height:40px; border-radius:50%">` : `<div class="stat-icon stat-gray" style="width:40px; height:40px">${Icon('user', 18)}</div>`}
              <div style="flex:1; min-width:0">
                <div style="font-weight:700; font-size:15px">${escapeHtml(participant.name || 'Participant')}</div>
                ${isUserIdAuth ? `
                  <div class="acct-class">${escapeHtml(participant.classSection || 'Unassigned class')}</div>
                  <div class="acct-userid">${Icon('id-badge', 12)}<span>${escapeHtml(participant.userId)}</span></div>
                ` : `
                  <div class="xs muted" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(participant.email || '')}</div>
                `}
              </div>
              ${Badge('Verified', { tone: 'green', dot: true })}
            </div>
          </div>

          ${instructions ? `
            <div class="quiz-instructions">
              <div class="quiz-instructions-title">${Icon('info', 15)}<span>Instructions</span></div>
              <div class="quiz-instructions-body">${escapeHtml(instructions)}</div>
            </div>
          ` : ''}

          ${(quiz.collectPhone || quiz.collectOrg || (quiz.customFields || []).length > 0) ? `
            <div class="quiz-form-group">
              <div class="form-group-title">A little about you</div>
              ${quiz.collectPhone ? `<div style="margin-bottom:14px">${fieldLabel('Phone number')}<input type="tel" class="input" id="p-phone" placeholder="Enter phone number" autocomplete="tel"></div>` : ''}
              ${quiz.collectOrg ? `<div style="margin-bottom:14px">${fieldLabel('Institution / School')}<input type="text" class="input" id="p-org" placeholder="Enter institution / school" autocomplete="organization"></div>` : ''}
              ${(quiz.customFields || []).map((cf, cfi) => `
                <div style="margin-bottom:14px">
                  ${fieldLabel(cf.label, cf.required)}
                  ${cf.type === 'dropdown' ? `
                    <select class="input select custom-field-val" data-cfi="${cfi}" data-label="${escapeHtml(cf.label)}">
                      <option value="">Select ${escapeHtml(cf.label)}…</option>
                      ${(cf.options || '').split(',').map(s => s.trim()).filter(Boolean).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
                    </select>
                  ` : `<input type="${cf.type === 'number' ? 'number' : 'text'}" class="input custom-field-val" data-cfi="${cfi}" data-label="${escapeHtml(cf.label)}" placeholder="Enter ${escapeHtml(cf.label)}">`}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <button class="btn btn-fun btn-lg btn-block" id="btn-start-quiz" style="height:56px; font-size:17px; margin-top:6px">${Icon('play', 18)}<span>Begin Quiz</span></button>
          <p class="xs text-3" style="text-align:center; margin-top:12px">The timer starts the moment you continue.</p>
        </div>
      </div>
    </div>`;

  bindNavbar(app);
  app.querySelector('#btn-start-quiz').addEventListener('click', () => {
    if (quiz.collectPhone) participant.phone = app.querySelector('#p-phone')?.value?.trim() || '';
    if (quiz.collectOrg) participant.org = app.querySelector('#p-org')?.value?.trim() || '';

    participant.custom = {};
    let reqMissing = false;
    let customNameValue = '';
    app.querySelectorAll('.custom-field-val').forEach(el => {
      const cfi = parseInt(el.dataset.cfi);
      const cf = quiz.customFields?.[cfi];
      const val = el.value?.trim() || '';
      if (cf?.required && !val) {
        showToast(`Please fill in ${cf.label}`, 'error');
        reqMissing = true;
        el.focus();
      }
      const label = cf?.label || `Field_${cfi}`;
      if (val) participant.custom[label] = val;
      if (label.toLowerCase() === 'name' && val) customNameValue = val;
    });
    if (reqMissing) return;
    if (customNameValue) participant.name = customNameValue;

    quizStarted = true;
    timeLeft = (quiz.timerMinutes || 30) * 60;
    if (quiz.shuffleQuestions) quiz.questions = shuffleArray(quiz.questions);
    renderContinuousQuizShell(app);
    startTimer();
  });
}

function fieldLabel(label, required) {
  return `<label class="field-label" style="margin-bottom:6px">${escapeHtml(label)}${required ? '<span class="field-req">*</span>' : ''}</label>`;
}

/* CONTINUOUS SCROLL QUIZ SHELL */
function renderContinuousQuizShell(app) {
  const total = quiz.questions.length;
  const letters = 'ABCDEFGHIJ';
  const subj = quizSubject();

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in" style="padding-top:0">
      <div class="quiz-head">
        <div class="quiz-head-inner">
          <div class="quiz-head-left">
            <span class="quiz-title-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(quiz.title)}</span>
            <span class="answered-count" id="answered-count">0 of ${total} answered</span>
          </div>
          <div class="quiz-head-right">
            <div class="quiz-progress" id="quiz-progress"><span id="quiz-progress-fill" style="width:0%"></span></div>
            <div id="timer" class="timer-pill">${Icon('timer', 15)}<span>${formatTime(timeLeft)}</span></div>
          </div>
        </div>
      </div>

      <div class="container-take" style="padding-top:28px">
        ${attemptHeroBlock()}
        <div class="continuous-quiz-container">
          ${quiz.questions.map((q, i) => `
            <section class="question-card" id="q-block-${i}" aria-labelledby="q-title-${i}">
              <div class="question-card-top">
                <div class="flex items-center gap-sm">
                  <span class="q-chip ${subj.cls}" style="--subj:${subj.color}">${i + 1}</span>
                  <span class="badge badge-gray">Question ${i + 1} of ${total}</span>
                  ${q.required !== false ? `<span class="badge badge-amber">${Icon('alert-circle', 11)} Required</span>` : ''}
                </div>
                <span class="pts-pill">${Icon('star', 13)}<span>${q.points || 1} pt${(q.points || 1) > 1 ? 's' : ''}</span></span>
              </div>

              <div id="err-banner-${i}"></div>

              <h2 class="question-text" id="q-title-${i}">${escapeHtml(q.text)}</h2>

              <div class="options-group" data-qi="${i}">
                ${q.type === 'tf' ? `
                  <button class="quiz-option ${answers[i] === 'true' ? 'selected' : ''}" data-qi="${i}" data-answer="true">
                    <span class="opt-letter">${Icon('check', 16)}</span><span>True</span>
                    <span class="opt-check">${Icon('check-circle', 20)}</span>
                  </button>
                  <button class="quiz-option ${answers[i] === 'false' ? 'selected' : ''}" data-qi="${i}" data-answer="false">
                    <span class="opt-letter">${Icon('x', 16)}</span><span>False</span>
                    <span class="opt-check">${Icon('check-circle', 20)}</span>
                  </button>
                ` : (q.options || []).map((opt, oi) => `
                  <button class="quiz-option ${answers[i] === oi.toString() ? 'selected' : ''}" data-qi="${i}" data-answer="${oi}">
                    <span class="opt-letter opt-letter-${(oi % 6) + 1}">${letters[oi]}</span><span>${escapeHtml(opt)}</span>
                    <span class="opt-check">${Icon('check-circle', 20)}</span>
                  </button>
                `).join('')}
              </div>
            </section>
          `).join('')}

          <div class="quiz-panel" style="margin-top:4px">
            <h3 style="font-size:19px; font-weight:800; letter-spacing:-0.01em">Ready to submit?</h3>
            <p style="color:var(--text-2); font-size:14.5px; margin:8px 0 22px">Make sure you have answered all required questions before submitting your evaluation.</p>
            <button class="btn btn-submit" id="btn-submit-continuous">
              ${Icon('check-circle', 18)}<span>Complete &amp; Submit Quiz</span>
            </button>
          </div>
        </div>
      </div>
    </div>`;

  bindNavbar(app);

  app.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const qi = parseInt(btn.dataset.qi);
      const val = btn.dataset.answer;
      answers[qi] = val;

      const block = document.getElementById(`q-block-${qi}`);
      block?.classList.remove('has-error');
      const errBanner = document.getElementById(`err-banner-${qi}`);
      if (errBanner) errBanner.innerHTML = '';

      const group = app.querySelector(`.options-group[data-qi="${qi}"]`);
      group?.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      updateProgress();
    });
  });

  app.querySelector('#btn-submit-continuous').addEventListener('click', validateAndSubmit);
  updateProgress();
}

function updateProgress() {
  const answered = Object.keys(answers).length;
  const total = quiz.questions.length;
  const el = document.getElementById('answered-count');
  if (el) el.textContent = `${answered} of ${total} answered`;
  const fill = document.getElementById('quiz-progress-fill');
  if (fill) {
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    fill.style.width = pct + '%';
  }
}

function validateAndSubmit() {
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    if (q.required !== false && (answers[i] === undefined || answers[i] === '')) {
      const card = document.getElementById(`q-block-${i}`);
      const errBanner = document.getElementById(`err-banner-${i}`);
      if (card) {
        card.classList.add('has-error');
        if (errBanner) {
          errBanner.innerHTML = `<div class="required-banner">${Icon('alert-circle', 15)}<span>Please answer this question</span></div>`;
        }
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast(`Please answer Question #${i + 1}`, 'error');
      return;
    }
  }
  showModal('Submit quiz?', '<p>Are you sure you want to finalize and submit your responses?</p>', () => submitQuiz(false), { confirmText: 'Submit' });
}

let quizEndTime = null;

function startTimer() {
  const key = `quiz_end_time_${quiz.id}`;
  const stored = sessionStorage.getItem(key);
  const totalSeconds = (quiz.timerMinutes || 30) * 60;

  if (stored && !isNaN(parseInt(stored))) {
    quizEndTime = parseInt(stored);
  } else {
    quizEndTime = Date.now() + (totalSeconds * 1000);
    sessionStorage.setItem(key, quizEndTime.toString());
  }

  const updateTimerDisplay = () => {
    if (quizSubmitted) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((quizEndTime - now) / 1000));
    timeLeft = remaining;

    const timerEl = document.getElementById('timer');
    if (timerEl) {
      timerEl.innerHTML = `${Icon('timer', 15)}<span>${formatTime(remaining)}</span>`;
      timerEl.className = 'timer-pill';
      if (remaining <= 60) timerEl.classList.add('danger');
      else if (remaining <= 300) timerEl.classList.add('warning');
    }

    if (remaining <= 0) {
      if (timerInterval) clearInterval(timerInterval);
      sessionStorage.removeItem(key);
      showToast('Time is up! Submitting automatically…', 'info');
      submitQuiz(true);
    }
  };

  updateTimerDisplay();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 1000);

  window.removeEventListener('visibilitychange', updateTimerDisplay);
  window.addEventListener('visibilitychange', updateTimerDisplay);
  window.removeEventListener('focus', updateTimerDisplay);
  window.addEventListener('focus', updateTimerDisplay);
}

async function submitQuiz(force = false) {
  if (quizSubmitted) return;
  quizSubmitted = true;
  if (timerInterval) clearInterval(timerInterval);
  sessionStorage.removeItem(`quiz_end_time_${quiz.id}`);

  const btn = document.getElementById('btn-submit-continuous');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `${Icon('loader', 16)}<span>Submitting &amp; evaluating…</span>`;
    btn.classList.add('icon-spin');
  }

  let score = 0, totalPoints = 0;
  const questionResults = [];
  quiz.questions.forEach((q, i) => {
    const pts = q.points || 1; totalPoints += pts;
    const correct = String(answers[i]) === String(q.correctAnswer);
    if (correct) score += pts;
    questionResults.push({ question: q.text, userAnswer: answers[i], correctAnswer: q.correctAnswer, correct, points: pts, options: q.options, type: q.type });
  });

  const percent = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percent >= (quiz.passingPercent || 50);
  const timeTaken = Math.max(1, (quiz.timerMinutes * 60) - timeLeft);
  const submission = { id: generateId(), quizId: quiz.id, participant, answers, score, totalPoints, percent, passed, timeTaken, questionResults, submittedAt: new Date().toISOString() };

  try {
    await saveSubmission(submission);
    renderResults(submission);
  } catch (err) {
    console.error('Submission error:', err);
    quizSubmitted = false;
    showToast('Failed to save submission: ' + (err.message || 'Server error'), 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${Icon('check-circle', 17)}<span>Complete &amp; Submit Quiz</span>`;
      btn.classList.remove('icon-spin');
    }
  }
}

/* ============================ RESULTS ============================ */
function renderResults(submission) {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const app = document.getElementById('app');

  // Show a skeleton while the results + certificate are being prepared, and only
  // swap in the real page once everything (including the certificate) is ready.
  app.innerHTML = `${renderNavbar()}\n${resultSkeleton()}`;

  (async () => {
    const pct = submission.percent || 0;
    const R = 60;
    const CIRC = 2 * Math.PI * R;
    const offset = CIRC * (1 - pct / 100);

    let certTemplate = null;
    try {
      certTemplate = quiz.certificateTemplateId ? await getCertTemplate(quiz.certificateTemplateId) : null;
    } catch { }

    const showCert = submission.passed && certTemplate;
    const isPptx = certTemplate?.type === 'pptx';
    const showSummary = quiz.showSummary !== false;
    const showAnswers = quiz.showCorrectAnswers !== false;

    let certBlock = '';
    let pptxNeedPdfJs = false;
    if (showCert) {
      if (isPptx) {
        try {
          const built = await buildPptxCert(submission, certTemplate);
          pptxNeedPdfJs = !!built.needPdfJs;
          certBlock = pptxCertPanelHtml(built, certTemplate);
        } catch (err) {
          console.error('Certificate build error:', err);
          certBlock = pptxCertPanelHtml({ ext: 'pdf', error: true }, certTemplate);
        }
      } else {
        certBlock = designerCertPanelHtml(submission, certTemplate);
      }
    } else if (submission.passed) {
      certBlock = `<div class="info" style="margin-bottom:20px">${Icon('info', 16)}<span>You passed, but no certificate template is attached to this quiz.</span></div>`;
    }

    app.innerHTML = `
      ${renderNavbar()}
      <div class="page fade-in">
        <div class="container-take">
          ${attemptHeroBlock(submission.participant || participant)}

          ${showSummary ? `
            <div class="card score-hero ${submission.passed ? 'passed' : ''}" style="margin-bottom:20px">
              <div class="score-ring ${submission.passed ? 'passed' : ''}">
                <svg viewBox="0 0 132 132" aria-hidden="true">
                  <circle class="ring-bg" cx="66" cy="66" r="${R}" stroke-width="10" fill="none"></circle>
                  <circle class="ring-fg" cx="66" cy="66" r="${R}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${offset}"></circle>
                </svg>
                <div class="ring-label">
                  <span class="ring-val" id="ring-val">${pct}%</span>
                  <span class="ring-cap">score</span>
                </div>
              </div>
              <div style="flex:1; text-align:left">
                <div class="flex gap-sm" style="margin-bottom:8px; flex-wrap:wrap">
                  ${Badge(submission.passed ? 'Passed' : 'Not passed', { tone: submission.passed ? 'green' : 'red', dot: true })}
                  ${submission.percent >= 90 ? Badge('Excellent!', { tone: 'violet', dot: true }) : ''}
                </div>
                <h2 class="score-hero-title">${submission.passed ? 'Evaluation passed!' : 'Evaluation complete'}</h2>
                <p class="score-hero-sub">${submission.passed ? 'Great job — you met the passing threshold.' : `You needed at least ${quiz.passingPercent}% to pass.`}</p>
              </div>
            </div>

            <div class="achievement-strip" style="margin:0 0 20px">
              <div class="ach-badge"><span class="ach-ic stat-amber">${Icon('zap', 18)}</span><span class="ach-label">Participation</span></div>
              <div class="ach-badge"><span class="ach-ic stat-blue">${Icon('clock', 18)}</span><span class="ach-label">${formatTime(submission.timeTaken)}</span></div>
              <div class="ach-badge"><span class="ach-ic stat-green">${Icon('check-circle', 18)}</span><span class="ach-label">${submission.questionResults?.filter(r => r.correct).length || 0} correct</span></div>
              ${submission.percent >= 90 ? `<div class="ach-badge"><span class="ach-ic stat-violet">${Icon('star', 18)}</span><span class="ach-label">Top scorer</span></div>` : ''}
            </div>

            <div class="stat-grid" style="margin-bottom:20px">
              <div class="card" style="padding:18px; text-align:center; box-shadow:none">
                <div class="stat-value" style="color:var(--blue-strong)">${submission.score}</div>
                <div class="stat-label">Your points · ${submission.totalPoints} total</div>
              </div>
              <div class="card" style="padding:18px; text-align:center; box-shadow:none">
                <div class="stat-value">${formatTime(submission.timeTaken)}</div>
                <div class="stat-label">Time taken</div>
              </div>
              <div class="card" style="padding:18px; text-align:center; box-shadow:none">
                <div class="stat-value" style="color:var(--green)">${quiz.questions.length}</div>
                <div class="stat-label">Questions</div>
              </div>
            </div>
          ` : `
            <div class="quiz-panel" style="margin-bottom:20px">
              <div class="flex items-center" style="justify-content:center; margin-bottom:10px">${Icon('check-circle', 26, '')}</div>
              <h2 style="font-size:20px; font-weight:800">Quiz submitted successfully</h2>
              <p class="muted sm" style="margin-top:6px">Your response has been recorded.</p>
            </div>
          `}

          ${certBlock}

          ${(showAnswers && submission.questionResults) ? `
            <div class="card card-pad" style="margin-bottom:20px">
              <h3 style="font-size:18px; font-weight:800; margin-bottom:16px">Question review</h3>
              <div class="result-review">
                ${submission.questionResults.map((qr, qi) => renderReviewItem(qr, qi)).join('')}
              </div>
            </div>
          ` : ''}

          <div style="text-align:center; margin:28px 0">
            <a href="#/" class="btn btn-secondary">${Icon('arrow-left', 15)}<span>Return to Homepage</span></a>
          </div>
        </div>
      </div>`;

    bindNavbar(app);
    bindReviewAccordions(app);

    if (showSummary && submission.passed) {
      burstConfetti({ count: submission.percent >= 90 ? 110 : 70 });
    }

    if (showCert && isPptx) {
      app.querySelector('#btn-download-pptx-cert')?.addEventListener('click', () => downloadCachedCert());
      if (pptxNeedPdfJs) renderPdfCertPreview();
    } else if (showCert && !isPptx) {
      app.querySelector('#btn-download-cert')?.addEventListener('click', () => downloadCertPDF());
    }
  })();
}

function renderReviewItem(qr, qi) {
  const isCorrect = qr.correct;
  const userOptLabel = qr.type === 'tf'
    ? (qr.userAnswer === 'true' ? 'True' : qr.userAnswer === 'false' ? 'False' : 'Unanswered')
    : (qr.options?.[parseInt(qr.userAnswer)] || 'Unanswered');
  const correctOptLabel = qr.type === 'tf'
    ? (qr.correctAnswer === 'true' ? 'True' : 'False')
    : (qr.options?.[parseInt(qr.correctAnswer)] || qr.correctAnswer);

  return `
    <div class="acc-item ${!isCorrect ? 'open' : ''}">
      <button class="acc-header" type="button" aria-expanded="${!isCorrect}">
        <span class="acc-icon">${Icon(isCorrect ? 'check-circle' : 'x-circle', 18, '')}</span>
        <span class="acc-title" style="color:${isCorrect ? 'var(--green)' : 'var(--red)'}">Q${qi + 1}. ${escapeHtml(qr.question)}</span>
        <span class="acc-meta">
          ${Badge(isCorrect ? `+${qr.points} pts` : '0 pts', { tone: isCorrect ? 'green' : 'red' })}
          <span class="acc-toggle">${Icon('chevron-down', 16)}</span>
        </span>
      </button>
      <div class="acc-body">
        <div class="review-reason" style="margin-bottom:6px"><strong>Your answer:</strong> <span style="color:${isCorrect ? 'var(--green)' : 'var(--red)'}; font-weight:600">${escapeHtml(userOptLabel)}</span></div>
        ${!isCorrect ? `<div class="review-reason"><strong>Correct answer:</strong> <span style="color:var(--green); font-weight:600">${escapeHtml(correctOptLabel)}</span></div>` : ''}
      </div>
    </div>`;
}

function bindReviewAccordions(app) {
  app.querySelectorAll('.acc-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.acc-item');
      const open = item.classList.toggle('open');
      header.setAttribute('aria-expanded', open);
    });
  });
}

/* ============================ CERTIFICATE RENDERING ============================ */
function buildCertificateInner(template, submission) {
  let inner = '';
  if (template.backgroundImage) {
    inner += `<img src="${escapeHtml(template.backgroundImage)}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;pointer-events:none">`;
  }

  const pName = submission.participant?.name || participant.name || 'Participant';
  const pEmail = submission.participant?.email || participant.email || '';
  const pOrg = submission.participant?.org || participant.org || '';
  const scoreStr = (submission.score ?? 0).toString();
  const totalStr = (submission.totalPoints ?? 0).toString();
  const percentStr = (submission.percent ?? 0) + '%';
  const dateStr = new Date(submission.submittedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const quizTitle = quiz?.title || 'Evaluation';

  const placeholders = {
    '{{name}}': pName, '{{quiz_title}}': quizTitle, '{{score}}': scoreStr, '{{total}}': totalStr,
    '{{percent}}': percentStr, '{{date}}': dateStr, '{{email}}': pEmail, '{{org}}': pOrg
  };

  let elements = template.elements;
  if (!elements || elements.length === 0) {
    elements = [
      { id: 'def1', type: 'text', content: 'CERTIFICATE OF ACHIEVEMENT', x: 50, y: 110, fontSize: 26, color: '#0284c7', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 800 },
      { id: 'def2', type: 'text', content: '{{quiz_title}}', x: 50, y: 165, fontSize: 24, color: '#1e293b', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 800 },
      { id: 'def3', type: 'text', content: 'PROUDLY PRESENTED TO', x: 50, y: 220, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '600', textAlign: 'center', width: 800 },
      { id: 'def4', type: 'text', content: '{{name}}', x: 50, y: 255, fontSize: 36, color: '#d97706', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 800 },
      { id: 'def5', type: 'text', content: 'for successfully completing the evaluation with a score of {{score}}/{{total}} ({{percent}})', x: 50, y: 330, fontSize: 14, color: '#475569', fontFamily: "'Outfit',sans-serif", fontWeight: '400', textAlign: 'center', width: 800 },
      { id: 'def6', type: 'text', content: 'Date: {{date}}', x: 100, y: 460, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '500', textAlign: 'center', width: 250 },
      { id: 'def7', type: 'text', content: '_______________________\nAuthorized Signature', x: 550, y: 445, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '500', textAlign: 'center', width: 250 }
    ];
  }

  return inner + elements.map(e => {
    if (e.type === 'image') {
      return `<img src="${escapeHtml(e.src)}" style="position:absolute;left:${e.x}px;top:${e.y}px;width:${e.width || 100}px;height:${e.height || 100}px;object-fit:contain">`;
    }
    let c = e.content || '';
    for (const [k, v] of Object.entries(placeholders)) c = c.replaceAll(k, v);
    return `<div style="position:absolute;left:${e.x}px;top:${e.y}px;font-size:${e.fontSize || 16}px;color:${e.color || '#333'};font-family:${e.fontFamily || "'Playfair Display',serif"};font-weight:${e.fontWeight || 'normal'};font-style:${e.fontStyle || 'normal'};text-align:${e.textAlign || 'center'};${e.width ? `width:${e.width}px;` : ''}white-space:pre-wrap;line-height:1.4">${escapeHtml(c)}</div>`;
  }).join('');
}

function designerCertPanelHtml(submission, template) {
  const style = `width:900px;height:636px;position:relative;background:${template.backgroundColor || '#ffffff'};border:${template.borderWidth || 0}px ${template.borderStyle || 'solid'} ${template.borderColor || '#c8a96e'};font-family:'Playfair Display',serif;overflow:hidden;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.18);`;
  const inner = buildCertificateInner(template, submission);
  return `
    <div class="card cert-panel">
      <div class="flex items-center" style="justify-content:center; gap:10px; margin-bottom:4px">${Icon('award', 20, '')}</div>
      <h3 style="font-size:20px; font-weight:800">Your official certificate</h3>
      <p class="muted sm" style="margin-top:4px">Personalized with your name and score.</p>
      <div id="cert-render-wrapper" style="margin-top:20px; overflow-x:auto">
        <div id="cert-render" style="${style}">${inner}</div>
      </div>
      <div class="cert-toolbar">
        <button class="btn btn-primary" id="btn-download-cert">${Icon('download', 15)}<span>Download PDF Certificate</span></button>
      </div>
    </div>`;
}

function resultSkeleton() {
  return `
    <div class="page">
      <div class="container-take">
        <div class="result-skel-card">
          <span class="sk" style="width:220px; height:22px; display:block"></span>
          <div style="display:flex; align-items:center; gap:24px; margin-top:18px">
            <span class="sk sk-round" style="width:120px; height:120px; flex:none; display:block"></span>
            <div style="flex:1">
              <span class="sk" style="width:160px; height:18px; display:block"></span>
              <span class="sk" style="width:220px; height:14px; margin-top:10px; display:block"></span>
            </div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:20px 0">
          ${[64, 80, 70].map(w => `
            <div class="result-skel-card" style="padding:20px; text-align:center">
              <span class="sk" style="width:${w}px; height:16px; margin:0 auto; display:block"></span>
              <span class="sk" style="width:90px; height:12px; margin:12px auto 0; display:block"></span>
            </div>`).join('')}
        </div>
        <div class="result-skel-card">
          <span class="sk" style="height:24px; width:40%; display:block; margin-bottom:16px"></span>
          <span class="sk sk-round" style="height:260px; width:100%; display:block"></span>
        </div>
      </div>
    </div>`;
}

async function downloadCertPDF() {
  try {
    const { default: html2canvas } = await import('html2canvas-pro');
    const { jsPDF } = await import('jspdf');
    const certEl = document.getElementById('cert-render');
    if (!certEl) return;
    showToast('Generating PDF certificate…');
    const canvas = await html2canvas(certEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [900, 636] });
    pdf.addImage(imgData, 'PNG', 0, 0, 900, 636);
    pdf.save(`Certificate_${participant.name || 'Participant'}.pdf`);
    showToast('Certificate downloaded');
  } catch (e) {
    console.error(e);
    showToast('Download error: ' + (e.message || 'Could not generate PDF'), 'error');
  }
}

let cachedCertBlob = null;
let cachedCertFilename = null;

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function buildPptxCert(submission, template) {
  const pName = submission.participant?.name || participant.name || 'Participant';
  const dateStr = new Date(submission.submittedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const response = await generateCertificatePdf(template.id, {
    name: pName,
    quiz_title: quiz?.title || 'Evaluation',
    score: String(submission.score ?? 0),
    total: String(submission.totalPoints ?? 0),
    percent: (submission.percent ?? 0) + '%',
    date: dateStr,
    email: submission.participant?.email || participant.email || '',
    org: submission.participant?.org || participant.org || ''
  });

  let ext, certBlob, previewBase64 = null, filename;
  if (response._json) {
    // New server returns { ext, filename, pdf|pptx, preview (PNG base64) }
    ext = response.ext;
    filename = response.filename || `Certificate_${pName.replace(/[^a-zA-Z0-9 ]/g, '')}.${ext}`;
    previewBase64 = response.preview || null;
    const b64 = ext === 'pdf' ? response.pdf : response.pptx;
    certBlob = b64 ? base64ToBlob(b64, ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation') : null;
  } else {
    // Legacy server: binary response
    certBlob = await response.blob();
    const contentType = response.headers.get('Content-Type') || '';
    ext = contentType.includes('pdf') ? 'pdf' : 'pptx';
    filename = `Certificate_${pName.replace(/[^a-zA-Z0-9 ]/g, '')}.${ext}`;
  }
  cachedCertBlob = certBlob;
  cachedCertFilename = filename;

  const wrapOpen = `<div style="width:100%; max-width:900px; margin:0 auto; overflow:hidden; border-radius:var(--r-md); box-shadow:var(--shadow-lg)">`;
  if (previewBase64) {
    // PNG preview works on every device (no PDF.js required)
    return { ext, blob: certBlob, filename, html: `${wrapOpen}<img src="data:image/png;base64,${previewBase64}" style="width:100%; height:auto; display:block; background:#fff"></div>` };
  }
  if (ext === 'pdf') {
    // Legacy server without PNG preview: rendered in place with PDF.js after the page swaps in.
    return { ext, blob: certBlob, filename, needPdfJs: true, html: `${wrapOpen}<canvas id="pdf-cert-canvas" style="width:100%; height:auto; display:block; background:#fff"></canvas></div>` };
  }
  return { ext, blob: certBlob, filename, html: `
    <div style="padding:32px; text-align:center">
      <div class="flex items-center" style="justify-content:center; gap:10px; margin-bottom:10px">${Icon('award', 26, '')}</div>
      <div style="font-weight:700; font-size:17px">Your personalized certificate is ready</div>
      <div class="sm muted" style="margin-top:6px">Generated with your name, score (${submission.percent}%) and completion details.</div>
    </div>` };
}

function pptxCertPanelHtml(built, template) {
  if (built.error) {
    return `
      <div class="card cert-panel">
        <div class="flex items-center" style="justify-content:center; gap:10px; margin-bottom:4px">${Icon('award', 20, '')}</div>
        <h3 style="font-size:20px; font-weight:800">Your official certificate</h3>
        <p class="muted sm" style="margin-top:4px">Certificates are ready to download.</p>
        <div style="color:var(--red); font-size:13px; padding:16px">Could not load the live preview. Use the download button below to get your certificate.</div>
        <div class="cert-toolbar">
          <button class="btn btn-primary" id="btn-download-pptx-cert">${Icon('download', 15)}<span>Download Certificate</span></button>
        </div>
      </div>`;
  }
  return `
    <div class="card cert-panel">
      <div class="flex items-center" style="justify-content:center; gap:10px; margin-bottom:4px">${Icon('award', 20, '')}</div>
      <h3 style="font-size:20px; font-weight:800">Your official certificate</h3>
      <p class="muted sm" style="margin-top:4px">Generated from template: ${escapeHtml(template.name || 'Certificate')}</p>
      ${built.html}
      <div class="cert-toolbar">
        <button class="btn btn-primary" id="btn-download-pptx-cert">${Icon('download', 15)}<span>Download Certificate (${built.ext === 'pdf' ? 'PDF' : 'PPTX'})</span></button>
      </div>
    </div>`;
}

function downloadCachedCert() {
  if (cachedCertBlob && cachedCertFilename) {
    const url = URL.createObjectURL(cachedCertBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cachedCertFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Certificate downloaded');
  }
}

// Legacy fallback: render the PDF preview onto the canvas with PDF.js after the page is in the DOM.
async function renderPdfCertPreview() {
  const canvas = document.getElementById('pdf-cert-canvas');
  if (!canvas || !cachedCertBlob) return;
  const wrap = canvas.closest('div');
  try {
    const arrayBuffer = await cachedCertBlob.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch (pdfErr) {
    console.warn('PDF.js render fallback:', pdfErr);
    if (wrap && cachedCertBlob) {
      const blobUrl = URL.createObjectURL(cachedCertBlob);
      wrap.innerHTML = `<object data="${blobUrl}" type="application/pdf" style="width:100%; aspect-ratio:900/636; border:none; display:block"></object>`;
    }
  }
}
