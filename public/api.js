const TOKEN_KEY = 'octrip.api.token.v1';

export class ApiError extends Error {
  constructor(code, message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {
    return '';
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    /* Local file or privacy mode: token remains in memory only for this page. */
  }
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    throw new ApiError('NETWORK_ERROR', '无法连接本地服务，请先运行 npm start', 0);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = null;
    }
  }

  if (!response.ok) {
    const apiError = payload && payload.error ? payload.error : null;
    if (response.status === 401 && options.clearTokenOn401 !== false) setToken('');
    throw new ApiError(
      apiError ? apiError.code : 'HTTP_ERROR',
      apiError ? apiError.message : `请求失败（HTTP ${response.status}）`,
      response.status,
      apiError ? apiError.details : null
    );
  }
  return payload;
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

export const api = {
  getToken,
  setToken,
  hasToken() { return Boolean(getToken()); },

  async health() {
    return request('/health', { auth: false, clearTokenOn401: false });
  },

  async login({ phone, code, role }) {
    const result = await request('/auth/login', { method: 'POST', body: { phone, code, role }, auth: false });
    setToken(result.token);
    return result;
  },

  async me() {
    return request('/auth/me', { clearTokenOn401: false });
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    } finally {
      setToken('');
    }
  },

  searchFlights(params) {
    return request(`/flights/search?${query(params)}`, { auth: false });
  },

  searchHotels(params) {
    return request(`/hotels/search?${query(params)}`, { auth: false });
  },

  searchAttractions(params) {
    return request(`/attractions/search?${query(params)}`, { auth: false });
  },

  itinerary(payload) {
    return request('/itineraries', { method: 'POST', body: payload, auth: false });
  },

  createOrder(payload) {
    return request('/orders', { method: 'POST', body: payload });
  },

  listOrders(scope) {
    return request(`/orders${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`);
  },

  getOrder(orderId) {
    return request(`/orders/${encodeURIComponent(orderId)}`);
  },

  payOrder(orderId, method) {
    return request(`/orders/${encodeURIComponent(orderId)}/pay`, { method: 'POST', body: { method } });
  },

  cancelOrder(orderId) {
    return request(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
  },

  getSeats(orderId) {
    return request(`/orders/${encodeURIComponent(orderId)}/seats`);
  },

  checkIn(orderId, seat) {
    return request(`/orders/${encodeURIComponent(orderId)}/checkin`, { method: 'POST', body: { seat } });
  },

  boardingPass(orderId) {
    return request(`/orders/${encodeURIComponent(orderId)}/boarding-pass`);
  }
};
