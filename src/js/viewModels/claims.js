define([
  'knockout',
  'ojs/ojarraydataprovider',
  '../services/apiService',
  '../services/auth',
  // JET comps used (loaded for side-effects)
  'ojs/ojdialog',
  'ojs/ojmessages',
  'ojs/ojbutton',
  'ojs/ojtable',
  'ojs/ojformlayout',
  'ojs/ojdatetimepicker',
  'ojs/ojinputnumber',
  'ojs/ojinputtext',
  'ojs/ojselectsingle',
  'ojs/ojlistview',
  'ojs/ojknockout',
  'ojs/ojkeyset'
], function (ko, ArrayDataProvider, api, auth) {

  // Prefer global JET export (AMD module is loaded above)
  var KeySetImpl = (window.oj && window.oj.KeySetImpl) ? window.oj.KeySetImpl : null;

  function ClaimsViewModel() {
    var self = this;

    // ---------------- helpers ----------------
    function toIsoDate(d) {
      if (!d) return '';
      if (typeof d === 'string') return d.length > 10 ? d.substring(0, 10) : d;
      if (Array.isArray(d) && d.length >= 3) {
        const pad = n => String(n).padStart(2, '0');
        return `${d[0]}-${pad(d[1])}-${pad(d[2])}`;
      }
      if (d instanceof Date && !isNaN(d.getTime())) {
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      }
      return '';
    }
    const dlg  = id => document.getElementById(id);
    const show = (sev,sum,det) => self.messages.push({severity:sev, summary:sum, detail:det||'', autoTimeout:3500});

    // Safe invocations on KeySetImpl (avoid losing `this`)
    function _callOn(obj, methodName) {
      const v = obj && obj[methodName];
      return (typeof v === 'function') ? v.call(obj) : v;
    }
    function _toSet(any) {
      if (!any) return new Set();
      if (any instanceof Set) return any;
      if (Array.isArray(any)) return new Set(any);
      if (typeof any[Symbol.iterator] === 'function') return new Set(Array.from(any));
      return new Set();
    }

    // ---------------- role/messages ----------------
    self.isAdmin  = ko.pureComputed(() => auth.hasRole && auth.hasRole('ADMIN'));
    self.messages = ko.observableArray([]);

    // ---------------- data ----------------
    self.claims   = ko.observableArray([]);
    self.claimsDP = new ArrayDataProvider(self.claims, { keyAttributes: 'id' });
    self.claimsCount = ko.pureComputed(() => (self.claims() || []).length);

    // ---------------- selection (object with row KeySet) ----------------
    self.selected = ko.observable({ row: new KeySetImpl() });
    self.isAssessing = ko.observable(false);


    function _getSelectedIds() {
      const sel = self.selected();
      if (!sel || !sel.row) return [];
      const ks = sel.row;

      if (_callOn(ks, 'isAddAll')) {
        const deleted = _toSet(_callOn(ks, 'deletedValues'));
        return (self.claims() || []).map(r => r.id).filter(id => !deleted.has(id));
      }
      const vals = _toSet(_callOn(ks, 'values'));
      return Array.from(vals);
    }

    function _getSelectedRows() {
      const ids = _getSelectedIds();
      if (!ids.length) return [];
      const map = new Map((self.claims() || []).map(r => [r.id, r]));
      return ids.map(id => map.get(id)).filter(Boolean);
    }

    function _getSingleSelectedRow() {
      const ids = _getSelectedIds();
      if (ids.length !== 1) return null;
      const id = ids[0];
      return (self.claims() || []).find(r => r.id === id) || null;
    }

    function _clearSelection() {
      self.selected({ row: new KeySetImpl() });
    }

    // Count for toolbar enable/disable
    self.selectedIdsCount = ko.pureComputed(function () { return _getSelectedIds().length; });

    // ---------------- columns ----------------
    self.columns = [
      { headerText: 'Claim #',         field: 'claimNumber' },
      { headerText: 'Policy ID',       field: 'policyId' },
      { headerText: 'Loss Date',       field: 'lossDate' },
      { headerText: 'Description',     field: 'description' },
      { headerText: 'Status',          field: 'status' },
      { headerText: 'Approved Amount', field: 'approvedAmount' },
      { headerText: 'Reason',          field: 'decisionReason' }
    ];

    // ---------------- filters (admin) ----------------
    self.filterPolicyId = ko.observable('');
    self.filterStatus   = ko.observable();
    self.statusDP = new ArrayDataProvider([
      { value: 'OPEN',     label: 'Open' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'CLOSED',   label: 'Closed' }
    ], { keyAttributes: 'value' });

    // ---------------- dialogs state ----------------
    self.newClaim = { policyId: ko.observable(''), description: ko.observable(''), lossDate: ko.observable('') };
    self.selectedClaim = { id: ko.observable(''), description: ko.observable(''), lossDate: ko.observable('') };

    // Assess (server expects APPROVE / REJECT as the *command*)
    self.assessData = { id: ko.observable(''), decision: ko.observable('APPROVE'),
                        approvedAmount: ko.observable(null), reason: ko.observable('') };

    self.assessStatusDP = new ArrayDataProvider([
      { value: 'APPROVE', label: 'Approve' },
      { value: 'REJECT',  label: 'Reject'  }
    ], { keyAttributes: 'value' });

    // ---------------- policies for File Claim ----------------
    self.policies   = ko.observableArray([]);
    self.policiesDP = new ArrayDataProvider(self.policies, { keyAttributes: 'id' });
    self.loadPolicies = function(){
      return api.policies.getAll(null)
        .then(rows => self.policies(rows || []))
        .catch(e => show('warning','Could not load policies', e.message||e));
    };

    // ---------------- main loader ----------------
    self.loadClaims = async function(){
      try {
        const policyId = self.isAdmin() ? (self.filterPolicyId() || null) : null;
        const status   = self.isAdmin() ? (self.filterStatus()   || null) : null;

        const raw = await api.claims.getAll(policyId, status);
        const flat = (raw || []).map(c => ({
          id:             c.id,
          claimNumber:    c.claimNumber,
          policyId:       (c.policy && c.policy.id) ? c.policy.id : (c.policyId || ''),
          lossDate:       toIsoDate(c.lossDate),
          description:    c.description || '',
          status:         c.status || '',
          approvedAmount: (c.approvedAmount !== undefined ? c.approvedAmount : null),
          decisionReason: c.decisionReason || ''
        }));

        _clearSelection();
        self.claims(flat);
        console.log('[Claims] rows set:', flat.length, flat);
      } catch (e) {
        show('error','Failed to load claims', e.message||e);
        console.error('[Claims] loadClaims error', e);
      }
    };

    self.applyFilter = function(){
      if (!self.isAdmin()) return;
      self.loadClaims();
    };

    // ---------------- enable/disable guards ----------------
    self.canUserUpdate = ko.pureComputed(function(){
      if (self.isAdmin()) return false;
      const rows = _getSelectedRows();
      return rows.length === 1 && rows[0].status === 'OPEN';
    });

    self.canAssess = ko.pureComputed(function(){
      if (!self.isAdmin()) return false;
      const rows = _getSelectedRows();
      return rows.length === 1 && rows[0].status === 'OPEN';
    });

    self.canClose = ko.pureComputed(function(){
      if (!self.isAdmin()) return false;
      const rows = _getSelectedRows();
      if (!rows.length) return false;
      return rows.every(r => r.status === 'APPROVED' || r.status === 'REJECTED');
    });

    // ---------------- toolbar actions ----------------
    self.openUpdateFromSelection = function(){
      const row = _getSingleSelectedRow();
      if (!row) return;
      self.selectedClaim.id(row.id);
      self.selectedClaim.description(row.description || '');
      self.selectedClaim.lossDate(row.lossDate || '');
      dlg('updateClaimDialog').open();
    };

    self.openAssessFromSelection = function(){
      const row = _getSingleSelectedRow();
      if (!row) return;
      self.assessData.id(row.id);
      self.assessData.decision(row.status === 'REJECTED' ? 'REJECT' : 'APPROVE');
      self.assessData.approvedAmount(row.approvedAmount != null ? row.approvedAmount : 0);
      self.assessData.reason(row.decisionReason || '');
      dlg('assessClaimDialog').open();
    };

    self.closeFromSelection = async function(){
      if (!self.isAdmin()) return;
      const rows = _getSelectedRows();
      if (!rows.length) return;

      const notClosable = rows.filter(r => !(r.status === 'APPROVED' || r.status === 'REJECTED'));
      if (notClosable.length) {
        show('warning','Close not allowed for selected item(s)','Only APPROVED or REJECTED claims can be closed.');
        return;
      }

      try {
        for (const r of rows) {
          try {
            await api.claims.close(r.id);
          } catch (e1) {
            console.warn('[Close] /close failed, trying PATCH status=CLOSED', r.id, e1.message || e1);
            await api.claims.update(r.id, { status: 'CLOSED' });
          }
        }
        _clearSelection();
        await self.loadClaims();
        show('confirmation','Selected claim(s) closed','');
      } catch (e) {
        show('error','Failed to close selected claim(s)', e.message || e);
      }
    };

    // ---------------- dialog open/close ----------------
    self.openNewClaimDialog  = function(){ self.newClaim.policyId(''); self.newClaim.description(''); self.newClaim.lossDate(''); dlg('newClaimDialog').open(); };
    self.closeNewClaimDialog = function(){ dlg('newClaimDialog').close(); };
    self.closeUpdateDialog   = function(){ dlg('updateClaimDialog').close(); };
    self.closeAssessDialog   = function(){ dlg('assessClaimDialog').close(); };

    // ---------------- submit handlers ----------------
    self.fileClaim = async function () {
      if (self.isAdmin()) return;
      const payload = {
        policyId: self.newClaim.policyId(),
        description: (self.newClaim.description() || '').trim(),
        lossDate: toIsoDate(self.newClaim.lossDate())
      };
      try {
        await api.claims.create(payload);
        dlg('newClaimDialog').close();
        self.loadClaims();
        show('confirmation','Claim filed','');
      } catch (e) {
        show('error','Failed to file claim', e.message || e);
      }
    };

    self.updateClaim = async function () {
      if (self.isAdmin()) return;
      const payload = {
        description: (self.selectedClaim.description() || '').trim(),
        lossDate: toIsoDate(self.selectedClaim.lossDate())
      };
      try {
        await api.claims.update(self.selectedClaim.id(), payload);
        dlg('updateClaimDialog').close();
        self.loadClaims();
        show('confirmation','Claim updated','');
      } catch (e) {
        show('error','Failed to update claim', e.message || e);
      }
    };

   self.assessClaim = async function () {
  if (!self.isAdmin() || self.isAssessing()) return;

  self.isAssessing(true);
  try {
    const decision = (self.assessData.decision() || '').trim(); // 'APPROVE' | 'REJECT'
    const reason   = (self.assessData.reason() || '').trim();
    const amtNum   = Number(self.assessData.approvedAmount() || 0);
    const amount   = isNaN(amtNum) ? 0 : amtNum;

    // Build candidate payloads the backend might accept.
    const variants = [];

    // V1: command style (most likely for your backend)
    const v1 = { decision, reason };
    if (decision === 'APPROVE') v1.approvedAmount = amount;
    variants.push(v1);

    // V2: status snapshot style
    const v2 = { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', decisionReason: reason };
    if (decision === 'APPROVE') v2.approvedAmount = amount;
    variants.push(v2);

    // V3: action + reason
    const v3 = { action: decision, reason };
    if (decision === 'APPROVE') v3.approvedAmount = amount;
    variants.push(v3);

    // V4/V5: alternate amount keys
    if (decision === 'APPROVE') {
      variants.push({ decision, reason, amount });
      variants.push({ decision, reason, payoutAmount: amount });
    } else {
      // When rejecting: most APIs don't want any amount field
      variants.push({ decision, reason });
    }

    let lastErr;
    for (const payload of variants) {
      try {
        console.log('[Assess] trying payload', JSON.parse(JSON.stringify(payload)));
        await api.claims.assess(self.assessData.id(), payload);
        dlg('assessClaimDialog').close();
        await self.loadClaims();
        show('confirmation', 'Assessment saved', '');
        return;
      } catch (e) {
        lastErr = e;
        console.warn('[Assess] variant failed:', e && (e.message || e));
      }
    }

    show('error', 'Failed to assess claim', lastErr && (lastErr.message || String(lastErr)));
  } finally {
    self.isAssessing(false);
  }
};


    // ---------------- lifecycle ----------------
    self.connected = function(){
      setTimeout(() => { self.loadPolicies(); self.loadClaims(); }, 200);
    };
  }

  return new ClaimsViewModel();
});
