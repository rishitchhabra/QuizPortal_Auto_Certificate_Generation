import { isAdminLoggedIn } from './auth.js';

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(hash) {
  window.location.hash = hash;
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
      // Handle async route handlers — catch errors to prevent blank pages
      if (result && typeof result.then === 'function') {
        result.then(cleanup => {
          if (typeof cleanup === 'function') currentCleanup = cleanup;
        }).catch(err => {
          console.error('Route error:', err);
          const app = document.getElementById('app');
          if (app) {
            app.innerHTML = `
              <div class="page fade-in">
                <div class="container" style="text-align:center; padding-top: 100px;">
                  <div class="clay-card" style="max-width: 500px; margin: 0 auto; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem">⚠️</div>
                    <h2 style="margin-bottom: 0.5rem">Something Went Wrong</h2>
                    <p style="color: var(--text-sub); margin-bottom: 0.5rem">Could not load this page. The server may be temporarily unavailable.</p>
                    <p style="color: var(--text-sub); font-size: 0.8rem; margin-bottom: 1.5rem">${err.message || 'Unknown error'}</p>
                    <button class="btn btn-primary" onclick="location.reload()">🔄 Retry</button>
                    <a href="#/" class="btn btn-secondary" style="margin-left: 0.5rem">Go Home</a>
                  </div>
                </div>
              </div>
            `;
          }
        });
      } else {
        if (typeof result === 'function') currentCleanup = result;
      }
    } else {
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = `
          <div class="page fade-in">
            <div class="container" style="text-align:center; padding-top: 100px;">
              <div class="clay-card" style="max-width: 450px; margin: 0 auto; padding: 3rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem">4️⃣0️⃣4️⃣</div>
                <h2 style="margin-bottom: 0.5rem">Page Not Found</h2>
                <p style="color: var(--text-sub); margin-bottom: 1.5rem">The page you are looking for does not exist or has moved.</p>
                <a href="#/" class="btn btn-primary">Go to Homepage</a>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
