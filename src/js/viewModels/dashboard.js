define([
  'knockout',
  '../services/apiService',
  '../services/auth',
  'ojs/ojchart',
  'ojs/ojknockout'
], function(ko, api, auth){
  function DashboardVM(){
    const self = this;

    self.isAdmin = ko.pureComputed(function(){ return auth.hasRole && auth.hasRole('ADMIN'); });

    // KPI tiles
    self.kpiActivePolicies = ko.observable(0);
    self.kpiOpenClaims = ko.observable(0);
    self.kpiPendingQuotes = ko.observable(0);
    self.kpiActiveProducts = ko.observable(0);

    // Charts data
    self.quotesFunnelSeries = ko.observableArray([]); // single series with groups DRAFT, PRICED, CONFIRMED
    self.quotesFunnelGroups = ko.observableArray(['DRAFT','PRICED','CONFIRMED']);

    self.claimsStatusSeries = ko.observableArray([]); // pie (donut-style) uses one series with groups
    self.claimsStatusGroups = ko.observableArray(['OPEN','APPROVED','REJECTED','CLOSED']);

    // Recent quotes
    self.recentQuotes = ko.observableArray([]);

    function loadKPIs(){
      return Promise.all([
        api.policies.getAll(null, 'ACTIVE').then(function(rows){ self.kpiActivePolicies((rows||[]).length); }),
        api.claims.getAll(null, 'OPEN').then(function(rows){ self.kpiOpenClaims((rows||[]).length); }),
        Promise.all([
          api.quotes.getAll(null, 'DRAFT'),
          api.quotes.getAll(null, 'PRICED')
        ]).then(function(res){
          const d = (res[0]||[]).length; const p = (res[1]||[]).length; self.kpiPendingQuotes(d+p);
        }),
        api.products.getAll(true).then(function(rows){ self.kpiActiveProducts((rows||[]).length); })
      ]);
    }

    function loadCharts(){
      return Promise.all([
        Promise.all([
          api.quotes.getAll(null, 'DRAFT'),
          api.quotes.getAll(null, 'PRICED'),
          api.quotes.getAll(null, 'CONFIRMED')
        ]).then(function(res){
          const data = [ (res[0]||[]).length, (res[1]||[]).length, (res[2]||[]).length ];
          self.quotesFunnelSeries([{ name: 'Quotes', items: data }]);
        }),
        Promise.all([
          api.claims.getAll(null, 'OPEN'),
          api.claims.getAll(null, 'APPROVED'),
          api.claims.getAll(null, 'REJECTED'),
          api.claims.getAll(null, 'CLOSED')
        ]).then(function(res){
          const counts = [
            (res[0]||[]).length,
            (res[1]||[]).length,
            (res[2]||[]).length,
            (res[3]||[]).length
          ];
          self.claimsStatusSeries([{ name: 'Claims', items: counts }]);
        })
      ]);
    }

    function loadRecentQuotes(){
      return api.quotes.getAll(null, null).then(function(rows){
        const data = (rows||[]).slice().sort(function(a,b){
          const da = a.createdAt || ''; const db = b.createdAt || '';
          return db.localeCompare(da);
        }).slice(0,10).map(function(q){
          return {
            id: q.id,
            customerName: ((q.customer&&q.customer.firstName)||'') + ' ' + ((q.customer&&q.customer.lastName)||''),
            productName: (q.product&&q.product.name)||'',
            status: q.status,
            premium: q.premiumCached || q.premium || null,
            createdAt: q.createdAt
          };
        });
        self.recentQuotes(data);
      });
    }

    self.connected = function(){
      if (!self.isAdmin()) return; // show nothing for non-admin
      loadKPIs().then(loadCharts).then(loadRecentQuotes).catch(function(){ /* ignore */ });
    };
  }

  return DashboardVM;
});
