// Shared admin menu. Add to every admin page just before </body>:
//   <script type="module" src="admin-nav.js"></script>
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const LINKS = [
  ['index.html', 'Dashboard', 'fa-gauge'],
  ['products.html', 'Products', 'fa-box'],
  ['stock-in.html', 'Stock-In', 'fa-truck-ramp-box'],
  ['suppliers.html', 'Suppliers', 'fa-truck-field'],
  ['purchase-orders.html', 'Purchase Orders', 'fa-file-invoice'],
  ['orders.html', 'Orders', 'fa-cart-shopping'],
  ['customers.html', 'Customers', 'fa-users'],
  ['delivery-riders.html', 'Delivery Riders', 'fa-motorcycle'],
  ['locations.html', 'Locations', 'fa-location-dot']
];
const cur = location.pathname.split('/').pop() || 'index.html';
const badge = '<span class="po-badge hidden ml-1 bg-red-500 text-white rounded-full px-1.5 text-[10px] font-bold"></span>';

const nav = document.querySelector('header nav');
if (nav) {
  const desk = LINKS.map(([h, l]) =>
    `<a href="${h}" class="${h === cur ? 'underline font-bold' : 'hover:underline'}">${l}${h === 'purchase-orders.html' ? badge : ''}</a>`).join('');
  const mob = LINKS.map(([h, l, ic]) =>
    `<a href="${h}" class="flex items-center px-4 py-2 text-sm ${h === cur ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-gray-50'}"><i class="fa-solid ${ic} w-5 text-emerald-600"></i>${l}${h === 'purchase-orders.html' ? badge : ''}</a>`).join('');
  nav.className = 'relative';
  nav.innerHTML = `
    <div class="hidden md:flex items-center gap-3 text-xs">${desk}</div>
    <button id="navBurger" type="button" class="md:hidden px-2 text-xl" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
    <div id="navPanel" class="hidden absolute right-0 top-9 w-56 bg-white text-gray-800 rounded-xl shadow-xl border z-[60] py-1">${mob}</div>`;
  document.getElementById('navBurger').onclick = (e) => { e.stopPropagation(); document.getElementById('navPanel').classList.toggle('hidden'); };
  document.addEventListener('click', () => document.getElementById('navPanel')?.classList.add('hidden'));
}

// Pending PO counter (after admin check passes)
if (window.adminReady) {
  window.adminReady.then(async () => {
    try {
      const db = getFirestore(getApps().length ? getApp() : initializeApp(window.__fbCfg));
      const snap = await getDocs(query(collection(db, 'purchase_orders'), where('status', '==', 'Submitted')));
      if (snap.size > 0) document.querySelectorAll('.po-badge').forEach(b => { b.textContent = snap.size; b.classList.remove('hidden'); });
    } catch (e) { console.warn('PO badge:', e.message); }
  });
}
