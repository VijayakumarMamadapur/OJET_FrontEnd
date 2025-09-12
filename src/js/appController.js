/**
 * @license
 * Copyright (c) 2014, 2025, Oracle and/or its affiliates.
 * Licensed under The Universal Permissive License (UPL), Version 1.0
 * as shown at https://oss.oracle.com/licenses/upl/
 * @ignore
 */
/*
 * Your application specific code will go here
 */
define(['knockout', 'ojs/ojcontext', 'ojs/ojmodule-element-utils', 'ojs/ojknockouttemplateutils', 'ojs/ojcorerouter', 'ojs/ojmodulerouter-adapter', 'ojs/ojknockoutrouteradapter', 'ojs/ojurlparamadapter', 'ojs/ojresponsiveutils', 'ojs/ojresponsiveknockoututils', 'ojs/ojarraydataprovider',
        './services/auth',
        'ojs/ojdrawerpopup', 'ojs/ojmodule-element', 'ojs/ojknockout'],
  function(ko, Context, moduleUtils, KnockoutTemplateUtils, CoreRouter, ModuleRouterAdapter, KnockoutRouterAdapter, UrlParamAdapter, ResponsiveUtils, ResponsiveKnockoutUtils, ArrayDataProvider, auth) {

     function ControllerViewModel() {

      this.KnockoutTemplateUtils = KnockoutTemplateUtils;

      // Handle announcements sent when pages change, for Accessibility.
      this.manner = ko.observable('polite');
      this.message = ko.observable();
      announcementHandler = (event) => {
          this.message(event.detail.message);
          this.manner(event.detail.manner);
      };

      document.getElementById('globalBody').addEventListener('announce', announcementHandler, false);


      // Media queries for responsive layouts
      const smQuery = ResponsiveUtils.getFrameworkQuery(ResponsiveUtils.FRAMEWORK_QUERY_KEY.SM_ONLY);
      this.smScreen = ResponsiveKnockoutUtils.createMediaQueryObservable(smQuery);
      const mdQuery = ResponsiveUtils.getFrameworkQuery(ResponsiveUtils.FRAMEWORK_QUERY_KEY.MD_UP);
      this.mdScreen = ResponsiveKnockoutUtils.createMediaQueryObservable(mdQuery);

      let navData = [
        { path: '', redirect: 'login' },
        { path: 'login', detail: { label: 'Login', iconClass: 'oj-ux-ico-lock' }, public: true },
        { path: 'dashboard', detail: { label: 'Dashboard', iconClass: 'oj-ux-ico-bar-chart' } },
        { path: 'profile', detail: { label: 'My Profile', iconClass: 'oj-ux-ico-contact' }, roles: ['USER'] },
        { path: 'customers', detail: { label: 'Customers', iconClass: 'oj-ux-ico-contact-group' }, roles: ['ADMIN'] },
        { path: 'products', detail: { label: 'Products', iconClass: 'oj-ux-ico-catalog' }, roles: ['ADMIN','USER'] },
        { path: 'quotes', detail: { label: 'Quotes', iconClass: 'oj-ux-ico-list' }, roles: ['ADMIN','USER'] },
        { path: 'policies', detail: { label: 'Policies', iconClass: 'oj-ux-ico-shield' }, roles: ['ADMIN','USER'] },
        { path: 'claims', detail: { label: 'Claims', iconClass: 'oj-ux-ico-clipboard' }, roles: ['ADMIN','USER'] },
        { path: 'payments', detail: { label: 'Payments', iconClass: 'oj-ux-ico-cash' }, roles: ['ADMIN','USER'] },
        { path: 'about', detail: { label: 'About', iconClass: 'oj-ux-ico-information-s' } }
      ];

      // Router setup
      let router = new CoreRouter(navData, {
        urlAdapter: new UrlParamAdapter()
      });
      // expose for redirects in services (e.g., on 401)
      window.appRouter = router;

      router.sync();

      // If not authenticated, force login when app starts
      auth.loadFromStorage();
      if (!auth.isAuthenticated()) {
        router.go({ path: 'login' });
      }

      this.moduleAdapter = new ModuleRouterAdapter(router);

      this.selection = new KnockoutRouterAdapter(router);

      // Hide header/nav/footer chrome on login and when not authenticated
      this.showChrome = ko.pureComputed(function(){
        const isAuthed = (auth && auth.isAuthenticated && auth.isAuthenticated());
        const cur = this.selection.path ? this.selection.path() : '';
        return isAuthed && cur !== 'login';
      }.bind(this));

      // Setup nav provider filtered by auth roles and auth state
      const filterByRole = function(items){
        const u = auth.user && auth.user();
        const isAuthed = !!u;
        return items.filter(function(r){
          if (!r.path) return false; // skip redirect
          if (!isAuthed && !r.public) return false; // show only public when not authed
          if (r.path === 'login' && isAuthed) return false; // hide login when authed
          if (r.roles && r.roles.length) {
            return r.roles.some(function(role){ return auth.hasRole(role); });
          }
          return true;
        });
      };

      this.navDataProvider = ko.pureComputed(function(){
        return new ArrayDataProvider(filterByRole(navData), {keyAttributes: 'path'});
      });

      // Drawer
      self.sideDrawerOn = ko.observable(false);

      // Close drawer on medium and larger screens
      this.mdScreen.subscribe(() => { self.sideDrawerOn(false) });

      // Called by navigation drawer toggle button and after selection of nav drawer item
      this.toggleDrawer = () => {
        self.sideDrawerOn(!self.sideDrawerOn());
      }

      // Header
      // Application Name used in Branding Area
      this.appName = ko.observable("App Name");
      // User Info used in Global Navigation area
      this.userLogin = ko.pureComputed(function(){
        const u = auth.user && auth.user();
        return u && u.username ? u.username : 'Guest';
      });

      // Sign out handler (menu item wired in your UI as needed)
      this.signOut = function() {
        auth.logout();
        router.go({ path: 'login' });
      };

      // Menu action handler (bind in index.html)
      this.handleMenuAction = function(event){
        let value = event && event.detail && (event.detail.value || event.detail.selectedValue);
        if (!value && event && event.detail && event.detail.originalEvent) {
          try {
            const el = event.detail.originalEvent.target.closest('oj-option');
            if (el) value = el.getAttribute('value');
          } catch(e) {}
        }
        if (value === 'out') this.signOut();
      }.bind(this);

      // Guard: prevent navigation to any route except login when not authenticated
      if (this.selection && this.selection.path) {
        this.selection.path.subscribe(function(newPath){
          if (!auth.isAuthenticated() && newPath !== 'login') {
            router.go({ path: 'login' });
            return;
          }
          // Prevent admins from accessing user-only routes like profile
          if (newPath === 'profile' && auth.hasRole && auth.hasRole('ADMIN')) {
            router.go({ path: 'dashboard' });
          }
        });
      }

      // Footer
      this.footerLinks = [
        {name: 'About Oracle', linkId: 'aboutOracle', linkTarget:'http://www.oracle.com/us/corporate/index.html#menu-about'},
        { name: "Contact Us", id: "contactUs", linkTarget: "http://www.oracle.com/us/corporate/contact/index.html" },
        { name: "Legal Notices", id: "legalNotices", linkTarget: "http://www.oracle.com/us/legal/index.html" },
        { name: "Terms Of Use", id: "termsOfUse", linkTarget: "http://www.oracle.com/us/legal/terms/index.html" },
        { name: "Your Privacy Rights", id: "yourPrivacyRights", linkTarget: "http://www.oracle.com/us/legal/privacy/index.html" },
      ];
     }
     // release the application bootstrap busy state
     Context.getPageContext().getBusyContext().applicationBootstrapComplete();

     return new ControllerViewModel();
  }
);
