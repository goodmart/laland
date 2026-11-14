// admin-nav.js  (add to every admin page just before </body>)
//   <script type="module" src="admin-nav.js"></script>
// Admindek-style left sidebar: grouped, collapsible menu, filtered by role,
// plus user info and logout. Mobile: sidebar opens from the menu button.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const cfg = { apiKey: "AIzaSyCP0heHxeSJezxkAyvYAkGdFenY4ErhV0U", authDomain: "laland-express.firebaseapp.com", projectId: "laland-express", storageBucket: "laland-express.firebasestorage.app", messagingSenderId: "315462688826", appId: "1:315462688826:web:a6b033e1ce664071201503" };
const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

const GROUPS = [
  { title: 'Dashboard', items: [['index.html', 'Dashboard', 'fa-gauge'], ['finance.html', 'Finance', 'fa-landmark']] },
  { title: 'Operations', items: [['orders.html', 'Orders', 'fa-cart-shopping'], ['rider.html', 'Rider Finance', 'fa-wallet'], ['day-close.html', 'Day Close', 'fa-cash-register']] },
  { title: 'Products & Suppliers', items: [['products.html', 'Products', 'fa-box'], ['stock-in.html', 'Stock-In', 'fa-truck-ramp-box'], ['suppliers.html', 'Suppliers', 'fa-truck-field'], ['purchase-orders.html', 'Purchase Orders', 'fa-file-invoice'], ['stock-receive.html', 'Stock Receive', 'fa-clipboard-check'], ['stock-value.html', 'Stock Value', 'fa-scale-balanced'], ['store-handover.html', 'Store Handover', 'fa-handshake']] },
  { title: 'Admin', items: [['customers.html', 'Customers', 'fa-users'], ['delivery-riders.html', 'Delivery Riders', 'fa-motorcycle'], ['locations.html', 'Locations', 'fa-location-dot'], ['data-tools.html', 'Data Tools', 'fa-screwdriver-wrench']] }
];

// Same rule as firestore.rules. null = every page.
const ROLE_PAGES = {
  master: null,
  store: ['orders.html', 'rider.html', 'day-close.html', 'stock-receive.html', 'stock-value.html', 'store-handover.html'],
  vendor: ['suppliers.html', 'products.html', 'stock-in.html', 'purchase-orders.html', 'stock-receive.html']
};
const ROLE_LABEL = { master: 'মাস্টার', store: 'স্টোর ম্যানেজার', vendor: 'Vendor Manager' };

const cur = location.pathname.split('/').pop() || 'index.html';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bd = (key) => `<span data-badge="${key}" class="hidden ml-auto bg-red-500 text-white rounded-full px-1.5 text-[10px] font-bold"></span>`;

// ---------- shell: sidebar + overlay, body shifted on desktop
function ensureShell() {
  if (document.getElementById('adSide')) return;
  const style = document.createElement('style');
  style.textContent = 'body.ad-shell{padding-left:0}@media (min-width:768px){body.ad-shell{padding-left:16rem}}';
  document.head.appendChild(style);
  document.body.classList.add('ad-shell');
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <aside id="adSide" class="fixed inset-y-0 left-0 w-64 bg-white border-r shadow-sm z-[55] flex flex-col transform -translate-x-full md:translate-x-0 transition-transform duration-200">
      <div class="px-5 py-4 border-b flex items-center gap-2">
        <i class="fa-solid fa-store text-emerald-600"></i>
        <span class="font-extrabold text-sm text-gray-800">Laland Express</span>
      </div>
      <nav id="adNav" class="flex-1 overflow-y-auto py-3"></nav>
      <div id="adUser" class="border-t p-3"></div>
    </aside>
    <div id="adOverlay" class="hidden fixed inset-0 bg-black/40 z-[54] md:hidden"></div>`;
  while (wrap.firstChild) document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  document.getElementById('adOverlay').onclick = closeSide;
}
function openSide() {
  document.getElementById('adSide').classList.remove('-translate-x-full');
  document.getElementById('adOverlay').classList.remove('hidden');
}
function closeSide() {
  document.getElementById('adSide')?.classList.add('-translate-x-full');
  document.getElementById('adOverlay')?.classList.add('hidden');
}
async function doLogout() {
  try { await signOut(auth); } catch (e) { /* ignore */ }
  location.href = 'index.html';
}

// ---------- menu
function render(role, name) {
  ensureShell();
  const allowed = role in ROLE_PAGES ? ROLE_PAGES[role] : [];
  const ok = (h) => allowed === null || allowed.includes(h);
  const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(([h]) => ok(h)) })).filter(g => g.items.length);

  document.getElementById('adNav').innerHTML = groups.map((g, gi) => `
    <div class="mb-2">
      <button type="button" data-g="${gi}" class="w-full flex items-center justify-between px-5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 hover:text-gray-600">
        <span>${esc(g.title)}</span><i class="fa-solid fa-chevron-down text-[9px] transition-transform"></i>
      </button>
      <div data-gb="${gi}" class="space-y-0.5 mt-1">
        ${g.items.map(([h, l, ic]) => `
          <a href="${h}" class="flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-sm ${h === cur ? 'bg-emerald-600 text-white font-semibold shadow' : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'}">
            <i class="fa-solid ${ic} w-4 text-center"></i><span class="flex-1">${esc(l)}</span>${bd(h)}
          </a>`).join('')}
      </div>
    </div>`).join('') || '<p class="px-5 py-4 text-xs text-gray-400">কোনো মেনু নেই</p>';

  document.querySelectorAll('#adNav button[data-g]').forEach(btn => {
    btn.onclick = () => {
      const body = document.querySelector(`#adNav [data-gb="${btn.dataset.g}"]`);
      const hide = body.classList.toggle('hidden');
      btn.querySelector('i').style.transform = hide ? 'rotate(-90deg)' : '';
    };
  });
  document.querySelectorAll('#adNav a').forEach(a => a.addEventListener('click', closeSide));

  const label = ROLE_LABEL[role] || '';
  document.getElementById('adUser').innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"><i class="fa-solid fa-user"></i></div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-gray-800 truncate">${esc(name)}</p>
        <p class="text-[11px] text-gray-500 truncate">${esc(label)}</p>
      </div>
      <button id="adLogout" type="button" title="লগআউট" class="text-red-500 hover:bg-red-50 p-2 rounded-lg"><i class="fa-solid fa-right-from-bracket"></i></button>
    </div>`;
  document.getElementById('adLogout').onclick = doLogout;

  // header (keeps the page's own header): user chip, logout, mobile menu button
  const nav = document.querySelector('header nav');
  if (nav) {
    nav.className = 'flex items-center gap-2 text-xs';
    nav.innerHTML = `
      <span class="hidden sm:flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-lg" title="লগইন করা ব্যক্তি">
        <i class="fa-solid fa-circle-user"></i><span class="font-semibold">${esc(name)}</span>
        <span class="hidden lg:inline text-[10px] text-emerald-100">(${esc(label)})</span>
      </span>
      <button id="navLogout" type="button" class="bg-red-500 hover:bg-red-600 px-2.5 py-1.5 rounded-lg font-bold shadow" title="লগআউট">
        <i class="fa-solid fa-right-from-bracket"></i><span class="hidden sm:inline ml-1">লগআউট</span>
      </button>
      <button id="navBurger" type="button" class="md:hidden px-2 text-xl" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>`;
    document.getElementById('navLogout').onclick = doLogout;
    document.getElementById('navBurger').onclick = () => {
      document.getElementById('adSide').classList.contains('-translate-x-full') ? openSide() : closeSide();
    };
  }
}

// ---------- page-level guard (direct URL access)
function guard(role, name) {
  ensureShell();
  const allowed = role in ROLE_PAGES ? ROLE_PAGES[role] : [];
  if (allowed === null || allowed.includes(cur)) return true;
  if (allowed.length) { location.replace(allowed[0]); return false; }
  const wall = document.createElement('div');
  wall.className = 'fixed inset-0 bg-white z-[100] flex items-center justify-center p-6';
  wall.innerHTML = `<div class="text-center space-y-3 max-w-sm">
      <i class="fa-solid fa-lock text-4xl text-red-500"></i>
      <p class="font-bold text-gray-800">এই পেজে আপনার অনুমতি নেই</p>
      <p class="text-xs text-gray-500">${esc(name)}</p>
      <button id="wallLogout" class="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold">লগআউট</button>
    </div>`;
  document.body.appendChild(wall);
  document.getElementById('wallLogout').onclick = doLogout;
  return false;
}

// Live counters in the sidebar (every admin page). Each one is a small, filtered listener.
function setBadge(key, n) {
  document.querySelectorAll(`[data-badge="${key}"]`).forEach(el => {
    el.textContent = n;
    el.classList.toggle('hidden', !n);
  });
}
function startBadges(role) {
  const allowed = ROLE_PAGES[role];
  const can = (h) => allowed === null || (allowed || []).includes(h);
  const fail = (e) => console.warn('badge:', e.message);
  if (can('orders.html'))
    onSnapshot(query(collection(db, 'orders'), where('status', '==', 'Pending')), s => setBadge('orders.html', s.size), fail);
  if (can('rider.html'))
    onSnapshot(query(collection(db, 'cash_settlements'), where('status', '==', 'Pending')), s => setBadge('rider.html', s.size), fail);
  if (can('stock-receive.html'))
    onSnapshot(query(collection(db, 'stock_in_pending'), where('status', '==', 'pending')), s => setBadge('stock-receive.html', s.size), fail);
  if (can('purchase-orders.html'))
    onSnapshot(query(collection(db, 'purchase_orders'), where('status', '==', 'Submitted')), s => setBadge('purchase-orders.html', s.size), fail);
}

onAuthStateChanged(auth, async (u) => {
  if (!u) return;                                   // the page itself shows the login screen
  try {
    const s = await getDoc(doc(db, 'admins', u.uid));
    if (!s.exists()) { guard('none', u.email); return render('none', u.email); }
    const d = s.data();
    if (d.active === false) { guard('none', u.email); return render('none', u.email); }
    const role = d.role || 'master';                // same rule as firestore.rules
    const name = d.name || u.email;
    if (!guard(role, name)) return;
    render(role, name);
    startBadges(role);
  } catch (e) {
    console.warn('admin-nav:', e.message);
  }
});
