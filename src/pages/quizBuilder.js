import { saveQuiz, getQuiz, generateId, getAllCertTemplates, getBatches, uploadQuestionImage } from '../store.js';
import { Icon, Badge, Field, Inp, Txta, Sel, Toggle, EmptyState } from '../components.js';
import { requireAdmin, hasPermission } from '../auth.js';
import { renderNavbar, showToast, escapeHtml, copyTextToClipboard, bindNavbar, renderAccessDenied, batchPickerHTML, bindBatchPicker } from '../utils.js';

let currentQuiz = null;
let activeTab = 'index';       // index | questions | evaluation | certificate | publishing
let activeQ = 0;               // selected question index
let saveTimer = null;

const TABS = [
  { id: 'index', label: 'General', icon: 'file-text' },
  { id: 'questions', label: 'Questions', icon: 'list-checks' },
  { id: 'evaluation', label: 'Evaluation', icon: 'target' },
  { id: 'certificate', label: 'Certificate', icon: 'award' },
  { id: 'publishing', label: 'Publishing', icon: 'send' }
];

function quizTitle() { return (currentQuiz?.title || '').trim() || 'Untitled quiz'; }

export async function renderQuizBuilder(app, params) {
  window.scrollTo(0, 0);
  if (!requireAdmin()) return;
  const quizId = params[0];
  if (quizId) {
    if (!hasPermission('quizzes', 'edit') && !hasPermission('quizzes', 'view')) {
      renderAccessDenied(app, 'Edit Quiz', 'Your account does not have permission to edit quizzes.');
      return;
    }
    currentQuiz = await getQuiz(quizId);
    if (!currentQuiz) { window.location.hash = '#/admin'; return; }
  } else {
    if (!hasPermission('quizzes', 'create')) {
      renderAccessDenied(app, 'New Quiz', 'Your account does not have permission to create quizzes.');
      return;
    }
    currentQuiz = {
      id: generateId(),
      title: '',
      description: '',
      timerMinutes: 30,
      passingPercent: 50,
      deadline: '',
      shuffleQuestions: false,
      showSummary: true,
      showCorrectAnswers: true,
      isPublished: true,
      certificateTemplateId: '',
      collectName: true,
      collectEmail: true,
      collectPhone: false,
      collectOrg: false,
      authMode: 'google',
      allowedBatches: [],
      instructions: '',
      limitPerUser: true,
      questions: [],
      createdAt: new Date().toISOString()
    };
  }
  activeTab = 'index';
  activeQ = 0;
  await renderPage(app);
}

async function renderPage(app) {
  const qListEl = app.querySelector('.q-list');
  const savedScroll = qListEl ? qListEl.scrollTop : 0;

  const certs = await getAllCertTemplates();
  app.innerHTML = `
    ${renderNavbar()}

    <div class="editor-head">
      <div class="editor-head-inner">
        <div class="editor-title-group">
          <a href="#/admin" class="btn btn-ghost btn-sm" style="padding:0 8px" aria-label="Back to dashboard">${Icon('arrow-left', 16)}</a>
          <div>
            <div class="editor-title" id="editor-title">${escapeHtml(quizTitle())}</div>
            <div class="toolbar-badge">${statusBadge()}</div>
          </div>
        </div>
        <div class="editor-actions">
          <span class="save-state" id="editor-state"></span>
          <button class="btn btn-secondary btn-sm" id="btn-preview">${Icon('eye', 14)}<span>Preview</span></button>
          <button class="btn btn-secondary btn-sm" id="btn-save">${Icon('save', 14)}<span>Save Draft</span></button>
          <button class="btn ${currentQuiz.isPublished ? 'btn-ghost' : 'btn-primary'} btn-sm" id="btn-toggle-live">
            ${Icon(currentQuiz.isPublished ? 'pause' : 'play', 14)}<span>${currentQuiz.isPublished ? 'Stop Quiz' : 'Make Live'}</span>
          </button>
        </div>
      </div>
      <div class="container" style="padding-bottom:12px">
        <div class="tabs" role="tablist">
          ${TABS.map(t => `
            <button class="tab-btn ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${activeTab === t.id}">
              ${Icon(t.icon, 15)}<span>${t.label}</span>
              ${t.id === 'questions' ? `<span class="badge badge-gray" style="height:18px; min-width:18px; padding:0 5px">${currentQuiz.questions.length}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="page" style="padding-top:28px">
      <div class="container">
        ${renderActiveTab(certs)}
      </div>
    </div>`;

  bindNavbar(app);
  bindEvents(app);
  setSaveState('saved');

  const newQListEl = app.querySelector('.q-list');
  if (newQListEl && savedScroll) {
    newQListEl.scrollTop = savedScroll;
  }
}

function statusBadge() {
  return currentQuiz.isPublished
    ? Badge('Live', { tone: 'green', dot: true })
    : Badge('Draft', { tone: 'gray', dot: true });
}

function renderActiveTab(certs) {
  switch (activeTab) {
    case 'questions': return renderQuestionsTab();
    case 'evaluation': return renderEvaluationTab();
    case 'certificate': return renderCertificateTab(certs);
    case 'publishing': return renderPublishingTab();
    default: return renderGeneralTab();
  }
}

/* ============================ GENERAL ============================ */
function renderGeneralTab() {
  const cf = currentQuiz.customFields || [];
  return `
    <div style="display:grid; grid-template-columns: 1fr 380px; gap:20px; align-items:start; flex-wrap:wrap">
      <div class="q-editor-card">
        <div class="q-editor-top"><div class="q-editor-title">Quiz details</div></div>
        <div class="panel">
          ${Field({ label: 'Quiz title', required: true, htmlFor: 'quiz-title', control: Inp({ id: 'quiz-title', value: currentQuiz.title, placeholder: 'e.g. General Chemistry — Final Assessment', className: 'input-lg' }) })}
          ${Field({ label: 'Description', htmlFor: 'quiz-desc', hint: 'Short summary shown in the quiz intro.', control: Txta({ id: 'quiz-desc', value: currentQuiz.description, rows: 3, placeholder: 'What is this quiz about?' }) })}
          ${Field({ label: 'Special instructions', htmlFor: 'quiz-instructions', hint: 'Optional. Shown on the pre-quiz screen after sign-in, right above Begin Quiz. Leave empty to hide.', control: Txta({ id: 'quiz-instructions', value: currentQuiz.instructions, rows: 5, placeholder: 'e.g. Read every question carefully. No negative marking. Answers are final once you submit…' }) })}
        </div>
      </div>

      <div class="q-editor-card">
        <div class="q-editor-top"><div class="q-editor-title">Audience</div></div>
        <div class="panel" style="display:flex; flex-direction:column">
          <div class="field" style="margin-bottom:14px">
            <label class="field-label" for="quiz-auth-mode">Login method</label>
            <select class="input select" id="quiz-auth-mode">
              <option value="google" ${currentQuiz.authMode === 'google' ? 'selected' : ''}>Google Sign-In (anyone with a Google account)</option>
              <option value="userid" ${currentQuiz.authMode === 'userid' ? 'selected' : ''}>Student User-ID (from the Students Master)</option>
            </select>
            <p class="hint" id="quiz-auth-mode-hint">${currentQuiz.authMode === 'userid' ? 'Students enter only their auto-generated User-ID. Their name is pulled from the master database.' : 'Participants sign in with Google so their name and email are captured automatically.'}</p>
          </div>

          <div id="quiz-batch-block" ${currentQuiz.authMode !== 'userid' ? 'style="display:none"' : ''}>
            <label class="field-label" for="quiz-allowed-batches">Allow only these Class-Sections</label>
            <div class="chip-toggle" id="quiz-allowed-batches"></div>
            <p class="hint">Leave all off to allow every batch. Choose specific Class-Sections to restrict who can attempt.</p>
          </div>

          ${Toggle({ id: 'quiz-collect-phone', checked: currentQuiz.collectPhone, label: 'Collect phone number', hint: 'Ask participants for their phone before starting.' })}
          ${Toggle({ id: 'quiz-collect-org', checked: currentQuiz.collectOrg, label: 'Collect institution', hint: 'Ask for the participant\'s school or institution.' })}
        </div>
      </div>
    </div>

    <div class="q-editor-card" style="margin-top:20px">
      <div class="q-editor-top"><div class="q-editor-title">Custom information fields</div></div>
      <div class="panel">
        <p class="muted sm" style="margin-bottom:16px">Collect class, section, roll number, or any other detail at the entry screen.</p>
        <div id="custom-fields-list">
          ${cf.map((f, cfi) => renderCustomField(f, cfi)).join('')}
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-add-custom-field">${Icon('plus', 14)}<span>Add field</span></button>
      </div>
    </div>`;
}

function renderCustomField(f, cfi) {
  return `
    <div class="card" style="padding:16px; margin-bottom:10px; box-shadow:none">
      <div class="flex gap-sm wrap" style="align-items:flex-end">
        <div style="flex:2; min-width:160px">
          ${Field({ label: 'Label', control: Inp({ value: f.label, placeholder: 'e.g. Class / Grade', className: 'cf-label', attrs: `data-cfi="${cfi}"` }) })}
        </div>
        <div style="flex:1; min-width:130px">
          ${Field({
    label: 'Type', control: Sel({
      options: [
        { value: 'text', label: 'Short text' },
        { value: 'dropdown', label: 'Dropdown select' },
        { value: 'number', label: 'Number' }
      ],
      value: f.type,
      className: 'cf-type',
      attrs: `data-cfi="${cfi}"`
    })
  })}
        </div>
        <div style="flex:2; min-width:160px">
          ${Field({ label: 'Options', control: Inp({ value: f.options || '', placeholder: 'Class 6, Class 7', className: 'cf-options', attrs: `data-cfi="${cfi}" ${f.type !== 'dropdown' ? 'disabled' : ''}` }) })}
        </div>
        <label class="checkbox-row" style="margin-bottom:16px">
          <input type="checkbox" class="cf-req" data-cfi="${cfi}" ${f.required ? 'checked' : ''}>
          <span class="checkbox-box">${Icon('check', 12)}</span>
          <span>Required</span>
        </label>
        <button class="icon-btn icon-btn-secondary icon-btn-danger cf-del" data-cfi="${cfi}" style="margin-bottom:12px" aria-label="Remove field">${Icon('trash', 15)}</button>
      </div>
    </div>`;
}

/* ============================ QUESTIONS (IDE) ============================ */
function renderQuestionsTab() {
  const total = currentQuiz.questions.length;
  const q = currentQuiz.questions[activeQ];
  return `
    <div class="editor-layout">
      <aside class="editor-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-search">
            <div class="search-wrap">${Icon('search', 15)}<input class="input q-search" type="text" placeholder="Search questions…" style="height:36px" aria-label="Search questions"></div>
          </div>
          <div class="q-list">
            ${currentQuiz.questions.map((qq, i) => renderQItem(qq, i)).join('')}
          </div>
          <div class="sidebar-add">
            <button class="btn btn-primary btn-sm" id="btn-add-q">${Icon('plus', 14)}<span>Add MCQ</span></button>
            <button class="btn btn-secondary btn-sm" id="btn-add-tf">${Icon('plus', 14)}<span>True / False</span></button>
          </div>
        </div>
      </aside>

      <main class="editor-main">
        ${q ? renderQuestionEditor(q, activeQ) : `
          <div class="card">
            ${EmptyState({
    icon: 'list-checks',
    title: 'No questions yet',
    desc: 'Add your first multiple-choice or true/false question to get started.',
    action: `<button class="btn btn-primary" id="btn-add-q-empty">${Icon('plus', 15)}<span>Add a question</span></button>`
  })}
          </div>
        `}
        ${total > 1 ? `
          <div class="card" style="padding:14px 20px">
            <div class="footer-nav">
              <button class="btn btn-secondary btn-sm" id="q-prev" ${activeQ === 0 ? 'disabled' : ''}>${Icon('chevron-left', 14)}<span>Previous</span></button>
              <span class="sm text-2 mono">Question ${activeQ + 1} of ${total}</span>
              <button class="btn btn-secondary btn-sm" id="q-next" ${activeQ === total - 1 ? 'disabled' : ''}><span>Next</span>${Icon('chevron-right', 14)}</button>
            </div>
          </div>
        ` : ''}
      </main>
    </div>`;
}

function qItemState(qq) {
  const valid = qq.type === 'mcq'
    ? (qq.correctAnswer !== '' && qq.correctAnswer !== undefined && qq.correctAnswer !== null)
    : (qq.correctAnswer === 'true' || qq.correctAnswer === 'false');
  return valid ? 'done' : 'empty';
}

function renderQItem(qq, i) {
  const text = (qq.text || '').trim() || 'Untitled question';
  const done = qItemState(qq) === 'done';
  return `
    <button class="q-item ${activeQ === i ? 'active' : ''} ${!done ? 'q-item-unmarked' : ''}" data-qi="${i}" aria-label="${done ? 'Question answered, click to edit' : 'Answer not set, click to edit'}">
      <span class="q-index">${i + 1}</span>
      <span class="q-item-copy">
        <span class="q-item-text">${escapeHtml(text)}</span>
        <span class="q-item-meta">
          ${done 
            ? `${Icon('check-circle', 11, 'check-inline')} <span style="color:var(--green)">Answer set</span>` 
            : `${Icon('alert-circle', 11)} <span style="color:var(--red); font-weight:600">Answer not set</span>`
          } · ${qq.type === 'tf' ? 'True / False' : 'MCQ'} · ${qq.points || 1} pt
        </span>
      </span>
    </button>`;
}

/* ============================ QUESTION EDITOR ============================ */
function renderQuestionEditor(q, i) {
  const letters = 'ABCDEFGHIJ';
  const isReq = q.required !== false;
  const isAnswerSet = qItemState(q) === 'done';

  return `
    <div class="q-editor-card">
      <div class="q-editor-top">
        <div class="q-editor-title-group">
          <span class="q-editor-index">Q${i + 1}</span>
          <div>
            <div class="q-editor-title">${q.type === 'tf' ? 'True / False question' : 'Multiple choice question'}</div>
          </div>
        </div>
        <div class="q-editor-actions">
          <button class="btn btn-secondary btn-sm q-dup" data-qi="${i}">${Icon('copy', 14)}<span>Duplicate</span></button>
          <button class="btn btn-danger-outline btn-sm q-del" data-qi="${i}">${Icon('trash', 14)}<span>Delete</span></button>
        </div>
      </div>
      <div class="panel">
        ${Field({
    label: 'Question',
    required: true,
    control: Inp({ className: 'q-text', value: q.text, placeholder: 'Enter the question…', attrs: `data-qi="${i}" style="font-weight:600"` })
  })}

        ${q.image ? `
          <div class="q-image-section" data-qi="${i}" style="margin-bottom:16px">
            <div class="q-image-preview">
              <img src="${q.image}" alt="Question image" class="q-image-thumb">
              <div class="q-image-actions">
                <button class="btn btn-danger-outline btn-sm q-image-remove" data-qi="${i}">${Icon('trash', 13)}<span>Remove image</span></button>
              </div>
            </div>
          </div>
        ` : ''}

        ${q.type === 'mcq' ? `
          <div style="margin-bottom:16px">
            <div class="flex items-center justify-between" style="margin-bottom:6px">
              <label class="field-label" style="margin-bottom:0">Options <span class="field-req">*</span></label>
              ${isAnswerSet 
                ? `<span class="badge badge-green" style="display:inline-flex; align-items:center; gap:4px; font-weight:600">${Icon('check-circle', 12)} Correct answer set</span>` 
                : `<span class="badge badge-red" style="display:inline-flex; align-items:center; gap:4px; font-weight:600">${Icon('alert-circle', 12)} Answer not set</span>`
              }
            </div>
            <p class="field-hint" style="margin-bottom:12px">Select the correct answer using the radio button on the left.</p>
            ${(q.options || []).map((opt, oi) => {
              const isCorrect = String(q.correctAnswer) === String(oi);
              return `
                <div class="option-row" data-qi="${i}" data-oi="${oi}" role="presentation">
                  <span class="radio-field">
                    <input type="radio" name="mcq-${i}" class="q-radio-mcq" data-qi="${i}" data-oi="${oi}" ${isCorrect ? 'checked' : ''} aria-label="Mark option ${letters[oi]} as correct">
                    <span class="radio-custom" aria-hidden="true"></span>
                  </span>
                  <input type="text" class="input opt-text" data-qi="${i}" data-oi="${oi}" placeholder="Option ${letters[oi]}" value="${escapeHtml(opt)}" style="height:42px">
                  <button class="icon-btn icon-btn-secondary option-delete" data-qi="${i}" data-oi="${oi}" aria-label="Remove option" ${q.options.length <= 2 ? 'disabled' : ''}>${Icon('x', 15)}</button>
                </div>
              `;
            }).join('')}
            <div class="flex gap-sm items-center wrap" style="margin-top:10px">
              <button class="btn btn-secondary btn-sm q-add-opt" data-qi="${i}" ${q.options?.length >= 8 ? 'disabled' : ''}>${Icon('plus', 14)}<span>Add option</span></button>
              ${!q.image ? `
                <label class="btn btn-secondary btn-sm" style="cursor:pointer; margin:0" for="q-image-input-${i}">
                  ${Icon('image', 14)}<span>Add photo</span>
                  <input type="file" id="q-image-input-${i}" class="q-image-input" data-qi="${i}" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">
                </label>
              ` : ''}
            </div>
          </div>
        ` : `
          <div style="margin-bottom:20px">
            <div class="flex items-center justify-between" style="margin-bottom:6px">
              <label class="field-label" style="margin-bottom:0">Correct answer <span class="field-req">*</span></label>
              ${isAnswerSet 
                ? `<span class="badge badge-green" style="display:inline-flex; align-items:center; gap:4px; font-weight:600">${Icon('check-circle', 12)} Correct answer set</span>` 
                : `<span class="badge badge-red" style="display:inline-flex; align-items:center; gap:4px; font-weight:600">${Icon('alert-circle', 12)} Answer not set</span>`
              }
            </div>
            <p class="field-hint" style="margin-bottom:12px">Select True or False as the correct answer.</p>
            <div class="flex wrap" style="gap:10px; margin-top:4px">
              ${[['true', 'True'], ['false', 'False']].map(([v, label]) => `
                <label class="choice-card ${String(q.correctAnswer) === v ? 'checked' : ''}">
                  <input type="radio" name="tf-${i}" class="q-radio-tf" data-qi="${i}" data-oi="${v}" ${String(q.correctAnswer) === v ? 'checked' : ''}>
                  <span class="opt-letter">${v === 'true' ? 'T' : 'F'}</span><span>${label}</span>
                </label>
              `).join('')}
            </div>
            ${!q.image ? `
              <div style="margin-top:12px">
                <label class="btn btn-secondary btn-sm" style="cursor:pointer; margin:0" for="q-image-input-${i}">
                  ${Icon('image', 14)}<span>Add photo</span>
                  <input type="file" id="q-image-input-${i}" class="q-image-input" data-qi="${i}" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">
                </label>
              </div>
            ` : ''}
          </div>
        `}

        <div class="flex gap-sm wrap" style="align-items:flex-end">
          <div style="width:120px">
            ${Field({ label: 'Points', control: Inp({ type: 'number', className: 'q-points', value: q.points || 1, min: '1', max: '100', attrs: `data-qi="${i}"` }) })}
          </div>
          <label class="checkbox-row" style="margin-bottom:20px">
            <input type="checkbox" class="q-required" data-qi="${i}" ${isReq ? 'checked' : ''}>
            <span class="checkbox-box">${Icon('check', 12)}</span>
            <span>Required question</span>
          </label>
        </div>
      </div>
    </div>`;
}

/* ============================ EVALUATION ============================ */
function renderEvaluationTab() {
  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; align-items:start">
      <div class="q-editor-card">
        <div class="q-editor-top"><div class="q-editor-title">Scoring &amp; time</div></div>
        <div class="panel">
          ${Field({ label: 'Timer limit (minutes)', htmlFor: 'quiz-timer', control: Inp({ type: 'number', id: 'quiz-timer', value: currentQuiz.timerMinutes, min: '1', max: '300' }) })}
          ${Field({ label: 'Passing score (%)', htmlFor: 'quiz-passing', hint: 'Minimum percentage required to earn a certificate.', control: Inp({ type: 'number', id: 'quiz-passing', value: currentQuiz.passingPercent, min: '0', max: '100' }) })}
          ${Field({ label: 'Start time / Available from (optional)', htmlFor: 'quiz-start-time', hint: 'Participants cannot start before this date and time (checked against master server timer). Leave blank for immediate access.', control: Inp({ type: 'datetime-local', id: 'quiz-start-time', value: currentQuiz.startTime || '' }) })}
          ${Field({ label: 'Deadline to start (optional)', htmlFor: 'quiz-deadline', hint: 'Participants can no longer start after this date and time (checked against master server timer). Leave blank for none.', control: Inp({ type: 'datetime-local', id: 'quiz-deadline', value: currentQuiz.deadline || '' }) })}
        </div>
      </div>

      <div class="q-editor-card">
        <div class="q-editor-top"><div class="q-editor-title">Behaviour</div></div>
        <div class="panel" style="display:flex; flex-direction:column">
          ${Toggle({ id: 'quiz-limit-user', checked: currentQuiz.limitPerUser, label: 'One response per Google account', hint: 'Prevents a student from submitting more than once.' })}
          ${Toggle({ id: 'quiz-shuffle', checked: currentQuiz.shuffleQuestions, label: 'Shuffle question order', hint: 'Present questions in a different order to each student.' })}
          ${Toggle({ id: 'quiz-shuffle-options', checked: !!currentQuiz.shuffleOptions, label: 'Shuffle options order', hint: 'Randomize the order of answer choices (A, B, C, D) for each question.' })}
          ${Toggle({ id: 'quiz-show-summary', checked: currentQuiz.showSummary !== false, label: 'Show result summary', hint: 'Show score, time and pass status after submission.' })}
          ${Toggle({ id: 'quiz-show-answers', checked: currentQuiz.showCorrectAnswers !== false, label: 'Show correct answers', hint: 'Let students review correct answers after submitting.' })}
          <div class="info" style="margin-top:18px">
            ${Icon('shield', 16)}<span>Google Sign-In is always required — participants must verify with a Google account before starting.</span>
          </div>
        </div>
      </div>
    </div>`;
}

/* ============================ CERTIFICATE ============================ */
function renderCertificateTab(certs) {
  const options = [{ value: '', label: 'No certificate issued' }, ...certs.map(t => ({ value: t.id, label: t.name || 'Untitled template' }))];
  return `
    <div class="q-editor-card" style="max-width:640px">
      <div class="q-editor-top"><div class="q-editor-title">Certificate</div></div>
      <div class="panel">
        ${Field({
    label: 'Certificate template',
    htmlFor: 'quiz-cert-template',
    hint: certs.length === 0 ? 'No templates yet — create one and it will appear here.' : undefined,
    control: Sel({ id: 'quiz-cert-template', options, value: currentQuiz.certificateTemplateId })
  })}
        <div class="flex gap-sm">
          <a href="#/certificates/new" class="btn btn-secondary btn-sm">${Icon('upload', 14)}<span>Upload / manage templates</span></a>
        </div>
        <div class="info" style="margin-top:18px">
          ${Icon('award', 16)}<span>Participants who reach the passing score will be able to download this certificate instantly.</span>
        </div>
      </div>
    </div>`;
}

/* ============================ PUBLISHING ============================ */
function renderPublishingTab() {
  return `
    <div style="display:grid; grid-template-columns: 1fr 380px; gap:20px; align-items:start">
      <div class="q-editor-card">
        <div class="q-editor-top"><div class="q-editor-title">Share link</div></div>
        <div class="panel">
          <p class="muted sm" style="margin-bottom:12px">Paste this link into your classroom group, or wherever students access their quizzes.</p>
          <div class="flex gap-sm">
            <input type="text" class="input" id="share-link" value="${window.location.origin}/#/take/${currentQuiz.id}" readonly style="flex:1" aria-label="Quiz share link">
            <button class="btn btn-primary" id="btn-copy-link">${Icon('copy', 15)}<span>Copy</span></button>
          </div>
          <div class="info" style="margin-top:18px">
            ${Icon(currentQuiz.isPublished ? 'zap' : 'pause', 16)}
            <span>${currentQuiz.isPublished ? 'This quiz is <strong>live</strong> and accepting submissions.' : 'This quiz is a <strong>draft</strong>. Participants cannot access it until you click "Make Live".'}</span>
          </div>
        </div>
      </div>

      <div class="q-editor-card">
        <div class="q-editor-top"><div class="q-editor-title">Visibility</div></div>
        <div class="panel">
          ${statusBadge()}
          <p class="muted sm" style="margin:12px 0 16px">Control when students can attempt this quiz.</p>
          <button class="btn ${currentQuiz.isPublished ? 'btn-danger-outline' : 'btn-primary'} btn-sm" id="btn-publish-inline">
            ${Icon(currentQuiz.isPublished ? 'pause' : 'play', 14)}<span>${currentQuiz.isPublished ? 'Stop Quiz' : 'Make Quiz Live'}</span>
          </button>
        </div>
      </div>
    </div>`;
}

/* ============================ SAVE STATE ============================ */
function setSaveState(state) {
  const el = document.getElementById('editor-state');
  if (!el) return;
  if (state === 'saving') {
    el.className = 'save-state saving';
    el.innerHTML = `${Icon('loader', 14)}<span>Saving…</span>`;
  } else if (state === 'unsaved') {
    el.className = 'save-state idle';
    el.innerHTML = `<span>Unsaved changes</span>`;
  } else {
    el.className = 'save-state saved';
    el.innerHTML = `${Icon('check-circle', 14)}<span>All changes saved</span>`;
  }
}

function markDirty() {
  setSaveState('unsaved');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => autosave(), 800);
}

async function autosave() {
  setSaveState('saving');
  try {
    await saveQuiz(currentQuiz);
    setSaveState('saved');
  } catch (err) {
    setSaveState('unsaved');
    showToast('Failed to save: ' + (err.message || 'Server error'), 'error');
  }
}

async function save() {
  setSaveState('saving');
  try {
    await saveQuiz(currentQuiz);
    setSaveState('saved');
    return true;
  } catch (err) {
    setSaveState('unsaved');
    showToast('Failed to save: ' + (err.message || 'Server error'), 'error');
    return false;
  }
}

/* ============================ EVENTS ============================ */
function bindEvents(app) {
  // Tabs
  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; window.scrollTo(0, 0); renderPage(app); });
  });

  // Head actions
  app.querySelector('#btn-save')?.addEventListener('click', async () => {
    if (!validateQuiz()) return;
    await save();
    showToast('Quiz saved');
  });
  app.querySelector('#btn-toggle-live')?.addEventListener('click', () => toggleLive(app));
  app.querySelector('#btn-publish-inline')?.addEventListener('click', () => toggleLive(app));
  app.querySelector('#btn-preview')?.addEventListener('click', async () => {
    if (!validateQuiz()) return;
    await saveQuiz(currentQuiz);
    window.location.hash = '#/take/' + currentQuiz.id;
  });
  app.querySelector('#btn-copy-link')?.addEventListener('click', async () => {
    const url = app.querySelector('#share-link').value;
    const ok = await copyTextToClipboard(url);
    if (ok) showToast('Quiz link copied');
    else showToast(url, 'info');
  });

  // General / Evaluation live bindings
  app.querySelector('#quiz-title')?.addEventListener('input', e => {
    currentQuiz.title = e.target.value;
    const t = document.getElementById('editor-title');
    if (t) t.textContent = quizTitle();
    markDirty();
  });
  app.querySelector('#quiz-desc')?.addEventListener('input', e => { currentQuiz.description = e.target.value; markDirty(); });
  app.querySelector('#quiz-instructions')?.addEventListener('input', e => { currentQuiz.instructions = e.target.value; markDirty(); });
  app.querySelector('#quiz-timer')?.addEventListener('input', e => { currentQuiz.timerMinutes = parseInt(e.target.value) || 0; markDirty(); });
  app.querySelector('#quiz-passing')?.addEventListener('input', e => { currentQuiz.passingPercent = parseInt(e.target.value) || 0; markDirty(); });
  app.querySelector('#quiz-start-time')?.addEventListener('input', e => { currentQuiz.startTime = e.target.value || ''; markDirty(); });
  app.querySelector('#quiz-deadline')?.addEventListener('input', e => { currentQuiz.deadline = e.target.value || ''; markDirty(); });
  app.querySelector('#quiz-cert-template')?.addEventListener('change', e => { currentQuiz.certificateTemplateId = e.target.value; markDirty(); });
  app.querySelector('#quiz-auth-mode')?.addEventListener('change', e => {
    currentQuiz.authMode = e.target.value;
    markDirty();
    const block = app.querySelector('#quiz-batch-block');
    const hint = app.querySelector('#quiz-auth-mode-hint');
    if (block) block.style.display = currentQuiz.authMode === 'userid' ? '' : 'none';
    if (hint) hint.textContent = currentQuiz.authMode === 'userid'
      ? 'Students enter only their auto-generated User-ID. Their name is pulled from the master database.'
      : 'Participants sign in with Google so their name and email are captured automatically.';
  });
  bindBatches(app);
  bindToggle(app, 'quiz-collect-phone', 'collectPhone');
  bindToggle(app, 'quiz-collect-org', 'collectOrg');
  bindToggle(app, 'quiz-limit-user', 'limitPerUser');
  bindToggle(app, 'quiz-shuffle', 'shuffleQuestions');
  bindToggle(app, 'quiz-shuffle-options', 'shuffleOptions');
  bindToggle(app, 'quiz-show-summary', 'showSummary');
  bindToggle(app, 'quiz-show-answers', 'showCorrectAnswers');

  // Active question live editing
  app.querySelector('.q-text')?.addEventListener('input', e => {
    const i = parseInt(e.target.dataset.qi);
    if (currentQuiz.questions[i]) {
      currentQuiz.questions[i].text = e.target.value;
      markDirty();
      updateSidebarPreview(i);
    }
  });
  app.querySelectorAll('.opt-text').forEach(el => {
    el.addEventListener('input', e => {
      const qi = parseInt(el.dataset.qi), oi = parseInt(el.dataset.oi);
      if (currentQuiz.questions[qi]?.options) { currentQuiz.questions[qi].options[oi] = e.target.value; markDirty(); }
    });
  });
  app.querySelectorAll('.q-points').forEach(el => {
    el.addEventListener('input', e => {
      const qi = parseInt(el.dataset.qi);
      if (currentQuiz.questions[qi]) currentQuiz.questions[qi].points = parseInt(e.target.value) || 1;
      markDirty();
    });
  });
  app.querySelectorAll('.q-required').forEach(el => {
    el.addEventListener('change', e => {
      const qi = parseInt(el.dataset.qi);
      if (currentQuiz.questions[qi]) currentQuiz.questions[qi].required = el.checked;
      markDirty();
    });
  });
  app.querySelectorAll('.q-radio-mcq, .q-radio-tf').forEach(radio => {
    radio.addEventListener('change', async () => {
      const qi = parseInt(radio.dataset.qi), oi = radio.dataset.oi;
      if (!currentQuiz.questions[qi]) return;
      currentQuiz.questions[qi].correctAnswer = oi;
      await save();
      switchQuestionView(app, qi);
      const meta = app.querySelector(`.q-item[data-qi="${qi}"] .q-item-meta`);
      if (meta) {
        meta.innerHTML = `${Icon('check-circle', 11, 'check-inline')} <span style="color:var(--green)">Answer set</span> · ${currentQuiz.questions[qi].type === 'tf' ? 'True / False' : 'MCQ'} · ${currentQuiz.questions[qi].points || 1} pt`;
      }
    });
  });

  // Clicking anywhere on an option row selects it as the correct answer
  app.querySelectorAll('.option-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.opt-text') || e.target.closest('.option-delete')) return;
      const radio = row.querySelector('.q-radio-mcq');
      if (radio && !radio.checked) radio.click();
    });
  });

  // Question image upload
  app.querySelectorAll('.q-image-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const qi = parseInt(input.dataset.qi);
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return; }
      try {
        showToast('Uploading image…');
        const result = await uploadQuestionImage(file);
        if (result.url) {
          currentQuiz.questions[qi].image = result.url;
          await save();
          showToast('Image added');
          renderPage(app);
        }
      } catch (err) {
        showToast('Image upload failed: ' + (err.message || 'Unknown error'), 'error');
      }
    });
  });
  app.querySelectorAll('.q-image-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qi = parseInt(btn.dataset.qi);
      if (currentQuiz.questions[qi]) {
        delete currentQuiz.questions[qi].image;
        await save();
        showToast('Image removed');
        renderPage(app);
      }
    });
  });

  // Custom fields
  app.querySelector('#btn-add-custom-field')?.addEventListener('click', async () => {
    currentQuiz.customFields = currentQuiz.customFields || [];
    currentQuiz.customFields.push({ id: generateId(), label: 'Class / Grade', type: 'dropdown', options: 'Class 6, Class 7, Class 8, Class 9, Class 10', required: true });
    await save();
    renderPage(app);
  });
  app.querySelectorAll('.cf-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentQuiz.customFields = currentQuiz.customFields || [];
      currentQuiz.customFields.splice(parseInt(btn.dataset.cfi), 1);
      await save();
      renderPage(app);
    });
  });
  app.querySelectorAll('.cf-type').forEach(sel => {
    sel.addEventListener('change', () => renderPage(app));
  });
  app.querySelectorAll('.cf-label').forEach(el => {
    el.addEventListener('input', e => {
      const cfi = parseInt(e.target.dataset.cfi);
      if (currentQuiz.customFields?.[cfi]) { currentQuiz.customFields[cfi].label = e.target.value; markDirty(); }
    });
  });
  app.querySelectorAll('.cf-options').forEach(el => {
    el.addEventListener('input', e => {
      const cfi = parseInt(e.target.dataset.cfi);
      if (currentQuiz.customFields?.[cfi]) { currentQuiz.customFields[cfi].options = e.target.value; markDirty(); }
    });
  });
  app.querySelectorAll('.cf-req').forEach(el => {
    el.addEventListener('change', e => {
      const cfi = parseInt(e.target.dataset.cfi);
      if (currentQuiz.customFields?.[cfi]) { currentQuiz.customFields[cfi].required = e.target.checked; markDirty(); }
    });
  });

  // Add questions
  app.querySelector('#btn-add-q')?.addEventListener('click', () => addQuestion(app, 'mcq'));
  app.querySelector('#btn-add-tf')?.addEventListener('click', () => addQuestion(app, 'tf'));
  app.querySelector('#btn-add-q-empty')?.addEventListener('click', () => addQuestion(app, 'mcq'));

  // Options
  app.querySelectorAll('.option-delete').forEach(el => {
    el.addEventListener('click', async () => {
      const qi = parseInt(el.dataset.qi), oi = parseInt(el.dataset.oi), q = currentQuiz.questions[qi];
      if (!q || q.options.length <= 2) { showToast('Need at least 2 options', 'error'); return; }
      q.options.splice(oi, 1);
      if (q.correctAnswer === oi.toString()) q.correctAnswer = '';
      else if (parseInt(q.correctAnswer) > oi) q.correctAnswer = (parseInt(q.correctAnswer) - 1).toString();
      await save();
      renderPage(app);
    });
  });
  app.querySelectorAll('.q-add-opt').forEach(el => {
    el.addEventListener('click', async () => {
      const qi = parseInt(el.dataset.qi);
      const q = currentQuiz.questions[qi];
      if (!q || q.options.length >= 8) { showToast('Maximum 8 options', 'error'); return; }
      q.options.push('');
      await save();
      renderPage(app);
    });
  });
  app.querySelectorAll('.q-dup').forEach(el => {
    el.addEventListener('click', async () => {
      const qi = parseInt(el.dataset.qi);
      const dup = JSON.parse(JSON.stringify(currentQuiz.questions[qi]));
      dup.id = generateId();
      currentQuiz.questions.splice(qi + 1, 0, dup);
      activeQ = qi + 1;
      await save();
      renderPage(app);
    });
  });
  app.querySelectorAll('.q-del').forEach(el => {
    el.addEventListener('click', async () => {
      currentQuiz.questions.splice(parseInt(el.dataset.qi), 1);
      if (activeQ >= currentQuiz.questions.length) activeQ = currentQuiz.questions.length - 1;
      if (activeQ < 0) activeQ = 0;
      await save();
      renderPage(app);
    });
  });

  // Sidebar navigation + search
  app.querySelectorAll('.q-item').forEach(item => {
    item.addEventListener('click', () => switchQuestionView(app, parseInt(item.dataset.qi)));
  });
  app.querySelector('#q-prev')?.addEventListener('click', () => switchQuestionView(app, activeQ - 1));
  app.querySelector('#q-next')?.addEventListener('click', () => switchQuestionView(app, activeQ + 1));
  app.querySelector('.q-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    app.querySelectorAll('.q-item').forEach(it => {
      it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

function switchQuestionView(app, newIndex) {
  if (newIndex < 0 || newIndex >= currentQuiz.questions.length) return;
  activeQ = newIndex;

  app.querySelectorAll('.q-item').forEach((item) => {
    const qi = parseInt(item.dataset.qi);
    item.classList.toggle('active', qi === activeQ);
  });

  const mainEl = app.querySelector('.editor-main');
  const total = currentQuiz.questions.length;
  const q = currentQuiz.questions[activeQ];
  if (mainEl) {
    mainEl.innerHTML = `
      ${q ? renderQuestionEditor(q, activeQ) : `
        <div class="card">
          ${EmptyState({
            icon: 'list-checks',
            title: 'No questions yet',
            desc: 'Add your first multiple-choice or true/false question to get started.',
            action: `<button class="btn btn-primary" id="btn-add-q-empty">${Icon('plus', 15)}<span>Add a question</span></button>`
          })}
        </div>
      `}
      ${total > 1 ? `
        <div class="card" style="padding:14px 20px">
          <div class="footer-nav">
            <button class="btn btn-secondary btn-sm" id="q-prev" ${activeQ === 0 ? 'disabled' : ''}>${Icon('chevron-left', 14)}<span>Previous</span></button>
            <span class="sm text-2 mono">Question ${activeQ + 1} of ${total}</span>
            <button class="btn btn-secondary btn-sm" id="q-next" ${activeQ === total - 1 ? 'disabled' : ''}><span>Next</span>${Icon('chevron-right', 14)}</button>
          </div>
        </div>
      ` : ''}
    `;
    bindEvents(app);
  }
}

function bindToggle(app, id, key) {
  const el = app.querySelector(`#${id}`);
  if (el) el.addEventListener('change', () => { currentQuiz[key] = el.checked; markDirty(); });
}

async function bindBatches(app) {
  const container = app.querySelector('#quiz-allowed-batches');
  if (!container || currentQuiz.authMode !== 'userid') return;
  let batches = [];
  try { batches = await getBatches(); } catch { /* ignore */ }
  currentQuiz.allowedBatches = Array.isArray(currentQuiz.allowedBatches) ? currentQuiz.allowedBatches : [];
  container.innerHTML = batchPickerHTML({
    id: 'quiz-batch-picker',
    label: 'Allow only these Class-Sections',
    hint: 'Leave all off to allow every batch. Choose specific Class-Sections to restrict who can attempt.',
    selected: currentQuiz.allowedBatches,
    batches
  });
  const picker = container.querySelector('#quiz-batch-picker');
  if (picker) bindBatchPicker(picker, {
    onSelected: (sel) => { currentQuiz.allowedBatches = sel; markDirty(); }
  });
}

function updateSidebarPreview(i) {
  const item = document.querySelector(`.q-item[data-qi="${i}"] .q-item-text`);
  if (item) item.textContent = currentQuiz.questions[i].text.trim() || 'Untitled question';
}

async function toggleLive(app) {
  if (!validateQuiz()) return;
  currentQuiz.isPublished = !currentQuiz.isPublished;
  await save();
  showToast(currentQuiz.isPublished ? 'Quiz is now live' : 'Quiz moved to drafts');
  renderPage(app);
}

async function addQuestion(app, type) {
  if (type === 'mcq') {
    currentQuiz.questions.push({ id: generateId(), type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '', points: 1, required: true, image: '' });
  } else {
    currentQuiz.questions.push({ id: generateId(), type: 'tf', text: '', correctAnswer: '', points: 1, required: true, image: '' });
  }
  activeQ = currentQuiz.questions.length - 1;
  activeTab = 'questions';
  await save();
  renderPage(app);
}

function validateQuiz() {
  for (let i = 0; i < currentQuiz.questions.length; i++) {
    const q = currentQuiz.questions[i];
    if (!q || !q.text || q.text.trim() === '') {
      activeTab = 'questions';
      activeQ = i;
      showToast(`Question ${i + 1} text is empty`, 'error');
      return false;
    }
    if (q.type === 'mcq') {
      if (!q.options || q.options.length < 2) { showToast(`Question ${i + 1} needs at least 2 options`, 'error'); return false; }
      if (q.correctAnswer === '' || q.correctAnswer === undefined || q.correctAnswer === null) { showToast(`Mark a correct answer for question ${i + 1}`, 'error'); return false; }
      const idx = parseInt(q.correctAnswer);
      if (isNaN(idx) || idx < 0 || idx >= q.options.length) { showToast(`Question ${i + 1} has an invalid correct answer`, 'error'); return false; }
    } else if (q.type === 'tf') {
      if (q.correctAnswer !== 'true' && q.correctAnswer !== 'false') { showToast(`Select True or False for question ${i + 1}`, 'error'); return false; }
    }
  }
  return true;
}
