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

  function QuotesViewModel() {
    const self = this;

    self.isAdmin = ko.pureComputed(function(){ return auth.hasRole && auth.hasRole('ADMIN'); });
    self.userCustomerId = ko.pureComputed(function(){ var u = auth.user && auth.user(); return u && u.customerId; });

    // ---------------- Observables ----------------
    self.quotes = ko.observableArray([]);
    self.customers = ko.observableArray([]);
    self.products = ko.observableArray([]);
    self.messages = ko.observableArray([]);

    self.selectedRow = ko.observable(null);

    self.filterCustomerId = ko.observable();
    self.filterStatus = ko.observable();

    self.newQuote = {
      customerId: ko.observable(null),
      productId: ko.observable(null),
      sumAssured: ko.observable(''),
      termMonths: ko.observable('')
    };

    self.editQuote = ko.observable({
      id: null,
      customerId: null,
      productId: null,
      sumAssured: '',
      termMonths: '',
      status: ''
    });

    self.statuses = [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'PRICED', label: 'Priced' },
      { value: 'CONFIRMED', label: 'Confirmed' }
    ];

    // ---------------- Data Providers ----------------
    self.quotesDP = new ArrayDataProvider(self.quotes, { keyAttributes: 'id' });
    self.customersDP = new ArrayDataProvider(self.customers, { keyAttributes: 'id' });
    self.productsDP = new ArrayDataProvider(self.products, { keyAttributes: 'id' });
    self.statusDP = new ArrayDataProvider(self.statuses, { keyAttributes: 'value' });
    // Table columns (header + field mapping)
    self.columns = [
      { headerText: 'Select', template: 'selectTpl' },
      { headerText: 'ID', field: 'id' },
      { headerText: 'Customer', field: 'customer.fullName' },
      { headerText: 'Product', field: 'product.name' },
      { headerText: 'Sum Assured', field: 'sumAssured' },
      { headerText: 'Term (Months)', field: 'termMonths' },
      { headerText: 'Premium', field: 'premiumCached' },
      { headerText: 'Status', field: 'status' }
    ];

    // ---------------- Message Helper ----------------
    self.showMessage = function(severity, detail){
      self.messages.push({ severity: severity, summary: severity.toUpperCase(), detail: detail, autoTimeout: 3500 });
    };

    // ---------------- Selected Quote Helper ----------------
    self.selectedQuote = ko.pureComputed(function(){
      const row = self.selectedRow();
      if (!row || !row.rowKey) return null;
      return self.quotes().find(function(q){ return q.id === row.rowKey; }) || null;
    });

    // Do not auto-open edit dialog on row selection to avoid conflicts
    // with checkbox-based bulk actions. Use explicit Edit button instead.
    self.selectedRow.subscribe(function(){ /* no-op */ });

    // ---------------- Load Data ----------------
    self.loadQuotes = function(customerId, status){
      if (!self.isAdmin()) {
        // Let backend scope to current user's customerId
        return api.quotes.getAll(null, null)
          .then(function(data){
            const mapped = (data || []).map(function(q){
              const cust = q && q.customer ? q.customer : {};
              const prod = q && q.product ? q.product : {};
              return Object.assign({}, q, {
                customer: Object.assign({}, cust, { fullName: ((cust.firstName || '') + ' ' + (cust.lastName || '')).trim(), id: cust.id }),
                product: Object.assign({}, prod, { name: (prod.name || ''), id: prod.id }),
                premiumCached: (q && q.premiumCached != null ? q.premiumCached : (q && q.premium || null)),
                selected: ko.observable(false)
              });
            });
            self.quotes(mapped);
            return mapped;
          })
          .catch(function(err){ self.showMessage('error', 'Failed to load quotes: ' + (err.message || err)); });
      }
      return api.quotes.getAll(customerId || null, status || null)
        .then(function(data){
          const mapped = (data || []).map(function(q){
            const cust = q && q.customer ? q.customer : {};
            const prod = q && q.product ? q.product : {};
            return Object.assign({}, q, {
              customer: Object.assign({}, cust, { fullName: ((cust.firstName || '') + ' ' + (cust.lastName || '')).trim(), id: cust.id }),
              product: Object.assign({}, prod, { name: (prod.name || ''), id: prod.id }),
              premiumCached: (q && q.premiumCached != null ? q.premiumCached : (q && q.premium || null)),
              selected: ko.observable(false)
            });
          });
          self.quotes(mapped);
          return mapped;
        })
        .catch(function(err){ self.showMessage('error', 'Failed to load quotes: ' + (err.message || err)); });
    };

    self.loadCustomers = function(){
      if (self.isAdmin()) {
        return api.customers.getAll().then(function(data){
          const mapped = (data || []).map(function(c){ return Object.assign({}, c, { fullName: (c.firstName || '') + ' ' + (c.lastName || ''), id: c.id }); });
          self.customers(mapped);
        });
      } else {
        const cid = self.userCustomerId();
        if (!cid) { self.customers([]); return Promise.resolve([]); }
        return api.customers.get(cid).then(function(c){
          const one = [{ id: c.id, firstName: c.firstName, lastName: c.lastName, fullName: (c.firstName || '') + ' ' + (c.lastName || '') }];
          self.customers(one);
        });
      }
    };

    self.loadProducts = function(){ return api.products.getAll(true).then(function(data){ self.products(data || []); }); };

    // ---------------- Filter Action ----------------
    self.applyFilter = function(){
      if (!self.isAdmin()) return;
      if (self.filterCustomerId()) self.loadQuotes(self.filterCustomerId(), null);
      else if (self.filterStatus()) self.loadQuotes(null, self.filterStatus());
      else self.loadQuotes();
    };

    // ---------------- Row Actions ----------------
    self.getCheckedRows = function(){ return self.quotes().filter(function(q){ return q.selected(); }); };

    self.priceCheckedRows = function(){
      if (!self.isAdmin()) { self.showMessage('error','Admin only'); return; }
      const rows = self.getCheckedRows();
      if (!rows.length) { self.showMessage('error','Select at least one quote'); return; }
      rows.forEach(function(row){ self.priceRow(row); });
    };

    self.confirmCheckedRows = async function(){
      if (!self.isAdmin()) { self.showMessage('error','Admin only'); return; }
      const rows = self.getCheckedRows();
      if (!rows.length) { self.showMessage('error','Select at least one quote'); return; }
      for (let row of rows) await self.confirmRow(row);
    };

    // Admin: open edit dialog for exactly one checked row
    self.editSelectedQuote = function(){
      if (!self.isAdmin()) { self.showMessage('error','Admin only'); return; }
      const rows = self.getCheckedRows();
      if (rows.length !== 1) { self.showMessage('error','Select exactly one quote to edit'); return; }
      const quote = rows[0];
      self.editQuote({
        id: quote.id,
        customerId: quote.customer && quote.customer.id,
        productId: quote.product && quote.product.id,
        sumAssured: quote.sumAssured,
        termMonths: quote.termMonths,
        status: quote.status
      });
      const dlg = document.getElementById('updateQuoteDialog');
      if (dlg) dlg.open();
    };

    self.priceRow = async function(quote){
      if (!self.isAdmin()) return self.showMessage('error','Admin only');
      if (!quote || !quote.id) return self.showMessage('error','Invalid quote for pricing');
      try { await api.quotes.price(quote.id); await self.loadQuotes(); self.showMessage('confirmation','Quote priced'); }
      catch(err){ self.showMessage('error','Failed to price quote: ' + (err.message || err)); }
    };

    self.confirmRow = async function(quote){
      if (!self.isAdmin()) return self.showMessage('error','Admin only');
      if (!quote || !quote.id) return self.showMessage('error','Invalid quote for confirmation');
      try { await api.quotes.confirm(quote.id); await self.loadQuotes(); self.showMessage('confirmation','Quote confirmed'); }
      catch(err){ self.showMessage('error','Failed to confirm quote: ' + (err.message || err)); }
    };

    // Admin updates sum/term (PATCH) which resets status to DRAFT on backend
    self.updateSelectedQuote = async function(){
      if (!self.isAdmin()) return;
      const q = self.editQuote();
      if (!q || !q.id) { self.showMessage('error','No quote selected'); return; }
      const payload = {
        sumAssured: q.sumAssured != null && q.sumAssured !== '' ? parseInt(q.sumAssured, 10) : null,
        termMonths: q.termMonths != null && q.termMonths !== '' ? parseInt(q.termMonths, 10) : null
      };
      try {
        await api.quotes.update(q.id, payload);
        const dlg = document.getElementById('updateQuoteDialog');
        if (dlg) dlg.close();
        await self.loadQuotes();
        self.showMessage('confirmation','Quote updated (status reset to DRAFT)');
      } catch (err) {
        self.showMessage('error','Failed to update quote: ' + (err.message || err));
      }
    };

    self.createQuote = function(){
      const body = {
        customerId: self.isAdmin() ? self.newQuote.customerId() : self.userCustomerId(),
        productId: self.newQuote.productId(),
        sumAssured: parseInt(self.newQuote.sumAssured() || 0, 10),
        termMonths: parseInt(self.newQuote.termMonths() || 0, 10),
        status: 'DRAFT'
      };
      api.quotes.create(body)
        .then(function(){ return self.loadQuotes(); })
        .then(function(){
          const dlg = document.getElementById('createQuoteDialog'); if (dlg) dlg.close();
          self.showMessage('confirmation','Quote created successfully');
          self.newQuote.customerId(null); self.newQuote.productId(null); self.newQuote.sumAssured(''); self.newQuote.termMonths('');
        })
        .catch(function(err){ self.showMessage('error','Failed to create quote: ' + (err.message || err)); });
    };

    self.deleteSelected = function(){
      if (!self.isAdmin()) { self.showMessage('error','Admin only'); return; }
      const q = self.selectedQuote();
      if (!q) return self.showMessage('error','Please select a quote to delete');
      api.quotes.remove(q.id)
        .then(function(){ return self.loadQuotes(); })
        .then(function(){ self.showMessage('confirmation','Quote deleted'); })
        .catch(function(err){ self.showMessage('error','Failed to delete quote: ' + (err.message || err)); });
    };

    // User acknowledges payment (sets pricingSource='ACK') prior to admin confirm
    self.ackSelectedPayment = function(){
      if (self.isAdmin()) return;
      const q = self.selectedQuote();
      if (!q) { self.showMessage('error','Select a PRICED quote'); return; }
      if (q.status !== 'PRICED') { self.showMessage('error','Only PRICED quotes can be acknowledged'); return; }
      if (q.pricingSource === 'ACK') { self.showMessage('confirmation','Already acknowledged'); return; }
      api.quotes.ackPayment(q.id)
        .then(function(){ return self.loadQuotes(); })
        .then(function(){ self.showMessage('confirmation','Payment acknowledged'); })
        .catch(function(err){ self.showMessage('error','Failed to acknowledge: ' + (err.message || err)); });
    };

    // ---------------- Init ----------------
    Promise.all([ self.loadCustomers(), self.loadProducts(), self.loadQuotes() ]);
  }

  return QuotesViewModel;
});
