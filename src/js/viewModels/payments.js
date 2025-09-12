define([
  'knockout',
  'ojs/ojarraydataprovider',
  '../services/apiService',
  '../services/auth',
  'ojs/ojmessages',
  'ojs/ojformlayout',
  'ojs/ojbutton',
  'ojs/ojtable',
  'ojs/ojdialog',
  'ojs/ojinputtext',
  'ojs/ojinputnumber',
  'ojs/ojselectsingle'
], function(ko, ArrayDataProvider, api, auth) {
  function PaymentsVM(){
    const self = this;

    self.isAdmin = ko.pureComputed(function(){ return auth.hasRole && auth.hasRole('ADMIN'); });

    self.messages = ko.observableArray([]);
    function msg(sev, text){ self.messages.push({ severity: sev, summary: sev.toUpperCase(), detail: text, autoTimeout: 3500 }); }

    // Payments
    self.items = ko.observableArray([]);
    self.dataProvider = new ArrayDataProvider(self.items, { keyAttributes: 'id' });

    // Admin filters
    self.targetTypes = [ {value:'POLICY', label:'Policy'}, {value:'CLAIM', label:'Claim'} ];
    self.targetType = ko.observable('POLICY');
    self.targetId = ko.observable('');

    // User policy selection
    self.userPolicies = ko.observableArray([]);
    self.userPoliciesDP = new ArrayDataProvider(self.userPolicies, { keyAttributes: 'id' });
    self.selectedPolicyId = ko.observable('');

    // New payment dialog state
    self.showDialog = function(){ document.getElementById('paymentDialog').open(); };
    self.closeDialog = function(){ document.getElementById('paymentDialog').close(); };
    self.payAmount = ko.observable(null);
    self.payMethod = ko.observable('CARD');

    self.loadUserPolicies = function(){
      // Backend already scopes policies for USER
      return api.policies.getAll(null).then(function(data){ self.userPolicies(data || []); });
    };

    self.load = function(){
      if (self.isAdmin()) {
        const tt = self.targetType();
        const id = self.targetId();
        if (!tt || !id) { self.items([]); return Promise.resolve([]); }
        return api.payments.list(tt, id).then(function(rows){ self.items(rows || []); });
      } else {
        const pid = self.selectedPolicyId();
        if (!pid) { self.items([]); return Promise.resolve([]); }
        return api.payments.list('POLICY', pid).then(function(rows){ self.items(rows || []); });
      }
    };

    self.applyFilter = function(){ if (self.isAdmin()) self.load(); };
    self.changePolicy = function(){ if (!self.isAdmin()) self.load(); };

    self.createPayment = function(){
      const payload = self.isAdmin() ? {
        targetType: self.targetType(),
        targetId: self.targetId(),
        amount: Number(self.payAmount() || 0),
        method: self.payMethod() || 'CARD'
      } : {
        targetType: 'POLICY',
        targetId: self.selectedPolicyId(),
        amount: Number(self.payAmount() || 0),
        method: self.payMethod() || 'CARD'
      };
      if (!payload.targetId || !payload.amount) { msg('error','Target and amount are required'); return; }
      api.payments.create(payload)
        .then(function(){ self.closeDialog(); return self.load(); })
        .then(function(){ msg('confirmation','Payment recorded'); })
        .catch(function(e){ msg('error','Failed to create payment: ' + (e.message || e)); });
    };

    // Init
    if (!self.isAdmin()) self.loadUserPolicies();
  }

  return PaymentsVM;
});

