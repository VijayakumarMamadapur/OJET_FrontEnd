define([], function () {
  let authHeader = null;

  function setAuth(username, password) {
    authHeader = 'Basic ' + btoa(username + ':' + password);
  }

  function clearAuth() { authHeader = null; }

  async function request(url, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (authHeader) headers['Authorization'] = authHeader;
    const resp = await fetch(url, Object.assign({}, options, { headers }));
    if (resp.status === 401) {
      clearAuth();
      if (window && window.appRouter) {
        window.appRouter.go({ path: 'login' });
      }
    }
    return resp;
  }

  return { setAuth, clearAuth, request };
});

