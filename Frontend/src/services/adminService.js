// src/services/adminService.js
// Admin-specific API service for the EVOLVS platform admin panel

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ADMIN_TOKEN_KEY = 'evolv_admin_token';
const ADMIN_USER_KEY = 'evolv_admin_user';
import { navigate } from '../utils/navigate.js';


const getToken = () =>
  localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || null;

const decodeJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

const isAdminToken = (token) => {
  const claims = decodeJwt(token);
  if (!claims) return false;
  return (
    claims.role === 'admin' ||
    claims.role === 'ADMIN' ||
    (Array.isArray(claims.roles) && (claims.roles.includes('admin') || claims.roles.includes('ADMIN'))) ||
    claims.isAdmin === true
  );
};

const isTokenExpired = (token = getToken()) => {
  if (!token) return true;
  const claims = decodeJwt(token);
  if (!claims?.exp) return false;
  return Date.now() >= claims.exp * 1000 - 5000;
};

const clearAdminSession = () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
  sessionStorage.removeItem(DEMO_KEY);
};

const request = async (path, opts = {}) => {
  const url = `${API_BASE_URL}${path}`;
  const token = getToken();
  const hasUser = !!(localStorage.getItem(ADMIN_USER_KEY) || sessionStorage.getItem(ADMIN_USER_KEY));

  // Not logged in at all
  if (!token && !hasUser) {
    clearAdminSession();
    navigate('/admin/login');
    throw new Error('Admin session expired. Please log in again.');
  }

  // Token exists but expired
  if (token && isTokenExpired(token)) {
    clearAdminSession();
    navigate('/admin/login');
    throw new Error('Admin session expired. Please log in again.');
  }

  const isFormData = opts.body instanceof FormData;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers ?? {}),
  };

  const response = await fetch(url, {
    ...opts,
    headers,
    credentials: 'include', // needed if backend uses cookie session
    body:
      opts.body && typeof opts.body !== 'string' && !isFormData
        ? JSON.stringify(opts.body)
        : opts.body,
  });

  if (response.status === 401 || response.status === 403) {
    clearAdminSession();
    navigate('/admin/login');
    throw new Error('Admin access denied.');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = Array.isArray(payload.message)
      ? payload.message.join(' ')
      : payload.message || `Request failed: ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
};

const demoEmpty = (promise) =>
  promise.catch((err) => {
    if (err.isDemo) return { data: [], total: 0 };
    throw err;
  });

export const adminService = {
  isLoggedIn() {
    const token = getToken();
    if (token) return !isTokenExpired(token);
    const user = this.getAdminUser();
    return !!user && String(user.role).toUpperCase() === 'ADMIN';
  },

  async adminLogin(email, password, rememberMe = false) {
    const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = Array.isArray(payload.message)
        ? payload.message.join(' ')
        : payload.message || 'Admin login failed.';
      const err = new Error(msg);
      err.status = response.status;
      throw err;
    }

    const admin = payload?.admin;
    if (!admin) throw new Error('Invalid login response.');
    if (String(admin.role).toUpperCase() !== 'ADMIN') {
      throw new Error('Access denied. You do not have admin privileges.');
    }
    if (admin.status && String(admin.status).toUpperCase() !== 'ACTIVE') {
      throw new Error('Your admin account is not active.');
    }

    const token =
      payload?.accessToken ?? payload?.token ?? payload?.data?.accessToken ?? null;

    const storage = rememberMe ? localStorage : sessionStorage;
    const other = rememberMe ? sessionStorage : localStorage;
    other.removeItem(ADMIN_TOKEN_KEY);
    other.removeItem(ADMIN_USER_KEY);

    if (token) storage.setItem(ADMIN_TOKEN_KEY, token);
    storage.setItem(ADMIN_USER_KEY, JSON.stringify(admin));

    return { token, user: admin };
  },


  getAdminUser() {
    const str =
      localStorage.getItem(ADMIN_USER_KEY) || sessionStorage.getItem(ADMIN_USER_KEY);
    try {
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  },

  logout() {
    clearAdminSession();
    navigate('/admin/login')
  },

  isAdminToken,
  isTokenExpired: () => isTokenExpired(),

  // ── Dashboard Stats ────────────────────────────────────────────────
  async getDashboardStats() {
    try {
      return await request('/api/admin/dashboard/summary');
    } catch {
      return null;
    }
  },

  async getAnalytics(period = 'monthly') {
    try {
      return await request(`/api/admin/analytics?period=${period}`);
    } catch {
      return null;
    }
  },

  // ── Users ──────────────────────────────────────────────────────────
  async getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return demoEmpty(request(`/api/admin/users${qs ? `?${qs}` : ''}`));
  },
  async getUserById(id) {
    return request(`/api/admin/users/${id}`);
  },

  async suspendUser(id, reason = '') {
    return request(`/api/admin/users/${id}/suspend`, { method: 'PATCH', body: { reason } });
  },

  async reactivateUser(id) {
    return request(`/api/admin/users/${id}/reactivate`, { method: 'PATCH' });
  },

  async deleteUser(id) {
    return request(`/api/admin/users/${id}`, { method: 'DELETE' });
  },

  // ── Posts ──────────────────────────────────────────────────────────
  async getPosts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return demoEmpty(request(`/api/admin/posts${qs ? `?${qs}` : ''}`));
  },

  async deletePost(id) {
    return request(`/api/admin/posts/${id}`, { method: 'DELETE' });
  },

  async restorePost(id) {
    return request(`/api/admin/posts/${id}/restore`, { method: 'PATCH' });
  },
  async getReports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return demoEmpty(request(`/api/admin/reports${qs ? `?${qs}` : ''}`));
  },

  async resolveReport(id, action = {}) {
    return request(`/api/admin/reports/${id}/resolve`, { method: 'PATCH', body: action });
  },

  async dismissReport(id) {
    return request(`/api/admin/reports/${id}/dismiss`, { method: 'PATCH' });
  },

  async getPendingReportsCount() {
    try {
      const res = await request('/api/admin/reports?status=pending&limit=1');
      return res?.total ?? res?.data?.total ?? res?.count ?? 0;
    } catch {
      return 0;
    }
  },

  // ── Comments ──────────────────────────────────────────────────────
  async getComments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return demoEmpty(request(`/api/admin/comments${qs ? `?${qs}` : ''}`));
  },

  async deleteComment(id) {
    return request(`/api/admin/comments/${id}`, { method: 'DELETE' });
  },

  // ── Connections ───────────────────────────────────────────────────
  async getConnectionStats() {
    try {
      return await request('/api/admin/connections');
    } catch {
      return null;
    }
  },

  // ── Notifications ─────────────────────────────────────────────────
  async sendNotification(data) {
    return request('/api/admin/notifications', { method: 'POST', body: data });
  },

  async getNotifications(params = {}) {
    const qs = new URLSearchParams(params).toString();
    try {
      return await request(`/api/admin/notifications${qs ? `?${qs}` : ''}`);
    } catch {
      return null;
    }
  },

  // ── Settings ──────────────────────────────────────────────────────
  async changePassword(currentPassword, newPassword) {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
  },

  async getPlatformConfig() {
    try {
      return await request('/api/admin/settings');
    } catch {
      return null;
    }
  },

  async getAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    try {
      return await request(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
    } catch {
      return null;
    }
  },
};

