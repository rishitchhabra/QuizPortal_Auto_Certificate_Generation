import './style.css';
import { registerRoute, startRouter } from './router.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderQuizBuilder } from './pages/quizBuilder.js';
import { renderTakeQuiz } from './pages/takeQuiz.js';
import { renderCertDesigner } from './pages/certDesigner.js';
import { renderResponses } from './pages/responses.js';
import { renderAdminLogin, renderAdminPanel } from './pages/admin.js';
import { renderUsers } from './pages/users.js';
import { renderRoles } from './pages/roles.js';
import { renderReports } from './pages/reports.js';
import { restoreSession } from './auth.js';

const app = document.getElementById('app');

async function boot() {
  await restoreSession();
  registerRoute('/', () => renderDashboard(app));
  registerRoute('/create', (p) => renderQuizBuilder(app, p));
  registerRoute('/edit', (p) => renderQuizBuilder(app, p));
  registerRoute('/take', (p) => renderTakeQuiz(app, p));
  registerRoute('/certificates', (p) => renderCertDesigner(app, p));
  registerRoute('/responses', (p) => renderResponses(app, p));
  registerRoute('/reports', (p) => renderReports(app, p));
  registerRoute('/users', () => renderUsers(app));
  registerRoute('/roles', () => renderRoles(app));
  registerRoute('/admin-login', () => renderAdminLogin(app));
  registerRoute('/admin', () => renderAdminPanel(app));

  startRouter();
}

boot();
