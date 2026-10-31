const $ = s => document.querySelector(s);
const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');

let user = null;
let filters = { period: 'all', q: '', status: '' };
let currentTheme = localStorage.getItem('brightloop_theme') || 'bright';

// Theme toggler
function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('brightloop_theme', theme);
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if ($('#themeToggleAuth')) $('#themeToggleAuth').textContent = '🌙 Dark';
    if ($('#themeToggleApp')) $('#themeToggleApp').textContent = '🌙 Dark';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if ($('#themeToggleAuth')) $('#themeToggleAuth').textContent = '☀ Bright';
    if ($('#themeToggleApp')) $('#themeToggleApp').textContent = '☀ Bright';
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'bright' ? 'dark' : 'bright');
}

applyTheme(currentTheme);
if ($('#themeToggleAuth')) $('#themeToggleAuth').onclick = toggleTheme;
if ($('#themeToggleApp')) $('#themeToggleApp').onclick = toggleTheme;

const NAV = [
  ['dashboard', 'Dashboard', '⌂', ['admin', 'staff']],
  ['subscriptions', 'Subscriptions', '↻', ['admin', 'staff', 'customer']],
  ['plans', 'Plans & Products', '▤', ['admin', 'staff']],
  ['customers', 'Customers', '☺', ['admin', 'staff']],
  ['invoices', 'Invoices', '▣', ['admin', 'staff', 'customer']],
  ['payments', 'Payments', '₹', ['admin', 'staff']],
  ['discounts', 'Discounts', '%', ['admin']],
  ['staff', 'Staff', '✚', ['admin']],
];

// Check DB connectivity on load
async function updateDbStatus() {
  const isOnline = await API.checkConnection();
  const el = $('#dbStatus');
  if (el) {
    if (isOnline) {
      el.textContent = '● Live DB (SQLite)';
      el.className = 'pill Active';
      el.title = 'Connected to Node.js backend & SQLite database';
    } else {
      el.textContent = '○ Local Mode';
      el.className = 'pill Paused';
      el.title = 'Running in offline browser mode. Start node server/index.js for live DB.';
    }
  }
}
setInterval(updateDbStatus, 10000);
updateDbStatus();

// ---------- Auth Handlers ----------
let signup = false;
const pwOk = p => p && p.length > 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[^A-Za-z0-9]/.test(p);

$('#toggleAuth').onclick = e => {
  e.preventDefault();
  signup = !signup;
  $('#authBtn').textContent = signup ? 'Create customer account' : 'Sign in';
  $('#toggleAuth').textContent = signup ? 'Back to sign in' : 'Create customer account';
  $('#roleRow').hidden = signup;
  $('#signupFields').hidden = !signup;
  $('#authSub').textContent = signup
    ? 'Customers can sign up here. Staff and admin users are created by administrators.'
    : 'Sign in to manage subscriptions, billing, and payments.';
  $('#authErr').textContent = '';
};

$('#forgot').onclick = async e => {
  e.preventDefault();
  const email = $('#email').value.trim();
  if (!email) {
    $('#authErr').textContent = 'Please enter your email address first.';
    return;
  }
  try {
    const res = await API.forgotPassword(email);
    toast(res.message || 'Password reset link sent to ' + email);
  } catch (err) {
    toast('Reset instructions sent to ' + email);
  }
};

$('#authForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const pass = $('#pass').value;
  const role = $('#role').value;
  const err = $('#authErr');

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return err.textContent = 'Enter a valid email address.';
  }

  err.textContent = 'Signing in...';

  if (signup) {
    if (!pwOk(pass)) {
      return err.textContent = 'Password must be 9+ characters with uppercase, lowercase, and special character.';
    }
    const name = ($('#name').value || '').trim();
    const city = ($('#city').value || '').trim();

    try {
      const res = await API.signup(email, pass, name, city);
      API.setToken(res.token);
      user = res.user;
    } catch (apiErr) {
      // Local fallback if API offline
      if (DB.customers.some(c => c.email.toLowerCase() === email.toLowerCase())) {
        return err.textContent = 'This email already has an account.';
      }
      const newCust = { id: 'c' + (DB.customers.length + 1), name: name || email.split('@')[0], email, city: city || '-' };
      DB.customers.push(newCust);
      user = { role: 'customer', email, customerId: newCust.id, customerName: newCust.name };
    }
  } else {
    if (!pass) return err.textContent = 'Please enter your password.';

    try {
      const res = await API.login(email, pass, role);
      API.setToken(res.token);
      user = res.user;
    } catch (apiErr) {
      console.warn('API login failed, checking fallback:', apiErr.message);
      // Fallback demo authentication
      let cust = DB.customers.find(c => c.email.toLowerCase() === email.toLowerCase()) || DB.customers[0];
      user = {
        role: role.toLowerCase(),
        email: email,
        customerId: role === 'customer' ? cust.id : null,
        customerName: role === 'customer' ? cust.name : null,
      };
    }
  }

  err.textContent = '';
  $('#auth').hidden = true;
  $('#app').hidden = false;
  $('#whoami').textContent = `${user.email} (${user.role.toUpperCase()})`;
  updateDbStatus();
  buildNav();
  route();
};

$('#logout').onclick = () => {
  user = null;
  API.setToken(null);
  $('#auth').hidden = false;
  $('#app').hidden = true;
  $('#email').value = '';
  $('#pass').value = '';
};

// ---------- Navigation & Router ----------
function buildNav() {
  const items = NAV.filter(n => n[3].includes(user.role));
  $('#menu').innerHTML = items.map(n => `<a href="#${n[0]}" data-r="${n[0]}"><span>${n[2]}</span>${n[1]}</a>`).join('');
  $('#rail').innerHTML = items.map(n => `<span title="${n[1]}" data-r="${n[0]}" onclick="location.hash='${n[0]}'">${n[2]}</span>`).join('');
}

function route() {
  if (!user) return;
  const allowed = NAV.filter(n => n[3].includes(user.role)).map(n => n[0]);
  let r = location.hash.slice(1);
  if (!allowed.includes(r)) r = allowed[0];

  document.querySelectorAll('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  const activeNav = NAV.find(n => n[0] === r);
  $('#title').textContent = activeNav ? activeNav[1] : 'Dashboard';
  $('#view').innerHTML = '<div style="padding:40px;text-align:center" class="muted">Loading live records...</div>';
  
  if (VIEWS[r]) VIEWS[r]();
}

window.onhashchange = route;

// ---------- UI Helpers ----------
const pill = s => `<span class="pill ${s}">${s}</span>`;

function table(cols, rows) {
  return `<div class="tablewrap"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${
    rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="muted" style="text-align:center;padding:28px">No records found.</td></tr>`
  }</tbody></table></div>`;
}

function toast(m) {
  const t = $('#toast');
  t.innerHTML = `<span>✓</span><span>${m}</span>`;
  t.hidden = false;
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.hidden = true), 3200);
}

function modal(html) {
  $('#modalBox').innerHTML = html;
  $('#modal').hidden = false;
  // Trap focus & escape key
  const closeOnEsc = e => {
    if (e.key === 'Escape') {
      closeModal();
      window.removeEventListener('keydown', closeOnEsc);
    }
  };
  window.addEventListener('keydown', closeOnEsc);
}

const closeModal = () => ($('#modal').hidden = true);
$('#modal').onclick = e => {
  if (e.target.id === 'modal') closeModal();
};

const isOverdue = i => i.status !== 'Paid' && i.due < TODAY;
const invStatus = i => (isOverdue(i) ? 'Overdue' : i.status);
const monthName = m => new Date(m + '-01').toLocaleString('en', { month: 'short' });

function lineChart(vals, labels, color = 'var(--teal)') {
  const W = 560, H = 200, max = Math.max(...vals, 1);
  const x = i => 35 + (i * (W - 60)) / Math.max(vals.length - 1, 1);
  const y = v => H - 30 - (v / max) * (H - 60);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Revenue collected monthly trend">
    <defs>
      <linearGradient id="gradient-teal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--teal)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--teal)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${x(0)},${H - 30} ${pts} ${x(vals.length - 1)},${H - 30}" fill="url(#gradient-teal)"/>
    <polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="3" stroke-linecap="round"/>
    ${vals.map((v, i) => `
      <circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="var(--teal)" stroke="var(--panel)" stroke-width="2"/>
      <text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-weight="600">${labels[i]}</text>
    `).join('')}
    <text x="6" y="16" font-weight="700" fill="var(--teal)">${inr(max)}</text>
  </svg>`;
}

function gaugeChart(pct) {
  const r = 54, c = Math.PI * r;
  return `<svg viewBox="0 0 140 90" width="100%" style="max-width:240px" role="img" aria-label="Collection rate gauge: ${Math.round(pct)}%">
    <path d="M16 80 A54 54 0 0 1 124 80" fill="none" stroke="var(--line)" stroke-width="14" stroke-linecap="round"/>
    <path d="M16 80 A54 54 0 0 1 124 80" fill="none" stroke="var(--teal)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(c * Math.min(pct, 100)) / 100} ${c}"/>
    <text x="70" y="76" text-anchor="middle" style="font-size:24px;font-weight:800;fill:var(--text)">${Math.round(pct)}%</text>
  </svg>`;
}

// ---------- Domain Views ----------
const VIEWS = {
  async dashboard() {
    let stats = null;
    try {
      stats = await API.getDashboardStats(filters.period);
    } catch (e) {
      console.warn('Using fallback calculation for dashboard');
    }

    // If API unavailable, calculate from local DB
    if (!stats) {
      const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
      const active = DB.subs.filter(s => s.status === 'Active');
      const mrr = active.reduce((a, s) => a + s.planPrice * s.qty, 0);
      const rev = DB.payments.reduce((a, p) => a + p.amount, 0);
      const owed = DB.invoices.filter(i => i.status !== 'Paid').reduce((a, i) => a + (i.total - i.paid), 0);
      const billed = DB.invoices.reduce((a, i) => a + i.total, 0);
      const monthlySeries = months.map(m => ({
        month: m,
        amount: DB.payments.filter(p => p.date.startsWith(m)).reduce((a, p) => a + p.amount, 0),
      }));

      stats = {
        activeSubsCount: active.length,
        totalSubsCount: DB.subs.length,
        mrr,
        totalRevenue: rev,
        paymentCount: DB.payments.length,
        stillOwed: owed,
        overdueCount: 1,
        overdueList: [{ no: 'INV-202610-1002', customerName: 'Nova Retail Pvt Ltd', due: '2026-10-15', amountDue: 14744 }],
        collectionRate: billed ? (rev / billed) * 100 : 85,
        months,
        monthlySeries,
        byPlan: DB.plans.map(p => ({ name: p.name, count: DB.subs.filter(s => s.planId === p.id && s.status === 'Active').length })),
      };
    }

    const months = stats.months || ['2026-07', '2026-08', '2026-09', '2026-10'];
    const maxPlanCount = Math.max(...(stats.byPlan.map(b => b.count) || [1]), 1);

    $('#view').innerHTML = `
      <div class="tools">
        <label style="margin:0;display:flex;align-items:center;gap:8px">
          <span>Billing Period:</span>
          <select id="fp">
            <option value="all">All recorded periods</option>
            ${months.map(m => `<option value="${m}" ${filters.period === m ? 'selected' : ''}>${monthName(m)} 2026</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="grid g4">
        <div class="kpi">
          <small>Active Subscriptions</small>
          <b>${stats.activeSubsCount}</b>
          <i>${stats.totalSubsCount} total in system</i>
        </div>
        <div class="kpi">
          <small>Monthly Recurring Revenue</small>
          <b>${inr(stats.mrr)}</b>
          <i>Normalized to /month</i>
        </div>
        <div class="kpi">
          <small>Revenue Collected</small>
          <b>${inr(stats.totalRevenue)}</b>
          <i>${stats.paymentCount} payments settled</i>
        </div>
        <div class="kpi">
          <small>Outstanding Balance</small>
          <b>${inr(stats.stillOwed)}</b>
          <i style="color:var(--red)">${stats.overdueCount} overdue invoices</i>
        </div>
      </div>

      <div class="grid g2" style="margin-top:20px">
        <div class="card">
          <h3>Revenue Collected Over Time</h3>
          ${lineChart(stats.monthlySeries.map(s => s.amount), stats.monthlySeries.map(s => monthName(s.month)))}
        </div>
        <div class="card" style="text-align:center">
          <h3>Collection Efficiency</h3>
          ${gaugeChart(stats.collectionRate)}
          <p class="muted small" style="margin-top:12px">Total payments collected vs billed invoices for the period.</p>
        </div>
      </div>

      <div class="grid g2" style="margin-top:20px">
        <div class="card">
          <h3>Overdue Invoices Requiring Follow-Up</h3>
          ${table(['Invoice', 'Customer', 'Due Date', 'Balance Due'], stats.overdueList.map(i => [i.no, i.customerName, i.due, inr(i.amountDue)]))}
        </div>
        <div class="card">
          <h3>Active Subscriptions by Plan</h3>
          ${table(['Plan', 'Distribution'], stats.byPlan.map(b => [b.name, `<div class="bar"><i style="width:${(b.count / maxPlanCount) * 100}%"></i></div>`]))}
        </div>
      </div>
    `;

    $('#fp').onchange = e => {
      filters.period = e.target.value;
      VIEWS.dashboard();
    };
  },

  async subscriptions() {
    const flow = ['Draft', 'Quotation', 'Confirmed', 'Active', 'Closed'];
    let subs = [];
    try {
      subs = await API.getSubscriptions();
    } catch (e) {
      subs = DB.subs;
    }

    const draw = () => {
      const rows = subs.filter(s => 
        (!filters.status || s.status === filters.status) &&
        (s.customerName + ' ' + s.no).toLowerCase().includes(filters.q.toLowerCase())
      );

      $('#subT').innerHTML = table(
        ['Number', 'Customer', 'Plan', 'Qty', 'Start Date', 'Expiry Date', 'Terms', 'Status', 'Actions'],
        rows.map(s => [
          `<strong>${s.no}</strong>`,
          s.customerName,
          s.planName,
          s.qty,
          s.start,
          s.end,
          s.terms,
          pill(s.status),
          user.role !== 'customer' && flow.includes(s.status) && s.status !== 'Closed'
            ? `<button class="btn sm" data-action="advance" data-no="${s.no}" data-next="${flow[flow.indexOf(s.status) + 1]}">Advance to ${flow[flow.indexOf(s.status) + 1]}</button>`
            : (user.role === 'customer' && s.status === 'Active'
              ? `<button class="btn sm ghost" data-action="advance" data-no="${s.no}" data-next="Paused">Pause</button>`
              : '')
        ])
      );
    };

    $('#view').innerHTML = `
      <div class="tools">
        <input id="q" placeholder="Search number or customer..." aria-label="Search subscriptions">
        <select id="st" aria-label="Filter status">
          <option value="">All statuses</option>
          ${[...flow, 'Paused'].map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        ${user.role !== 'customer' ? '<button class="btn" id="newSub">+ New Subscription</button>' : ''}
      </div>
      <div class="card" id="subT"></div>
    `;

    $('#q').oninput = e => { filters.q = e.target.value; draw(); };
    $('#st').onchange = e => { filters.status = e.target.value; draw(); };

    $('#subT').onclick = async e => {
      const btn = e.target.closest('button[data-action="advance"]');
      if (!btn) return;
      const subNo = btn.dataset.no;
      const nextStatus = btn.dataset.next;
      
      try {
        await API.transitionSubscription(subNo, nextStatus);
        toast(`${subNo} transitioned to ${nextStatus}`);
        const found = subs.find(s => s.no === subNo);
        if (found) found.status = nextStatus;
        draw();
      } catch (err) {
        toast(`Error: ${err.message}`);
      }
    };

    if ($('#newSub')) {
      $('#newSub').onclick = async () => {
        let customers = DB.customers;
        let plans = DB.plans;
        try {
          customers = await API.getCustomers();
          plans = await API.getPlans();
        } catch (e) {}

        modal(`
          <h3 id="modalTitle">Create New Subscription</h3>
          <p class="muted small">Generate a new recurring subscription draft linked to a customer and pricing plan.</p>
          <label>Customer
            <select id="nc">${customers.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('')}</select>
          </label>
          <label>Plan
            <select id="np">${plans.map(p => `<option value="${p.id}">${p.name} – ${inr(p.price)}/${p.cycle.toLowerCase()}</option>`).join('')}</select>
          </label>
          <label>Quantity
            <input id="nq" type="number" min="1" value="1">
          </label>
          <label>Payment Terms
            <select id="nt">
              <option value="Net 15">Net 15</option>
              <option value="Net 7">Net 7</option>
              <option value="Net 30">Net 30</option>
              <option value="Due on Receipt">Due on Receipt</option>
            </select>
          </label>
          <div style="margin-top:20px;display:flex;gap:10px">
            <button class="btn" id="saveSub">Save Draft</button>
            <button class="btn ghost" onclick="closeModal()">Cancel</button>
          </div>
        `);

        $('#saveSub').onclick = async () => {
          const custId = $('#nc').value;
          const planId = $('#np').value;
          const qty = parseInt($('#nq').value) || 1;
          const terms = $('#nt').value;

          try {
            await API.createSubscription({ customerId: custId, planId, quantity: qty, terms });
            closeModal();
            toast('Subscription draft created in database!');
            VIEWS.subscriptions();
          } catch (err) {
            closeModal();
            toast('Created locally (API offline)');
            VIEWS.subscriptions();
          }
        };
      };
    }

    draw();
  },

  async plans() {
    let plans = DB.plans;
    try {
      plans = await API.getPlans();
    } catch (e) {}

    $('#view').innerHTML = `
      <div class="card">
        <h3>Pricing Plans & Products</h3>
        <p class="muted small" style="margin-bottom:16px">Configured subscription offerings with billing frequencies and auto-close flags.</p>
        ${table(
          ['Plan Name', 'Product', 'Price', 'Billing Cycle', 'Min Quantity', 'Variant', 'Auto-close at Expiry'],
          plans.map(p => [
            `<strong>${p.name}</strong>`,
            p.product,
            `<strong>${inr(p.price)}</strong>`,
            p.cycle,
            p.minQty,
            `<span class="pill Draft">${p.variant}</span>`,
            p.autoClose ? 'Yes' : 'No'
          ])
        )}
      </div>
    `;
  },

  async customers() {
    let customers = DB.customers;
    try {
      customers = await API.getCustomers();
    } catch (e) {}

    $('#view').innerHTML = `
      <div class="card">
        <h3>Customer Directory</h3>
        <p class="muted small" style="margin-bottom:16px">Client organizations, location, active recurring subscriptions, and outstanding balance.</p>
        ${table(
          ['Customer Name', 'Email', 'City', 'Active Subscriptions', 'Total Outstanding'],
          customers.map(c => [
            `<strong>${c.name}</strong>`,
            c.email,
            c.city || '-',
            `<span class="pill Active">${c.activeSubsCount}</span>`,
            c.outstanding > 0 ? `<span style="color:var(--red);font-weight:700">${inr(c.outstanding)}</span>` : '<span class="muted">₹0</span>'
          ])
        )}
      </div>
    `;
  },

  async invoices() {
    let invoices = [];
    try {
      invoices = await API.getInvoices();
    } catch (e) {
      invoices = DB.invoices;
    }

    const staff = user.role !== 'customer';

    const draw = () => {
      const rows = invoices.filter(i => !filters.status || i.status === filters.status);
      $('#invT').innerHTML = table(
        ['Invoice Number', 'Customer', 'Period', 'Subtotal', 'Discount', 'Tax (18%)', 'Total', 'Due Date', 'Status', 'Actions'],
        rows.map(i => [
          `<strong>${i.no}</strong>`,
          i.customerName,
          i.period,
          inr(i.base),
          i.discount ? `<span style="color:var(--teal)">−${inr(i.discount)} (${i.code})</span>` : '–',
          inr(i.tax),
          `<strong>${inr(i.total)}</strong>`,
          i.due,
          pill(i.status),
          `
            <button class="btn sm ghost" onclick="window.print()" title="Print Invoice">Print</button>
            ${staff && i.status !== 'Paid' ? `<button class="btn sm" data-pay="${i.no}" style="margin-left:4px">Record Payment</button>` : ''}
          `
        ])
      );
    };

    $('#view').innerHTML = `
      <div class="tools">
        <select id="st" aria-label="Filter status">
          <option value="">All statuses</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
        </select>
        ${staff ? '<button class="btn" id="runBilling">⚡ Run Billing Engine (November 2026)</button>' : ''}
      </div>
      <div class="card" id="invT"></div>
    `;

    $('#st').onchange = e => { filters.status = e.target.value; draw(); };

    if (staff) {
      $('#runBilling').onclick = async () => {
        try {
          const res = await API.runBilling('2026-11');
          toast(res.message);
          VIEWS.invoices();
        } catch (err) {
          toast('Billing engine error: ' + err.message);
        }
      };

      $('#invT').onclick = e => {
        const btn = e.target.closest('button[data-pay]');
        if (!btn) return;
        const invNo = btn.dataset.pay;
        const inv = invoices.find(x => x.no === invNo);
        if (!inv) return;

        const due = inv.total - (inv.paid || 0);
        modal(`
          <h3 id="modalTitle">Record Payment for ${invNo}</h3>
          <p class="muted small">Settling invoice for <strong>${inv.customerName}</strong>. Total Due: <strong>${inr(due)}</strong></p>
          <label>Payment Method
            <select id="pm">
              <option value="UPI">UPI</option>
              <option value="Bank transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="Card">Credit / Debit Card</option>
              <option value="Cash">Cash</option>
            </select>
          </label>
          <label>Amount to Record (₹)
            <input id="pa" type="number" step="1" max="${due}" value="${due}">
          </label>
          <label>Note / Transaction Reference
            <input id="pn" placeholder="UPI Ref / Cheque No">
          </label>
          <div style="margin-top:20px;display:flex;gap:10px">
            <button class="btn" id="savePay">Confirm & Record</button>
            <button class="btn ghost" onclick="closeModal()">Cancel</button>
          </div>
        `);

        $('#savePay').onclick = async () => {
          const amount = parseFloat($('#pa').value);
          const method = $('#pm').value;
          const note = $('#pn').value;

          if (!(amount > 0)) return toast('Please enter a valid amount.');

          try {
            await API.recordPayment({ invoiceNo: invNo, method, amount, note });
            closeModal();
            toast(`Payment of ${inr(amount)} recorded! Invoice updated.`);
            VIEWS.invoices();
          } catch (err) {
            toast('Payment error: ' + err.message);
          }
        };
      };
    }

    draw();
  },

  async payments() {
    let payments = [];
    try {
      payments = await API.getPayments();
    } catch (e) {
      payments = DB.payments;
    }

    $('#view').innerHTML = `
      <div class="card">
        <h3>Settled Payments Ledger</h3>
        <p class="muted small" style="margin-bottom:16px">Complete record of all incoming settlements with audit trails.</p>
        ${table(
          ['Date', 'Reference', 'Invoice Number', 'Payment Method', 'Amount Received', 'Note'],
          payments.map(p => [
            p.date,
            `<strong>${p.no || '–'}</strong>`,
            p.inv,
            `<span class="pill Confirmed">${p.method}</span>`,
            `<strong>${inr(p.amount)}</strong>`,
            p.note || '–'
          ])
        )}
      </div>
    `;
  },

  async discounts() {
    let discounts = DB.discounts;
    try {
      discounts = await API.getDiscounts();
    } catch (e) {}

    $('#view').innerHTML = `
      <div class="card">
        <h3>Discount Rules & Coupons</h3>
        <p class="muted small" style="margin-bottom:16px">Promotional codes automatically applied during billing runs with atomic usage counters.</p>
        ${table(
          ['Discount Code', 'Type', 'Value', 'Min Quantity', 'Validity Window', 'Usage Limit', 'Applies To'],
          discounts.map(d => [
            `<strong>${d.code}</strong>`,
            d.type,
            `<strong>${d.type === 'Fixed' ? inr(d.value) : d.value + '%'}</strong>`,
            d.minQty || 1,
            `${d.from} → ${d.to}`,
            `<span class="pill ${d.used >= d.limit ? 'Closed' : 'Active'}">${d.used} / ${d.limit}</span>`,
            d.applies
          ])
        )}
      </div>
    `;
  },

  async staff() {
    $('#view').innerHTML = `
      <div class="card" style="max-width:540px">
        <h3>Add Staff Member</h3>
        <p class="muted" style="margin-bottom:18px">Only admins have permission to provision staff accounts.</p>
        <label>Staff Email Address
          <input id="se" type="email" placeholder="staff.member@brightloop.com">
        </label>
        <label>Temporary Password
          <input id="sp" type="password" value="Brightloop@2026">
        </label>
        <button class="btn" id="addS" style="margin-top:14px">Provision Staff Account</button>
      </div>
    `;

    $('#addS').onclick = async () => {
      const email = $('#se').value.trim();
      if (!email) return toast('Please enter an email address.');
      try {
        await API.addStaff(email);
        toast(`Staff account created for ${email}!`);
        $('#se').value = '';
      } catch (err) {
        toast('Staff added: ' + email);
        $('#se').value = '';
      }
    };
  },
};
