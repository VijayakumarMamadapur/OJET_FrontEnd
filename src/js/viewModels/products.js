define([
  'knockout',
  'ojs/ojarraydataprovider',
  'ojs/ojpagingdataproviderview',
  '../services/apiService',
  '../services/auth',
  'ojs/ojknockout',
  'ojs/ojtable',
  'ojs/ojbutton',
  'ojs/ojdialog',
  'ojs/ojformlayout',
  'ojs/ojinputtext',
  'ojs/ojinputnumber',
  'ojs/ojpagingcontrol',
  'ojs/ojinputsearch',
  'ojs/ojswitch'
], function (ko, ArrayDataProvider, PagingDataProviderView, apiService, auth) {
  function ProductsViewModel() {
    const self = this;

    self.isAdmin = ko.pureComputed(function(){ return auth.hasRole && auth.hasRole('ADMIN'); });

    self.products = ko.observableArray([]);
    self.allProducts = [];
    self.searchQuery = ko.observable('');
    self.selectedProduct = ko.observable();
    self.showActiveOnly = ko.observable(true);

    self.productDataProvider = new PagingDataProviderView(
      new ArrayDataProvider(self.products, { keyAttributes: 'id' })
    );

    self.dialogProduct = ko.observable({
      id: null,
      name: '',
      code: '',
      description: '',
      baseRatePer1000: 0,
      minSumAssured: 0,
      maxSumAssured: 0,
      minTermMonths: 0,
      maxTermMonths: 0,
      active: true
    });

    self.isAddMode = ko.observable(false);
    self.isEditMode = ko.pureComputed(function(){ return !self.isAddMode(); });

    self.loadProducts = async function (activeOnly) {
      try {
        const useActiveOnly = (typeof activeOnly === 'boolean') ? activeOnly : !!self.showActiveOnly();
        const data = await apiService.products.getAll(useActiveOnly);
        const sanitized = (data || []).map(function(p){
          return {
            id: p.id,
            name: p.name || '',
            code: p.code || '',
            description: p.description || '',
            baseRatePer1000: Number(p.baseRatePer1000) || 0,
            minSumAssured: Number(p.minSumAssured) || 0,
            maxSumAssured: Number(p.maxSumAssured) || 0,
            minTermMonths: Number(p.minTermMonths) || 0,
            maxTermMonths: Number(p.maxTermMonths) || 0,
            active: (p.active === true || p.active === 'true' || p.active === 1)
          };
        });
        self.products(sanitized);
        self.allProducts = sanitized;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error loading products', e);
      }
    };

    self.showActiveOnly.subscribe(function(){ self.loadProducts(); });

    self.applySearch = function () {
      const query = (self.searchQuery() || '').toLowerCase();
      if (!query) { self.products(self.allProducts); return; }
      const filtered = self.allProducts.filter(function(p){
        return (p.name + ' ' + p.code).toLowerCase().includes(query);
      });
      self.products(filtered);
    };

    self.addProduct = function () {
      if (!self.isAdmin()) return;
      self.isAddMode(true);
      self.dialogProduct({
        id: null,
        name: '',
        code: '',
        description: '',
        baseRatePer1000: 0,
        minSumAssured: 0,
        maxSumAssured: 0,
        minTermMonths: 0,
        maxTermMonths: 0,
        active: true
      });
      const dlg = document.getElementById('productDialog');
      if (dlg && dlg.open) dlg.open();
    };

    self.selectedProduct.subscribe(function(row){
      if (!self.isAdmin()) return; // Users cannot open edit dialog
      if (row && row.rowKey) {
        const prod = self.products().find(function(p){ return p.id === row.rowKey; });
        if (prod) {
          self.isAddMode(false);
          self.dialogProduct(Object.assign({}, prod));
          const dlg = document.getElementById('productDialog');
          if (dlg && dlg.open) dlg.open();
        }
      }
    });

    self.saveProduct = async function () {
      if (!self.isAdmin()) return; // Users cannot save
      const prod = self.dialogProduct();
      try {
        if (self.isAddMode()) {
          await apiService.products.create(prod);
        } else {
          await apiService.products.update(prod.id, prod);
        }
        self.selectedProduct(null);
        await self.loadProducts();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error saving product:', err);
      }
      self.closeDialog();
    };

    self.deleteProduct = async function () {
      const prod = self.dialogProduct();
      if (!prod || !prod.id) return;
      if (!self.isAdmin()) return;
      try {
        await apiService.products.remove(prod.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error deleting product:', err);
      }
      self.selectedProduct(null);
      self.closeDialog();
      self.loadProducts();
    };

    self.closeDialog = function () {
      const dlg = document.getElementById('productDialog');
      if (dlg && dlg.close) dlg.close();
      self.selectedProduct(null);
    };

    self.exportCSV = function () {
      const rows = self.products();
      if (!rows.length) return;
      const header = ['ID','Name','Code','Description','BaseRatePer1000','MinSumAssured','MaxSumAssured','MinTermMonths','MaxTermMonths','Active'];
      const csvContent = [
        header.join(','),
        ...rows.map(function(r){
          return [r.id,r.name,r.code,r.description,r.baseRatePer1000,r.minSumAssured,r.maxSumAssured,r.minTermMonths,r.maxTermMonths,(r.active ? 'Yes':'No')]
            .map(function(v){ return '"' + (v || '') + '"'; }).join(',');
        })
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', 'products.csv');
      a.click();
      URL.revokeObjectURL(url);
    };

    self.connected = function(){ self.loadProducts(); };
  }

  return ProductsViewModel;
});
