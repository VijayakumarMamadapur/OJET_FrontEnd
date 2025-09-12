define([
  'knockout',
  'ojs/ojarraydataprovider',
  '../services/apiService',
  '../services/auth',
  'ojs/ojmessages',
  'ojs/ojbutton',
  'ojs/ojformlayout',
  'ojs/ojinputtext',
  'ojs/ojselectsingle',
  'ojs/ojtable',
  'ojs/ojdialog'
], function (ko, ArrayDataProvider, api, auth) {

  function PoliciesViewModel() {
    const self = this;

    self.isAdmin = ko.pureComputed(function(){ return auth.hasRole && auth.hasRole('ADMIN'); });

    self.policies = ko.observableArray([]);
    self.customers = ko.observableArray([]);
    self.filterCustomerId = ko.observable();
    self.selectedRow = ko.observable();
    self.selectedPolicy = ko.observable();

    self.policiesDP = new ArrayDataProvider(self.policies, { keyAttributes: 'id' });
    self.customersDP = new ArrayDataProvider(self.customers, { keyAttributes: 'id' });

    self.messages = ko.observableArray([]);
    self.showMessage = function(severity, detail){
      self.messages.push({ severity: severity, summary: severity.toUpperCase(), detail: detail, autoTimeout: 3500 });
    };

    self.loadCustomers = function(){
      if (!self.isAdmin()) { self.customers([]); return Promise.resolve([]); }
      return api.customers.getAll().then(function(data){
        const mapped = (data || []).map(function(c){ return Object.assign({}, c, { fullName: (c.firstName || '') + ' ' + (c.lastName || '') }); });
        self.customers(mapped);
        return mapped;
      }).catch(function(err){ self.showMessage('error','Failed to load customers'); throw err; });
    };

    self.loadPolicies = function(){
      if (!self.isAdmin()) {
        // User: load only their policies (backend enforces customer scoping)
        return api.policies.getAll(null).then(function(data){
          const mapped = (data || []).map(function(p){
            return Object.assign({}, p, {
              customer: Object.assign({}, p.customer, { fullName: (p.customer.firstName || '') + ' ' + (p.customer.lastName || '') }),
              product: Object.assign({}, p.product)
            });
          });
          self.policies(mapped);
          return mapped;
        }).catch(function(err){ self.showMessage('error','Failed to load policies: ' + (err.message || err)); throw err; });
      }
      return api.policies.getAll(self.filterCustomerId()).then(function(data){
        const mapped = (data || []).map(function(p){
          return Object.assign({}, p, {
            customer: Object.assign({}, p.customer, { fullName: (p.customer.firstName || '') + ' ' + (p.customer.lastName || '') }),
            product: Object.assign({}, p.product)
          });
        });
        self.policies(mapped);
        return mapped;
      }).catch(function(err){ self.showMessage('error','Failed to load policies: ' + (err.message || err)); throw err; });
    };

    self.selectedRow.subscribe(function(row){
      if (row && row.data) {
        var rowData = row.data;
        rowData.customer = rowData.customer || { fullName: '' };
        rowData.product = rowData.product || { name: '' };
        self.selectedPolicy(rowData);
        var dialog = document.querySelector('#viewPolicyDialog');
        if (dialog) dialog.open();
      }
    });

    self.handleRowChanged = function(event){
      const rowContext = event.detail.value;
      if (rowContext && rowContext.rowKey != null) {
        const selected = self.policies().find(function(p){ return p.id === rowContext.rowKey; });
        if (selected) {
          selected.customer = selected.customer || { fullName: '' };
          selected.product = selected.product || { name: '' };
          self.selectedPolicy(selected);
          var dialog = document.querySelector('#viewPolicyDialog');
          if (dialog) dialog.open();
        }
      }
    };

    self.closeDialog = function(){
      var dialog = document.querySelector('#viewPolicyDialog');
      if (dialog) dialog.close();
      self.selectedPolicy(null);
    };

    Promise.all([ self.loadCustomers(), self.loadPolicies() ]).catch(function(){ /* already messaged */ });
  }

  return PoliciesViewModel;
});
