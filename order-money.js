// Shared order-money helpers for the storefront and every admin page.
// The "real" bill of an order after returns = value of the units the customer KEPT (coupon discount applied
// proportionally) + delivery charge (only if at least one unit was kept).
// This is the same formula the server uses in functions/reconcile.js (parts().held), so every page shows the same number.
(function () {
  const n = (v) => Number(v || 0);
  const r2 = (v) => Math.round(v * 100) / 100;

  // units that came back, in any way (door return or return menu)
  function returnedUnits(o) {
    return (o.items || []).reduce((s, i) => s + n(i.returnedQty), 0);
  }

  // current bill. Cancelled, or returned before delivery -> 0. No returns -> the original total.
  function netBill(o) {
    const st = String(o.status || '').toLowerCase();
    if (st === 'cancelled') return 0;
    if (st === 'returned' && !o.deliveredAt) return 0;
    const items = o.items || [];
    if (!returnedUnits(o)) return n(o.totalAmount);
    const sub = n(o.subtotal) || items.reduce((s, i) => s + n(i.price) * n(i.qty), 0);
    const ratio = sub > 0 ? (sub - n(o.discount)) / sub : 1;
    const dc = o.deliveryCharge == null ? 30 : n(o.deliveryCharge);
    let kept = 0, any = false;
    items.forEach((i) => {
      const k = n(i.qty) - n(i.returnedQty);
      if (k > 0) { kept += n(i.price) * k; any = true; }
    });
    return Math.max(0, r2(kept * ratio + (any ? dc : 0)));
  }

  // true when part (or all) of a delivered order came back, i.e. netBill differs from the order total
  function hasReturns(o) {
    return returnedUnits(o) > 0 && Math.abs(netBill(o) - n(o.totalAmount)) > 0.005;
  }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.OrderMoney = { netBill, hasReturns, returnedUnits, esc };
  window.netBill = netBill;
})();
