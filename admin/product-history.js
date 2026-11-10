// product-history.js  (identical copy goes in admin/ AND supplier/)
// window.openProductHistory(productId, productName, scope, companyName, currentStock)
//   scope 'admin'    -> stock-in (with PO ref) + stock-out (delivered orders)
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

async function stockOutFor(productId) {
  const snap = await getDocs(query(collection(db, 'orders'), where('status', '==', 'Delivered')));
  const rows = [];
  snap.forEach(d => {
    const o = d.data();
    const it = (o.items || []).find(i => same(i.id, productId));
    if (it) rows.push({ date: o.deliveredAt || o.updatedAt || o.createdAt || '', ref: o.orderId || d.id, qty: Number(it.qty || 0), price: Number(it.price || 0) });
  });
  return rows.sort(byDateDesc);
}

const card = (label, value, cls = 'text-gray-800') => `<div class="bg-gray-50 border rounded-xl p-2.5 text-center"><p class="text-[10px] text-gray-500">${label}</p><p class="font-extrabold text-sm ${cls}">${value}</p></div>`;
const empty = t => `<p class="text-center text-gray-400 py-4">${t}</p>`;

window.openProductHistory = async function (productId, productName, scope = 'admin', companyName = '', currentStock = '') {
  const m = ensureModal();
  m.classList.remove('hidden');
  document.getElementById('phTitle').textContent = 'Stock History: ' + productName;
  const body = document.getElementById('phBody');
  body.innerHTML = '<p class="text-center text-gray-400 py-6">Loading...</p>';
  try {
    const ins = await stockInFor(productId, scope, companyName);
    const totalIn = ins.reduce((s, r) => s + r.qty, 0);
    const inTable = ins.length ? `<div class="overflow-x-auto"><table class="w-full text-left">
        <thead><tr class="bg-emerald-50 text-emerald-800"><th class="p-1.5">Date</th><th class="p-1.5">Chalan / PO</th><th class="p-1.5 text-center">Qty In</th><th class="p-1.5 text-right">TP</th></tr></thead>
        <tbody>${ins.map(r => `<tr class="border-b"><td class="p-1.5">${fmt(r.date)}</td><td class="p-1.5"><b>${esc(r.ref)}</b>${r.poNo ? `<span class="block text-[10px] text-gray-400">${esc(r.poNo)}</span>` : ''}</td><td class="p-1.5 text-center font-bold text-emerald-700">+${r.qty}</td><td class="p-1.5 text-right">৳${r.tp}</td></tr>`).join('')}</tbody></table></div>`
      : empty('এখনো কোনো stock-in নেই।');

    if (scope === 'supplier') {
      body.innerHTML = `
        <div class="grid grid-cols-2 gap-2">${card('Current Stock', (currentStock || 0) + ' pcs', 'text-blue-600')}${card('Total Received', totalIn + ' pcs', 'text-emerald-700')}</div>
        <p class="font-bold text-gray-700">Stock-In History</p>${inTable}
        <p class="text-[10px] text-gray-400">বিক্রয়ের তথ্য এখানে দেখানো হয় না।</p>`;
      return;
    }

    const outs = await stockOutFor(productId);
    const totalOut = outs.reduce((s, r) => s + r.qty, 0);
    const soldValue = outs.reduce((s, r) => s + r.qty * r.price, 0);
    const expected = totalIn - totalOut;
    const diff = Number(currentStock || 0) - expected;
    const outTable = outs.length ? `<div class="overflow-x-auto"><table class="w-full text-left">
        <thead><tr class="bg-rose-50 text-rose-800"><th class="p-1.5">Delivered On</th><th class="p-1.5">Order</th><th class="p-1.5 text-center">Qty Out</th><th class="p-1.5 text-right">Price</th></tr></thead>
        <tbody>${outs.map(r => `<tr class="border-b"><td class="p-1.5">${fmt(r.date)}</td><td class="p-1.5"><b>${esc(r.ref)}</b></td><td class="p-1.5 text-center font-bold text-rose-700">-${r.qty}</td><td class="p-1.5 text-right">৳${r.price}</td></tr>`).join('')}</tbody></table></div>`
      : empty('এখনো কোনো ডেলিভারি নেই।');

    body.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${card('Current Stock', (currentStock || 0) + ' pcs', 'text-blue-600')}
        ${card('Total In', '+' + totalIn, 'text-emerald-700')}
        ${card('Total Out (Delivered)', '-' + totalOut, 'text-rose-700')}
        ${card('Sales Value', '৳ ' + soldValue)}
      </div>
      <p class="text-[11px] ${diff ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-gray-500 bg-gray-50 border'} rounded-lg p-2">
        হিসাব: এসেছে ${totalIn} − ডেলিভারি ${totalOut} = ${expected}, বর্তমান স্টক ${currentStock || 0}.
        ${diff ? `পার্থক্য ${diff > 0 ? '+' : ''}${diff} pcs। ম্যানুয়াল স্টক পরিবর্তন, ফেরত বা পুরনো stock-in edit এর কারণে হতে পারে।` : 'হিসাব মিলছে।'}</p>
      <p class="font-bold text-emerald-700">Stock-In</p>${inTable}
      <p class="font-bold text-rose-700">Stock-Out (Delivered)</p>${outTable}`;
  } catch (e) {
    body.innerHTML = `<p class="text-red-600 text-center py-6">Could not load history: ${esc(e.message)}</p>`;
  }
};
