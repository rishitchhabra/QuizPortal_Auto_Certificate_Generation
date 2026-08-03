import { isAdminLoggedIn } from './auth.js';
import { Icon } from './components.js';
import { renderNavbar } from './utils.js';

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(hash) {
  window.location.hash = hash;
}

function renderError(app, { icon, title, desc, detail, retry }) {
  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container-narrow" style="padding-top: 40px">
        <div class="card card-hover" style="padding: 48px 32px; text-align:center">
          <div class="empty-icon" style="margin: 0 auto 18px">${icon}</div>
          <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 8px">${title}</h1>
          <p style="color: var(--text-2); font-size: 15px; max-width: 420px; margin: 0 auto 6px">${desc}</p>
          ${detail ? `<p style="color: var(--text-3); font-size: 12px; margin: 0 auto">${detail}</p>` : ''}
          <div style="display:flex; gap:10px; justify-content:center; margin-top: 24px">
            ${retry ? `<button class="btn btn-primary" onclick="location.reload()">${Icon('refresh-cw', 15)}<span>Retry</span></button>` : ''}
            <a href="#/" class="btn btn-secondary">${Icon('home', 15)}<span>Go Home</span></a>
          </div>
        </div>
      </div>
    </div>`;
}

export function startRouter() {
  function normalizePathRoute() {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const hash = window.location.hash || '';
    const pathRoutes = new Set(['/admin', '/admin-login']);

    if (pathRoutes.has(pathname)) {
      const route = hash && hash !== '#/' ? hash : `#${pathname}`;
      window.history.replaceState(null, '', `/${route}`);
    }
  }

  function handleRoute() {
    normalizePathRoute();
    const rawHash = window.location.hash.slice(1) || '/';
    const [path, ...params] = rawHash.split('/').filter(Boolean);
    const routeKey = '/' + (path || '');

    // Cleanup previous route if needed
    if (typeof currentCleanup === 'function') {
      currentCleanup();
      currentCleanup = null;
    }

    // Admin Route Protection
    const protectedRoutes = ['/admin', '/create', '/edit', '/certificates', '/responses'];
    if (protectedRoutes.includes(routeKey) && !isAdminLoggedIn()) {
      window.location.hash = '#/admin-login';
      return;
    }

    const handler = routes[routeKey];
    if (handler) {
      const result = handler(params);
      if (result && typeof result.then === 'function') {
        result.then(cleanup => {
          if (typeof cleanup === 'function') currentCleanup = cleanup;
        }).catch(err => {
          console.error('Route error:', err);
          const app = document.getElementById('app');
          if (app) {
            renderError(app, {
              icon: Icon('alert-circle', 26),
              title: 'Something Went Wrong',
              desc: 'Could not load this page. The server may be temporarily unavailable.',
              detail: err.message || 'Unknown error',
              retry: true
            });
          }
        });
      } else {
        if (typeof result === 'function') currentCleanup = result;
      }
    } else {
      const app = document.getElementById('app');
      if (app) {
        renderError(app, {
          icon: Icon('search', 26),
          title: 'Page Not Found',
          desc: 'The page you are looking for does not exist or has moved.'
        });
      }
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
