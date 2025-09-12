define(['knockout', '../services/auth'], function(ko, auth) {
  function LoginVM() {
    const self = this;
    self.username = ko.observable('');
    self.password = ko.observable('');
    self.error = ko.observable('');

    self.signIn = async function() {
      self.error('');
      try {
        await auth.login(self.username(), self.password());
        if (window && window.appRouter) {
          window.appRouter.go({ path: 'dashboard' });
        }
      } catch (e) {
        self.error('Invalid username or password');
      }
    };
  }
  return LoginVM;
});

