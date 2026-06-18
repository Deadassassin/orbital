import { signal } from './signal.js';

function parseHash() {
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  const params = {};
  if (qs) {
    for (const part of qs.split('&')) {
      const [k, v] = part.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { path: path || '/', params };
}

function matchRoute(path, pattern) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export function createRouter(routes) {
  const navigated = signal(0);
  const currentParams = signal({});
  let currentRoute = null;

  function resolve() {
    const { path, params: qParams } = parseHash();
    for (const route of routes) {
      const routeParams = matchRoute(path, route.path);
      if (routeParams) {
        Object.assign(routeParams, qParams);
        currentParams.val = routeParams;
        currentRoute = route;
        navigated.val = Date.now();
        return route;
      }
    }
    const fallback = routes.find(r => r.path === '/');
    if (fallback) {
      currentRoute = fallback;
      currentParams.val = qParams;
      navigated.val = Date.now();
      return fallback;
    }
    return null;
  }

  async function navigate(path) {
    if (currentRoute && currentRoute.beforeEnter) {
      const result = await currentRoute.beforeEnter(path, currentParams.peek());
      if (result === false) return;
    }
    location.hash = '#' + path;
  }

  function back() { history.back(); }
  function forward() { history.forward(); }

  window.addEventListener('hashchange', resolve);
  window.addEventListener('popstate', resolve);

  resolve();

  return {
    navigate,
    back,
    forward,
    current: {
      get val() {
        navigated.val;
        return currentRoute ? { component: currentRoute.component, params: currentParams.peek() } : null;
      },
    },
    getRoute: () => currentRoute,
    getParams: () => currentParams.peek(),
    destroy: () => {
      window.removeEventListener('hashchange', resolve);
      window.removeEventListener('popstate', resolve);
    },
  };
}
