import { getQuiz, saveSubmission, generateId, getCertTemplate, getSubmissionsByEmail, getGoogleUser } from '../store.js';
import { renderNavbar, showToast, formatTime, shuffleArray, showModal, escapeHtml } from '../utils.js';
import { initGoogleAuth, renderGoogleButton, getGoogleClientId } from '../auth.js';

let quiz = null, participant = {}, answers = {};
let timerInterval = null, timeLeft = 0, quizStarted = false, quizSubmitted = false;

export async function renderTakeQuiz(app, params) {
  const quizId = params[0];
  quiz = await getQuiz(quizId);

  if (!quiz) {
    app.innerHTML = `${renderNavbar()}
      <div class="page fade-in">
        <div class="container-sm" style="padding-top: 60px">
          <div class="clay-card" style="text-align:center; padding: 3rem">
            <div style="font-size: 3.5rem; margin-bottom: 0.5rem">❌</div>
            <h2>Quiz Not Found</h2>
            <p style="color: var(--text-sub); margin: 0.5rem 0 1.5rem">This quiz link may be invalid or deleted.</p>
            <a href="#/" class="btn btn-primary">Go to Home</a>
          </div>
        </div>
      </div>`;
    return;
  }

  // 1. Check Live vs Stopped Status
  if (!quiz.isPublished) {
    app.innerHTML = `${renderNavbar()}
      <div class="page fade-in">
        <div class="container-sm" style="padding-top: 60px">
          <div class="clay-card" style="text-align:center; padding: 3rem">
            <div style="font-size: 3.5rem; margin-bottom: 0.75rem">⏸️</div>
            <h2 style="margin-bottom: 0.5rem">Quiz Currently Inactive</h2>
            <p style="color: var(--text-sub); font-size: 0.95rem">
              The quiz organizer has paused or stopped this quiz. Access is currently disabled.
            </p>
            <a href="#/" class="btn btn-secondary" style="margin-top: 1.5rem">← Return Home</a>
          </div>
        </div>
      </div>`;
    return;
  }

  // 2. Check Attempt Deadline
  if (quiz.deadline) {
    const deadlineDate = new Date(quiz.deadline);
    if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
      app.innerHTML = `${renderNavbar()}
        <div class="page fade-in">
          <div class="container-sm" style="padding-top: 60px">
            <div class="clay-card" style="text-align:center; padding: 3rem">
              <div style="font-size: 3.5rem; margin-bottom: 0.75rem">⏰</div>
              <h2 style="margin-bottom: 0.5rem">Quiz Deadline Passed</h2>
              <p style="color: var(--text-sub); font-size: 0.95rem">
                The deadline to attempt this quiz was <strong>${deadlineDate.toLocaleString()}</strong>. New attempts are closed.
              </p>
              <a href="#/" class="btn btn-secondary" style="margin-top: 1.5rem">← Return Home</a>
            </div>
          </div>
        </div>`;
      return;
    }
  }

  answers = {}; quizStarted = false; quizSubmitted = false; participant = {};
  if (timerInterval) clearInterval(timerInterval);

  const clientId = getGoogleClientId();
  const guser = getGoogleUser();

  if (!clientId) {
    app.innerHTML = `${renderNavbar()}
      <div class="page fade-in">
        <div class="container-sm" style="padding-top: 60px">
          <div class="clay-card" style="text-align:center; padding: 3rem">
            <div style="font-size: 3.5rem; margin-bottom: 0.75rem">⚠️</div>
            <h2 style="margin-bottom: 0.5rem">Google Sign-In Required</h2>
            <p style="color: var(--text-sub); font-size: 0.95rem">
              Google OAuth configuration is missing in Admin Portal.
            </p>
            <a href="#/" class="btn btn-secondary" style="margin-top: 1.5rem">← Return Home</a>
          </div>
        </div>
      </div>`;
    return () => {};
  }

  if (!guser) {
    renderGoogleSignIn(app, clientId);
  } else {
    participant.name = guser.name || '';
    participant.email = guser.email || '';
    renderParticipantForm(app);
  }
  return () => { if (timerInterval) clearInterval(timerInterval); };
}

function renderGoogleSignIn(app, clientId) {
  const totalPts = quiz.questions.reduce((s, q) => s + (q.points || 1), 0);
  
  app.innerHTML = `${renderNavbar()}
    <div class="page fade-in">
      <div class="container-sm" style="padding-top: 40px">
        <div class="clay-card" style="padding: 2.5rem; text-align: center">
          <img src="logo.png" alt="Logo" style="height: 60px; margin-bottom: 0.75rem; object-fit: contain">
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.25rem">${escapeHtml(quiz.title)}</h2>
          <p style="color: var(--text-sub); font-size: 0.95rem; margin-bottom: 1.5rem">${escapeHtml(quiz.description || 'Sign in with your verified Google account to begin.')}</p>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1.75rem; text-align: center">
            <div style="padding: 0.75rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <div style="font-weight: 800; font-size: 1.1rem; color: var(--clay-primary)">${quiz.questions.length}</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Questions</div>
            </div>
            <div style="padding: 0.75rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <div style="font-weight: 800; font-size: 1.1rem; color: var(--clay-warning)">${quiz.timerMinutes} min</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Duration</div>
            </div>
            <div style="padding: 0.75rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <div style="font-weight: 800; font-size: 1.1rem; color: var(--clay-success)">${totalPts}</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Points</div>
            </div>
          </div>

          ${quiz.deadline ? `
            <div style="font-size: 0.85rem; color: var(--clay-warning); font-weight: 800; margin-bottom: 1rem">
              ⏰ Attempt Deadline: ${new Date(quiz.deadline).toLocaleString()}
            </div>
          ` : ''}

          <div style="border-top: 1px solid rgba(160,195,230,0.3); padding-top: 1.5rem; margin-top: 0.5rem">
            <p style="font-size: 0.95rem; font-weight: 800; margin-bottom: 1rem">Authentication Required</p>
            <div id="google-btn-container" style="display:flex; justify-content:center; margin-bottom: 1rem"></div>
            <p style="font-size: 0.75rem; color: var(--text-muted)">Your verified Google email address will be recorded.</p>
          </div>
        </div>
      </div>
    </div>`;

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

function renderParticipantForm(app) {
  // Check 1 Response Limit
  if (quiz.limitPerUser && participant.email) {
    const existing = getSubmissionsByEmail(quiz.id, participant.email);
    if (existing.length > 0) {
      app.innerHTML = `${renderNavbar()}
        <div class="page fade-in">
          <div class="container-sm" style="padding-top: 60px">
            <div class="clay-card" style="padding: 3rem 2.5rem; text-align: center">
              <div style="font-size: 4rem; margin-bottom: 0.75rem">🔒</div>
              <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.5rem">Submission Limit Reached</h2>
              <p style="color: var(--text-sub); margin-bottom: 1.25rem">
                Only 1 response per Google account is permitted. You have already completed this evaluation.
              </p>
              <div style="padding: 1.25rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input); margin-bottom: 1.5rem">
                <div style="font-size: 0.85rem; color: var(--text-sub)">Your Previous Score</div>
                <div style="font-size: 2.2rem; font-weight: 900; color: var(--clay-primary); margin: 0.2rem 0">${existing[0].percent}%</div>
                <div style="font-size: 0.8rem; color: var(--text-muted)">Submitted on ${new Date(existing[0].submittedAt).toLocaleDateString()}</div>
              </div>
              <a href="#/" class="btn btn-secondary">← Back to Home</a>
            </div>
          </div>
        </div>`;
      return;
    }
  }

  const guser = getGoogleUser();

  app.innerHTML = `${renderNavbar()}
    <div class="page fade-in">
      <div class="container-sm" style="padding-top: 40px">
        <div class="clay-card" style="padding: 2.5rem">
          <div style="text-align:center; margin-bottom: 0.75rem">
            <img src="logo.png" alt="Logo" style="height: 55px; object-fit: contain">
          </div>
          <h2 style="text-align:center; font-size: 1.6rem; font-weight: 800; margin-bottom: 0.25rem">${escapeHtml(quiz.title)}</h2>
          <p style="text-align:center; color: var(--text-sub); font-size: 0.95rem; margin-bottom: 1.5rem">${escapeHtml(quiz.description || 'Welcome! Ready to start your quiz?')}</p>
          
          <div style="display:flex; align-items:center; gap: 0.75rem; padding: 0.85rem 1.2rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input); margin-bottom: 1.5rem">
            ${guser?.picture ? `<img src="${guser.picture}" style="width: 42px; height: 42px; border-radius: 50%">` : '<div style="width:42px; height:42px; border-radius:50%; background:var(--clay-primary); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700">👤</div>'}
            <div style="flex:1">
              <div style="font-weight:800; font-size: 0.95rem">${escapeHtml(participant.name || 'Participant')}</div>
              <div style="font-size: 0.8rem; color: var(--text-sub)">${escapeHtml(participant.email || '')}</div>
            </div>
            <span class="badge badge-success">Google Verified</span>
          </div>

          ${quiz.collectPhone ? `<div class="form-group"><label class="form-label">Phone Number</label><input type="tel" class="form-input" id="p-phone"></div>` : ''}
          ${quiz.collectOrg ? `<div class="form-group"><label class="form-label">Institution / Class</label><input type="text" class="form-input" id="p-org"></div>` : ''}
          
          <button class="btn btn-primary btn-lg" style="width:100%; margin-top: 0.5rem" id="btn-start-quiz">
            🚀 Begin Quiz Arena
          </button>
        </div>
      </div>
    </div>`;

  app.querySelector('#btn-start-quiz').addEventListener('click', () => {
    if (quiz.collectPhone) participant.phone = app.querySelector('#p-phone')?.value?.trim() || '';
    if (quiz.collectOrg) participant.org = app.querySelector('#p-org')?.value?.trim() || '';
    quizStarted = true;
    timeLeft = (quiz.timerMinutes || 30) * 60;
    if (quiz.shuffleQuestions) quiz.questions = shuffleArray(quiz.questions);
    renderContinuousQuizShell(app);
    startTimer();
  });
}

/* CONTINUOUS SCROLL QUIZ SHELL (NO QUESTIONS JUMP SIDEBAR AS REQUESTED IN IMAGE 3) */
function renderContinuousQuizShell(app) {
  const total = quiz.questions.length;
  const letters = 'ABCDEFGHIJ';

  app.innerHTML = `${renderNavbar()}
    <div class="page fade-in">
      <div class="container-sm">
        
        <!-- Sticky Header Bar (Progress & Timer) -->
        <div style="position: sticky; top: 70px; z-index: 90; background: rgba(255,255,255,0.94); backdrop-filter: blur(14px); border-radius: var(--radius-md); padding: 0.9rem 1.5rem; box-shadow: var(--clay-shadow-card); margin-bottom: 2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap: 0.75rem">
          <div>
            <div style="font-weight: 900; font-size: 1.05rem; color: var(--text-main); font-variant-numeric: tabular-nums" id="answered-count">0 of ${total} answered</div>
            <div style="font-size: 0.75rem; color: var(--text-sub)">Continuous Scroll Evaluation</div>
          </div>
          
          <div id="timer" class="timer-display">⏱️ ${formatTime(timeLeft)}</div>
        </div>

        <!-- Continuous Scroll Questions Column -->
        <div class="continuous-quiz-container">
          ${quiz.questions.map((q, i) => `
            <div class="question-block-card" id="q-block-${i}">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem">
                <span class="badge badge-clay">Question ${i + 1} of ${total}</span>
                <div style="display:flex; gap: 0.5rem; align-items:center">
                  ${q.required !== false ? `<span class="badge badge-danger" style="font-size: 0.7rem">* Required</span>` : ''}
                  <span style="font-size: 0.85rem; font-weight: 800; color: var(--text-sub)">${q.points || 1} pt${(q.points || 1) > 1 ? 's' : ''}</span>
                </div>
              </div>

              <!-- Required Error Message Placeholder -->
              <div id="err-banner-${i}"></div>

              <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem; line-height: 1.5">${escapeHtml(q.text)}</h3>

              <div class="options-group" data-qi="${i}">
                ${q.type === 'tf' ? `
                  <button class="quiz-option-btn" data-qi="${i}" data-answer="true">
                    <span class="opt-letter opt-0">T</span><span>True</span>
                  </button>
                  <button class="quiz-option-btn" data-qi="${i}" data-answer="false">
                    <span class="opt-letter opt-1">F</span><span>False</span>
                  </button>
                ` : (q.options || []).map((opt, oi) => `
                  <button class="quiz-option-btn" data-qi="${i}" data-answer="${oi}">
                    <span class="opt-letter opt-${oi % 4}">${letters[oi]}</span><span>${escapeHtml(opt)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}

          <!-- Bottom Final Submit Card -->
          <div class="clay-card" style="text-align:center; padding: 2.5rem; margin-top: 1rem">
            <h3 style="font-weight: 800; margin-bottom: 0.5rem; font-size: 1.3rem">Ready to Submit?</h3>
            <p style="color: var(--text-sub); font-size: 0.9rem; margin-bottom: 1.5rem">Make sure you have answered all required questions before submitting your evaluation.</p>
            <button class="btn btn-success btn-lg" id="btn-submit-continuous" style="width: 100%; max-width: 420px">
              ✅ Complete & Submit Quiz
            </button>
          </div>
        </div>

      </div>
    </div>`;

  // Option selection
  app.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qi = parseInt(btn.dataset.qi);
      const val = btn.dataset.answer;
      answers[qi] = val;

      // Clear question error formatting
      const block = document.getElementById(`q-block-${qi}`);
      block?.classList.remove('has-error');
      const errBanner = document.getElementById(`err-banner-${qi}`);
      if (errBanner) errBanner.innerHTML = '';

      // Highlight selected option
      const group = app.querySelector(`.options-group[data-qi="${qi}"]`);
      group?.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      updateProgress();
    });
  });

  app.querySelector('#btn-submit-continuous').addEventListener('click', validateAndSubmit);
}

function updateProgress() {
  const answered = Object.keys(answers).length;
  const total = quiz.questions.length;
  const el = document.getElementById('answered-count');
  if (el) el.textContent = `${answered} of ${total} answered`;
}

/* REQUIRED QUESTION VALIDATION & AUTO-DIVERT TO EXACT QUESTION */
function validateAndSubmit() {
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    if (q.required !== false && (answers[i] === undefined || answers[i] === '')) {
      const card = document.getElementById(`q-block-${i}`);
      const errBanner = document.getElementById(`err-banner-${i}`);

      if (card) {
        card.classList.add('has-error');
        if (errBanner) {
          errBanner.innerHTML = `<div class="required-error-banner">⚠️ Please Answer the question</div>`;
        }
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast(`Please Answer Question #${i + 1}`, 'error');
      return;
    }
  }

  showModal('Submit Quiz Arena?', '<p>Are you sure you want to finalize and submit your responses?</p>', submitQuiz);
}

function startTimer() {
  const timerEl = document.getElementById('timer');
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timerEl) {
      timerEl.textContent = '⏱️ ' + formatTime(timeLeft);
      timerEl.className = 'timer-display';
      if (timeLeft <= 60) timerEl.classList.add('danger');
      else if (timeLeft <= 300) timerEl.classList.add('warning');
    }
    if (timeLeft <= 0) { clearInterval(timerInterval); submitQuiz(); }
  }, 1000);
}

function submitQuiz() {
  if (quizSubmitted) return;
  quizSubmitted = true;
  if (timerInterval) clearInterval(timerInterval);

  let score = 0, totalPoints = 0;
  const questionResults = [];
  quiz.questions.forEach((q, i) => {
    const pts = q.points || 1; totalPoints += pts;
    const correct = answers[i] === q.correctAnswer;
    if (correct) score += pts;
    questionResults.push({ question: q.text, userAnswer: answers[i], correctAnswer: q.correctAnswer, correct, points: pts, options: q.options, type: q.type });
  });

  const percent = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percent >= (quiz.passingPercent || 50);
  const timeTaken = (quiz.timerMinutes * 60) - timeLeft;
  const submission = { id: generateId(), quizId: quiz.id, participant, answers, score, totalPoints, percent, passed, timeTaken, questionResults, submittedAt: new Date().toISOString() };
  saveSubmission(submission);
  renderResults(submission);
}

function renderResults(submission) {
  const app = document.getElementById('app');
  (async () => {
    const certTemplate = quiz.certificateTemplateId ? await getCertTemplate(quiz.certificateTemplateId) : null;
    const showCert = submission.passed && certTemplate;

    app.innerHTML = `${renderNavbar()}
    <div class="page fade-in">
      <div class="container-sm">
        
        <div class="clay-card" style="text-align:center; padding: 3rem 2rem">
          <div style="font-size: 4.5rem; margin-bottom: 0.5rem">${submission.passed ? '🎉' : '😔'}</div>
          <div style="font-size: 3rem; font-weight: 900; color: ${submission.passed ? 'var(--clay-success)' : 'var(--clay-danger)'}">${submission.percent}%</div>
          <h2 style="margin-top: 0.25rem; font-size: 1.6rem; font-weight: 800">${submission.passed ? 'Passed Evaluation!' : 'Evaluation Complete'}</h2>
          <p style="color: var(--text-sub); margin-top: 0.4rem">${submission.passed ? 'Great job! You have met the passing threshold.' : `You needed at least ${quiz.passingPercent}% to pass.`}</p>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-top: 2rem">
            <div style="padding: 0.85rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <div style="font-size: 1.3rem; font-weight: 800; color: var(--clay-success)">${submission.score}</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Your Points</div>
            </div>
            <div style="padding: 0.85rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <div style="font-size: 1.3rem; font-weight: 800">${submission.totalPoints}</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Total Points</div>
            </div>
            <div style="padding: 0.85rem; background: var(--bg-input); border-radius: var(--radius-md); box-shadow: var(--clay-shadow-input)">
              <div style="font-size: 1.3rem; font-weight: 800">${formatTime(submission.timeTaken)}</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Time Taken</div>
            </div>
          </div>
        </div>

        ${showCert ? `
          <div class="clay-card" style="margin-top: 1.5rem; text-align: center; padding: 2rem">
            <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 1rem">🎓 Verified Official Certificate</h3>
            <div class="cert-canvas-wrapper" style="margin-bottom: 1.25rem"><div id="cert-render" class="cert-canvas"></div></div>
            <button class="btn btn-primary btn-lg" id="btn-download-cert">📥 Download PDF Certificate</button>
          </div>
        ` : ''}

        <div style="text-align:center; margin: 2rem 0">
          <a href="#/" class="btn btn-secondary btn-lg">← Return to Homepage</a>
        </div>

      </div>
    </div>`;

    if (showCert && certTemplate) {
      renderCertificate(certTemplate, submission);
      app.querySelector('#btn-download-cert')?.addEventListener('click', () => downloadCertPDF());
    }
  })();
}

function renderCertificate(template, submission) {
  const el = document.getElementById('cert-render');
  if (!el) return;
  el.style.cssText = `width:900px;min-height:636px;position:relative;background:${template.backgroundColor || '#fffdf7'};border:${template.borderWidth || 8}px ${template.borderStyle || 'double'} ${template.borderColor || '#c8a96e'};padding:40px;font-family:'Playfair Display',serif;`;
  const placeholders = {
    '{{name}}': submission.participant.name || 'Participant',
    '{{score}}': submission.score.toString(),
    '{{total}}': submission.totalPoints.toString(),
    '{{percent}}': submission.percent + '%',
    '{{date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    '{{quiz_title}}': quiz.title,
    '{{email}}': submission.participant.email || '',
    '{{org}}': submission.participant.org || '',
  };
  el.innerHTML = (template.elements || []).map(e => {
    if (e.type === 'image') {
      return `<img src="${e.src}" style="position:absolute;left:${e.x}px;top:${e.y}px;width:${e.width || 100}px;height:${e.height || 100}px;object-fit:contain">`;
    }
    let c = e.content || '';
    for (const [k, v] of Object.entries(placeholders)) c = c.replaceAll(k, v);
    return `<div style="position:absolute;left:${e.x}px;top:${e.y}px;font-size:${e.fontSize || 16}px;color:${e.color || '#333'};font-family:${e.fontFamily || "'Playfair Display',serif"};font-weight:${e.fontWeight || 'normal'};font-style:${e.fontStyle || 'normal'};text-align:${e.textAlign || 'center'};${e.width ? `width:${e.width}px;` : ''}white-space:pre-wrap;line-height:1.4">${c}</div>`;
  }).join('');
}

async function downloadCertPDF() {
  try {
    const { default: html2canvas } = await import('html2canvas-pro');
    const { jsPDF } = await import('jspdf');
    const certEl = document.getElementById('cert-render');
    const canvas = await html2canvas(certEl, { scale: 2, useCORS: true, backgroundColor: null });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [900, 636] });
    pdf.addImage(imgData, 'PNG', 0, 0, 900, 636);
    pdf.save(`Certificate_${participant.name || 'participant'}.pdf`);
    showToast('Certificate downloaded in PDF format! 🎓');
  } catch (e) {
    console.error(e);
    showToast('Download error', 'error');
  }
}
