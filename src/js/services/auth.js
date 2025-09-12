define(['knockout', './http', './config'], function (ko, http, config) {
  const user = ko.observable(null);

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('auth');
      if (!raw) return;
      const { u, p, userInfo } = JSON.parse(raw);
      if (u && p) {
        http.setAuth(u, p);
        user(userInfo || null);
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  async function login(username, password) {
    http.setAuth(username, password);
    const resp = await http.request(config.base.core + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (!resp.ok) throw new Error('Invalid credentials');
    const data = await resp.json();
    user(data);
    localStorage.setItem('auth', JSON.stringify({ u: username, p: password, userInfo: data }));
    return data;
  }

  function logout() {
    http.clearAuth();
    user(null);
    localStorage.removeItem('auth');
  }

  function isAuthenticated() { return !!user(); }
  function hasRole(role) { return !!(user() && user().roles && user().roles.indexOf(role) >= 0); }
  function hasAnyRole(roles) { return roles.some(hasRole); }

  return { user, login, logout, loadFromStorage, isAuthenticated, hasRole, hasAnyRole };
});

