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
  function handleRoute() {
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
      currentCleanup = handler(params);
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
