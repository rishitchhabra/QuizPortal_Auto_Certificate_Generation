import { getAllQuizzes, getQuiz } from '../store.js';
import { renderNavbar, showToast, escapeHtml } from '../utils.js';

export function renderDashboard(app) {
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">
        
        <!-- Kids-Friendly Light Claymorphism Hero Section -->
        <div class="hero-clay">
          <div style="margin-bottom: 1rem">
            <img src="logo.png" alt="Gyan International School Logo" style="height: 90px; object-fit: contain; filter: drop-shadow(0 8px 16px rgba(0,136,255,0.25))">
          </div>
          <h1>Gyan's Quiz Arena</h1>
          <p>
            Welcome students! Enter your official Quiz ID or paste your quiz link below to jump into your interactive live quiz.
          </p>

          <div class="quiz-code-box">
            <input type="text" id="join-quiz-input" placeholder="Paste Quiz ID or Link here (e.g. q178558...)">
            <button class="btn btn-primary btn-lg" id="btn-join-quiz">
              🚀 Enter Quiz Arena
            </button>
          </div>
        </div>

        <!-- Features Showcase Grid -->
        <div style="margin-bottom: 3.5rem">
          <h2 style="text-align:center; font-size: 1.6rem; font-weight: 900; margin-bottom: 2rem">
            🌟 Why Students & Teachers Love Gyan's Quiz Arena
          </h2>

          <div class="grid grid-3">
            <div class="feature-clay-card">
              <div class="feature-icon-clay" style="background: #e0f2fe; color: #0284c7">⏱️</div>
              <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem">Continuous Scroll Quizzes</h3>
              <p style="font-size: 0.85rem; color: var(--text-sub)">
                Smooth, phone-friendly scroll experience with real-time countdown timer and instant submission.
              </p>
            </div>

            <div class="feature-clay-card">
              <div class="feature-icon-clay" style="background: #e0f7fa; color: #00b894">🎓</div>
              <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem">Instant Custom Certificates</h3>
              <p style="font-size: 0.85rem; color: var(--text-sub)">
                Achieve the passing score to immediately download your official Gyan International School certificate.
              </p>
            </div>

            <div class="feature-clay-card">
              <div class="feature-icon-clay" style="background: #ede9fe; color: #7c3aed">🔒</div>
              <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem">Google Verified Security</h3>
              <p style="font-size: 0.85rem; color: var(--text-sub)">
                Mandatory Google OAuth login ensures authentic student verification and single-response rules.
              </p>
            </div>
          </div>
        </div>

        <!-- Admin Access Notice Card -->
        <div class="clay-card" style="text-align:center; padding: 2rem">
          <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem">🔐 Teacher & Organizer Access</h3>
          <p style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 1.25rem">
            Log into the protected Admin Control Portal to build quizzes, control Live/Stopped status, and set deadlines.
          </p>
          <a href="#/admin" class="btn btn-secondary btn-sm">🔒 Open Admin Control Portal</a>
        </div>

      </div>
    </div>
  `;

  // Join Quiz handler
  const joinInput = app.querySelector('#join-quiz-input');
  const joinBtn = app.querySelector('#btn-join-quiz');

  const executeJoin = () => {
    let val = joinInput.value.trim();
    if (!val) {
      showToast('Please enter a Quiz ID or paste a link', 'error');
      return;
    }
    if (val.includes('#/take/')) {
      val = val.split('#/take/')[1];
    } else if (val.includes('/take/')) {
      val = val.split('/take/')[1];
    }
    val = val.split('/')[0].split('?')[0];

    (async () => {
      const quiz = await getQuiz(val);
      if (!quiz) { showToast(`Quiz with ID "${val}" not found. Check your link.`, 'error'); return; }
      window.location.hash = `#/take/${quiz.id}`;
    })();
  };

  joinBtn.addEventListener('click', executeJoin);
  joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') executeJoin(); });
}
