// admin-nav.js  (add to every admin page just before </body>)
//   <script type="module" src="admin-nav.js"></script>
// Shows only the menu links the logged-in admin's role may open.
//   master    -> everything
//   store     -> orders, rider
//   supplier  -> suppliers, products, stock-in, purchase-orders
// Role rule matches firestore.rules: missing role = master; an unknown role gets no links.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const cfg = { apiKey: "AIzaSyCP0heHxeSJezxkAyvYAkGdFenY4ErhV0U", authDomain: "laland-express.firebaseapp.com", projectId: "laland-express", storageBucket: "laland-express.firebasestorage.app", messagingSenderId: "315462688826", appId: "1:315462688826:web:a6b033e1ce664071201503" };
const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

const LINKS = [
  ['index.html', 'Dashboard', 'fa-gauge'],
  ['products.html', 'Products', 'fa-box'],
  ['stock-in.html', 'Stock-In', 'fa-truck-ramp-box'],
  ['suppliers.html', 'Suppliers', 'fa-truck-field'],
  ['purchase-orders.html', 'Purchase Orders', 'fa-file-invoice'],
  ['orders.html', 'Orders', 'fa-cart-shopping'],
  ['customers.html', 'Customers', 'fa-users'],
  ['delivery-riders.html', 'Delivery Riders', 'fa-motorcycle'],
  ['rider.html', 'Rider Finance', 'fa-wallet'],
  ['locations.html', 'Locations', 'fa-location-dot']
];

const ROLE_PAGES = {
  master: null,                                                   // null = all pages
  store: ['orders.html', 'rider.html'],
  supplier: ['suppliers.html', 'products.html', 'stock-in.html', 'purchase-orders.html']
};
const ROLE_LABEL = { master: 'মাস্টার', store: 'স্টোর ম্যানেজার', supplier: 'সাপ্লায়ার ম্যানেজার' };

const cur = location.pathname.split('/').pop() || 'index.html';
const badge = '<span class="po-badge hidden ml-1 bg-red-500 text-white rounded-full px-1.5 text-[10px] font-bold"></span>';
const nav = document.querySelector('header nav');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render(role, name) {
  if (!nav) return;
  const allowed = role in ROLE_PAGES ? ROLE_PAGES[role] : [];
  const links = LINKS.filter(([h]) => allowed === null || allowed.includes(h));
  const label = ROLE_LABEL[role] ? `<span class="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">${ROLE_LABEL[role]}</span>` : '';
  const desk = links.map(([h, l]) =>
    `<a href="${h}" class="${h === cur ? 'underline font-bold' : 'hover:underline'}">${l}${h === 'purchase-orders.html' ? badge : ''}</a>`).join('');
  const mob = links.map(([h, l, ic]) =>
    `<a href="${h}" class="flex items-center px-4 py-2 text-sm ${h === cur ? 'bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-gray-50'}"><i class="fa-solid ${ic} w-5 text-emerald-600"></i>${l}${h === 'purchase-orders.html' ? badge : ''}</a>`).join('');
  nav.className = 'relative';
  nav.innerHTML = `
    <div class="hidden md:flex items-center gap-3 text-xs">${label}${desk}</div>
    <div class="flex items-center gap-2 text-xs">
      <span class="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-lg" title="লগইন করা ব্যক্তি">
        <i class="fa-solid fa-circle-user"></i><span class="hidden sm:inline font-semibold">${esc(name)}</span>
        <span class="hidden lg:inline text-[10px] text-emerald-100">(${ROLE_LABEL[role] || ''})</span>
      </span>
      <button id="navLogout" type="button" class="bg-red-500 hover:bg-red-600 px-2.5 py-1.5 rounded-lg font-bold shadow" title="লগআউট">
        <i class="fa-solid fa-right-from-bracket"></i><span class="hidden sm:inline ml-1">লগআউট</span>
      </button>
      <button id="navBurger" type="button" class="md:hidden px-2 text-xl" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
    </div>
    <div id="navPanel" class="hidden absolute right-0 top-9 w-56 bg-white text-gray-800 rounded-xl shadow-xl border z-[60] py-1">
      ${label ? `<p class="px-4 py-2 text-[11px] text-gray-500 border-b">${ROLE_LABEL[role]}</p>` : ''}${mob}</div>`;
  document.getElementById('navLogout').onclick = async () => { try { await signOut(auth); } catch (e) {} location.href = 'index.html'; };
  document.getElementById('navBurger').onclick = (e) => { e.stopPropagation(); document.getElementById('navPanel').classList.toggle('hidden'); };
  document.addEventListener('click', () => document.getElementById('navPanel')?.classList.add('hidden'));
}

// Page-level guard: the menu hides links, this stops direct URL access.
function guard(role, name) {
  const allowed = role in ROLE_PAGES ? ROLE_PAGES[role] : [];
  if (allowed === null || allowed.includes(cur)) return true;   // page allowed
  if (allowed.length) { location.replace(allowed[0]); return false; }
  // no pages for this role (none / inactive / unknown): block the page
  const wall = document.createElement('div');
  wall.className = 'fixed inset-0 bg-white z-[100] flex items-center justify-center p-6';
  wall.innerHTML = `<div class="text-center space-y-3 max-w-sm">
      <i class="fa-solid fa-lock text-4xl text-red-500"></i>
      <p class="font-bold text-gray-800">এই পেজে আপনার অনুমতি নেই</p>
      <p class="text-xs text-gray-500">${esc(name)}</p>
      <button id="wallLogout" class="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold">লগআউট</button>
    </div>`;
  document.body.appendChild(wall);
  document.getElementById('wallLogout').onclick = async () => { try { await signOut(auth); } catch (e) {} location.href = 'index.html'; };
  return false;
}

async function countPendingPO() {
  try {
    const snap = await getDocs(query(collection(db, 'purchase_orders'), where('status', '==', 'Submitted')));
    if (snap.size > 0) document.querySelectorAll('.po-badge').forEach(b => { b.textContent = snap.size; b.classList.remove('hidden'); });
  } catch (e) { /* no access to purchase orders: no badge */ }
}

onAuthStateChanged(auth, async (u) => {
  if (!u) return;                                  // the page itself handles the login screen
  try {
    const s = await getDoc(doc(db, 'admins', u.uid));
    if (!s.exists()) { guard('none', u.email); return render('none', u.email); }
    const d = s.data();
    if (d.active === false) { guard('none', u.email); return render('none', u.email); }
    const role = d.role || 'master';               // same rule as firestore.rules
    if (!guard(role, d.name || u.email)) return;
    render(role, d.name || u.email);
    if (role === 'master' || role === 'supplier') countPendingPO();
  } catch (e) {
    console.warn('admin-nav:', e.message);
  }
});
