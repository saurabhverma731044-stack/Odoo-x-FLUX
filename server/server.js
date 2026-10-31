const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'brightloop-super-secret-key-2026';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static frontend from workspace root
app.use(express.static(path.join(__dirname, '..')));

// Helper: password complexity validator
function isStrongPassword(p) {
  return p && p.length > 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

// Authentication middleware
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ')) 
      ? authHeader.split(' ')[1] 
      : req.cookies?.token;

    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { customer: true },
    });

    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// RBAC middleware
function authorize(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------

// Sign in
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { customer: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (role && user.role !== role.toUpperCase()) {
      return res.status(403).json({ error: `You do not have access as ${role}` });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // dev
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.toLowerCase(),
        customerId: user.customerId,
        customerName: user.customer?.name || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign up (Customer only)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, city } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be 9+ characters with an uppercase letter, a lowercase letter and a special character.',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        city: city || 'Lucknow',
      },
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: 'CUSTOMER',
        customerId: customer.id,
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400000 });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: 'customer',
        customerId: customer.id,
        customerName: customer.name,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role.toLowerCase(),
      customerId: req.user.customerId,
      customerName: req.user.customer?.name || null,
    },
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Don't leak user existence
      return res.json({ message: 'If this email exists, a reset link was generated.' });
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: token,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    console.log(`[PASSWORD_RESET_DEV_LINK] Reset token for ${email}: ${token}`);
    res.json({ message: `Reset link sent to ${email}`, resetToken: token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password must be 9+ characters with uppercase, lowercase and special character.',
      });
    }

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: newHash },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------------------------------------------------
// CUSTOMERS
// -------------------------------------------------------------

app.get('/api/customers', authenticate, authorize(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        subscriptions: { where: { status: 'Active' } },
        invoices: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = customers.map((c) => {
      const outstanding = c.invoices
        .filter((i) => i.status !== 'Paid')
        .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        city: c.city || '-',
        activeSubsCount: c.subscriptions.length,
        outstanding,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// -------------------------------------------------------------
// PLANS & PRODUCTS
// -------------------------------------------------------------

app.get('/api/plans', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      include: { product: true, variant: true },
    });
    const formatted = plans.map((p) => ({
      id: p.id,
      name: p.name,
      product: p.product.name,
      price: p.price,
      cycle: p.billingPeriod,
      minQty: p.minQuantity,
      variant: p.variant ? `${p.variant.attributeValue}` : 'Standard',
      autoClose: p.autoClose,
      pausable: p.pausable,
      renewable: p.renewable,
      closableEarly: p.closableEarly,
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true },
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// -------------------------------------------------------------
// DISCOUNTS & TAXES
// -------------------------------------------------------------

app.get('/api/discounts', authenticate, async (req, res) => {
  try {
    const discounts = await prisma.discount.findMany();
    const formatted = discounts.map((d) => ({
      id: d.id,
      code: d.code,
      type: d.type,
      value: d.value,
      minQty: d.minQuantity,
      from: d.startDate.toISOString().slice(0, 10),
      to: d.endDate.toISOString().slice(0, 10),
      limit: d.usageLimit,
      used: d.usedCount,
      applies: d.appliesTo,
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch discounts' });
  }
});

app.get('/api/taxes', async (req, res) => {
  try {
    const taxes = await prisma.tax.findMany({ where: { isActive: true } });
    res.json(taxes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch taxes' });
  }
});

// -------------------------------------------------------------
// SUBSCRIPTIONS
// -------------------------------------------------------------

app.get('/api/subscriptions', authenticate, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'CUSTOMER') {
      where.customerId = req.user.customerId;
    }
    const subs = await prisma.subscription.findMany({
      where,
      include: {
        customer: true,
        plan: { include: { product: true } },
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = subs.map((s) => ({
      id: s.id,
      no: s.subscriptionNumber,
      cust: s.customerId,
      customerName: s.customer.name,
      planId: s.planId,
      planName: s.plan.name,
      planPrice: s.plan.price,
      planCycle: s.plan.billingPeriod,
      qty: s.lines[0]?.quantity || 1,
      start: s.startDate.toISOString().slice(0, 10),
      end: s.expiryDate.toISOString().slice(0, 10),
      terms: s.paymentTerms,
      status: s.status,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Create subscription
app.post('/api/subscriptions', authenticate, authorize(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { customerId, planId, quantity, terms } = req.body;
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { product: true },
    });
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const count = await prisma.subscription.count();
    const subNo = `SUB-${1001 + count}`;
    const qty = Math.max(parseInt(quantity) || 1, plan.minQuantity);
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const tax = await prisma.tax.findFirst({ where: { isActive: true } });
    const taxRate = tax ? tax.rate : 0.18;
    const unitPrice = plan.price;
    const taxAmt = Math.round(unitPrice * qty * taxRate);

    const sub = await prisma.subscription.create({
      data: {
        subscriptionNumber: subNo,
        customerId,
        planId,
        status: 'Draft',
        startDate,
        expiryDate,
        nextBillingDate: new Date(),
        paymentTerms: terms || 'Net 15',
        autoClose: plan.autoClose,
        lines: {
          create: [
            {
              productId: plan.productId,
              variantId: plan.variantId,
              quantity: qty,
              unitPrice: unitPrice,
              taxId: tax ? tax.id : null,
              taxAmount: taxAmt,
              amount: unitPrice * qty,
            },
          ],
        },
      },
      include: { customer: true, plan: true },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Subscription',
        entityId: sub.id,
        action: 'CREATED_DRAFT',
        userId: req.user.id,
        details: JSON.stringify({ subscriptionNumber: subNo, customerId, planId }),
      },
    });

    res.status(201).json(sub);
  } catch (err) {
    console.error('Create sub error:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// State transition
app.post('/api/subscriptions/:id/transition', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { nextStatus } = req.body;

    const sub = await prisma.subscription.findFirst({
      where: {
        OR: [{ id }, { subscriptionNumber: id }],
      },
      include: { plan: true },
    });

    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    // Customer portal permissions
    if (req.user.role === 'CUSTOMER') {
      if (sub.customerId !== req.user.customerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      // Customers can only pause or close if the plan allows
      if (nextStatus === 'Paused' && !sub.plan.pausable) {
        return res.status(400).json({ error: 'This plan does not permit pausing' });
      }
      if (nextStatus === 'Closed' && !sub.plan.closableEarly) {
        return res.status(400).json({ error: 'This plan does not permit closing early' });
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: nextStatus },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Subscription',
        entityId: sub.id,
        action: `TRANSITION_${nextStatus.toUpperCase()}`,
        userId: req.user.id,
        details: JSON.stringify({ from: sub.status, to: nextStatus }),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update subscription status' });
  }
});

// -------------------------------------------------------------
// INVOICES & BILLING ENGINE
// -------------------------------------------------------------

app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'CUSTOMER') {
      where.customerId = req.user.customerId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { customer: true, subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const formatted = invoices.map((inv) => {
      let status = inv.status;
      if (status !== 'Paid' && inv.dueDate < now) {
        status = 'Overdue';
      }
      return {
        id: inv.id,
        no: inv.invoiceNumber,
        sub: inv.subscription.subscriptionNumber,
        cust: inv.customerId,
        customerName: inv.customer.name,
        period: inv.billingPeriodStart.toISOString().slice(0, 7),
        base: inv.subtotal,
        discount: inv.discountAmount,
        code: inv.discountCode,
        tax: inv.taxAmount,
        total: inv.totalAmount,
        paid: inv.paidAmount,
        due: inv.dueDate.toISOString().slice(0, 10),
        status: status,
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Idempotent Billing Run
app.post('/api/invoices/run-billing', authenticate, authorize(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { period } = req.body; // e.g. '2026-11'
    const targetPeriod = period || new Date().toISOString().slice(0, 7);
    const periodStart = new Date(`${targetPeriod}-01`);
    const periodEnd = new Date(`${targetPeriod}-28`);
    const dueDate = new Date(`${targetPeriod}-15`);

    // Find all active subscriptions
    const activeSubs = await prisma.subscription.findMany({
      where: { status: 'Active' },
      include: {
        customer: true,
        plan: { include: { product: true } },
        lines: true,
      },
    });

    let createdCount = 0;
    const discounts = await prisma.discount.findMany({
      where: {
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    const tax = await prisma.tax.findFirst({ where: { isActive: true } });
    const taxRate = tax ? tax.rate : 0.18;

    for (const sub of activeSubs) {
      // Check idempotency: unique key (subscriptionId, billingPeriodStart)
      const existing = await prisma.invoice.findFirst({
        where: {
          subscriptionId: sub.id,
          billingPeriodStart: periodStart,
        },
      });

      if (existing) continue; // Already billed for this period!

      const qty = sub.lines[0]?.quantity || 1;
      const base = sub.plan.price * qty;

      // Find matching discount
      let discountAmt = 0;
      let matchedDiscount = null;

      for (const d of discounts) {
        if (d.usedCount < d.usageLimit && qty >= (d.minQuantity || 1)) {
          if (d.appliesTo === 'All subscriptions' || d.targetPlanId === sub.planId || `${sub.plan.name} plan` === d.appliesTo) {
            discountAmt = d.type === 'Percentage' ? (base * d.value) / 100 : d.value;
            matchedDiscount = d;
            break;
          }
        }
      }

      const net = Math.max(0, base - discountAmt);
      const taxAmt = Math.round(net * taxRate);
      const total = net + taxAmt;
      const invNo = `INV-${targetPeriod.replace('-', '')}-${sub.subscriptionNumber.slice(-4)}`;

      await prisma.invoice.create({
        data: {
          invoiceNumber: invNo,
          subscriptionId: sub.id,
          customerId: sub.customerId,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          dueDate: dueDate,
          subtotal: base,
          discountAmount: discountAmt,
          discountCode: matchedDiscount ? matchedDiscount.code : null,
          taxAmount: taxAmt,
          totalAmount: total,
          paidAmount: 0,
          status: 'Confirmed',
          lines: {
            create: [
              {
                productId: sub.plan.productId,
                description: `${sub.plan.name} subscription (${targetPeriod})`,
                quantity: qty,
                unitPrice: sub.plan.price,
                taxAmount: taxAmt,
                totalAmount: total,
              },
            ],
          },
        },
      });

      // Atomic increment discount usage
      if (matchedDiscount) {
        await prisma.discount.update({
          where: { id: matchedDiscount.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      createdCount++;
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'Invoice',
        entityId: targetPeriod,
        action: 'BILLING_RUN_EXECUTED',
        userId: req.user.id,
        details: JSON.stringify({ period: targetPeriod, invoicesCreated: createdCount }),
      },
    });

    res.json({
      success: true,
      period: targetPeriod,
      invoicesCreated: createdCount,
      message: createdCount
        ? `${createdCount} invoices successfully generated for ${targetPeriod}`
        : `All active subscriptions for ${targetPeriod} were already invoiced.`,
    });
  } catch (err) {
    console.error('Billing run error:', err);
    res.status(500).json({ error: 'Failed to run billing' });
  }
});

// -------------------------------------------------------------
// PAYMENTS
// -------------------------------------------------------------

app.get('/api/payments', authenticate, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'CUSTOMER') {
      where.invoice = { customerId: req.user.customerId };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { invoice: true },
      orderBy: { paymentDate: 'desc' },
    });

    const formatted = payments.map((p) => ({
      id: p.id,
      no: p.paymentNumber,
      inv: p.invoice.invoiceNumber,
      method: p.method,
      amount: p.amount,
      date: p.paymentDate.toISOString().slice(0, 10),
      note: p.note || '–',
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Record Payment
app.post('/api/payments', authenticate, authorize(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { invoiceNo, method, amount, note } = req.body;
    const inv = await prisma.invoice.findFirst({
      where: { invoiceNumber: invoiceNo },
    });

    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const due = inv.totalAmount - inv.paidAmount;
    const payAmt = parseFloat(amount);

    if (isNaN(payAmt) || payAmt <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' });
    }

    if (payAmt > due) {
      return res.status(400).json({ error: `Amount exceeds remaining due of ₹${due}` });
    }

    const count = await prisma.payment.count();
    const payNo = `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(count + 1).padStart(4, '0')}`;

    const payment = await prisma.payment.create({
      data: {
        paymentNumber: payNo,
        invoiceId: inv.id,
        method: method || 'UPI',
        amount: payAmt,
        note: note || '',
      },
    });

    const newPaid = inv.paidAmount + payAmt;
    const newStatus = newPaid >= inv.totalAmount ? 'Paid' : inv.status;

    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        paidAmount: newPaid,
        status: newStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Payment',
        entityId: payment.id,
        action: 'PAYMENT_RECORDED',
        userId: req.user.id,
        details: JSON.stringify({ invoiceNo, amount: payAmt, newStatus }),
      },
    });

    res.status(201).json({ payment, newStatus, remainingDue: inv.totalAmount - newPaid });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// -------------------------------------------------------------
// STAFF (Admin only)
// -------------------------------------------------------------

app.get('/api/staff', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      select: { id: true, email: true, createdAt: true },
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

app.post('/api/staff', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Staff email required' });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const pwd = password || 'Brightloop@2026';
    const hash = await bcrypt.hash(pwd, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hash,
        role: 'STAFF',
      },
    });

    res.status(201).json({ id: user.id, email: user.email, message: 'Staff member created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create staff' });
  }
});

// -------------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------------

app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const { period } = req.query; // 'all' or '2026-10'

    const allSubs = await prisma.subscription.findMany({
      include: { plan: true },
    });
    const activeSubs = allSubs.filter((s) => s.status === 'Active');

    const mrr = activeSubs.reduce((sum, s) => {
      const price = s.plan.billingPeriod === 'Yearly' ? s.plan.price / 12 : s.plan.price;
      return sum + price;
    }, 0);

    const invoices = await prisma.invoice.findMany({
      include: { customer: true },
    });

    const payments = await prisma.payment.findMany();

    // Months available
    const monthSet = new Set(invoices.map((i) => i.billingPeriodStart.toISOString().slice(0, 7)));
    const months = Array.from(monthSet).sort();

    const filteredInvoices = period && period !== 'all'
      ? invoices.filter((i) => i.billingPeriodStart.toISOString().slice(0, 7) === period)
      : invoices;

    const filteredPayments = period && period !== 'all'
      ? payments.filter((p) => p.paymentDate.toISOString().slice(0, 7) === period)
      : payments;

    const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const stillOwed = filteredInvoices
      .filter((i) => i.status !== 'Paid')
      .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);

    const now = new Date();
    const overdueInvoices = filteredInvoices
      .filter((i) => i.status !== 'Paid' && i.dueDate < now)
      .map((i) => ({
        no: i.invoiceNumber,
        customerName: i.customer.name,
        due: i.dueDate.toISOString().slice(0, 10),
        amountDue: i.totalAmount - i.paidAmount,
      }));

    const billedAmount = filteredInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const collectionRate = billedAmount > 0 ? (totalRevenue / billedAmount) * 100 : 0;

    // Per-month payments for chart
    const monthlySeries = months.map((m) => {
      const monthlyTotal = payments
        .filter((p) => p.paymentDate.toISOString().slice(0, 7) === m)
        .reduce((sum, p) => sum + p.amount, 0);
      return { month: m, amount: monthlyTotal };
    });

    // Plans distribution
    const plans = await prisma.plan.findMany();
    const byPlan = plans.map((p) => ({
      name: p.name,
      count: activeSubs.filter((s) => s.planId === p.id).length,
    }));

    res.json({
      activeSubsCount: activeSubs.length,
      totalSubsCount: allSubs.length,
      mrr: Math.round(mrr),
      totalRevenue,
      paymentCount: filteredPayments.length,
      stillOwed,
      overdueCount: overdueInvoices.length,
      overdueList: overdueInvoices.slice(0, 6),
      collectionRate: Math.round(collectionRate),
      months,
      monthlySeries,
      byPlan,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to compute dashboard metrics' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Brightloop Subscription Engine running at http://localhost:${PORT}`);
});
