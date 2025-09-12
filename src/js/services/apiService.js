define(['./http', './config'], function(http, config) {
  const base = config.base.core;
  const payBase = config.base.payment;

  async function getJson(resp) {
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error('API error ' + resp.status + ' ' + text);
    }
    return resp.json();
  }

  const customers = {
    async getAll() {
      const resp = await http.request(base + '/customers');
      return getJson(resp);
    },
    async get(id) {
      const resp = await http.request(base + '/customers/' + encodeURIComponent(id));
      return getJson(resp);
    },
    async create(payload) {
      const resp = await http.request(base + '/customers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async update(id, payload) {
      const resp = await http.request(base + '/customers/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async remove(id) {
      const resp = await http.request(base + '/customers/' + encodeURIComponent(id), {
        method: 'DELETE'
      });
      if (!resp.ok) throw new Error('Delete failed ' + resp.status);
      return true;
    }
  };

  const products = {
    async getAll(activeOnly) {
      const url = activeOnly ? (base + '/products?active=true') : (base + '/products');
      const resp = await http.request(url);
      return getJson(resp);
    },
    async get(id) {
      const resp = await http.request(base + '/products/' + encodeURIComponent(id));
      return getJson(resp);
    },
    async create(payload) {
      const resp = await http.request(base + '/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async update(id, payload) {
      const resp = await http.request(base + '/products/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async remove(id) {
      const resp = await http.request(base + '/products/' + encodeURIComponent(id), {
        method: 'DELETE'
      });
      if (!resp.ok) throw new Error('Delete failed ' + resp.status);
      return true;
    }
  };

  const quotes = {
    async getAll(customerId, status) {
      let url = base + '/quotes';
      const params = [];
      if (customerId) params.push('customer_id=' + encodeURIComponent(customerId));
      if (status) params.push('status=' + encodeURIComponent(status));
      if (params.length) url += '?' + params.join('&');
      const resp = await http.request(url);
      return getJson(resp);
    },
    async create(payload) {
      const resp = await http.request(base + '/quotes', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async update(id, payload) {
      const resp = await http.request(base + '/quotes/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async price(id) {
      const resp = await http.request(base + '/quotes/' + encodeURIComponent(id) + '/price', { method: 'POST' });
      return getJson(resp);
    },
    async confirm(id) {
      const resp = await http.request(base + '/quotes/' + encodeURIComponent(id) + '/confirm', { method: 'POST' });
      return getJson(resp);
    }
    // Note: no delete endpoint in backend; omit remove()
  };

  const policies = {
    async getAll(customerId, status) {
      let url = base + '/policies';
      const params = [];
      if (customerId) params.push('customer_id=' + encodeURIComponent(customerId));
      if (status) params.push('status=' + encodeURIComponent(status));
      if (params.length) url += '?' + params.join('&');
      const resp = await http.request(url);
      return getJson(resp);
    },
    async get(id) {
      const resp = await http.request(base + '/policies/' + encodeURIComponent(id));
      return getJson(resp);
    }
  };

  const claims = {
    async getAll(policyId, status) {
      let url = base + '/claims';
      const params = [];
      if (policyId) params.push('policy_id=' + encodeURIComponent(policyId));
      if (status) params.push('status=' + encodeURIComponent(status));
      if (params.length) url += '?' + params.join('&');
      const resp = await http.request(url);
      return getJson(resp);
    },
    async create(payload) {
      const resp = await http.request(base + '/claims', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async update(id, payload) {
      const resp = await http.request(base + '/claims/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async assess(id, payload) {
      const resp = await http.request(base + '/claims/' + encodeURIComponent(id) + '/assess', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async close(id) {
      const resp = await http.request(base + '/claims/' + encodeURIComponent(id) + '/close', { method: 'POST' });
      return getJson(resp);
    }
  };

  const payments = {
    async list(targetType, targetId) {
      let url = payBase + '/payments?targetType=' + encodeURIComponent(targetType) + '&targetId=' + encodeURIComponent(targetId);
      const resp = await http.request(url);
      return getJson(resp);
    },
    async create(payload) {
      const resp = await http.request(payBase + '/payments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return getJson(resp);
    },
    async get(id) {
      const resp = await http.request(payBase + '/payments/' + encodeURIComponent(id));
      return getJson(resp);
    }
  };

  return { customers, products, quotes, policies, claims, payments };
});
