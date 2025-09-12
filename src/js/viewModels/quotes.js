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

    // Observables
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

    self.editQuote = ko.observable({ id: null, customerId: null, productId: null, sumAssured: '', termMonths: '', status: '' });

    self.statuses = [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'PRICED', label: 'Priced' },
      { value: 'CONFIRMED', label: 'Confirmed' }
    ];

    // Providers
    self.quotesDP = new ArrayDataProvider(self.quotes, { keyAttributes: 'id' });
    self.customersDP = new ArrayDataProvider(self.customers, { keyAttributes: 'id' });
    self.productsDP = new ArrayDataProvider(self.products, { keyAttributes: 'id' });
    self.statusDP = new ArrayDataProvider(self.statuses, { keyAttributes: 'value' });

    self.showMessage = function(severity, detail){
      self.messages.push({ severity: severity, summary: severity.toUpperCase(), detail: detail, autoTimeout: 3500 });
    };

    self.selectedQuote = ko.pureComputed(function(){
      const row = self.selectedRow();
      if (!row || !row.rowKey) return null;
      return self.quotes().find(function(q){ return q.id === row.rowKey; }) || null;
    });

    self.selectedRow.subscribe(function(row){
      if (!self.isAdmin()) return; // Only admin can edit via dialog
      if (row && row.rowKey) {
        const quote = self.quotes().find(function(q){ return q.id === row.rowKey; });
        if (quote) {
          self.editQuote({ id: quote.id, customerId: quote.customer.id, productId: quote.product.id, sumAssured: quote.sumAssured, termMonths: quote.termMonths, status: quote.status });
          const dlg = document.getElementById('updateQuoteDialog');
          if (dlg && dlg.open) dlg.open();
        }
      }
    });

    // Loads
    self.loadQuotes = function(customerId, status){
      if (!self.isAdmin()) {
        const cid = self.userCustomerId();
        if (!cid) { self.quotes([]); return Promise.resolve([]); }
        return api.quotes.getAll(cid, null)
          .then(function(data){
            const mapped = (data || []).map(function(q){
              return Object.assign({}, q, {
                customer: Object.assign({}, q.customer, { fullName: (q.customer.firstName || '') + ' ' + (q.customer.lastName || ''), id: q.customer.id }),
                product: Object.assign({}, q.product, { name: (q.product.name || ''), id: q.product.id }),
                premiumCached: (q.premiumCached != null ? q.premiumCached : (q.premium || null)),
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
            return Object.assign({}, q, {
              customer: Object.assign({}, q.customer, { fullName: (q.customer.firstName || '') + ' ' + (q.customer.lastName || ''), id: q.customer.id }),
              product: Object.assign({}, q.product, { name: (q.product.name || ''), id: q.product.id }),
              premiumCached: (q.premiumCached != null ? q.premiumCached : (q.premium || null)),
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

    // Actions
    self.applyFilter = function(){
      if (!self.isAdmin()) return;
      if (self.filterCustomerId()) self.loadQuotes(self.filterCustomerId(), null);
      else if (self.filterStatus()) self.loadQuotes(null, self.filterStatus());
      else self.loadQuotes();
    };

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

    self.createQuote = function(){
      const body = {
        customerId: self.isAdmin() ? self.newQuote.customerId() : self.userCustomerId(),
        productId: self.newQuote.productId(),
        sumAssured: parseInt(self.newQuote.sumAssured() || 0, 10),
        termMonths: parseInt(self.newQuote.termMonths() || 0, 10),
        status: 'DRAFT'
      };
      api.quotes.create(body)
        .then(function(q){
          if (!self.isAdmin()) {
            // For USER, append created quote locally for visibility in this session
            const mapped = Object.assign({}, q, {
              customer: Object.assign({}, q.customer, { fullName: (q.customer.firstName || '') + ' ' + (q.customer.lastName || ''), id: q.customer.id }),
              product: Object.assign({}, q.product, { name: (q.product.name || ''), id: q.product.id }),
              premiumCached: (q.premiumCached != null ? q.premiumCached : (q.premium || null)),
              selected: ko.observable(false)
            });
            self.quotes([mapped]);
          } else {
            self.loadQuotes();
          }
        })
        .then(function(){
          const dlg = document.getElementById('createQuoteDialog'); if (dlg) dlg.close();
          self.showMessage('confirmation','Quote created successfully');
          self.newQuote.customerId(null); self.newQuote.productId(null); self.newQuote.sumAssured(''); self.newQuote.termMonths('');
        })
        .catch(function(err){ self.showMessage('error','Failed to create quote: ' + (err.message || err)); });
    };

    self.deleteSelected = function(){
      const q = self.selectedQuote();
      if (!q) return self.showMessage('error','Please select a quote to delete');
      self.showMessage('error','Delete API not implemented');
    };

    // Init
    Promise.all([ self.loadCustomers(), self.loadProducts() ]).then(function(){ self.loadQuotes(); });
  }

  return QuotesViewModel;
});
