import { saveQuiz, getQuiz, generateId, getAllCertTemplates, getBatches, uploadQuestionImage, uploadQuizBanner } from '../store.js';
import { Icon, Badge, Field, Inp, Txta, Sel, Toggle, EmptyState } from '../components.js';
import { requireAdmin, hasPermission } from '../auth.js';
import { renderNavbar, showToast, escapeHtml, copyTextToClipboard, bindNavbar, renderAccessDenied, batchPickerHTML, bindBatchPicker } from '../utils.js';
import { BANNER_TEMPLATES } from '../bannerTemplates.js';

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
      title: 'Untitled Quiz',
      nickname: '',
      description: '',
      bannerUrl: '',
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
      instructions: `1. Read each question carefully before choosing your answer.
2. The timer begins as soon as you click "Begin Quiz".
3. Do not refresh or navigate away from the browser tab while taking the quiz.
4. Review your selected answers before clicking "Submit Quiz".
5. Upon reaching the passing score, your certificate will be generated automatically.`,
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
          ${Field({ label: 'Internal Nickname (Admin view only)', htmlFor: 'quiz-nickname', hint: 'Optional internal identifier for the Admin Dashboard. Participants will never see this.', control: Inp({ id: 'quiz-nickname', value: currentQuiz.nickname || '', placeholder: 'e.g. Set-A Batch 2026 / Term 1 Final' }) })}
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

    <!-- Quiz Banner & Link Share Image Section -->
    <div class="q-editor-card" style="margin-top:20px">
      <div class="q-editor-top">
        <div class="q-editor-title">Quiz Banner &amp; Link Share Preview Image</div>
      </div>
      <div class="panel">
        <p class="muted sm" style="margin-bottom:16px">
          Map a banner to this quiz. When you share the quiz link on WhatsApp, Telegram, Twitter, or Slack, this banner image will pop up automatically as the link preview card.
        </p>

        <div style="display:grid; grid-template-columns: 1fr 340px; gap:20px; align-items:start; flex-wrap:wrap">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
              <label class="field-label" style="margin:0">Quiz Banner</label>
              <span class="badge badge-purple" style="font-weight:600; font-size:11px; display:inline-flex; align-items:center; gap:4px">${Icon('image', 11)} Adaptive</span>
            </div>
            <div id="quiz-banner-preview-box" style="position:relative; width:100%; border-radius:12px; overflow:hidden; border:2px solid var(--border); background:var(--bg-2)">
              ${currentQuiz.bannerUrl ? `
                <img src="${escapeHtml(currentQuiz.bannerUrl)}" alt="Quiz banner" style="width:100%; height:auto; display:block">
                <button class="btn btn-danger btn-sm" id="btn-remove-banner" style="position:absolute; top:12px; right:12px; z-index:2; box-shadow:0 4px 12px rgba(0,0,0,0.3)">${Icon('trash', 14)} Remove Banner</button>
              ` : `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:32px 16px">
                <div style="margin-bottom:6px; color:var(--text-3)">${Icon('image', 36)}</div>
                <div style="font-weight:600; font-size:14px; margin-bottom:4px">No banner mapped</div>
                <div class="xs muted" style="margin-bottom:12px">Upload your JPG or PNG image (any size) or select a preset template</div>
                <label class="btn btn-secondary btn-sm" style="cursor:pointer">
                  ${Icon('upload', 14)} <span>Upload Banner (JPG/PNG)</span>
                  <input type="file" class="quiz-banner-file-input" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" style="display:none">
                </label>
                </div>
              `}
            </div>
            ${currentQuiz.bannerUrl ? `
              <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center">
                <span class="xs muted">Banner mapped${currentQuiz.bannerUrl.startsWith('data:') ? ' (template — upload a JPG/PNG for link preview)' : ''}</span>
                <label class="btn btn-ghost btn-xs" style="cursor:pointer">
                  ${Icon('upload', 12)} <span>Change Image</span>
                  <input type="file" class="quiz-banner-file-input" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" style="display:none">
                </label>
              </div>
            ` : ''}
          </div>

          <!-- Social Share Card Live Preview -->
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
              <label class="field-label" style="margin:0">Link Share Preview Card</label>
            </div>
            <div class="card" style="padding:12px; background:var(--bg-2); border:1px solid var(--border); border-radius:12px">
              <div class="xs muted" style="margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px">Link Popup Card (WhatsApp / Socials)</div>
              <div style="border-radius:10px; overflow:hidden; border:1px solid var(--border); background:var(--card-bg)">
                <div style="width:100%; height:120px; background:var(--bg-3); overflow:hidden; position:relative">
                  ${currentQuiz.bannerUrl ? `
                    <img src="${escapeHtml(currentQuiz.bannerUrl)}" alt="Share preview" style="width:100%; height:100%; object-fit:cover">
                  ` : `
                    <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px; font-weight:700; background:linear-gradient(135deg, #4f46e5, #7c3aed)">
                      Quiz Banner Image
                    </div>
                  `}
                </div>
                <div style="padding:10px 12px">
                  <div style="font-size:10.5px; color:var(--primary); font-weight:700; text-transform:uppercase">GYAN.PORTAL.EDU · QUIZ</div>
                  <div style="font-size:13px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px">${escapeHtml(quizTitle())}</div>
                  <div style="font-size:11.5px; color:var(--text-2); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:2px">${escapeHtml(currentQuiz.description || 'Attempt this certified online quiz on Gyan Portal.')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Banner Templates Gallery -->
        <div style="margin-top:24px">
          <label class="field-label" style="margin-bottom:8px">Or Pick a Banner Template</label>
          <div class="grid grid-3" style="gap:12px">
            ${BANNER_TEMPLATES.map(t => `
              <div class="banner-template-card ${currentQuiz.bannerUrl === t.url ? 'active' : ''}" data-url="${escapeHtml(t.url)}" style="cursor:pointer; border-radius:10px; overflow:hidden; border:2px solid ${currentQuiz.bannerUrl === t.url ? 'var(--primary)' : 'var(--border)'}; background:var(--card-bg); transition:all 0.15s ease">
                <div style="height:76px; width:100%; overflow:hidden; position:relative">
                  <img src="${escapeHtml(t.url)}" alt="${escapeHtml(t.name)}" style="width:100%; height:100%; object-fit:cover">
                </div>
                <div style="padding:8px 10px; display:flex; justify-content:space-between; align-items:center">
                  <span style="font-size:12px; font-weight:600">${escapeHtml(t.name)}</span>
                  ${currentQuiz.bannerUrl === t.url ? Badge('Mapped', { tone: 'green' }) : `<span class="xs muted">${escapeHtml(t.category)}</span>`}
                </div>
              </div>
            `).join('')}
          </div>
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
          ${Field({ label: 'Start time / Available from (optional)', htmlFor: 'quiz-start-time', hint: 'Participants cannot start before this date and time (checked against master server timer). Leave blank for immediate access.', control: Inp({ type: 'datetime-local', id: 'quiz-start-time', value: toLocalDatetimeLocal(currentQuiz.startTime) }) })}
          ${Field({ label: 'Deadline to start (optional)', htmlFor: 'quiz-deadline', hint: 'Participants can no longer start after this date and time (checked against master server timer). Leave blank for none.', control: Inp({ type: 'datetime-local', id: 'quiz-deadline', value: toLocalDatetimeLocal(currentQuiz.deadline) }) })}
          <div id="quiz-time-window-info" style="display:none"></div>
        </div>
      </div>

      <div class="q-editor-card">
        <div class="q-editor-top"><div class="q-editor-title">Behaviour</div></div>
        <div class="panel" style="display:flex; flex-direction:column">
          ${Toggle({ id: 'quiz-limit-user', checked: currentQuiz.limitPerUser, label: 'One response per Google account', hint: 'Prevents a student from submitting more than once.' })}
          ${Toggle({ id: 'quiz-stop-responses', checked: !!currentQuiz.stopResponses, label: 'Stop taking responses', hint: 'Prevent new attempts, but allow past attempts to download their certificates.' })}
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
            <input type="text" class="input" id="share-link" value="${window.location.origin}/take/${currentQuiz.id}" readonly style="flex:1" aria-label="Quiz share link">
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

let isSaving = false;
let savePending = false;

function markDirty() {
  setSaveState('unsaved');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => autosave(), 600);
}

async function autosave() {
  if (isSaving) {
    savePending = true;
    return;
  }
  isSaving = true;
  savePending = false;
  setSaveState('saving');
  try {
    await saveQuiz(currentQuiz);
    setSaveState('saved');
  } catch (err) {
    setSaveState('unsaved');
  } finally {
    isSaving = false;
    if (savePending) {
      savePending = false;
      autosave();
    }
  }
}

async function save() {
  if (isSaving) return true;
  isSaving = true;
  setSaveState('saving');
  try {
    await saveQuiz(currentQuiz);
    setSaveState('saved');
    return true;
  } catch (err) {
    setSaveState('unsaved');
    showToast('Failed to save: ' + (err.message || 'Server error'), 'error');
    return false;
  } finally {
    isSaving = false;
  }
}

/* ============================ EVENTS ============================ */
function bindEvents(app) {
  // Tabs
  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => { activeTab = btn.dataset.tab; window.scrollTo(0, 0); renderPage(app); };
  });

  // Head actions
  const btnSave = app.querySelector('#btn-save');
  if (btnSave) btnSave.onclick = async () => {
    if (!validateQuiz()) return;
    await save();
    showToast('Quiz saved');
  };
  const btnToggleLive = app.querySelector('#btn-toggle-live');
  if (btnToggleLive) btnToggleLive.onclick = () => toggleLive(app);
  const btnPublishInline = app.querySelector('#btn-publish-inline');
  if (btnPublishInline) btnPublishInline.onclick = () => toggleLive(app);
  const btnPreview = app.querySelector('#btn-preview');
  if (btnPreview) btnPreview.onclick = async () => {
    if (!validateQuiz()) return;
    await saveQuiz(currentQuiz);
    window.location.hash = '#/take/' + currentQuiz.id;
  };
  const btnCopyLink = app.querySelector('#btn-copy-link');
  if (btnCopyLink) btnCopyLink.onclick = async () => {
    const url = app.querySelector('#share-link')?.value;
    const ok = await copyTextToClipboard(url);
    if (ok) showToast('Quiz link copied');
    else showToast(url, 'info');
  };

  // General / Evaluation live bindings
  const quizTitleInput = app.querySelector('#quiz-title');
  if (quizTitleInput) quizTitleInput.oninput = e => {
    currentQuiz.title = e.target.value;
    const t = document.getElementById('editor-title');
    if (t) t.textContent = quizTitle();
    markDirty();
  };
  const quizNicknameInput = app.querySelector('#quiz-nickname');
  if (quizNicknameInput) quizNicknameInput.oninput = e => { currentQuiz.nickname = e.target.value; markDirty(); };
  const quizDescInput = app.querySelector('#quiz-desc');
  if (quizDescInput) quizDescInput.oninput = e => { currentQuiz.description = e.target.value; markDirty(); };
  const quizInstInput = app.querySelector('#quiz-instructions');
  if (quizInstInput) quizInstInput.oninput = e => { currentQuiz.instructions = e.target.value; markDirty(); };
  const quizTimerInput = app.querySelector('#quiz-timer');
  if (quizTimerInput) quizTimerInput.oninput = e => { currentQuiz.timerMinutes = parseInt(e.target.value) || 0; markDirty(); };
  const quizPassingInput = app.querySelector('#quiz-passing');
  if (quizPassingInput) quizPassingInput.oninput = e => { currentQuiz.passingPercent = parseInt(e.target.value) || 0; markDirty(); };
  const quizStartTimeInput = app.querySelector('#quiz-start-time');
  if (quizStartTimeInput) quizStartTimeInput.oninput = e => { currentQuiz.startTime = e.target.value ? new Date(e.target.value).toISOString() : ''; updateTimeWindowInfo(app); markDirty(); };
  const quizDeadlineInput = app.querySelector('#quiz-deadline');
  if (quizDeadlineInput) quizDeadlineInput.oninput = e => { currentQuiz.deadline = e.target.value ? new Date(e.target.value).toISOString() : ''; updateTimeWindowInfo(app); markDirty(); };
  updateTimeWindowInfo(app);
  const quizCertTemplateSel = app.querySelector('#quiz-cert-template');
  if (quizCertTemplateSel) quizCertTemplateSel.onchange = e => { currentQuiz.certificateTemplateId = e.target.value; markDirty(); };
  const quizAuthModeSel = app.querySelector('#quiz-auth-mode');
  if (quizAuthModeSel) quizAuthModeSel.onchange = e => {
    currentQuiz.authMode = e.target.value;
    markDirty();
    const block = app.querySelector('#quiz-batch-block');
    const hint = app.querySelector('#quiz-auth-mode-hint');
    if (block) block.style.display = currentQuiz.authMode === 'userid' ? '' : 'none';
    if (hint) hint.textContent = currentQuiz.authMode === 'userid'
      ? 'Students enter only their auto-generated User-ID. Their name is pulled from the master database.'
      : 'Participants sign in with Google so their name and email are captured automatically.';
  };
  bindBatches(app);
  bindToggle(app, 'quiz-collect-phone', 'collectPhone');
  bindToggle(app, 'quiz-collect-org', 'collectOrg');
  bindToggle(app, 'quiz-limit-user', 'limitPerUser');
  bindToggle(app, 'quiz-stop-responses', 'stopResponses');
  bindToggle(app, 'quiz-shuffle', 'shuffleQuestions');
  bindToggle(app, 'quiz-shuffle-options', 'shuffleOptions');
  bindToggle(app, 'quiz-show-summary', 'showSummary');
  bindToggle(app, 'quiz-show-answers', 'showCorrectAnswers');

  // Quiz Banner File Upload (.jpg, .png, .webp, .gif)
  app.querySelectorAll('.quiz-banner-file-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showToast('Banner file size must be under 10MB', 'error');
        return;
      }
      showToast('Uploading banner image…', 'info');
      try {
        const url = await uploadQuizBanner(file);
        currentQuiz.bannerUrl = url;
        markDirty();
        showToast('Banner image mapped to quiz');
        renderPage(app);
      } catch (err) {
        showToast(err.message || 'Failed to upload banner image', 'error');
      }
    });
  });

  // Remove Banner
  const btnRemoveBanner = app.querySelector('#btn-remove-banner');
  if (btnRemoveBanner) {
    btnRemoveBanner.addEventListener('click', () => {
      currentQuiz.bannerUrl = '';
      markDirty();
      showToast('Banner removed');
      renderPage(app);
    });
  }

  // Banner Template Selection
  app.querySelectorAll('.banner-template-card').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      currentQuiz.bannerUrl = url;
      markDirty();
      showToast('Banner template mapped to quiz');
      renderPage(app);
    });
  });

  // Custom fields
  const btnAddCustom = app.querySelector('#btn-add-custom-field');
  if (btnAddCustom) btnAddCustom.onclick = async () => {
    currentQuiz.customFields = currentQuiz.customFields || [];
    currentQuiz.customFields.push({ id: generateId(), label: 'Class / Grade', type: 'dropdown', options: 'Class 6, Class 7, Class 8, Class 9, Class 10', required: true });
    await save();
    renderPage(app);
  };
  app.querySelectorAll('.cf-del').forEach(btn => {
    btn.onclick = async () => {
      currentQuiz.customFields = currentQuiz.customFields || [];
      currentQuiz.customFields.splice(parseInt(btn.dataset.cfi), 1);
      await save();
      renderPage(app);
    };
  });
  app.querySelectorAll('.cf-type').forEach(sel => {
    sel.onchange = () => renderPage(app);
  });
  app.querySelectorAll('.cf-label').forEach(el => {
    el.oninput = e => {
      const cfi = parseInt(e.target.dataset.cfi);
      if (currentQuiz.customFields?.[cfi]) { currentQuiz.customFields[cfi].label = e.target.value; markDirty(); }
    };
  });
  app.querySelectorAll('.cf-options').forEach(el => {
    el.oninput = e => {
      const cfi = parseInt(e.target.dataset.cfi);
      if (currentQuiz.customFields?.[cfi]) { currentQuiz.customFields[cfi].options = e.target.value; markDirty(); }
    };
  });
  app.querySelectorAll('.cf-req').forEach(el => {
    el.onchange = e => {
      const cfi = parseInt(e.target.dataset.cfi);
      if (currentQuiz.customFields?.[cfi]) { currentQuiz.customFields[cfi].required = e.target.checked; markDirty(); }
    };
  });

  // Add question buttons
  const btnAddQ = app.querySelector('#btn-add-q');
  if (btnAddQ) btnAddQ.onclick = () => addQuestion(app, 'mcq');
  const btnAddTf = app.querySelector('#btn-add-tf');
  if (btnAddTf) btnAddTf.onclick = () => addQuestion(app, 'tf');

  // Sidebar navigation + search
  app.querySelectorAll('.q-item').forEach(item => {
    item.onclick = () => switchQuestionView(app, parseInt(item.dataset.qi));
  });
  const qSearchInput = app.querySelector('.q-search');
  if (qSearchInput) qSearchInput.oninput = e => {
    const q = e.target.value.toLowerCase();
    app.querySelectorAll('.q-item').forEach(it => {
      it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };

  // Bind active question editor events inside .editor-main
  bindQuestionEditorEvents(app);
}

function bindQuestionEditorEvents(app) {
  const main = app.querySelector('.editor-main');
  if (!main) return;

  // Active question live editing
  const qTextInput = main.querySelector('.q-text');
  if (qTextInput) qTextInput.oninput = e => {
    const i = parseInt(e.target.dataset.qi);
    if (currentQuiz.questions[i]) {
      currentQuiz.questions[i].text = e.target.value;
      markDirty();
      updateSidebarPreview(i);
    }
  };
  main.querySelectorAll('.opt-text').forEach(el => {
    el.oninput = e => {
      const qi = parseInt(el.dataset.qi), oi = parseInt(el.dataset.oi);
      if (currentQuiz.questions[qi]?.options) {
        currentQuiz.questions[qi].options[oi] = e.target.value;
        markDirty();
      }
    };
  });
  main.querySelectorAll('.q-points').forEach(el => {
    el.oninput = e => {
      const qi = parseInt(el.dataset.qi);
      if (currentQuiz.questions[qi]) {
        currentQuiz.questions[qi].points = parseInt(e.target.value) || 1;
        markDirty();
      }
    };
  });
  main.querySelectorAll('.q-required').forEach(el => {
    el.onchange = e => {
      const qi = parseInt(el.dataset.qi);
      if (currentQuiz.questions[qi]) {
        currentQuiz.questions[qi].required = el.checked;
        markDirty();
      }
    };
  });
  main.querySelectorAll('.q-radio-mcq, .q-radio-tf').forEach(radio => {
    radio.onchange = async () => {
      const qi = parseInt(radio.dataset.qi), oi = radio.dataset.oi;
      if (!currentQuiz.questions[qi]) return;
      currentQuiz.questions[qi].correctAnswer = oi;
      markDirty();
      updateSidebarQItemMeta(app, qi);
      updateEditorHeaderBadge(main, qi);
    };
  });

  // Clicking anywhere on an option row selects it as the correct answer
  main.querySelectorAll('.option-row').forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest('.opt-text') || e.target.closest('.option-delete')) return;
      const radio = row.querySelector('.q-radio-mcq');
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
  });

  // Question image upload
  main.querySelectorAll('.q-image-input').forEach(input => {
    input.onchange = async (e) => {
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
          switchQuestionView(app, qi);
        }
      } catch (err) {
        showToast('Image upload failed: ' + (err.message || 'Unknown error'), 'error');
      }
    };
  });
  main.querySelectorAll('.q-image-remove').forEach(btn => {
    btn.onclick = async () => {
      const qi = parseInt(btn.dataset.qi);
      if (currentQuiz.questions[qi]) {
        delete currentQuiz.questions[qi].image;
        await save();
        showToast('Image removed');
        switchQuestionView(app, qi);
      }
    };
  });

  // Options add / delete / duplicate / delete question
  main.querySelectorAll('.option-delete').forEach(el => {
    el.onclick = async () => {
      const qi = parseInt(el.dataset.qi), oi = parseInt(el.dataset.oi), q = currentQuiz.questions[qi];
      if (!q || q.options.length <= 2) { showToast('Need at least 2 options', 'error'); return; }
      q.options.splice(oi, 1);
      if (q.correctAnswer === oi.toString()) q.correctAnswer = '';
      else if (parseInt(q.correctAnswer) > oi) q.correctAnswer = (parseInt(q.correctAnswer) - 1).toString();
      await save();
      switchQuestionView(app, qi);
    };
  });
  main.querySelectorAll('.q-add-opt').forEach(el => {
    el.onclick = async () => {
      const qi = parseInt(el.dataset.qi);
      const q = currentQuiz.questions[qi];
      if (!q || q.options.length >= 8) { showToast('Maximum 8 options', 'error'); return; }
      q.options.push('');
      await save();
      switchQuestionView(app, qi);
    };
  });
  main.querySelectorAll('.q-dup').forEach(el => {
    el.onclick = async () => {
      const qi = parseInt(el.dataset.qi);
      const dup = JSON.parse(JSON.stringify(currentQuiz.questions[qi]));
      dup.id = generateId();
      currentQuiz.questions.splice(qi + 1, 0, dup);
      activeQ = qi + 1;
      await save();
      renderPage(app);
    };
  });
  main.querySelectorAll('.q-del').forEach(el => {
    el.onclick = async () => {
      currentQuiz.questions.splice(parseInt(el.dataset.qi), 1);
      if (activeQ >= currentQuiz.questions.length) activeQ = currentQuiz.questions.length - 1;
      if (activeQ < 0) activeQ = 0;
      await save();
      renderPage(app);
    };
  });

  // Footer nav
  const btnPrev = main.querySelector('#q-prev');
  if (btnPrev) btnPrev.onclick = () => switchQuestionView(app, activeQ - 1);
  const btnNext = main.querySelector('#q-next');
  if (btnNext) btnNext.onclick = () => switchQuestionView(app, activeQ + 1);
  const btnAddQEmpty = main.querySelector('#btn-add-q-empty');
  if (btnAddQEmpty) btnAddQEmpty.onclick = () => addQuestion(app, 'mcq');
}

function updateSidebarQItemMeta(app, qi) {
  const meta = app.querySelector(`.q-item[data-qi="${qi}"] .q-item-meta`);
  const q = currentQuiz.questions[qi];
  if (meta && q) {
    const done = qItemState(q) === 'done';
    meta.innerHTML = done
      ? `${Icon('check-circle', 11, 'check-inline')} <span style="color:var(--green)">Answer set</span> · ${q.type === 'tf' ? 'True / False' : 'MCQ'} · ${q.points || 1} pt`
      : `${Icon('alert-circle', 11)} <span style="color:var(--red); font-weight:600">Answer not set</span> · ${q.type === 'tf' ? 'True / False' : 'MCQ'} · ${q.points || 1} pt`;
  }
}

function updateEditorHeaderBadge(main, qi) {
  const badge = main.querySelector('.field-label + .badge');
  const q = currentQuiz.questions[qi];
  if (badge && q) {
    const done = qItemState(q) === 'done';
    badge.className = done ? 'badge badge-green' : 'badge badge-red';
    badge.style.cssText = 'display:inline-flex; align-items:center; gap:4px; font-weight:600';
    badge.innerHTML = done
      ? `${Icon('check-circle', 12)} Correct answer set`
      : `${Icon('alert-circle', 12)} Answer not set`;
  }
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
    bindQuestionEditorEvents(app);
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

function formatWindowDuration(startTimeStr, deadlineStr) {
  if (!startTimeStr || !deadlineStr) return null;
  const start = new Date(startTimeStr);
  const end = new Date(deadlineStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    return { valid: false, message: 'Start time must be earlier than the deadline (end time).' };
  }

  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} min${mins !== 1 ? 's' : ''}`);

  return { valid: true, durationText: parts.join(' ') };
}

function updateTimeWindowInfo(app) {
  const infoEl = app.querySelector('#quiz-time-window-info');
  if (!infoEl) return;

  const res = formatWindowDuration(currentQuiz.startTime, currentQuiz.deadline);
  if (!res) {
    infoEl.innerHTML = '';
    infoEl.style.display = 'none';
  } else if (!res.valid) {
    infoEl.style.display = 'block';
    infoEl.style.cssText = 'margin-top:14px; padding:10px 14px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:var(--red); font-size:13.5px; display:flex; align-items:center; gap:8px; font-weight:500';
    infoEl.innerHTML = `${Icon('alert-circle', 16)}<span>${res.message}</span>`;
  } else {
    infoEl.style.display = 'block';
    infoEl.style.cssText = 'margin-top:14px; padding:10px 14px; border-radius:8px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.25); color:var(--blue); font-size:13.5px; display:flex; align-items:center; gap:8px; font-weight:500';
    infoEl.innerHTML = `${Icon('clock', 16)}<span>Time window duration: <strong>${res.durationText}</strong></span>`;
  }
}

function validateQuiz() {
  if (currentQuiz.startTime && currentQuiz.deadline) {
    const start = new Date(currentQuiz.startTime);
    const end = new Date(currentQuiz.deadline);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start >= end) {
      activeTab = 'evaluation';
      showToast('Start time must be earlier than the deadline (end time)', 'error');
      return false;
    }
  }

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

function toLocalDatetimeLocal(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}
