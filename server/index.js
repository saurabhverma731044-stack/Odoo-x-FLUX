const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const crypto = require('node:crypto');
const { db, hashPassword, verifyPassword } = require('./db');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'brightloop-super-secret-key-2026';

// Helper: Password validator (9+ chars, uppercase, lowercase, special char)
function isStrongPassword(p) {
  return p && p.length > 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

// Token generation and verification
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 86400000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  if (expectedSig !== signature) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded && decoded.userId) {
      return db.prepare('SELECT id, email, role, customer_id FROM users WHERE id = ?').get(decoded.userId);
    }
  }
  return null;
}

// Static MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  // Set CORS for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');

  // -----------------------------------------------------------
  // API ROUTES
  // -----------------------------------------------------------

  if (pathname.startsWith('/api/')) {
    // 1. Health check
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        database: 'connected',
        engine: 'SQLite 3 via Node.js native engine',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Auth: Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password, role } = body;
      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password are required' });
      }

      const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
      if (!user) {
        return sendJson(res, 401, { error: 'Invalid email or password' });
      }

      if (!verifyPassword(password, user.password_hash)) {
        return sendJson(res, 401, { error: 'Invalid email or password' });
      }

      if (role && user.role.toLowerCase() !== role.toLowerCase()) {
        return sendJson(res, 403, { error: `Account does not have ${role} role privileges` });
      }

      const token = createToken({ userId: user.id, email: user.email, role: user.role });
      const customer = user.customer_id
        ? db.prepare('SELECT * FROM customers WHERE id = ?').get(user.customer_id)
        : null;

      return sendJson(res, 200, {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role.toLowerCase(),
          customerId: user.customer_id,
          customerName: customer ? customer.name : null,
        },
      });
    }

    // 3. Auth: Signup
    if (pathname === '/api/auth/signup' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password, name, city } = body;

      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password are required' });
      }

      if (!isStrongPassword(password)) {
        return sendJson(res, 400, {
          error: 'Password must be 9+ characters with an uppercase letter, a lowercase letter, and a special character.',
        });
      }

      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
      if (existing) {
        return sendJson(res, 400, { error: 'An account with this email already exists' });
      }

      const custId = 'c-' + crypto.randomUUID().slice(0, 8);
      const userId = 'u-' + crypto.randomUUID().slice(0, 8);
      const custName = name || email.split('@')[0];

      db.prepare('INSERT INTO customers (id, name, email, city) VALUES (?, ?, ?, ?)')
        .run(custId, custName, email.toLowerCase(), city || 'Lucknow');

      const pwHash = hashPassword(password);
      db.prepare('INSERT INTO users (id, email, password_hash, role, customer_id) VALUES (?, ?, ?, ?, ?)')
        .run(userId, email.toLowerCase(), pwHash, 'CUSTOMER', custId);

      const token = createToken({ userId, email: email.toLowerCase(), role: 'CUSTOMER' });

      return sendJson(res, 201, {
        token,
        user: {
          id: userId,
          email: email.toLowerCase(),
          role: 'customer',
          customerId: custId,
          customerName: custName,
        },
      });
    }

    // 4. Auth: Me
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = getAuthUser(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated' });

      const customer = user.customer_id
        ? db.prepare('SELECT * FROM customers WHERE id = ?').get(user.customer_id)
        : null;

      return sendJson(res, 200, {
        user: {
          id: user.id,
          email: user.email,
          role: user.role.toLowerCase(),
          customerId: user.customer_id,
          customerName: customer ? customer.name : null,
        },
      });
    }

    // 5. Auth: Forgot Password
    if (pathname === '/api/auth/forgot-password' && method === 'POST') {
      const body = await parseBody(req);
      const { email } = body;
      if (!email) return sendJson(res, 400, { error: 'Email is required' });

      const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
      if (user) {
        const resetToken = crypto.randomBytes(20).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000).toISOString();
        db.prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
          .run('prt-' + crypto.randomUUID().slice(0, 8), user.id, resetToken, expiresAt);
        console.log(`[PASSWORD_RESET_LINK] Token for ${email}: ${resetToken}`);
      }

      return sendJson(res, 200, { message: `Password reset instructions sent to ${email}` });
    }

    // 6. Customers list
    if (pathname === '/api/customers' && method === 'GET') {
      const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
      const result = customers.map((c) => {
        const activeCount = db.prepare('SELECT count(*) as count FROM subscriptions WHERE customer_id = ? AND status = ?').get(c.id, 'Active').count;
        const unpaidInvoices = db.prepare('SELECT total_amount, paid_amount FROM invoices WHERE customer_id = ? AND status != ?').all(c.id, 'Paid');
        const outstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          city: c.city || '-',
          activeSubsCount: activeCount,
          outstanding,
        };
      });
      return sendJson(res, 200, result);
    }

    // 7. Plans list
    if (pathname === '/api/plans' && method === 'GET') {
      const plans = db.prepare(`
        SELECT p.*, pr.name as product_name, pv.attribute_value as variant_name
        FROM plans p
        LEFT JOIN products pr ON p.product_id = pr.id
        LEFT JOIN product_variants pv ON p.variant_id = pv.id
      `).all();

      const formatted = plans.map((p) => ({
        id: p.id,
        name: p.name,
        product: p.product_name || 'Brightloop CRM',
        price: p.price,
        cycle: p.billing_period,
        minQty: p.min_quantity,
        variant: p.variant_name || 'Standard',
        autoClose: Boolean(p.auto_close),
        pausable: Boolean(p.pausable),
        renewable: Boolean(p.renewable),
        closableEarly: Boolean(p.closable_early),
      }));
      return sendJson(res, 200, formatted);
    }

    // 8. Products list
    if (pathname === '/api/products' && method === 'GET') {
      const products = db.prepare('SELECT * FROM products').all();
      return sendJson(res, 200, products);
    }

    // 9. Discounts list
    if (pathname === '/api/discounts' && method === 'GET') {
      const discounts = db.prepare('SELECT * FROM discounts ORDER BY created_at DESC').all();
      const formatted = discounts.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        value: d.value,
        minQty: d.min_quantity,
        from: String(d.start_date).slice(0, 10),
        to: String(d.end_date).slice(0, 10),
        limit: d.usage_limit,
        used: d.used_count,
        applies: d.applies_to,
      }));
      return sendJson(res, 200, formatted);
    }

    // 10. Subscriptions list
    if (pathname === '/api/subscriptions' && method === 'GET') {
      const user = getAuthUser(req);
      let query = `
        SELECT s.*, c.name as customer_name, p.name as plan_name, p.price as plan_price, p.billing_period as plan_cycle,
               sl.quantity as qty
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN plans p ON s.plan_id = p.id
        LEFT JOIN subscription_lines sl ON sl.subscription_id = s.id
      `;
      let params = [];
      if (user && user.role === 'CUSTOMER') {
        query += ' WHERE s.customer_id = ?';
        params.push(user.customer_id);
      }
      query += ' ORDER BY s.created_at DESC';

      const rows = db.prepare(query).all(...params);
      const formatted = rows.map((s) => ({
        id: s.id,
        no: s.subscription_number,
        cust: s.customer_id,
        customerName: s.customer_name,
        planId: s.plan_id,
        planName: s.plan_name,
        planPrice: s.plan_price,
        planCycle: s.plan_cycle,
        qty: s.qty || 1,
        start: String(s.start_date).slice(0, 10),
        end: String(s.expiry_date).slice(0, 10),
        terms: s.payment_terms,
        status: s.status,
      }));
      return sendJson(res, 200, formatted);
    }

    // 11. Create Subscription
    if (pathname === '/api/subscriptions' && method === 'POST') {
      const body = await parseBody(req);
      const { customerId, planId, quantity, terms } = body;

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (!plan) return sendJson(res, 400, { error: 'Invalid plan' });

      const totalCount = db.prepare('SELECT count(*) as count FROM subscriptions').get().count;
      const subNo = `SUB-${1001 + totalCount}`;
      const subId = 'sub-' + crypto.randomUUID().slice(0, 8);
      const qty = Math.max(parseInt(quantity) || 1, plan.min_quantity);

      const today = new Date().toISOString().slice(0, 10);
      const expiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

      db.prepare(`
        INSERT INTO subscriptions (id, subscription_number, customer_id, plan_id, status, start_date, expiry_date, next_billing_date, payment_terms, auto_close)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(subId, subNo, customerId, planId, 'Draft', today, expiry, today, terms || 'Net 15', plan.auto_close);

      const amount = plan.price * qty;
      const taxAmt = Math.round(amount * 0.18);
      db.prepare(`
        INSERT INTO subscription_lines (id, subscription_id, product_id, quantity, unit_price, tax_amount, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('line-' + subId, subId, plan.product_id, qty, plan.price, taxAmt, amount);

      db.prepare('INSERT INTO audit_logs (id, entity_type, entity_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .run('aud-' + crypto.randomUUID().slice(0, 8), 'Subscription', subId, 'CREATED_DRAFT', JSON.stringify({ subNo, customerId, planId }));

      return sendJson(res, 201, { success: true, id: subId, no: subNo });
    }

    // 12. Subscription state transition
    if (pathname.startsWith('/api/subscriptions/') && pathname.endsWith('/transition') && method === 'POST') {
      const parts = pathname.split('/');
      const subIdentifier = parts[3];
      const body = await parseBody(req);
      const { nextStatus } = body;

      const sub = db.prepare(`
        SELECT s.*, p.pausable, p.closable_early
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.id = ? OR s.subscription_number = ?
      `).get(subIdentifier, subIdentifier);

      if (!sub) return sendJson(res, 404, { error: 'Subscription not found' });

      db.prepare('UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(nextStatus, sub.id);

      db.prepare('INSERT INTO audit_logs (id, entity_type, entity_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .run('aud-' + crypto.randomUUID().slice(0, 8), 'Subscription', sub.id, `TRANSITION_${nextStatus.toUpperCase()}`, JSON.stringify({ from: sub.status, to: nextStatus }));

      return sendJson(res, 200, { success: true, status: nextStatus, no: sub.subscription_number });
    }

    // 13. Invoices list
    if (pathname === '/api/invoices' && method === 'GET') {
      const user = getAuthUser(req);
      let query = `
        SELECT i.*, c.name as customer_name, s.subscription_number
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        JOIN subscriptions s ON i.subscription_id = s.id
      `;
      let params = [];
      if (user && user.role === 'CUSTOMER') {
        query += ' WHERE i.customer_id = ?';
        params.push(user.customer_id);
      }
      query += ' ORDER BY i.created_at DESC';

      const rows = db.prepare(query).all(...params);
      const today = new Date().toISOString().slice(0, 10);

      const formatted = rows.map((inv) => {
        let status = inv.status;
        if (status !== 'Paid' && inv.due_date < today) {
          status = 'Overdue';
        }
        return {
          id: inv.id,
          no: inv.invoice_number,
          sub: inv.subscription_number,
          cust: inv.customer_id,
          customerName: inv.customer_name,
          period: String(inv.billing_period_start).slice(0, 7),
          base: inv.subtotal,
          discount: inv.discount_amount,
          code: inv.discount_code,
          tax: inv.tax_amount,
          total: inv.total_amount,
          paid: inv.paid_amount,
          due: String(inv.due_date).slice(0, 10),
          status: status,
        };
      });
      return sendJson(res, 200, formatted);
    }

    // 14. Idempotent Billing Run
    if (pathname === '/api/invoices/run-billing' && method === 'POST') {
      const body = await parseBody(req);
      const targetPeriod = body.period || '2026-11';
      const periodStart = `${targetPeriod}-01`;
      const periodEnd = `${targetPeriod}-28`;
      const dueDate = `${targetPeriod}-15`;

      const activeSubs = db.prepare(`
        SELECT s.*, p.name as plan_name, p.price as plan_price, p.product_id, sl.quantity as qty
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        LEFT JOIN subscription_lines sl ON sl.subscription_id = s.id
        WHERE s.status = 'Active'
      `).all();

      const discounts = db.prepare(`
        SELECT * FROM discounts
        WHERE is_active = 1 AND start_date <= ? AND end_date >= ?
      `).all(periodStart, periodStart);

      let createdCount = 0;

      for (const sub of activeSubs) {
        // Idempotency check: (subscription_id, billing_period_start)
        const existing = db.prepare(`
          SELECT id FROM invoices
          WHERE subscription_id = ? AND billing_period_start = ?
        `).get(sub.id, periodStart);

        if (existing) continue; // Already generated, skip!

        const qty = sub.qty || 1;
        const base = sub.plan_price * qty;

        // Apply discount rule
        let discountAmt = 0;
        let matchedDiscount = null;

        for (const d of discounts) {
          if (d.used_count < d.usage_limit && qty >= (d.min_quantity || 1)) {
            if (d.applies_to === 'All subscriptions' || `${sub.plan_name} plan` === d.applies_to || d.target_plan_id === sub.plan_id) {
              discountAmt = d.type === 'Percentage' ? (base * d.value) / 100 : d.value;
              matchedDiscount = d;
              break;
            }
          }
        }

        const net = Math.max(0, base - discountAmt);
        const tax = Math.round(net * 0.18);
        const total = net + tax;
        const invNo = `INV-${targetPeriod.replace('-', '')}-${sub.subscription_number.slice(-4)}`;
        const invId = `inv-${targetPeriod}-${sub.id}`;

        db.prepare(`
          INSERT INTO invoices (
            id, invoice_number, subscription_id, customer_id, billing_period_start,
            billing_period_end, due_date, subtotal, discount_amount, discount_code,
            tax_amount, total_amount, paid_amount, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(invId, invNo, sub.id, sub.customer_id, periodStart, periodEnd, dueDate, base, discountAmt, matchedDiscount ? matchedDiscount.code : null, tax, total, 0, 'Confirmed');

        db.prepare(`
          INSERT INTO invoice_lines (id, invoice_id, product_id, description, quantity, unit_price, tax_amount, total_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('invl-' + invId, invId, sub.product_id, `Subscription billing ${targetPeriod}`, qty, sub.plan_price, tax, total);

        if (matchedDiscount) {
          db.prepare('UPDATE discounts SET used_count = used_count + 1 WHERE id = ?').run(matchedDiscount.id);
        }

        createdCount++;
      }

      db.prepare('INSERT INTO audit_logs (id, entity_type, entity_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .run('aud-' + crypto.randomUUID().slice(0, 8), 'Invoice', targetPeriod, 'BILLING_RUN_EXECUTED', JSON.stringify({ targetPeriod, invoicesCreated: createdCount }));

      return sendJson(res, 200, {
        success: true,
        period: targetPeriod,
        invoicesCreated: createdCount,
        message: createdCount
          ? `${createdCount} invoices successfully generated for ${targetPeriod}`
          : `All active subscriptions for ${targetPeriod} were already invoiced.`,
      });
    }

    // 15. Payments list
    if (pathname === '/api/payments' && method === 'GET') {
      const rows = db.prepare(`
        SELECT p.*, i.invoice_number
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        ORDER BY p.payment_date DESC
      `).all();

      const formatted = rows.map((p) => ({
        id: p.id,
        no: p.payment_number,
        inv: p.invoice_number,
        method: p.method,
        amount: p.amount,
        date: String(p.payment_date).slice(0, 10),
        note: p.note || '–',
      }));
      return sendJson(res, 200, formatted);
    }

    // 16. Record Payment
    if (pathname === '/api/payments' && method === 'POST') {
      const body = await parseBody(req);
      const { invoiceNo, method, amount, note } = body;

      const inv = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(invoiceNo);
      if (!inv) return sendJson(res, 404, { error: 'Invoice not found' });

      const due = inv.total_amount - inv.paid_amount;
      const payAmt = parseFloat(amount);

      if (isNaN(payAmt) || payAmt <= 0) {
        return sendJson(res, 400, { error: 'Payment amount must be greater than zero' });
      }

      if (payAmt > due) {
        return sendJson(res, 400, { error: `Amount exceeds remaining due of ₹${Math.round(due)}` });
      }

      const count = db.prepare('SELECT count(*) as count FROM payments').get().count;
      const payNo = `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(count + 1).padStart(4, '0')}`;
      const payId = 'pay-' + crypto.randomUUID().slice(0, 8);
      const today = new Date().toISOString().slice(0, 10);

      db.prepare(`
        INSERT INTO payments (id, payment_number, invoice_id, method, amount, payment_date, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(payId, payNo, inv.id, method || 'UPI', payAmt, today, note || '');

      const newPaid = inv.paid_amount + payAmt;
      const newStatus = newPaid >= inv.total_amount ? 'Paid' : inv.status;

      db.prepare('UPDATE invoices SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newPaid, newStatus, inv.id);

      db.prepare('INSERT INTO audit_logs (id, entity_type, entity_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .run('aud-' + crypto.randomUUID().slice(0, 8), 'Payment', payId, 'PAYMENT_RECORDED', JSON.stringify({ invoiceNo, amount: payAmt, newStatus }));

      return sendJson(res, 201, { success: true, paymentNumber: payNo, newStatus, remainingDue: inv.total_amount - newPaid });
    }

    // 17. Staff
    if (pathname === '/api/staff' && method === 'GET') {
      const staff = db.prepare("SELECT id, email, created_at FROM users WHERE role = 'STAFF'").all();
      return sendJson(res, 200, staff);
    }

    if (pathname === '/api/staff' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password } = body;
      if (!email) return sendJson(res, 400, { error: 'Email is required' });

      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
      if (existing) return sendJson(res, 400, { error: 'User already exists' });

      const pw = password || 'Brightloop@2026';
      const hash = hashPassword(pw);
      const userId = 'u-staff-' + crypto.randomUUID().slice(0, 8);

      db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)')
        .run(userId, email.toLowerCase(), hash, 'STAFF');

      return sendJson(res, 201, { success: true, email: email.toLowerCase() });
    }

    // 18. Dashboard Stats
    if (pathname === '/api/dashboard/stats' && method === 'GET') {
      const period = parsedUrl.query.period; // 'all' or '2026-10'

      const activeSubs = db.prepare(`
        SELECT s.*, p.price, p.billing_period, sl.quantity as qty
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        LEFT JOIN subscription_lines sl ON sl.subscription_id = s.id
        WHERE s.status = 'Active'
      `).all();

      const totalSubsCount = db.prepare('SELECT count(*) as count FROM subscriptions').get().count;

      const mrr = activeSubs.reduce((sum, s) => {
        const qty = s.qty || 1;
        const price = s.billing_period === 'Yearly' ? s.price / 12 : s.price;
        return sum + price * qty;
      }, 0);

      const allInvoices = db.prepare(`
        SELECT i.*, c.name as customer_name
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
      `).all();

      const allPayments = db.prepare('SELECT * FROM payments').all();

      // Available distinct months
      const months = Array.from(new Set(allInvoices.map((i) => String(i.billing_period_start).slice(0, 7)))).sort();

      const filteredInvoices = period && period !== 'all'
        ? allInvoices.filter((i) => String(i.billing_period_start).slice(0, 7) === period)
        : allInvoices;

      const filteredPayments = period && period !== 'all'
        ? allPayments.filter((p) => String(p.payment_date).slice(0, 7) === period)
        : allPayments;

      const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
      const stillOwed = filteredInvoices
        .filter((i) => i.status !== 'Paid')
        .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);

      const today = new Date().toISOString().slice(0, 10);
      const overdueList = filteredInvoices
        .filter((i) => i.status !== 'Paid' && i.due_date < today)
        .map((i) => ({
          no: i.invoice_number,
          customerName: i.customer_name,
          due: String(i.due_date).slice(0, 10),
          amountDue: i.total_amount - i.paid_amount,
        }));

      const billedAmount = filteredInvoices.reduce((sum, i) => sum + i.total_amount, 0);
      const collectionRate = billedAmount > 0 ? (totalRevenue / billedAmount) * 100 : 0;

      const monthlySeries = months.map((m) => {
        const amt = allPayments
          .filter((p) => String(p.payment_date).startsWith(m))
          .reduce((sum, p) => sum + p.amount, 0);
        return { month: m, amount: amt };
      });

      const plans = db.prepare('SELECT id, name FROM plans').all();
      const byPlan = plans.map((p) => {
        const count = activeSubs.filter((s) => s.plan_id === p.id).length;
        return { name: p.name, count };
      });

      return sendJson(res, 200, {
        activeSubsCount: activeSubs.length,
        totalSubsCount,
        mrr: Math.round(mrr),
        totalRevenue,
        paymentCount: filteredPayments.length,
        stillOwed,
        overdueCount: overdueList.length,
        overdueList: overdueList.slice(0, 6),
        collectionRate: Math.round(collectionRate),
        months,
        monthlySeries,
        byPlan,
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  // -----------------------------------------------------------
  // STATIC FILE SERVING
  // -----------------------------------------------------------
  let filePath = path.join(__dirname, '..', pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(__dirname, '..', 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('500 Internal Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` Brightloop Subscription Engine Live & Connected!`);
  console.log(` Web UI & API: http://localhost:${PORT}`);
  console.log(` Database: SQLite (dev.db) - 100% relational & indexed`);
  console.log(` Default Logins:`);
  console.log(`   Admin:    admin@brightloop.com / Brightloop@2026`);
  console.log(`   Staff:    staff@brightloop.com / Brightloop@2026`);
  console.log(`   Customer: aarav@traders.in     / Brightloop@2026`);
  console.log(`======================================================\n`);
});
