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
  'ojs/ojdatetimepicker',
  'ojs/ojpagingcontrol',
  'ojs/ojinputsearch'
], function (ko, ArrayDataProvider, PagingDataProviderView, apiService, auth) {
  function CustomersViewModel() {
    const self = this;

    self.isAdmin = ko.pureComputed(function(){ return auth.hasRole && auth.hasRole('ADMIN'); });

    self.customers = ko.observableArray([]);
    self.allCustomers = [];
    self.searchQuery = ko.observable('');
    self.selectedCustomer = ko.observable();

    self.customerDataProvider = new PagingDataProviderView(
      new ArrayDataProvider(self.customers, { keyAttributes: 'id' })
    );

    self.dialogCustomer = ko.observable({
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dob: ''
    });

    self.isAddMode = ko.observable(false);
    self.isEditMode = ko.pureComputed(function(){ return !self.isAddMode(); });

    self.loadCustomers = async function () {
      try {
        self.selectedCustomer(null);
        if (!self.isAdmin()) {
          // For USER, show only their linked customer
          const u = auth.user && auth.user();
          const cid = u && u.customerId;
          if (!cid) {
            self.customers([]);
            self.allCustomers = [];
            return;
          }
          const c = await apiService.customers.get(cid);
          const one = [{
            id: c.id,
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || '',
            phone: c.phone || '',
            dob: c.dob || ''
          }];
          self.customers(one);
          self.allCustomers = one;
          // Auto-open edit for convenience
          self.isAddMode(false);
          self.dialogCustomer(Object.assign({}, one[0]));
          const dlg = document.getElementById('customerDialog');
          if (dlg && dlg.open) dlg.open();
          return;
        } else {
          const data = await apiService.customers.getAll();
          const sanitized = (data || []).map(function(c){
            return {
              id: c.id,
              firstName: c.firstName || '',
              lastName: c.lastName || '',
              email: c.email || '',
              phone: c.phone || '',
              dob: c.dob || ''
            };
          });
          self.customers(sanitized);
          self.allCustomers = sanitized;
        }
      } catch (e) {
        // keep table empty on error
        self.customers([]);
        self.allCustomers = [];
        // eslint-disable-next-line no-console
        console.error('Error loading customers', e);
      }
    };

    self.applySearch = function () {
      const query = (self.searchQuery() || '').toLowerCase();
      if (!query) {
        self.customers(self.allCustomers);
        return;
      }
      const filtered = self.allCustomers.filter(function(c){
        return ((c.firstName + ' ' + c.lastName).toLowerCase().includes(query) ||
                (c.email || '').toLowerCase().includes(query));
      });
      self.customers(filtered);
    };

    self.addCustomer = function () {
      if (!self.isAdmin()) return;
      self.isAddMode(true);
      self.dialogCustomer({ id: null, firstName: '', lastName: '', email: '', phone: '', dob: '' });
      document.getElementById('customerDialog').open();
    };

    self.selectedCustomer.subscribe(function(row){
      if (row && row.rowKey) {
        const cust = self.customers().find(function(c){ return c.id === row.rowKey; });
        if (cust) {
          self.isAddMode(false);
          self.dialogCustomer(Object.assign({}, cust));
          document.getElementById('customerDialog').open();
        }
      }
    });

    self.saveCustomer = async function () {
      const cust = self.dialogCustomer();
      try {
        if (self.isAddMode()) {
          await apiService.customers.create(cust);
        } else {
          await apiService.customers.update(cust.id, cust);
        }
        await self.loadCustomers();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error saving customer:', err);
      }
      self.closeDialog();
    };

    self.deleteCustomer = async function () {
      const cust = self.dialogCustomer();
      if (!cust || !cust.id) return;
      if (!self.isAdmin()) return; // Only admin can delete
      try {
        await apiService.customers.remove(cust.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error deleting customer:', err);
      }
      self.selectedCustomer(null);
      self.closeDialog();
      self.loadCustomers();
    };

    self.closeDialog = function () {
      const dlg = document.getElementById('customerDialog');
      if (dlg && dlg.close) dlg.close();
      self.selectedCustomer(null);
    };

    self.exportCSV = function () {
      const rows = self.customers();
      if (!rows.length) return;
      const header = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'DOB'];
      const csvContent = [
        header.join(','),
        ...rows.map(function(r){
          return [r.id, r.firstName, r.lastName, r.email, r.phone, r.dob]
            .map(function(v){ return '"' + (v || '') + '"'; }).join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', 'customers.csv');
      a.click();
      URL.revokeObjectURL(url);
    };

    self.connected = function(){ self.loadCustomers(); };
  }

  return CustomersViewModel;
});
