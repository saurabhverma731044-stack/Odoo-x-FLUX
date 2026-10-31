// Mock data. Replace with Supabase queries later (see README).
const TODAY = '2026-10-31', TAX = 0.18;
const DB = {
  customers: [
    {id:1,name:'Aarav Traders',email:'aarav@traders.in',city:'Lucknow'},
    {id:2,name:'Nova Retail Pvt Ltd',email:'accounts@novaretail.in',city:'Delhi'},
    {id:3,name:'Sapna Boutique',email:'sapna@boutique.in',city:'Kanpur'},
    {id:4,name:'Helix Logistics',email:'finance@helix.com',city:'Mumbai'},
    {id:5,name:'GreenLeaf Foods',email:'hello@greenleaf.in',city:'Pune'},
    {id:6,name:'Kiran Clinics',email:'admin@kiranclinics.in',city:'Jaipur'}],
  plans: [
    {id:1,name:'Starter',product:'Brightloop CRM',price:999,cycle:'Monthly',minQty:1,variant:'Standard',autoClose:true},
    {id:2,name:'Business',product:'Brightloop CRM',price:2499,cycle:'Monthly',minQty:3,variant:'Odoo brand (+560)',autoClose:false},
    {id:3,name:'Enterprise Yearly',product:'Brightloop Suite',price:24999,cycle:'Yearly',minQty:10,variant:'Standard',autoClose:false},
    {id:4,name:'Analytics Add-on',product:'Brightloop Insights',price:499,cycle:'Monthly',minQty:1,variant:'Standard',autoClose:true}],
  subs: [
    {no:'SUB-1001',cust:1,plan:1,qty:3,start:'2026-07-01',end:'2027-07-01',terms:'Net 15',status:'Active'},
    {no:'SUB-1002',cust:2,plan:2,qty:5,start:'2026-07-01',end:'2027-07-01',terms:'Net 15',status:'Active'},
    {no:'SUB-1003',cust:3,plan:1,qty:1,start:'2026-08-01',end:'2027-08-01',terms:'Net 7',status:'Active'},
    {no:'SUB-1004',cust:4,plan:3,qty:12,start:'2026-07-01',end:'2027-07-01',terms:'Net 30',status:'Active'},
    {no:'SUB-1005',cust:5,plan:4,qty:2,start:'2026-09-01',end:'2027-09-01',terms:'Net 15',status:'Paused'},
    {no:'SUB-1006',cust:6,plan:2,qty:4,start:'2026-10-01',end:'2027-10-01',terms:'Net 15',status:'Confirmed'},
    {no:'SUB-1007',cust:2,plan:4,qty:5,start:'2026-11-01',end:'2027-11-01',terms:'Net 15',status:'Quotation'},
    {no:'SUB-1008',cust:3,plan:2,qty:3,start:'2026-12-01',end:'2027-12-01',terms:'Net 7',status:'Draft'}],
  discounts: [
    {code:'SEATS10',type:'Percentage',value:10,minQty:5,from:'2026-07-01',to:'2026-12-31',limit:50,used:3,applies:'Business plan'},
    {code:'FLAT500',type:'Fixed',value:500,minQty:1,from:'2026-10-01',to:'2026-11-30',limit:20,used:1,applies:'All subscriptions'}],
  invoices: [], payments: []
};

const plan = id => DB.plans.find(p => p.id === id), cust = id => DB.customers.find(c => c.id === id);
function discountFor(sub){
  const base = plan(sub.plan).price * sub.qty;
  const d = DB.discounts.find(d => d.to >= TODAY && d.from <= TODAY && d.used < d.limit && sub.qty >= d.minQty && (d.applies==='All subscriptions' || plan(sub.plan).name+' plan'===d.applies));
  return d ? {code:d.code, amt: d.type==='Percentage' ? base*d.value/100 : d.value} : {code:'',amt:0};
}

function buildInvoice(sub, period){
  const p = plan(sub.plan), base = p.price*sub.qty, d = discountFor(sub);
  const net = base - d.amt, tax = Math.round(net*TAX), due = new Date(period+'-15');
  return {no:'INV-'+period.replace('-','')+'-'+sub.no.slice(-4), sub:sub.no, cust:sub.cust, period, base, discount:d.amt, code:d.code, tax, total:net+tax, due:period+'-15', status:'Confirmed', paid:0};
}
// Seed history: invoices for Jul–Oct, most paid
['2026-07','2026-08','2026-09','2026-10'].forEach(m => DB.subs.filter(s => ['Active','Paused'].includes(s.status) && s.start.slice(0,7) <= m).forEach((s,i) => {
  const inv = buildInvoice(s, m); inv.discount = 0; inv.code=''; inv.tax = Math.round(plan(s.plan).price*s.qty*TAX); inv.total = plan(s.plan).price*s.qty+inv.tax;
  if (m < '2026-10' || i % 2 === 0) { inv.status='Paid'; inv.paid=inv.total; DB.payments.push({inv:inv.no,method:['UPI','Bank transfer','Card'][i%3],amount:inv.total,date:m+'-'+String(5+i).padStart(2,'0'),note:''}); }
  DB.invoices.push(inv);
}));
