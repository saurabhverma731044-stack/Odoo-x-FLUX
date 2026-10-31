// Brightloop Database & API Client
const API_BASE = window.location.origin.includes('localhost:4000') 
  ? '/api' 
  : 'http://localhost:4000/api';

const TODAY = '2026-10-31';
const TAX_RATE = 0.18;

// Client Cache and API wrapper
const API = {
  token: localStorage.getItem('brightloop_token') || null,
  isLive: false,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('brightloop_token', t);
    else localStorage.removeItem('brightloop_token');
  },

  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error occurred');
      }
      this.isLive = true;
      return data;
    } catch (err) {
      console.warn(`API call failed for ${endpoint}:`, err.message);
      throw err;
    }
  },

  async checkConnection() {
    try {
      const h = await fetch(`${API_BASE}/health`, { method: 'GET' });
      if (h.ok) {
        this.isLive = true;
        return true;
      }
    } catch (e) {
      this.isLive = false;
    }
    return false;
  },

  // Auth
  login(email, password, role) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
  },

  signup(email, password, name, city) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, city }),
    });
  },

  forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Subscriptions
  getSubscriptions() {
    return this.request('/subscriptions');
  },

  createSubscription(data) {
    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  transitionSubscription(subNo, nextStatus) {
    return this.request(`/subscriptions/${subNo}/transition`, {
      method: 'POST',
      body: JSON.stringify({ nextStatus }),
    });
  },

  // Invoices & Billing
  getInvoices() {
    return this.request('/invoices');
  },

  runBilling(period) {
    return this.request('/invoices/run-billing', {
      method: 'POST',
      body: JSON.stringify({ period }),
    });
  },

  // Payments
  getPayments() {
    return this.request('/payments');
  },

  recordPayment(data) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Catalog
  getPlans() {
    return this.request('/plans');
  },

  getCustomers() {
    return this.request('/customers');
  },

  getDiscounts() {
    return this.request('/discounts');
  },

  getDashboardStats(period = 'all') {
    return this.request(`/dashboard/stats?period=${encodeURIComponent(period)}`);
  },

  addStaff(email) {
    return this.request('/staff', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

// Fallback in-memory database if API backend is starting
const DB = {
  customers: [
    { id: 'c1', name: 'Aarav Traders', email: 'aarav@traders.in', city: 'Lucknow', activeSubsCount: 1, outstanding: 0 },
    { id: 'c2', name: 'Nova Retail Pvt Ltd', email: 'accounts@novaretail.in', city: 'Delhi', activeSubsCount: 1, outstanding: 14744 },
    { id: 'c3', name: 'Sapna Boutique', email: 'sapna@boutique.in', city: 'Kanpur', activeSubsCount: 1, outstanding: 0 },
    { id: 'c4', name: 'Helix Logistics', email: 'finance@helix.com', city: 'Mumbai', activeSubsCount: 1, outstanding: 0 },
    { id: 'c5', name: 'GreenLeaf Foods', email: 'hello@greenleaf.in', city: 'Pune', activeSubsCount: 0, outstanding: 0 },
    { id: 'c6', name: 'Kiran Clinics', email: 'admin@kiranclinics.in', city: 'Jaipur', activeSubsCount: 0, outstanding: 0 },
  ],
  plans: [
    { id: 'plan-1', name: 'Starter', product: 'Brightloop CRM', price: 999, cycle: 'Monthly', minQty: 1, variant: 'Standard', autoClose: true },
    { id: 'plan-2', name: 'Business', product: 'Brightloop CRM', price: 2499, cycle: 'Monthly', minQty: 3, variant: 'Odoo brand (+560)', autoClose: false },
    { id: 'plan-3', name: 'Enterprise Yearly', product: 'Brightloop Suite', price: 24999, cycle: 'Yearly', minQty: 10, variant: 'Standard', autoClose: false },
    { id: 'plan-4', name: 'Analytics Add-on', product: 'Brightloop Insights', price: 499, cycle: 'Monthly', minQty: 1, variant: 'Standard', autoClose: true },
  ],
  subs: [
    { no: 'SUB-1001', cust: 'c1', customerName: 'Aarav Traders', planId: 'plan-1', planName: 'Starter', planPrice: 999, planCycle: 'Monthly', qty: 3, start: '2026-07-01', end: '2027-07-01', terms: 'Net 15', status: 'Active' },
    { no: 'SUB-1002', cust: 'c2', customerName: 'Nova Retail Pvt Ltd', planId: 'plan-2', planName: 'Business', planPrice: 2499, planCycle: 'Monthly', qty: 5, start: '2026-07-01', end: '2027-07-01', terms: 'Net 15', status: 'Active' },
    { no: 'SUB-1003', cust: 'c3', customerName: 'Sapna Boutique', planId: 'plan-1', planName: 'Starter', planPrice: 999, planCycle: 'Monthly', qty: 1, start: '2026-08-01', end: '2027-08-01', terms: 'Net 7', status: 'Active' },
    { no: 'SUB-1004', cust: 'c4', customerName: 'Helix Logistics', planId: 'plan-3', planName: 'Enterprise Yearly', planPrice: 24999, planCycle: 'Yearly', qty: 12, start: '2026-07-01', end: '2027-07-01', terms: 'Net 30', status: 'Active' },
    { no: 'SUB-1005', cust: 'c5', customerName: 'GreenLeaf Foods', planId: 'plan-4', planName: 'Analytics Add-on', planPrice: 499, planCycle: 'Monthly', qty: 2, start: '2026-09-01', end: '2027-09-01', terms: 'Net 15', status: 'Paused' },
    { no: 'SUB-1006', cust: 'c6', customerName: 'Kiran Clinics', planId: 'plan-2', planName: 'Business', planPrice: 2499, planCycle: 'Monthly', qty: 4, start: '2026-10-01', end: '2027-10-01', terms: 'Net 15', status: 'Confirmed' },
    { no: 'SUB-1007', cust: 'c2', customerName: 'Nova Retail Pvt Ltd', planId: 'plan-4', planName: 'Analytics Add-on', planPrice: 499, planCycle: 'Monthly', qty: 5, start: '2026-11-01', end: '2027-11-01', terms: 'Net 15', status: 'Quotation' },
    { no: 'SUB-1008', cust: 'c3', customerName: 'Sapna Boutique', planId: 'plan-2', planName: 'Business', planPrice: 2499, planCycle: 'Monthly', qty: 3, start: '2026-12-01', end: '2027-12-01', terms: 'Net 7', status: 'Draft' },
  ],
  discounts: [
    { code: 'SEATS10', type: 'Percentage', value: 10, minQty: 5, from: '2026-07-01', to: '2026-12-31', limit: 50, used: 3, applies: 'Business plan' },
    { code: 'FLAT500', type: 'Fixed', value: 500, minQty: 1, from: '2026-10-01', to: '2026-11-30', limit: 20, used: 1, applies: 'All subscriptions' },
  ],
  invoices: [],
  payments: [],
};
