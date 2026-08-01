import { saveQuiz, getQuiz, generateId, getAllCertTemplates } from '../store.js';
import { renderNavbar, showToast, escapeHtml, copyTextToClipboard } from '../utils.js';
import { requireAdmin } from '../auth.js';

let currentQuiz = null;

export async function renderQuizBuilder(app, params) {
  if (!requireAdmin()) return;

  const quizId = params[0];
  if (quizId) {
    currentQuiz = await getQuiz(quizId);
    if (!currentQuiz) { window.location.hash = '#/admin'; return; }
  } else {
    currentQuiz = {
      id: generateId(),
      title: '',
      description: '',
      timerMinutes: 30,
      passingPercent: 50,
      deadline: '', // Last date/time to start quiz
      shuffleQuestions: false,
      showResults: true,
      isPublished: true, // Default to Live
      certificateTemplateId: '',
      collectName: true,
      collectEmail: true,
      collectPhone: false,
      collectOrg: false,
      limitPerUser: true,
      questions: [],
      createdAt: new Date().toISOString()
    };
  }
  await renderPage(app);
}

async function renderPage(app) {
  const certs = await getAllCertTemplates();

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-sm">
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem">
          <div>
            <a href="#/admin" class="btn btn-ghost btn-sm" style="margin-bottom:0.4rem">← Back to Admin Portal</a>
            <h1 style="font-size: 1.75rem; font-weight: 900">${currentQuiz.title ? '✏️ Edit Quiz' : '➕ Create New Quiz'}</h1>
          </div>
          <div style="display:flex; gap: 0.5rem">
            <button class="btn btn-secondary btn-sm" id="btn-preview">👁️ Preview</button>
            <button class="btn btn-success btn-sm" id="btn-save">💾 Save Draft</button>
            <button class="btn ${currentQuiz.isPublished ? 'btn-danger' : 'btn-primary'} btn-sm" id="btn-toggle-live">
              ${currentQuiz.isPublished ? '⏸️ Stop Quiz (Make Inactive)' : '🚀 Make Quiz Live'}
            </button>
          </div>
        </div>

        <!-- Status Banner -->
        <div style="margin-bottom: 1.25rem">
          <span class="badge ${currentQuiz.isPublished ? 'badge-success' : 'badge-danger'}" style="font-size: 0.9rem; padding: 0.5rem 1.2rem">
            ${currentQuiz.isPublished ? '🟢 Quiz Status: LIVE (Accepting Submissions)' : '🔴 Quiz Status: STOPPED / INACTIVE (Access Blocked)'}
          </span>
        </div>

        <!-- Quiz Meta Card -->
        <div class="clay-card" style="margin-bottom: 1.5rem">
          <div class="form-group">
            <label class="form-label">Quiz Title *</label>
            <input type="text" class="form-input" id="quiz-title" placeholder="e.g., General Chemistry & Biology Final" value="${escapeHtml(currentQuiz.title)}" style="font-size: 1.1rem; font-weight: 700">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Description / Instructions</label>
            <textarea class="form-textarea" id="quiz-desc" placeholder="Brief instructions for participants..." style="min-height: 70px">${escapeHtml(currentQuiz.description)}</textarea>
          </div>
        </div>

        <!-- Quiz Settings & Rules Card -->
        <div class="clay-card" style="margin-bottom: 1.5rem">
          <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1rem">⚙️ Evaluation, Deadline & Security Controls</h3>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem">
            <div class="form-group">
              <label class="form-label">⏱️ Timer Limit (Minutes)</label>
              <input type="number" class="form-input" id="quiz-timer" min="1" max="300" value="${currentQuiz.timerMinutes}">
            </div>
            <div class="form-group">
              <label class="form-label">🎯 Passing Score (%)</label>
              <input type="number" class="form-input" id="quiz-passing" min="0" max="100" value="${currentQuiz.passingPercent}">
            </div>
          </div>

          <!-- Deadline Setting -->
          <div class="form-group" style="margin-bottom: 1rem">
            <label class="form-label">⏰ Last Date & Time to Attempt Quiz (Optional Deadline)</label>
            <input type="datetime-local" class="form-input" id="quiz-deadline" value="${currentQuiz.deadline || ''}">
            <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 0.3rem">
              If set, participants will not be able to start the quiz after this date/time. Leave blank for no deadline.
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem">
            <div class="form-group">
              <label class="form-label">🎓 Certificate Template</label>
              <select class="form-select" id="quiz-cert-template">
                <option value="">No Certificate Issued</option>
                ${certs.map(t => `<option value="${t.id}" ${currentQuiz.certificateTemplateId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">🔒 Security & Attempt Rules</label>
              <div style="display:flex; flex-direction:column; gap: 0.6rem; margin-top: 0.3rem">
                <label style="display:flex; align-items:center; gap: 0.5rem; font-size: 0.85rem; cursor:pointer">
                  <input type="checkbox" id="quiz-limit-user" ${currentQuiz.limitPerUser ? 'checked' : ''}>
                  <strong>Limit to 1 response per Google account</strong>
                </label>
                <label style="display:flex; align-items:center; gap: 0.5rem; font-size: 0.85rem; cursor:pointer">
                  <input type="checkbox" id="quiz-shuffle" ${currentQuiz.shuffleQuestions ? 'checked' : ''}>
                  Shuffle question order per student
                </label>
                <label style="display:flex; align-items:center; gap: 0.5rem; font-size: 0.85rem; cursor:pointer">
                  <input type="checkbox" id="quiz-show-results" ${currentQuiz.showResults ? 'checked' : ''}>
                  Show correct answers & feedback after submission
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Questions List -->
        <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 1rem">❓ Questions (${currentQuiz.questions.length})</h3>
        <div id="questions-container">
          ${currentQuiz.questions.map((q, i) => renderQuestionEditor(q, i)).join('')}
        </div>

        <div style="text-align:center; margin: 2rem 0">
          <button class="btn btn-primary btn-lg" id="btn-add-q">+ Add MCQ Question</button>
          <button class="btn btn-secondary btn-lg" id="btn-add-tf" style="margin-left: 0.75rem">+ Add True/False Question</button>
        </div>

        ${currentQuiz.isPublished ? `
          <div class="clay-card">
            <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem">📤 Direct Share Quiz Link</h3>
            <p style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 1rem">
              Share this link with participants to take the quiz.
            </p>
            <div style="display:flex; gap: 0.5rem">
              <input type="text" class="form-input" value="${window.location.origin}${window.location.pathname}#/take/${currentQuiz.id}" readonly id="share-link">
              <button class="btn btn-primary" id="btn-copy-link">📋 Copy Link</button>
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;

  bindEvents(app);
}

function renderQuestionEditor(q, i) {
  const letters = 'ABCDEFGHIJ';
  const isReq = q.required !== false; // Default required to true

  return `
    <div class="clay-card" style="margin-bottom: 1.25rem" data-qindex="${i}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; flex-wrap:wrap; gap: 0.5rem">
        <div style="display:flex; align-items:center; gap: 0.75rem">
          <span class="badge badge-clay">Question ${i + 1}</span>
          <label style="display:flex; align-items:center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700; color: var(--clay-primary); cursor:pointer">
            <input type="checkbox" class="q-required" data-qi="${i}" ${isReq ? 'checked' : ''}>
            <span>* Required Question</span>
          </label>
        </div>
        
        <div style="display:flex; gap: 0.5rem; align-items:center">
          <label style="font-size: 0.85rem; color: var(--text-sub)">Points:</label>
          <input type="number" class="form-input q-points" data-qi="${i}" value="${q.points || 1}" min="1" max="100" style="width: 70px; text-align:center">
        </div>
      </div>

      <div class="form-group">
        <input type="text" class="form-input q-text" data-qi="${i}" placeholder="Enter question text..." value="${escapeHtml(q.text)}" style="font-weight: 700; font-size: 1rem">
      </div>

      ${q.type === 'tf' ? `
        <div style="display:flex; flex-direction:column; gap: 0.5rem; margin-bottom: 1rem">
          <label class="quiz-option-btn ${q.correctAnswer === 'true' ? 'selected' : ''}" style="cursor:pointer">
            <input type="radio" name="tf-${i}" class="q-radio-tf" data-qi="${i}" data-oi="true" ${q.correctAnswer === 'true' ? 'checked' : ''}>
            <span>True</span>
          </label>
          <label class="quiz-option-btn ${q.correctAnswer === 'false' ? 'selected' : ''}" style="cursor:pointer">
            <input type="radio" name="tf-${i}" class="q-radio-tf" data-qi="${i}" data-oi="false" ${q.correctAnswer === 'false' ? 'checked' : ''}>
            <span>False</span>
          </label>
        </div>
      ` : `
        <div style="margin-bottom: 1rem">
          ${(q.options || []).map((opt, oi) => `
            <div style="display:flex; align-items:center; gap: 0.75rem; margin-bottom: 0.5rem">
              <input type="radio" name="mcq-${i}" class="q-radio-mcq" data-qi="${i}" data-oi="${oi}" ${q.correctAnswer === oi.toString() ? 'checked' : ''} title="Mark correct answer">
              <span style="font-weight:800; font-size: 0.85rem; color: var(--text-sub); width: 20px">${letters[oi]}.</span>
              <input type="text" class="form-input opt-text" data-qi="${i}" data-oi="${oi}" placeholder="Option ${letters[oi]}" value="${escapeHtml(opt)}">
              <button class="btn btn-danger btn-sm option-delete" data-qi="${i}" data-oi="${oi}" style="padding: 0.4rem 0.8rem">✕</button>
            </div>
          `).join('')}
        </div>
      `}

      <div style="display:flex; gap: 0.5rem; align-items:center; flex-wrap:wrap">
        ${q.type !== 'tf' ? `<button class="btn btn-secondary btn-sm q-add-opt" data-qi="${i}">+ Add Option</button>` : ''}
        <button class="btn btn-secondary btn-sm q-dup" data-qi="${i}">📋 Duplicate</button>
        <button class="btn btn-secondary btn-sm q-up" data-qi="${i}" ${i === 0 ? 'disabled' : ''}>⬆️</button>
        <button class="btn btn-secondary btn-sm q-down" data-qi="${i}" ${i === currentQuiz.questions.length - 1 ? 'disabled' : ''}>⬇️</button>
        <button class="btn btn-danger btn-sm q-del" data-qi="${i}" style="margin-left:auto">🗑️ Remove Question</button>
      </div>
    </div>
  `;
}

function sync(app) {
  currentQuiz.title = app.querySelector('#quiz-title')?.value || '';
  currentQuiz.description = app.querySelector('#quiz-desc')?.value || '';
  currentQuiz.timerMinutes = parseInt(app.querySelector('#quiz-timer')?.value) || 30;
  currentQuiz.passingPercent = parseInt(app.querySelector('#quiz-passing')?.value) || 50;
  currentQuiz.deadline = app.querySelector('#quiz-deadline')?.value || '';
  currentQuiz.shuffleQuestions = app.querySelector('#quiz-shuffle')?.checked || false;
  currentQuiz.showResults = app.querySelector('#quiz-show-results')?.checked ?? true;
  currentQuiz.limitPerUser = app.querySelector('#quiz-limit-user')?.checked ?? true;
  currentQuiz.certificateTemplateId = app.querySelector('#quiz-cert-template')?.value || '';

  app.querySelectorAll('.q-text').forEach(el => {
    const i = parseInt(el.dataset.qi);
    if (currentQuiz.questions[i]) currentQuiz.questions[i].text = el.value;
  });
  app.querySelectorAll('.q-required').forEach(el => {
    const i = parseInt(el.dataset.qi);
    if (currentQuiz.questions[i]) currentQuiz.questions[i].required = el.checked;
  });
  app.querySelectorAll('.opt-text').forEach(el => {
    const qi = parseInt(el.dataset.qi), oi = parseInt(el.dataset.oi);
    if (currentQuiz.questions[qi]?.options?.[oi] !== undefined) {
      currentQuiz.questions[qi].options[oi] = el.value;
    }
  });
  app.querySelectorAll('.q-points').forEach(el => {
    const i = parseInt(el.dataset.qi);
    if (currentQuiz.questions[i]) currentQuiz.questions[i].points = parseInt(el.value) || 1;
  });
}

function validateQuiz(app) {
  sync(app);
  for (let i = 0; i < currentQuiz.questions.length; i++) {
    const q = currentQuiz.questions[i];
    const qNum = i + 1;
    if (!q || !q.text || q.text.trim() === '') {
      window.alert(`Question ${qNum} is empty. Please enter the question text.`);
      showToast(`Question ${qNum} text is empty`, 'error');
      return false;
    }
    if (q.type === 'mcq') {
      if (!q.options || q.options.length < 2) {
        window.alert(`Question ${qNum} must have at least 2 options.`);
        showToast(`Question ${qNum} needs at least 2 options`, 'error');
        return false;
      }
      if (q.correctAnswer === '' || q.correctAnswer === undefined || q.correctAnswer === null) {
        window.alert(`Please mark a correct answer for Question ${qNum}.`);
        showToast(`Mark correct answer for question ${qNum}`, 'error');
        return false;
      }
      const idx = parseInt(q.correctAnswer);
      if (isNaN(idx) || idx < 0 || idx >= q.options.length) {
        window.alert(`Question ${qNum} has an invalid correct answer selection.`);
        showToast(`Invalid correct answer for question ${qNum}`, 'error');
        return false;
      }
    } else if (q.type === 'tf') {
      if (q.correctAnswer !== 'true' && q.correctAnswer !== 'false') {
        window.alert(`Please select True or False as the correct answer for Question ${qNum}.`);
        showToast(`Select correct True/False for question ${qNum}`, 'error');
        return false;
      }
    }
  }
  return true;
}

function bindEvents(app) {
  app.querySelector('#btn-save')?.addEventListener('click', () => {
    if (!validateQuiz(app)) return;
    saveQuiz(currentQuiz);
    showToast('Quiz saved! 💾');
  });

  app.querySelector('#btn-toggle-live')?.addEventListener('click', () => {
    if (!validateQuiz(app)) return;
    currentQuiz.isPublished = !currentQuiz.isPublished;
    saveQuiz(currentQuiz);
    showToast(currentQuiz.isPublished ? 'Quiz status set to LIVE! 🚀' : 'Quiz stopped (Inactive)');
    renderPage(app);
  });

  app.querySelector('#btn-preview')?.addEventListener('click', () => {
    if (!validateQuiz(app)) return;
    saveQuiz(currentQuiz);
    window.location.hash = '#/take/' + currentQuiz.id;
  });

  app.querySelector('#btn-copy-link')?.addEventListener('click', () => {
    const url = app.querySelector('#share-link').value;
    copyTextToClipboard(url).then(ok => {
      if (ok) showToast('Quiz link copied! 📋');
      else showToast(url, 'info');
    });
  });

  app.querySelector('#btn-add-q')?.addEventListener('click', () => {
    sync(app);
    currentQuiz.questions.push({ id: generateId(), type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '', points: 1, required: true });
    saveQuiz(currentQuiz);
    renderPage(app);
  });

  app.querySelector('#btn-add-tf')?.addEventListener('click', () => {
    sync(app);
    currentQuiz.questions.push({ id: generateId(), type: 'tf', text: '', correctAnswer: '', points: 1, required: true });
    saveQuiz(currentQuiz);
    renderPage(app);
  });

  app.querySelectorAll('.q-radio-mcq, .q-radio-tf').forEach(el => {
    el.addEventListener('change', () => {
      sync(app);
      currentQuiz.questions[parseInt(el.dataset.qi)].correctAnswer = el.dataset.oi;
      saveQuiz(currentQuiz);
      renderPage(app);
    });
  });

  app.querySelectorAll('.option-delete').forEach(el => {
    el.addEventListener('click', () => {
      sync(app);
      const qi = parseInt(el.dataset.qi), oi = parseInt(el.dataset.oi), q = currentQuiz.questions[qi];
      if (q.options.length <= 2) { showToast('Need at least 2 options', 'error'); return; }
      q.options.splice(oi, 1);
      if (q.correctAnswer === oi.toString()) q.correctAnswer = '';
      else if (parseInt(q.correctAnswer) > oi) q.correctAnswer = (parseInt(q.correctAnswer) - 1).toString();
      saveQuiz(currentQuiz);
      renderPage(app);
    });
  });

  app.querySelectorAll('.q-add-opt').forEach(el => {
    el.addEventListener('click', () => {
      sync(app);
      const qi = parseInt(el.dataset.qi);
      if (currentQuiz.questions[qi].options.length >= 8) { showToast('Maximum 8 options', 'error'); return; }
      currentQuiz.questions[qi].options.push('');
      saveQuiz(currentQuiz);
      renderPage(app);
    });
  });

  app.querySelectorAll('.q-dup').forEach(el => {
    el.addEventListener('click', () => {
      sync(app);
      const qi = parseInt(el.dataset.qi);
      const dup = JSON.parse(JSON.stringify(currentQuiz.questions[qi]));
      dup.id = generateId();
      currentQuiz.questions.splice(qi + 1, 0, dup);
      saveQuiz(currentQuiz);
      renderPage(app);
    });
  });

  app.querySelectorAll('.q-up').forEach(el => {
    el.addEventListener('click', () => {
      sync(app);
      const qi = parseInt(el.dataset.qi);
      if (qi > 0) {
        [currentQuiz.questions[qi], currentQuiz.questions[qi - 1]] = [currentQuiz.questions[qi - 1], currentQuiz.questions[qi]];
        saveQuiz(currentQuiz);
        renderPage(app);
      }
    });
  });

  app.querySelectorAll('.q-down').forEach(el => {
    el.addEventListener('click', () => {
      sync(app);
      const qi = parseInt(el.dataset.qi);
      if (qi < currentQuiz.questions.length - 1) {
        [currentQuiz.questions[qi], currentQuiz.questions[qi + 1]] = [currentQuiz.questions[qi + 1], currentQuiz.questions[qi]];
        saveQuiz(currentQuiz);
        renderPage(app);
      }
    });
  });

  app.querySelectorAll('.q-del').forEach(el => {
    el.addEventListener('click', () => {
      sync(app);
      currentQuiz.questions.splice(parseInt(el.dataset.qi), 1);
      saveQuiz(currentQuiz);
      renderPage(app);
    });
  });
}
