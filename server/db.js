const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'dev.db');
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for high performance
db.exec('PRAGMA foreign_keys = ON;');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, key] = stored.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CUSTOMER',
      customer_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      city TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'SERVICE',
      sales_price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      attribute_name TEXT NOT NULL,
      attribute_value TEXT NOT NULL,
      price_extra REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      price REAL NOT NULL,
      billing_period TEXT DEFAULT 'Monthly',
      min_quantity INTEGER DEFAULT 1,
      available_from DATETIME,
      available_to DATETIME,
      auto_close INTEGER DEFAULT 0,
      closable_early INTEGER DEFAULT 1,
      pausable INTEGER DEFAULT 1,
      renewable INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (variant_id) REFERENCES product_variants(id)
    );

    CREATE TABLE IF NOT EXISTS quotation_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plan_id TEXT,
      validity_days INTEGER DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS quotation_template_lines (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      FOREIGN KEY (template_id) REFERENCES quotation_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS taxes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rate REAL NOT NULL,
      applies_to TEXT DEFAULT 'ALL',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      min_purchase REAL,
      min_quantity INTEGER DEFAULT 1,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      usage_limit INTEGER DEFAULT 100,
      used_count INTEGER DEFAULT 0,
      applies_to TEXT DEFAULT 'All subscriptions',
      target_product_id TEXT,
      target_plan_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      subscription_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT DEFAULT 'Draft',
      start_date DATETIME NOT NULL,
      expiry_date DATETIME NOT NULL,
      next_billing_date DATETIME NOT NULL,
      payment_terms TEXT DEFAULT 'Net 15',
      auto_close INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS subscription_lines (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      tax_id TEXT,
      tax_amount REAL DEFAULT 0,
      amount REAL NOT NULL,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (tax_id) REFERENCES taxes(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      subscription_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      billing_period_start TEXT NOT NULL,
      billing_period_end TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      discount_code TEXT,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'Confirmed',
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      UNIQUE(subscription_id, billing_period_start)
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT UNIQUE NOT NULL,
      invoice_id TEXT NOT NULL,
      method TEXT DEFAULT 'UPI',
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
  `);
}

function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    return; // Already seeded
  }

  console.log('Seeding database with default records...');
  const defaultPw = hashPassword('Brightloop@2026');

  // Admin and Staff users
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)
  `).run('user-admin-1', 'admin@brightloop.com', defaultPw, 'ADMIN');

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)
  `).run('user-staff-1', 'staff@brightloop.com', defaultPw, 'STAFF');

  // Customers
  const customerList = [
    { id: 'c1', name: 'Aarav Traders', email: 'aarav@traders.in', city: 'Lucknow' },
    { id: 'c2', name: 'Nova Retail Pvt Ltd', email: 'accounts@novaretail.in', city: 'Delhi' },
    { id: 'c3', name: 'Sapna Boutique', email: 'sapna@boutique.in', city: 'Kanpur' },
    { id: 'c4', name: 'Helix Logistics', email: 'finance@helix.com', city: 'Mumbai' },
    { id: 'c5', name: 'GreenLeaf Foods', email: 'hello@greenleaf.in', city: 'Pune' },
    { id: 'c6', name: 'Kiran Clinics', email: 'admin@kiranclinics.in', city: 'Jaipur' },
  ];

  for (const c of customerList) {
    db.prepare('INSERT INTO customers (id, name, email, city) VALUES (?, ?, ?, ?)')
      .run(c.id, c.name, c.email, c.city);

    db.prepare('INSERT INTO users (id, email, password_hash, role, customer_id) VALUES (?, ?, ?, ?, ?)')
      .run('u-' + c.id, c.email, defaultPw, 'CUSTOMER', c.id);
  }

  // Products
  db.prepare('INSERT INTO products (id, name, type, sales_price, cost_price, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run('prod-1', 'Brightloop CRM', 'SERVICE', 999, 200, 'Customer relationship and sales system');
  db.prepare('INSERT INTO products (id, name, type, sales_price, cost_price, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run('prod-2', 'Brightloop Suite', 'SERVICE', 24999, 5000, 'Complete Enterprise ERP & Billing');
  db.prepare('INSERT INTO products (id, name, type, sales_price, cost_price, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run('prod-3', 'Brightloop Insights', 'SERVICE', 499, 50, 'Cohort analytics and recurring revenue reports');

  // Variants
  db.prepare('INSERT INTO product_variants (id, product_id, attribute_name, attribute_value, price_extra) VALUES (?, ?, ?, ?, ?)')
    .run('var-1', 'prod-1', 'Brand', 'Standard', 0);
  db.prepare('INSERT INTO product_variants (id, product_id, attribute_name, attribute_value, price_extra) VALUES (?, ?, ?, ?, ?)')
    .run('var-2', 'prod-1', 'Brand', 'Odoo brand (+560)', 560);
  db.prepare('INSERT INTO product_variants (id, product_id, attribute_name, attribute_value, price_extra) VALUES (?, ?, ?, ?, ?)')
    .run('var-3', 'prod-2', 'Brand', 'Standard', 0);
  db.prepare('INSERT INTO product_variants (id, product_id, attribute_name, attribute_value, price_extra) VALUES (?, ?, ?, ?, ?)')
    .run('var-4', 'prod-3', 'Brand', 'Standard', 0);

  // Plans
  db.prepare(`
    INSERT INTO plans (id, name, product_id, variant_id, price, billing_period, min_quantity, auto_close, pausable, renewable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('plan-1', 'Starter', 'prod-1', 'var-1', 999, 'Monthly', 1, 1, 1, 1);

  db.prepare(`
    INSERT INTO plans (id, name, product_id, variant_id, price, billing_period, min_quantity, auto_close, pausable, renewable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('plan-2', 'Business', 'prod-1', 'var-2', 2499, 'Monthly', 3, 0, 1, 1);

  db.prepare(`
    INSERT INTO plans (id, name, product_id, variant_id, price, billing_period, min_quantity, auto_close, pausable, renewable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('plan-3', 'Enterprise Yearly', 'prod-2', 'var-3', 24999, 'Yearly', 10, 0, 1, 1);

  db.prepare(`
    INSERT INTO plans (id, name, product_id, variant_id, price, billing_period, min_quantity, auto_close, pausable, renewable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('plan-4', 'Analytics Add-on', 'prod-3', 'var-4', 499, 'Monthly', 1, 1, 1, 1);

  // Taxes
  db.prepare('INSERT INTO taxes (id, name, rate, applies_to, is_active) VALUES (?, ?, ?, ?, ?)')
    .run('tax-1', 'GST 18%', 0.18, 'ALL', 1);

  // Discounts
  db.prepare(`
    INSERT INTO discounts (id, code, type, value, min_quantity, start_date, end_date, usage_limit, used_count, applies_to, target_plan_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('disc-1', 'SEATS10', 'Percentage', 10, 5, '2026-07-01', '2026-12-31', 50, 3, 'Business plan', 'plan-2');

  db.prepare(`
    INSERT INTO discounts (id, code, type, value, min_quantity, start_date, end_date, usage_limit, used_count, applies_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('disc-2', 'FLAT500', 'Fixed', 500, 1, '2026-10-01', '2026-11-30', 20, 1, 'All subscriptions');

  // Subscriptions
  const subList = [
    { id: 'sub-1', no: 'SUB-1001', cust: 'c1', plan: 'plan-1', qty: 3, price: 999, start: '2026-07-01', end: '2027-07-01', terms: 'Net 15', status: 'Active' },
    { id: 'sub-2', no: 'SUB-1002', cust: 'c2', plan: 'plan-2', qty: 5, price: 2499, start: '2026-07-01', end: '2027-07-01', terms: 'Net 15', status: 'Active' },
    { id: 'sub-3', no: 'SUB-1003', cust: 'c3', plan: 'plan-1', qty: 1, price: 999, start: '2026-08-01', end: '2027-08-01', terms: 'Net 7', status: 'Active' },
    { id: 'sub-4', no: 'SUB-1004', cust: 'c4', plan: 'plan-3', qty: 12, price: 24999, start: '2026-07-01', end: '2027-07-01', terms: 'Net 30', status: 'Active' },
    { id: 'sub-5', no: 'SUB-1005', cust: 'c5', plan: 'plan-4', qty: 2, price: 499, start: '2026-09-01', end: '2027-09-01', terms: 'Net 15', status: 'Paused' },
    { id: 'sub-6', no: 'SUB-1006', cust: 'c6', plan: 'plan-2', qty: 4, price: 2499, start: '2026-10-01', end: '2027-10-01', terms: 'Net 15', status: 'Confirmed' },
    { id: 'sub-7', no: 'SUB-1007', cust: 'c2', plan: 'plan-4', qty: 5, price: 499, start: '2026-11-01', end: '2027-11-01', terms: 'Net 15', status: 'Quotation' },
    { id: 'sub-8', no: 'SUB-1008', cust: 'c3', plan: 'plan-2', qty: 3, price: 2499, start: '2026-12-01', end: '2027-12-01', terms: 'Net 7', status: 'Draft' },
  ];

  for (const s of subList) {
    db.prepare(`
      INSERT INTO subscriptions (id, subscription_number, customer_id, plan_id, status, start_date, expiry_date, next_billing_date, payment_terms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s.id, s.no, s.cust, s.plan, s.status, s.start, s.end, '2026-11-01', s.terms);

    const amt = s.price * s.qty;
    const taxAmt = Math.round(amt * 0.18);
    db.prepare(`
      INSERT INTO subscription_lines (id, subscription_id, product_id, quantity, unit_price, tax_id, tax_amount, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('line-' + s.id, s.id, 'prod-1', s.qty, s.price, 'tax-1', taxAmt, amt);
  }

  // Invoices & Payments for Jul-Oct 2026
  const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
  let payIndex = 1;

  for (const m of months) {
    for (let i = 0; i < subList.length; i++) {
      const s = subList[i];
      if (!['Active', 'Paused'].includes(s.status) || s.start.slice(0, 7) > m) continue;

      const base = s.price * s.qty;
      const tax = Math.round(base * 0.18);
      const total = base + tax;
      const invNo = `INV-${m.replace('-', '')}-${s.no.slice(-4)}`;
      const invId = `inv-${m}-${s.id}`;
      const isPaid = m < '2026-10' || i % 2 === 0;

      db.prepare(`
        INSERT OR IGNORE INTO invoices (
          id, invoice_number, subscription_id, customer_id, billing_period_start,
          billing_period_end, due_date, subtotal, discount_amount, discount_code,
          tax_amount, total_amount, paid_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invId, invNo, s.id, s.cust, `${m}-01`, `${m}-28`, `${m}-15`,
        base, 0, null, tax, total, isPaid ? total : 0, isPaid ? 'Paid' : 'Confirmed'
      );

      db.prepare(`
        INSERT OR IGNORE INTO invoice_lines (id, invoice_id, product_id, description, quantity, unit_price, tax_amount, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('invl-' + invId, invId, 'prod-1', `Subscription ${s.no} (${m})`, s.qty, s.price, tax, total);

      if (isPaid) {
        const payNo = `PAY-${m.replace('-', '')}-${String(payIndex++).padStart(4, '0')}`;
        const payId = `pay-${m}-${s.id}`;
        const method = ['UPI', 'Bank transfer', 'Card'][i % 3];
        const date = `${m}-${String(5 + (i % 10)).padStart(2, '0')}`;

        db.prepare(`
          INSERT OR IGNORE INTO payments (id, payment_number, invoice_id, method, amount, payment_date, note)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(payId, payNo, invId, method, total, date, 'Payment settled');
      }
    }
  }

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, user_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('audit-init', 'System', 'ROOT', 'DATABASE_INITIALIZED', 'user-admin-1', JSON.stringify({ message: 'Database initialized & seeded' }));

  console.log('Database successfully initialized and seeded!');
}

initDatabase();
seedDatabase();

module.exports = {
  db,
  hashPassword,
  verifyPassword,
};
