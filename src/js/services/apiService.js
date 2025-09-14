define(['./http', './config'], function (http, config) {
  const base = config.base.core;
  const payBase = config.base.payment;

  // --- helpers ---
  async function getJson(resp) {
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error('API error ' + resp.status + (text ? ' ' + text : ''));
  }
  // tolerate 204 or empty body
  const text = await resp.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    return text; // if server returns plain text
  }
}


  // JSON request wrapper: auto-sets headers unless body is FormData/Blob
  function jsonRequest(url, options = {}) {
    const opts = { method: 'GET', ...options };
    const isJsonBody = opts.body && !(opts.body instanceof FormData) && !(opts.body instanceof Blob);
    opts.headers = {
      'Accept': 'application/json',
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };
    return http.request(url, opts);
  }

  const customers = {
    async getAll() {
      return getJson(await jsonRequest(base + '/customers'));
    },
    async get(id) {
      return getJson(await jsonRequest(base + '/customers/' + encodeURIComponent(id)));
    },
    async create(payload) {
      return getJson(await jsonRequest(base + '/customers', {
        method: 'POST',
        body: JSON.stringify(payload)
      }));
    },
    async update(id, payload) {
      return getJson(await jsonRequest(base + '/customers/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }));
    },
    async remove(id) {
      const resp = await jsonRequest(base + '/customers/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed ' + resp.status);
      return true;
    }
  };

  const products = {
    async getAll(activeOnly) {
      const url = activeOnly ? (base + '/products?active=true') : (base + '/products');
      return getJson(await jsonRequest(url));
    },
    async get(id) {
      return getJson(await jsonRequest(base + '/products/' + encodeURIComponent(id)));
    },
    async create(payload) {
      return getJson(await jsonRequest(base + '/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      }));
    },
    async update(id, payload) {
      return getJson(await jsonRequest(base + '/products/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }));
    },
    async remove(id) {
      const resp = await jsonRequest(base + '/products/' + encodeURIComponent(id), { method: 'DELETE' });
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
      return getJson(await jsonRequest(url));
    },
    async create(payload) {
      return getJson(await jsonRequest(base + '/quotes', {
        method: 'POST',
        body: JSON.stringify(payload)
      }));
    },
    async update(id, payload) {
      return getJson(await jsonRequest(base + '/quotes/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }));
    },
    async price(id) {
      return getJson(await jsonRequest(base + '/quotes/' + encodeURIComponent(id) + '/price', { method: 'POST' }));
    },
    async confirm(id) {
      return getJson(await jsonRequest(base + '/quotes/' + encodeURIComponent(id) + '/confirm', { method: 'POST' }));
    },
    async ackPayment(id) {
      return getJson(await jsonRequest(base + '/quotes/' + encodeURIComponent(id) + '/ack-payment', { method: 'POST' }));
    },
    async remove(id) {
      const resp = await jsonRequest(base + '/quotes/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed ' + resp.status);
      return true;
    }
  };

  const policies = {
    async getAll(customerId, status) {
      let url = base + '/policies';
      const params = [];
      if (customerId) params.push('customer_id=' + encodeURIComponent(customerId));
      if (status) params.push('status=' + encodeURIComponent(status));
      if (params.length) url += '?' + params.join('&');
      return getJson(await jsonRequest(url));
    },
    async get(id) {
      return getJson(await jsonRequest(base + '/policies/' + encodeURIComponent(id)));
    }
  };

  // apiService.js
// apiService.js (claims section only)
const claims = {
  async getAll(policyId, status) {
    let url = base + '/claims';
    const params = [];
    if (policyId) params.push('policy_id=' + encodeURIComponent(policyId));
    if (status)   params.push('status=' + encodeURIComponent(status));
    if (params.length) url += '?' + params.join('&');
    const resp = await http.request(url);
    return getJson(resp);
  },

  async create(payload) {
    const resp = await http.request(base + '/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    return getJson(resp);
  },

  async update(id, payload) {
    const resp = await http.request(base + '/claims/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    return getJson(resp);
  },

  async assess(id, payload) {
    const resp = await http.request(base + '/claims/' + encodeURIComponent(id) + '/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    return getJson(resp);
  },

  async close(id) {
    // Many backends expect a JSON body (even if empty) + header
    const resp = await http.request(base + '/claims/' + encodeURIComponent(id) + '/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({}) // safe no-op payload
    });
    return getJson(resp);
  }
};


  const payments = {
    async list(targetType, targetId) {
      const url = payBase + '/payments?targetType=' + encodeURIComponent(targetType) + '&targetId=' + encodeURIComponent(targetId);
      return getJson(await jsonRequest(url));
    },
    async create(payload) {
      return getJson(await jsonRequest(payBase + '/payments', {
        method: 'POST',
        body: JSON.stringify(payload)
      }));
    },
    async get(id) {
      return getJson(await jsonRequest(payBase + '/payments/' + encodeURIComponent(id)));
    }
  };

  return { customers, products, quotes, policies, claims, payments };
});
