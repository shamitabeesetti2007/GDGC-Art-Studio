/* ==========================================================================
   API SERVICE LAYER — CONTEMPORARY ART EDITORIAL
   Centralized API client for all backend communication.
   ========================================================================== */

const API_BASE = (window.ART_API_BASE_URL || window.API_URL || '').replace(/\/+$/, '');

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function apiRequest(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR', 'The studio service could not be reached. Check your connection and try again.');
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(res.status, 'INVALID_RESPONSE', 'The studio service returned an unreadable response.');
    }
  }

  if (!res.ok) {
    const err = data.error || {};
    throw new ApiError(res.status, err.code, err.message || 'Request failed');
  }

  return data;
}

// ---- Authentication ----
const AuthApi = {
  async signup(name, email, password) {
    const data = await apiRequest('POST', '/api/auth/signup', { name, email, password });
    return data.user;
  },

  async login(email, password) {
    const data = await apiRequest('POST', '/api/auth/login', { email, password });
    return data.user;
  },

  async logout() {
    await apiRequest('POST', '/api/auth/logout');
  },

  async getCurrentUser() {
    try {
      const data = await apiRequest('GET', '/api/auth/me');
      return data.user;
    } catch (err) {
      if (err.status === 401 || err.status === 404) return null;
      throw err;
    }
  }
};

// ---- Metadata ----
const MetaApi = {
  async getMeta() {
    const data = await apiRequest('GET', '/api/meta');
    return data.meta;
  }
};

// ---- Paintings ----
const PaintingsApi = {
  async listPaintings() {
    const data = await apiRequest('GET', '/api/paintings');
    return data.paintings;
  },

  async getPainting(id) {
    const data = await apiRequest('GET', `/api/paintings/${id}`);
    return data.painting;
  },

  async createPainting(title, artist, description, price, image_url = '') {
    const data = await apiRequest('POST', '/api/paintings', { title, artist, description, price, image_url });
    return data.painting;
  },

  async updatePainting(id, updates) {
    const data = await apiRequest('PATCH', `/api/paintings/${id}`, updates);
    return data.painting;
  }
};

// ---- Orders ----
const OrdersApi = {
  async listOrders() {
    const data = await apiRequest('GET', '/api/orders');
    return data.orders;
  },

  async createOrder(paintingId) {
    const data = await apiRequest('POST', `/api/paintings/${paintingId}/orders`);
    return data.order;
  },

  async cancelOrder(orderId) {
    const data = await apiRequest('PATCH', `/api/orders/${orderId}/cancel`);
    return data.order;
  }
};

// ---- Bookings ----
const BookingsApi = {
  async getTakenDates() {
    const data = await apiRequest('GET', '/api/bookings/taken-dates');
    return data.takenDates;
  },

  async createBooking(date, wall_sqft, address) {
    const data = await apiRequest('POST', '/api/bookings', { date, wall_sqft, address });
    return data.booking;
  },

  async listBookings() {
    const data = await apiRequest('GET', '/api/bookings');
    return data.bookings;
  },

  async confirmBooking(id) {
    const data = await apiRequest('PATCH', `/api/bookings/${id}/confirm`);
    return data.booking;
  },

  async declineBooking(id) {
    const data = await apiRequest('PATCH', `/api/bookings/${id}/decline`);
    return data.booking;
  },

  async cancelBooking(id) {
    const data = await apiRequest('PATCH', `/api/bookings/${id}/cancel`);
    return data.booking;
  }
};

// ---- Pottery ----
const PotteryApi = {
  async createPotteryRequest(item, glaze, quantity, needed_by) {
    const data = await apiRequest('POST', '/api/pottery', { item, glaze, quantity, needed_by });
    return data.request;
  },

  async listPotteryRequests() {
    const data = await apiRequest('GET', '/api/pottery');
    return data.requests;
  },

  async updatePotteryRequest(id, updates) {
    const data = await apiRequest('PATCH', `/api/pottery/${id}`, updates);
    return data.request;
  },

  async acceptPotteryRequest(id) {
    const data = await apiRequest('PATCH', `/api/pottery/${id}/accept`);
    return data.request;
  },

  async declinePotteryRequest(id) {
    const data = await apiRequest('PATCH', `/api/pottery/${id}/decline`);
    return data.request;
  },

  async cancelPotteryRequest(id) {
    const data = await apiRequest('PATCH', `/api/pottery/${id}/cancel`);
    return data.request;
  }
};

// Expose globally
window.AuthApi = AuthApi;
window.MetaApi = MetaApi;
window.PaintingsApi = PaintingsApi;
window.OrdersApi = OrdersApi;
window.BookingsApi = BookingsApi;
window.PotteryApi = PotteryApi;
window.ApiError = ApiError;
