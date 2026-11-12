// product-history.js  (identical copy goes in admin/ AND supplier/)
// window.openProductHistory(productId, productName, scope, companyName, currentStock)
//   scope 'admin'    -> stock-in (with PO ref) + stock-out / returns from the movement ledger
//   scope 'supplier' -> own stock-in only (customer/sales data is not visible to suppliers)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const cfg = { apiKey: "AIzaSyCP0heHxeSJezxkAyvYAkGdFenY4ErhV0U", authDomain: "laland-express.firebaseapp.com", projectId: "laland-express", storageBucket: "laland-express.firebasestorage.app", messagingSenderId: "315462688826", appId: "1:315462688826:web:a6b033e1ce664071201503" };
const db = getFirestore(getApps().length ? getApp() : initializeApp(cfg));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = v => { const d = new Date(v || ''); return v && !isNaN(d) ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; };
const same = (a, b) => String(a) === String(b);
const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));

function ensureModal() {
  let m = document.getElementById('phModal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'phModal';
  m.className = 'fixed inset-0 bg-black/60 z-[70] hidden flex items-center justify-center p-3';
  m.innerHTML = `<div class="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-4 space-y-3 shadow-2xl">
    <div class="flex justify-between items-center border-b pb-2">
      <h3 id="phTitle" class="font-bold text-sm text-indigo-700"></h3>
      <button type="button" onclick="document.getElementById('phModal').classList.add('hidden')" class="text-xl px-2 text-gray-500">&times;</button>
    </div>
    <div id="phBody" class="space-y-3 text-xs"></div></div>`;
  document.body.appendChild(m);
  return m;
}

async function stockInFor(productId, scope, companyName) {
  const snap = scope === 'supplier'
    ? await getDocs(query(collection(db, 'stock_in_history'), where('supplier', '==', companyName)))
    : await getDocs(collection(db, 'stock_in_history'));
  const rows = [];
  snap.forEach(d => {
    const r = d.data();
    const it = (r.items || []).find(i => same(i.id, productId));
    if (it) rows.push({ date: r.createdAt || r.updatedAt || '', ref: r.invoiceNo || d.id, poNo: r.poNo || '', qty: Number(it.qty || 0), tp: Number(it.tp || 0) });
  });
  return rows.sort(byDateDesc);
}

// Stock movements written by the Cloud Function (products/{id}/movements)
async function movementsFor(productId) {
  const snap = await getDocs(collection(db, 'products', String(productId), 'movements'));
  const outs = [], rets = [];
  snap.forEach(d => {
    const m = d.data();
    const row = { date: m.createdAt || '', ref: m.refId || d.id, qty: Number(m.qty || 0), balanceAfter: m.balanceAfter };
    if (m.type === 'out') outs.push(row);
    else if (m.type === 'return') rets.push(row);
    else if (m.type === 'return_undo') rets.push({ ...row, qty: -row.qty });
  });
  return { outs: outs.sort(byDateDesc), rets: rets.sort(byDateDesc) };
}

const card = (label, value, cls = 'text-gray-800') => `<div class="bg-gray-50 border rounded-xl p-2.5 text-center"><p class="text-[10px] text-gray-500">${label}</p><p class="font-extrabold text-sm ${cls}">${value}</p></div>`;
const empty = t => `<p class="text-center text-gray-400 py-4">${t}</p>`;

window.openProductHistory = async function (productId, productName, scope = 'admin', companyName = '', currentStock = '') {
  const m = ensureModal();
  m.classList.remove('hidden');
  document.getElementById('phTitle').textContent = 'Stock History: ' + productName;
  const body = document.getElementById('phBody');
  body.innerHTML = '<p class="text-center text-gray-400 py-6">Loading...</p>';

  // Each part is read separately. A part the current role may not read is shown as a notice, not an error.
  let ins = null, insDenied = false, movs = null, movDenied = false;
  try { ins = await stockInFor(productId, scope, companyName); } catch (e) { insDenied = true; }
  if (scope !== 'supplier') {
    try { movs = await movementsFor(productId); } catch (e) { movDenied = true; }
  }
  const notice = (msg) => `<p class="text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">${esc(msg)}</p>`;
  const cur = currentStock || 0;
  const totalIn = ins ? ins.reduce((s, r) => s + r.qty, 0) : 0;
  const inTable = insDenied ? notice('স্টক-ইন তথ্য দেখার অনুমতি আপনার নেই।')
    : (ins && ins.length ? `<div class="overflow-x-auto"><table class="w-full text-left">
        <thead><tr class="bg-emerald-50 text-emerald-800"><th class="p-1.5">Date</th><th class="p-1.5">Chalan / PO</th><th class="p-1.5 text-center">Qty In</th><th class="p-1.5 text-right">TP</th></tr></thead>
        <tbody>${ins.map(r => `<tr class="border-b"><td class="p-1.5">${fmt(r.date)}</td><td class="p-1.5"><b>${esc(r.ref)}</b>${r.poNo ? `<span class="block text-[10px] text-gray-400">${esc(r.poNo)}</span>` : ''}</td><td class="p-1.5 text-center font-bold text-emerald-700">+${r.qty}</td><td class="p-1.5 text-right">৳${r.tp}</td></tr>`).join('')}</tbody></table></div>`
      : empty('এখনো কোনো stock-in নেই।'));

  // Stock-in only (supplier role, or a role without access to sales movements)
  if (!movs) {
    body.innerHTML = `
      <div class="grid grid-cols-2 gap-2">${card('Current Stock', cur + ' pcs', 'text-blue-600')}${card('Total Received', totalIn + ' pcs', 'text-emerald-700')}</div>
      <p class="font-bold text-gray-700">Stock-In History</p>${inTable}
      ${movDenied ? notice('বিক্রয় ও ফেরতের তথ্য দেখার অনুমতি আপনার নেই।') : '<p class="text-[10px] text-gray-400">বিক্রয় ও ফেরতের তথ্য এখানে দেখানো হয় না।</p>'}`;
    return;
  }

  // Full view (master / store manager)
  const { outs, rets } = movs;
  const totalOut = outs.reduce((s, r) => s + r.qty, 0);
  const totalRet = rets.reduce((s, r) => s + r.qty, 0);
  const expected = totalIn - totalOut + totalRet;
  const diff = Number(cur) - expected;
  const outTable = outs.length ? `<div class="overflow-x-auto"><table class="w-full text-left">
      <thead><tr class="bg-rose-50 text-rose-800"><th class="p-1.5">Delivered On</th><th class="p-1.5">Order</th><th class="p-1.5 text-center">Qty Out</th><th class="p-1.5 text-right">Stock After</th></tr></thead>
      <tbody>${outs.map(r => `<tr class="border-b"><td class="p-1.5">${fmt(r.date)}</td><td class="p-1.5"><b>${esc(r.ref)}</b></td><td class="p-1.5 text-center font-bold text-rose-700">-${r.qty}</td><td class="p-1.5 text-right">${r.balanceAfter ?? '-'}</td></tr>`).join('')}</tbody></table></div>`
    : empty('এখনো কোনো ডেলিভারি নেই।');
  const retTable = rets.length ? `<div class="overflow-x-auto"><table class="w-full text-left">
      <thead><tr class="bg-orange-50 text-orange-800"><th class="p-1.5">Date</th><th class="p-1.5">Order</th><th class="p-1.5 text-center">Qty Back</th><th class="p-1.5 text-right">Stock After</th></tr></thead>
      <tbody>${rets.map(r => `<tr class="border-b"><td class="p-1.5">${fmt(r.date)}</td><td class="p-1.5"><b>${esc(r.ref)}</b></td><td class="p-1.5 text-center font-bold text-orange-700">${r.qty > 0 ? '+' : ''}${r.qty}</td><td class="p-1.5 text-right">${r.balanceAfter ?? '-'}</td></tr>`).join('')}</tbody></table></div>`
    : empty('কোনো ফেরত নেই।');

  body.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${card('Current Stock', cur + ' pcs', 'text-blue-600')}
      ${card('Total In', '+' + totalIn, 'text-emerald-700')}
      ${card('Total Out (Delivered)', '-' + totalOut, 'text-rose-700')}
      ${card('Total Returned', '+' + totalRet, 'text-orange-700')}
    </div>
    <p class="text-[11px] ${diff ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-gray-500 bg-gray-50 border'} rounded-lg p-2">
      হিসাব: এসেছে ${totalIn} − ডেলিভারি ${totalOut} + ফেরত ${totalRet} = ${expected}, বর্তমান স্টক ${cur}.
      ${diff ? `পার্থক্য ${diff > 0 ? '+' : ''}${diff} pcs। ম্যানুয়াল স্টক পরিবর্তন বা পুরনো stock-in edit এর কারণে হতে পারে।` : 'হিসাব মিলছে।'}</p>
    <p class="font-bold text-emerald-700">Stock-In</p>${inTable}
    <p class="font-bold text-rose-700">Stock-Out (Delivered)</p>${outTable}
    <p class="font-bold text-orange-700">Returns (Back to Stock)</p>${retTable}`;
};
