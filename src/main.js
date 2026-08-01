import './style.css';
import { registerRoute, startRouter } from './router.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderQuizBuilder } from './pages/quizBuilder.js';
import { renderTakeQuiz } from './pages/takeQuiz.js';
import { renderCertDesigner } from './pages/certDesigner.js';
import { renderResponses } from './pages/responses.js';
import { renderAdminLogin, renderAdminPanel } from './pages/admin.js';

const app = document.getElementById('app');

registerRoute('/', () => renderDashboard(app));
registerRoute('/create', (p) => renderQuizBuilder(app, p));
registerRoute('/edit', (p) => renderQuizBuilder(app, p));
registerRoute('/take', (p) => renderTakeQuiz(app, p));
registerRoute('/certificates', (p) => renderCertDesigner(app, p));
registerRoute('/responses', (p) => renderResponses(app, p));
registerRoute('/admin-login', () => renderAdminLogin(app));
registerRoute('/admin', () => renderAdminPanel(app));

startRouter();
