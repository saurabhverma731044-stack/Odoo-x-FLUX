const $ = s => document.querySelector(s), inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
let user = null, filters = {period:'all', q:'', status:''};
const NAV = [
  ['dashboard','Dashboard','⌂',['admin','staff']], ['subscriptions','Subscriptions','↻',['admin','staff','customer']],
  ['plans','Plans & Products','▤',['admin','staff']], ['customers','Customers','☺',['admin','staff']],
  ['invoices','Invoices','▣',['admin','staff','customer']], ['payments','Payments','₹',['admin','staff']],
  ['discounts','Discounts','%',['admin']], ['staff','Staff','✚',['admin']]];

// ---------- auth ----------
let signup = false;
const pwOk = p => p.length > 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[^A-Za-z0-9]/.test(p);
$('#toggleAuth').onclick = e => { e.preventDefault(); signup = !signup;
  $('#authBtn').textContent = signup ? 'Create account' : 'Sign in'; $('#toggleAuth').textContent = signup ? 'Back to sign in' : 'Create an account';
  $('#roleRow').hidden = signup; $('#authSub').textContent = signup ? 'Customers can create an account here. Staff are added by an admin.' : 'Sign in to manage subscriptions and billing.'; };
$('#forgot').onclick = e => { e.preventDefault(); const m = $('#email').value.trim();
  $('#authErr').textContent = m ? '' : 'Enter your email first.'; if (m) toast('Reset link sent to ' + m); };
$('#authForm').onsubmit = e => { e.preventDefault(); const email = $('#email').value.trim(), pass = $('#pass').value, err = $('#authErr');
  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = 'Enter a valid email address.';
  if (signup) {
    if (!pwOk(pass)) return err.textContent = 'Password needs 9+ characters with an uppercase letter, a lowercase letter and a special character.';
    if (DB.customers.some(c => c.email === email)) return err.textContent = 'This email already has an account.';
    DB.customers.push({id:DB.customers.length+1, name:email.split('@')[0], email, city:'-'}); user = {role:'customer', email, cust:DB.customers.length};
  } else { if (!pass) return err.textContent = 'Enter your password.';
    const role = $('#role').value; user = {role, email, cust: role === 'customer' ? (DB.customers.find(c => c.email === email)||DB.customers[0]).id : null}; }
  err.textContent = ''; $('#auth').hidden = true; $('#app').hidden = false; $('#whoami').textContent = user.email + ' (' + user.role + ')'; buildNav(); route(); };
$('#logout').onclick = () => { user = null; $('#app').hidden = true; $('#auth').hidden = false; };

// ---------- nav / router ----------
function buildNav(){
  const items = NAV.filter(n => n[3].includes(user.role));
  $('#menu').innerHTML = items.map(n => `<a href="#${n[0]}" data-r="${n[0]}"><span>${n[2]}</span>${n[1]}</a>`).join('');
  $('#rail').innerHTML = items.map(n => `<span title="${n[1]}" data-r="${n[0]}" onclick="location.hash='${n[0]}'">${n[2]}</span>`).join('');
}
function route(){ if (!user) return; const allowed = NAV.filter(n => n[3].includes(user.role)).map(n => n[0]);
  let r = location.hash.slice(1); if (!allowed.includes(r)) r = allowed[0];
  document.querySelectorAll('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  $('#title').textContent = NAV.find(n => n[0] === r)[1]; $('#view').innerHTML = ''; VIEWS[r](); }
window.onhashchange = route;

// ---------- helpers ----------
const pill = s => `<span class="pill ${s}">${s}</span>`;
function table(cols, rows){ return `<div class="tablewrap"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`; }
function toast(m){ const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2600); }
function modal(html){ $('#modalBox').innerHTML = html; $('#modal').hidden = false; }
const closeModal = () => $('#modal').hidden = true; $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
const isOverdue = i => i.status !== 'Paid' && i.due < TODAY;
const invStatus = i => isOverdue(i) ? 'Overdue' : i.status;
const monthName = m => new Date(m + '-01').toLocaleString('en', {month:'short'});
function line(vals, labels, color = '#a8e6dc'){
  const W = 560, H = 200, max = Math.max(...vals, 1), x = i => 30 + i * (W - 50) / Math.max(vals.length - 1, 1), y = v => H - 28 - v / max * (H - 50);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
  <polygon points="${x(0)},${H-28} ${pts} ${x(vals.length-1)},${H-28}" fill="url(#g)"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"/>
  ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${color}"/><text x="${x(i)}" y="${H-8}" text-anchor="middle">${labels[i]}</text>`).join('')}<text x="4" y="14">${inr(max)}</text></svg>`;
}
function gauge(pct){ const r = 54, c = Math.PI * r;
  return `<svg viewBox="0 0 140 90" width="100%" style="max-width:240px"><path d="M16 80 A54 54 0 0 1 124 80" fill="none" stroke="#223140" stroke-width="14" stroke-linecap="round"/><path d="M16 80 A54 54 0 0 1 124 80" fill="none" stroke="#a8e6dc" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c * pct / 100} ${c}"/><text x="70" y="76" text-anchor="middle" style="font-size:22px;font-weight:700;fill:#e8f0f4">${Math.round(pct)}%</text></svg>`; }

// ---------- views ----------
const VIEWS = {
dashboard(){
  const months = [...new Set(DB.invoices.map(i => i.period))].sort(), sel = filters.period === 'all' ? months : [filters.period];
  const invs = DB.invoices.filter(i => sel.includes(i.period)), pays = DB.payments.filter(p => sel.includes(p.date.slice(0,7)));
  const active = DB.subs.filter(s => s.status === 'Active'), mrr = active.reduce((a, s) => a + (plan(s.plan).cycle === 'Yearly' ? plan(s.plan).price / 12 : plan(s.plan).price) * s.qty, 0);
  const revenue = pays.reduce((a, p) => a + p.amount, 0), owed = invs.filter(i => i.status !== 'Paid').reduce((a, i) => a + i.total, 0), overdue = invs.filter(isOverdue);
  const billed = invs.reduce((a, i) => a + i.total, 0), perMonth = months.map(m => DB.payments.filter(p => p.date.startsWith(m)).reduce((a, p) => a + p.amount, 0));
  const byPlan = DB.plans.map(p => ({n:p.name, c:DB.subs.filter(s => s.plan === p.id && s.status === 'Active').length})), maxC = Math.max(...byPlan.map(b => b.c), 1);
  $('#view').innerHTML = `
  <div class="tools"><select id="fp"><option value="all">All months</option>${months.map(m => `<option value="${m}" ${filters.period === m ? 'selected' : ''}>${monthName(m)} 2026</option>`).join('')}</select></div>
  <div class="grid g4">
    <div class="kpi"><small>Active subscriptions</small><b>${active.length}</b><i>${DB.subs.length} total</i></div>
    <div class="kpi"><small>Monthly recurring revenue</small><b>${inr(mrr)}</b><i>from active plans</i></div>
    <div class="kpi"><small>Revenue collected</small><b>${inr(revenue)}</b><i>${pays.length} payments</i></div>
    <div class="kpi"><small>Still owed</small><b>${inr(owed)}</b><i>${overdue.length} overdue</i></div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Revenue collected by month</h3>${line(perMonth, months.map(monthName))}</div>
    <div class="card"><h3>Collection rate</h3>${gauge(billed ? revenue / billed * 100 : 0)}<p class="muted small">Collected ÷ billed in the selected period.</p></div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Overdue invoices</h3>${table(['Invoice','Customer','Due','Amount'], overdue.slice(0, 6).map(i => [i.no, cust(i.cust).name, i.due, inr(i.total - i.paid)]))}</div>
    <div class="card"><h3>Active subscriptions by plan</h3>${table(['Plan','Share'], byPlan.map(b => [b.n, `<div class="bar"><i style="width:${b.c / maxC * 100}%"></i></div>`]))}</div></div>`;
  $('#fp').onchange = e => { filters.period = e.target.value; VIEWS.dashboard(); };
},
subscriptions(){
  const flow = ['Draft','Quotation','Confirmed','Active','Closed'];
  const mine = user.role === 'customer' ? DB.subs.filter(s => s.cust === user.cust) : DB.subs;
  const draw = () => { const rows = mine.filter(s => (!filters.status || s.status === filters.status) && (cust(s.cust).name + s.no).toLowerCase().includes(filters.q.toLowerCase()));
    $('#subT').innerHTML = table(['Number','Customer','Plan','Qty','Start','Expiry','Terms','Status',''], rows.map(s => [s.no, cust(s.cust).name, plan(s.plan).name, s.qty, s.start, s.end, s.terms, pill(s.status),
      user.role !== 'customer' && flow.includes(s.status) && s.status !== 'Closed' ? `<button class="btn sm" data-n="${s.no}">Move to ${flow[flow.indexOf(s.status) + 1]}</button>` : ''])); };
  $('#view').innerHTML = `<div class="tools"><input id="q" placeholder="Search number or customer"><select id="st"><option value="">All statuses</option>${[...flow, 'Paused'].map(s => `<option>${s}</option>`).join('')}</select>${user.role !== 'customer' ? '<button class="btn" id="newSub">New subscription</button>' : ''}</div><div class="card" id="subT"></div>`;
  $('#q').oninput = e => { filters.q = e.target.value; draw(); }; $('#st').onchange = e => { filters.status = e.target.value; draw(); };
  $('#subT').onclick = e => { const n = e.target.dataset.n; if (!n) return; const s = DB.subs.find(x => x.no === n); s.status = flow[flow.indexOf(s.status) + 1]; toast(n + ' is now ' + s.status); draw(); };
  if ($('#newSub')) $('#newSub').onclick = () => { modal(`<h3>New subscription</h3><label>Customer<select id="nc">${DB.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label><label>Plan<select id="np">${DB.plans.map(p => `<option value="${p.id}">${p.name} – ${inr(p.price)}/${p.cycle.toLowerCase()}</option>`).join('')}</select></label><label>Quantity<input id="nq" type="number" min="1" value="1"></label><button class="btn" id="save">Save as draft</button> <button class="btn ghost" onclick="closeModal()">Cancel</button>`);
    $('#save').onclick = () => { DB.subs.push({no:'SUB-' + (1001 + DB.subs.length), cust:+$('#nc').value, plan:+$('#np').value, qty:Math.max(+$('#nq').value, 1), start:TODAY, end:'2027-10-31', terms:'Net 15', status:'Draft'}); closeModal(); toast('Subscription created'); draw(); }; };
  draw(); filters.status = ''; filters.q = '';
},
plans(){ $('#view').innerHTML = `<div class="card"><h3>Plans</h3>${table(['Plan','Product','Price','Billing','Min qty','Variant','Closes automatically'], DB.plans.map(p => [p.name, p.product, inr(p.price), p.cycle, p.minQty, p.variant, p.autoClose ? 'Yes' : 'No']))}</div>`; },
customers(){ $('#view').innerHTML = `<div class="card"><h3>Customers</h3>${table(['Name','Email','City','Active subscriptions','Outstanding'], DB.customers.map(c => [c.name, c.email, c.city, DB.subs.filter(s => s.cust === c.id && s.status === 'Active').length, inr(DB.invoices.filter(i => i.cust === c.id && i.status !== 'Paid').reduce((a, i) => a + i.total - i.paid, 0))]))}</div>`; },
invoices(){
  const mine = user.role === 'customer' ? DB.invoices.filter(i => i.cust === user.cust) : DB.invoices, staff = user.role !== 'customer';
  const draw = () => { const rows = mine.filter(i => !filters.status || invStatus(i) === filters.status).slice().reverse();
    $('#invT').innerHTML = table(['Invoice','Customer','Period','Subtotal','Discount','Tax','Total','Due','Status',''], rows.map(i => [i.no, cust(i.cust).name, i.period, inr(i.base), i.discount ? '−' + inr(i.discount) + ' (' + i.code + ')' : '–', inr(i.tax), inr(i.total), i.due, pill(invStatus(i)),
      staff ? `<button class="btn sm ghost" onclick="window.print()">Print</button>` + (i.status !== 'Paid' ? ` <button class="btn sm" data-p="${i.no}">Record payment</button>` : '') : ''])); };
  $('#view').innerHTML = `<div class="tools"><select id="st"><option value="">All statuses</option><option>Confirmed</option><option>Paid</option><option>Overdue</option></select>${staff ? '<button class="btn" id="run">Run billing for November</button>' : ''}</div><div class="card" id="invT"></div>`;
  $('#st').onchange = e => { filters.status = e.target.value; draw(); };
  if (staff) { $('#run').onclick = () => { let n = 0; DB.subs.filter(s => s.status === 'Active').forEach(s => { if (!DB.invoices.some(i => i.sub === s.no && i.period === '2026-11')) { DB.invoices.push(buildInvoice(s, '2026-11')); n++; } });
    toast(n ? n + ' invoices created' : 'Nothing to bill – all active subscriptions already invoiced'); draw(); };
    $('#invT').onclick = e => { const n = e.target.dataset.p; if (n) payModal(n, draw); }; }
  draw(); filters.status = '';
},
payments(){ $('#view').innerHTML = `<div class="card"><h3>Payments received</h3>${table(['Date','Invoice','Method','Amount','Note'], DB.payments.slice().reverse().map(p => [p.date, p.inv, p.method, inr(p.amount), p.note || '–']))}</div>`; },
discounts(){ $('#view').innerHTML = `<div class="card"><h3>Discount rules</h3>${table(['Code','Type','Value','Min qty','Valid','Used','Applies to'], DB.discounts.map(d => [d.code, d.type, d.type === 'Fixed' ? inr(d.value) : d.value + '%', d.minQty, d.from + ' → ' + d.to, d.used + ' / ' + d.limit, d.applies]))}<p class="muted small">Matching discounts are applied to the next invoice automatically.</p></div>`; },
staff(){ $('#view').innerHTML = `<div class="card"><h3>Add a staff member</h3><p class="muted">Only admins can create staff accounts.</p><label>Email<input id="se" type="email"></label><button class="btn" id="addS">Add staff</button></div>`;
  $('#addS').onclick = () => { $('#se').value ? (toast('Staff invite sent to ' + $('#se').value), $('#se').value = '') : toast('Enter an email first'); }; }
};
function payModal(no, done){ const i = DB.invoices.find(x => x.no === no), due = i.total - i.paid;
  modal(`<h3>Record payment for ${no}</h3><label>Method<select id="pm"><option>UPI</option><option>Bank transfer</option><option>Card</option><option>Cash</option></select></label><label>Amount<input id="pa" type="number" value="${due}"></label><label>Note<input id="pn"></label><button class="btn" id="ps">Save payment</button> <button class="btn ghost" onclick="closeModal()">Cancel</button>`);
  $('#ps').onclick = () => { const a = Math.min(+$('#pa').value, due); if (!(a > 0)) return toast('Enter an amount'); DB.payments.push({inv:no, method:$('#pm').value, amount:a, date:TODAY, note:$('#pn').value}); i.paid += a; if (i.paid >= i.total) i.status = 'Paid'; closeModal(); toast('Payment recorded'); done(); }; }
