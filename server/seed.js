const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean old records
  await prisma.auditLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.subscriptionLine.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.quotationTemplateLine.deleteMany({});
  await prisma.quotationTemplate.deleteMany({});
  await prisma.discount.deleteMany({});
  await prisma.tax.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.customer.deleteMany({});

  const defaultPasswordHash = await bcrypt.hash('Brightloop@2026', 10);

  // 1. Create Users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@brightloop.com',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@brightloop.com',
      passwordHash: defaultPasswordHash,
      role: 'STAFF',
    },
  });

  // 2. Customers
  const customerData = [
    { name: 'Aarav Traders', email: 'aarav@traders.in', city: 'Lucknow' },
    { name: 'Nova Retail Pvt Ltd', email: 'accounts@novaretail.in', city: 'Delhi' },
    { name: 'Sapna Boutique', email: 'sapna@boutique.in', city: 'Kanpur' },
    { name: 'Helix Logistics', email: 'finance@helix.com', city: 'Mumbai' },
    { name: 'GreenLeaf Foods', email: 'hello@greenleaf.in', city: 'Pune' },
    { name: 'Kiran Clinics', email: 'admin@kiranclinics.in', city: 'Jaipur' },
  ];

  const customers = [];
  for (const c of customerData) {
    const cust = await prisma.customer.create({
      data: {
        name: c.name,
        email: c.email,
        city: c.city,
      },
    });
    // Create customer portal user
    await prisma.user.create({
      data: {
        email: c.email,
        passwordHash: defaultPasswordHash,
        role: 'CUSTOMER',
        customerId: cust.id,
      },
    });
    customers.push(cust);
  }

  // 3. Products & Variants
  const p1 = await prisma.product.create({
    data: {
      name: 'Brightloop CRM',
      type: 'SERVICE',
      salesPrice: 999,
      costPrice: 200,
      notes: 'Complete customer relationship & sales suite',
      variants: {
        create: [
          { attributeName: 'Brand', attributeValue: 'Standard', priceExtra: 0 },
          { attributeName: 'Brand', attributeValue: 'Odoo brand (+560)', priceExtra: 560 },
        ],
      },
    },
    include: { variants: true },
  });

  const p2 = await prisma.product.create({
    data: {
      name: 'Brightloop Suite',
      type: 'SERVICE',
      salesPrice: 24999,
      costPrice: 5000,
      notes: 'Enterprise ERP, Invoicing, Inventory & Subscriptions',
      variants: {
        create: [
          { attributeName: 'Brand', attributeValue: 'Standard', priceExtra: 0 },
        ],
      },
    },
    include: { variants: true },
  });

  const p3 = await prisma.product.create({
    data: {
      name: 'Brightloop Insights',
      type: 'SERVICE',
      salesPrice: 499,
      costPrice: 50,
      notes: 'Advanced analytics, cohort reports & MRR metrics',
      variants: {
        create: [
          { attributeName: 'Brand', attributeValue: 'Standard', priceExtra: 0 },
        ],
      },
    },
    include: { variants: true },
  });

  // 4. Plans
  const planStarter = await prisma.plan.create({
    data: {
      name: 'Starter',
      productId: p1.id,
      variantId: p1.variants[0].id,
      price: 999,
      billingPeriod: 'Monthly',
      minQuantity: 1,
      autoClose: true,
      closableEarly: true,
      pausable: true,
      renewable: true,
    },
  });

  const planBusiness = await prisma.plan.create({
    data: {
      name: 'Business',
      productId: p1.id,
      variantId: p1.variants[1].id,
      price: 2499,
      billingPeriod: 'Monthly',
      minQuantity: 3,
      autoClose: false,
      closableEarly: true,
      pausable: true,
      renewable: true,
    },
  });

  const planEnterprise = await prisma.plan.create({
    data: {
      name: 'Enterprise Yearly',
      productId: p2.id,
      variantId: p2.variants[0].id,
      price: 24999,
      billingPeriod: 'Yearly',
      minQuantity: 10,
      autoClose: false,
      closableEarly: true,
      pausable: true,
      renewable: true,
    },
  });

  const planAnalytics = await prisma.plan.create({
    data: {
      name: 'Analytics Add-on',
      productId: p3.id,
      variantId: p3.variants[0].id,
      price: 499,
      billingPeriod: 'Monthly',
      minQuantity: 1,
      autoClose: true,
      closableEarly: true,
      pausable: true,
      renewable: true,
    },
  });

  const plansMap = {
    1: planStarter,
    2: planBusiness,
    3: planEnterprise,
    4: planAnalytics,
  };

  // 5. Taxes
  const taxGST = await prisma.tax.create({
    data: {
      name: 'GST 18%',
      rate: 0.18,
      appliesTo: 'ALL',
      isActive: true,
    },
  });

  // 6. Discounts
  const d1 = await prisma.discount.create({
    data: {
      code: 'SEATS10',
      type: 'Percentage',
      value: 10,
      minQuantity: 5,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 50,
      usedCount: 3,
      appliesTo: 'Business plan',
      targetPlanId: planBusiness.id,
    },
  });

  const d2 = await prisma.discount.create({
    data: {
      code: 'FLAT500',
      type: 'Fixed',
      value: 500,
      minQuantity: 1,
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-11-30'),
      usageLimit: 20,
      usedCount: 1,
      appliesTo: 'All subscriptions',
    },
  });

  // 7. Quotation Templates
  await prisma.quotationTemplate.create({
    data: {
      name: 'Standard CRM Starter Package',
      planId: planStarter.id,
      validityDays: 30,
      lines: {
        create: [
          {
            productId: p1.id,
            variantId: p1.variants[0].id,
            quantity: 2,
            unitPrice: 999,
          },
        ],
      },
    },
  });

  // 8. Subscriptions
  const subsSeed = [
    { no: 'SUB-1001', custIdx: 0, planId: planStarter.id, qty: 3, start: '2026-07-01', end: '2027-07-01', terms: 'Net 15', status: 'Active', prodId: p1.id, unitPrice: 999 },
    { no: 'SUB-1002', custIdx: 1, planId: planBusiness.id, qty: 5, start: '2026-07-01', end: '2027-07-01', terms: 'Net 15', status: 'Active', prodId: p1.id, unitPrice: 2499 },
    { no: 'SUB-1003', custIdx: 2, planId: planStarter.id, qty: 1, start: '2026-08-01', end: '2027-08-01', terms: 'Net 7', status: 'Active', prodId: p1.id, unitPrice: 999 },
    { no: 'SUB-1004', custIdx: 3, planId: planEnterprise.id, qty: 12, start: '2026-07-01', end: '2027-07-01', terms: 'Net 30', status: 'Active', prodId: p2.id, unitPrice: 24999 },
    { no: 'SUB-1005', custIdx: 4, planId: planAnalytics.id, qty: 2, start: '2026-09-01', end: '2027-09-01', terms: 'Net 15', status: 'Paused', prodId: p3.id, unitPrice: 499 },
    { no: 'SUB-1006', custIdx: 5, planId: planBusiness.id, qty: 4, start: '2026-10-01', end: '2027-10-01', terms: 'Net 15', status: 'Confirmed', prodId: p1.id, unitPrice: 2499 },
    { no: 'SUB-1007', custIdx: 1, planId: planAnalytics.id, qty: 5, start: '2026-11-01', end: '2027-11-01', terms: 'Net 15', status: 'Quotation', prodId: p3.id, unitPrice: 499 },
    { no: 'SUB-1008', custIdx: 2, planId: planBusiness.id, qty: 3, start: '2026-12-01', end: '2027-12-01', terms: 'Net 7', status: 'Draft', prodId: p1.id, unitPrice: 2499 },
  ];

  const createdSubs = [];
  for (const s of subsSeed) {
    const cust = customers[s.custIdx];
    const sub = await prisma.subscription.create({
      data: {
        subscriptionNumber: s.no,
        customerId: cust.id,
        planId: s.planId,
        status: s.status,
        startDate: new Date(s.start),
        expiryDate: new Date(s.end),
        nextBillingDate: new Date('2026-11-01'),
        paymentTerms: s.terms,
        autoClose: false,
        lines: {
          create: [
            {
              productId: s.prodId,
              quantity: s.qty,
              unitPrice: s.unitPrice,
              taxId: taxGST.id,
              taxAmount: Math.round(s.unitPrice * s.qty * 0.18),
              amount: s.unitPrice * s.qty,
            },
          ],
        },
      },
    });
    createdSubs.push({ ...sub, qty: s.qty, unitPrice: s.unitPrice, custId: cust.id, prodId: s.prodId });
  }

  // 9. Historical Invoices & Payments (Jul - Oct 2026)
  const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
  let paymentCount = 1;

  for (const m of months) {
    for (let i = 0; i < createdSubs.length; i++) {
      const s = createdSubs[i];
      if (!['Active', 'Paused'].includes(s.status) || s.startDate > new Date(m + '-28')) continue;

      const base = s.unitPrice * s.qty;
      const tax = Math.round(base * 0.18);
      const total = base + tax;
      const invNo = `INV-${m.replace('-', '')}-${s.subscriptionNumber.slice(-4)}`;
      const dueDate = new Date(`${m}-15`);
      const isPaid = m < '2026-10' || i % 2 === 0;

      const inv = await prisma.invoice.create({
        data: {
          invoiceNumber: invNo,
          subscriptionId: s.id,
          customerId: s.custId,
          billingPeriodStart: new Date(`${m}-01`),
          billingPeriodEnd: new Date(`${m}-28`),
          dueDate: dueDate,
          subtotal: base,
          discountAmount: 0,
          discountCode: null,
          taxAmount: tax,
          totalAmount: total,
          paidAmount: isPaid ? total : 0,
          status: isPaid ? 'Paid' : 'Confirmed',
          lines: {
            create: [
              {
                productId: s.prodId,
                description: `Subscription billing for ${m}`,
                quantity: s.qty,
                unitPrice: s.unitPrice,
                taxAmount: tax,
                totalAmount: total,
              },
            ],
          },
        },
      });

      if (isPaid) {
        await prisma.payment.create({
          data: {
            paymentNumber: `PAY-${m.replace('-', '')}-${String(paymentCount++).padStart(4, '0')}`,
            invoiceId: inv.id,
            method: ['UPI', 'Bank transfer', 'Card'][i % 3],
            amount: total,
            paymentDate: new Date(`${m}-${String(5 + (i % 10)).padStart(2, '0')}`),
            note: 'Automated settlement',
          },
        });
      }
    }
  }

  // 10. Audit log
  await prisma.auditLog.create({
    data: {
      entityType: 'System',
      entityId: 'ROOT',
      action: 'SYSTEM_INITIALIZED',
      userId: adminUser.id,
      details: JSON.stringify({ message: 'Seed executed successfully' }),
    },
  });

  console.log('Seeding completed successfully!');
  console.log('Admin login: admin@brightloop.com / Brightloop@2026');
  console.log('Staff login: staff@brightloop.com / Brightloop@2026');
  console.log('Customer login: aarav@traders.in / Brightloop@2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
