define([
  'knockout',
  '../services/apiService',
  '../services/auth',
  'ojs/ojknockout',
  'ojs/ojformlayout',
  'ojs/ojinputtext',
  'ojs/ojbutton'
], function(ko, apiService, auth) {
  function ProfileVM() {
    const self = this;

    self.loading = ko.observable(true);
    self.error = ko.observable('');
    self.success = ko.observable('');

    self.id = ko.observable(null);
    self.firstName = ko.observable('');
    self.lastName = ko.observable('');
    self.email = ko.observable('');
    self.phone = ko.observable('');
    self.dob = ko.observable('');

    self.load = async function() {
      self.loading(true);
      self.error('');
      self.success('');
      try {
        const u = auth.user && auth.user();
        const cid = u && u.customerId;
        if (!cid) {
          self.error('No customer is linked to this user.');
          self.loading(false);
          return;
        }
        const c = await apiService.customers.get(cid);
        self.id(c.id);
        self.firstName(c.firstName || '');
        self.lastName(c.lastName || '');
        self.email(c.email || '');
        self.phone(c.phone || '');
        self.dob(c.dob || '');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load profile', e);
        self.error('Failed to load profile');
      } finally {
        self.loading(false);
      }
    };

    self.save = async function() {
      self.error('');
      self.success('');
      const cid = self.id();
      if (!cid) return;
      try {
        await apiService.customers.update(cid, {
          firstName: self.firstName(),
          lastName: self.lastName(),
          email: self.email(),
          phone: self.phone(),
          dob: self.dob()
        });
        self.success('Profile updated');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to save profile', e);
        self.error('Failed to save');
      }
    };

    self.connected = function() {
      self.load();
    };
  }

  return ProfileVM;
});

