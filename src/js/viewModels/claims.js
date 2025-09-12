define([
  'knockout',
  'ojs/ojarraydataprovider',
  '../services/apiService',
  '../services/auth',
  'ojs/ojdialog',
  'ojs/ojmessages',
  'ojs/ojbutton',
  'ojs/ojtable',
  'ojs/ojformlayout',
  'ojs/ojdatetimepicker',
  'ojs/ojinputnumber',
  'ojs/ojinputtext',
  'ojs/ojselectsingle'
], function (ko, ArrayDataProvider, api, auth) {
  function ClaimsViewModel() {
    var self = this;

    self.isAdmin = ko.pureComputed(function(){ return auth.hasRole && auth.hasRole('ADMIN'); });

    self.claims = ko.observableArray([]);
    self.claimsDP = new ArrayDataProvider(self.claims, { keyAttributes: 'id' });
    self.messages = ko.observableArray([]);

    // Admin-only filters
    self.filterPolicyId = ko.observable('');
    self.filterStatus = ko.observable();
    self.statuses = [
      { value: 'OPEN', label: 'Open' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'CLOSED', label: 'Closed' }
    ];
    self.statusDP = new ArrayDataProvider(self.statuses, { keyAttributes: 'value' });

    self.newClaim = {
      policyId: ko.observable(''),
      description: ko.observable(''),
      lossDate: ko.observable('')
    };

    self.selectedClaim = {
      id: ko.observable(''),
      description: ko.observable(''),
      lossDate: ko.observable('')
    };

    self.assessData = {
      id: ko.observable(''),
      decision: ko.observable(''),
      approvedAmount: ko.observable(null),
      reason: ko.observable('')
    };

    function show(severity, summary, detail){
      self.messages.push({ severity: severity, summary: summary, detail: detail, autoTimeout: 3500 });
    }

    self.loadClaims = async function() {
      try {
        // Backend scopes results for USER automatically; Admin can filter
        var policyId = self.isAdmin() ? (self.filterPolicyId() || null) : null;
        var status = self.isAdmin() ? (self.filterStatus() || null) : null;
        var data = await api.claims.getAll(policyId, status);
        self.claims(data || []);
      } catch (e) {
        show('error','Failed to load claims', e.message || e);
      }
    };

    self.applyFilter = function(){
      if (!self.isAdmin()) return;
      self.loadClaims();
    };

    self.fileClaim = async function () {
      try {
        var c = await api.claims.create({
          policyId: self.newClaim.policyId(),
          description: self.newClaim.description(),
          lossDate: self.newClaim.lossDate()
        });
        document.getElementById('newClaimDialog').close();
        // Reload for both roles; backend will scope for USER
        self.loadClaims();
      } catch (e) {
        show('error','Failed to file claim', e.message || e);
      }
    };

    self.updateClaim = async function () {
      try {
        await api.claims.update(self.selectedClaim.id(), {
          description: self.selectedClaim.description(),
          lossDate: self.selectedClaim.lossDate()
        });
        document.getElementById('updateClaimDialog').close();
        self.loadClaims();
      } catch (e) {
        show('error','Failed to update claim', e.message || e);
      }
    };

    self.assessClaim = async function () {
      try {
        await api.claims.assess(self.assessData.id(), {
          decision: self.assessData.decision(),
          approvedAmount: self.assessData.approvedAmount(),
          reason: self.assessData.reason()
        });
        document.getElementById('assessClaimDialog').close();
        self.loadClaims();
      } catch (e) {
        show('error','Failed to assess claim', e.message || e);
      }
    };

    self.closeClaim = async function (row) {
      try {
        await api.claims.close(row.id);
        self.loadClaims();
      } catch (e) {
        show('error','Failed to close claim', e.message || e);
      }
    };

    self.openNewClaimDialog = function(){ document.getElementById('newClaimDialog').open(); };
    self.closeNewClaimDialog = function(){ document.getElementById('newClaimDialog').close(); };

    self.openUpdateDialog = function(row){
      self.selectedClaim.id(row.id);
      self.selectedClaim.description(row.description);
      self.selectedClaim.lossDate(row.lossDate);
      document.getElementById('updateClaimDialog').open();
    };
    self.closeUpdateDialog = function(){ document.getElementById('updateClaimDialog').close(); };

    self.openAssessDialog = function(row){
      self.assessData.id(row.id);
      self.assessData.decision('');
      self.assessData.approvedAmount(null);
      self.assessData.reason('');
      document.getElementById('assessClaimDialog').open();
    };
    self.closeAssessDialog = function(){ document.getElementById('assessClaimDialog').close(); };

    self.loadClaims();
  }

  return ClaimsViewModel;
});
