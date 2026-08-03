import { getAllQuizzes, getQuiz } from '../store.js';
import { renderNavbar, showToast, escapeHtml } from '../utils.js';
import { Icon } from '../components.js';

export function renderDashboard(app) {
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container">

        <!-- HERO -->
        <section class="hero">
          <div class="hero-copy">
            <span class="hero-eyebrow">${Icon('graduation-cap', 15)}<span>Gyan International School</span></span>
            <h1 class="hero-title">Take quizzes.<br><span class="accent">Earn certificates.</span></h1>
            <p class="hero-sub">
              Interactive assessments built for the classroom — timed, secure, and instantly graded.
              Enter your quiz ID below to begin.
            </p>

            <form class="join-box" id="join-form" role="search" aria-label="Join a quiz">
              <input type="text" id="join-quiz-input" class="input" placeholder="Paste Quiz ID or link" aria-label="Quiz ID or link" autocomplete="off">
              <button type="submit" class="btn btn-primary btn-lg" id="btn-join-quiz">
                <span>Enter Quiz</span>${Icon('arrow-right', 16)}
              </button>
            </form>

            <div class="trust-row">
              <span class="trust-item">${Icon('check-circle', 15)}Google Verified</span>
              <span class="trust-item">${Icon('award', 15)}Instant Certificates</span>
              <span class="trust-item">${Icon('zap', 15)}Live Quizzes</span>
              <span class="trust-item">${Icon('shield', 15)}Secure &amp; Private</span>
            </div>
          </div>

          <!-- Hero visual -->
          <div class="hero-visual" aria-hidden="true">
            <div class="mock-stack">
              <div class="cert-chip">
                <div class="chip-title">Certificate of Achievement</div>
                <div class="chip-name">Aarav</div>
                <div class="chip-line"></div>
                <div class="chip-foot">Score 100% · Gyan Intl School</div>
              </div>
              <div class="mock-card">
                <div class="mock-card-head">
                  <div class="mock-title">Science Quiz · Ch. 4</div>
                  <span class="badge badge-green">${Icon('zap', 11)} Live</span>
                </div>
                <div class="mock-q">Which planet is known as the Red Planet?</div>
                <div class="mock-options">
                  <div class="mock-opt"><span class="opt-let">A</span>Venus</div>
                  <div class="mock-opt hit"><span class="opt-let">B</span>Mars</div>
                  <div class="mock-opt"><span class="opt-let">C</span>Jupiter</div>
                  <div class="mock-opt"><span class="opt-let">D</span>Saturn</div>
                </div>
                <div style="margin-top:18px">
                  <div class="progress"><div class="progress-fill" style="width:60%"></div></div>
                  <div style="display:flex; justify-content:space-between; margin-top:6px">
                    <span class="xs muted">3 of 5 answered</span>
                    <span class="xs muted">${Icon('clock', 12)} 12:40 left</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- FEATURES -->
        <div style="margin-top:72px">
          <div class="section-head">
            <div>
              <h2 class="section-title">Built for schools, designed for students</h2>
              <p class="section-sub">Everything a modern classroom needs to run fair, verifiable assessments.</p>
            </div>
          </div>
          <div class="feature-grid">
            ${features.map(f => `
              <div class="feature">
                <div class="feature-icon">${Icon(f.icon)}</div>
                <h3 class="feature-title">${f.title}</h3>
                <p class="feature-text">${f.text}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- HOW IT WORKS -->
        <div style="margin-top:72px">
          <div class="section-head">
            <div>
              <h2 class="section-title">How it works</h2>
              <p class="section-sub">From quiz ID to certificate in three simple steps.</p>
            </div>
          </div>
          <div class="steps">
            ${steps.map(s => `
              <div class="step">
                <div class="step-num">${s.num}</div>
                <h3 class="step-title">${s.title}</h3>
                <p class="step-desc">${s.desc}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ADMIN ACCESS -->
        <div class="card card-pad" style="margin-top:72px; display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap">
          <div style="display:flex; align-items:center; gap:16px">
            <div class="stat-icon stat-gray" style="width:52px; height:52px">${Icon('lock', 22)}</div>
            <div>
              <h3 style="font-size:17px; font-weight:700">Teacher &amp; organizer access</h3>
              <p class="muted sm" style="margin-top:3px">Create quizzes, control live status, and manage certificates from the admin portal.</p>
            </div>
          </div>
          <a href="#/admin" class="btn btn-secondary">${Icon('layout', 15)}<span>Open Admin Portal</span></a>
        </div>

      </div>

      <!-- FOOTER -->
      <footer class="footer">
        <div class="footer-inner">
          <div class="footer-brand">
            <img src="/logo.png" alt="Gyan International School" style="height:28px; width:auto">
            <div>
              <div class="footer-title">Gyan's Quiz Arena</div>
              <div class="footer-copy">Interactive assessments &amp; certificates</div>
            </div>
          </div>
          <div class="footer-links">
            <a href="#/">Home</a>
            <a href="#/admin-login">Admin Login</a>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Join Quiz handler
  const joinInput = app.querySelector('#join-quiz-input');
  const joinBtn = app.querySelector('#btn-join-quiz');
  const joinForm = app.querySelector('#join-form');

  const executeJoin = () => {
    let val = joinInput.value.trim();
    if (!val) {
      showToast('Please enter a Quiz ID or paste a link', 'error');
      joinInput.focus();
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

  joinForm.addEventListener('submit', (e) => { e.preventDefault(); executeJoin(); });
  joinBtn.addEventListener('click', executeJoin);
}

const features = [
  { icon: 'list-checks', title: 'Continuous-scroll quizzes', text: 'A distraction-free, phone-friendly answering flow with a live countdown timer and one-tap submission.' },
  { icon: 'award', title: 'Auto-generated certificates', text: 'Students who pass instantly receive a personalized, branded certificate ready to download as PDF.' },
  { icon: 'shield', title: 'Verified with Google', text: 'Mandatory Google sign-in confirms every participant\'s identity and enforces one response per account.' },
  { icon: 'timer', title: 'Timed assessments', text: 'Set a deadline and a per-quiz timer. Submissions are captured automatically the moment time runs out.' },
  { icon: 'bar-chart', title: 'Results & analytics', text: 'Review each response, see per-question accuracy, and track pass rates across every submission.' },
  { icon: 'user', title: 'Custom participant fields', text: 'Collect class, section, and roll number at entry — so results map cleanly back to your records.' }
];

const steps = [
  { num: '1', title: 'Enter your quiz ID', desc: 'Paste the quiz ID or link your teacher shared. The quiz opens in your browser — no app to install.' },
  { num: '2', title: 'Sign in with Google', desc: 'Your school Google account verifies your identity, then you answer each question under the live timer.' },
  { num: '3', title: 'Get your certificate', desc: 'Hit the passing score and download your official certificate immediately, complete with your name and score.' }
];
