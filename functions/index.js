// Laland Express - stock movement engine.
// Runs on every orders/{id} update (Blaze plan) and keeps products.stock correct:
//   Delivered (first time)          -> 'out' movement for every item, stock goes DOWN by qty
//   returnedQty goes up / Returned  -> 'return' movement, stock goes UP by the returned qty
// Each movement doc id is fixed (out_<order>_<product>, ret_<order>_<product>_<entry>),
// and the write runs in a transaction that checks it first, so a replay never counts twice.
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// how many units of this line are currently "returned" (status Returned = whole order)
const retTarget = (order, item) =>
  order.status === "Returned" ? Number(item.qty || 0) : Number(item.returnedQty || 0);

async function applyMove(productId, moveId, delta, type, meta) {
  if (!productId || !delta) return;
  const pRef = db.doc(`products/${productId}`);
  const mRef = pRef.collection("movements").doc(moveId);
  await db.runTransaction(async (tx) => {
    const m = await tx.get(mRef);
    if (m.exists) return;                       // already applied -> no double count
    const p = await tx.get(pRef);
    if (!p.exists) return;                      // product deleted: nothing to move
    const newStock = Number(p.data().stock || 0) + delta;
    tx.update(pRef, { stock: newStock });
    tx.set(mRef, {
      type,                                     // 'out' | 'return' | 'return_undo'
      qty: Math.abs(delta),
      delta,
      balanceAfter: newStock,
      refId: meta.refId,
      supplier: p.data().supplier || "",
      createdAt: new Date().toISOString()
    });
  });
}

exports.onOrderChange = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const orderId = event.params.orderId;
  const items = after.items || [];
  const refId = after.orderId || orderId;

  // 1) first time Delivered -> stock out
  if (before.status !== "Delivered" && after.status === "Delivered") {
    for (const it of items) {
      await applyMove(String(it.id), `out_${orderId}_${it.id}`, -Number(it.qty || 0), "out", { refId });
    }
  }

  // 2) returns: only for orders that really left the shelf (have deliveredAt)
  if (after.deliveredAt) {
    const last = (after.returnHistory || []).slice(-1)[0];
    const entryId = last ? last.id : "full";
    for (const it of items) {
      const prev = (before.items || []).find((x) => String(x.id) === String(it.id)) || {};
      const d = retTarget(after, it) - retTarget(before, prev);
      if (!d) continue;
      if (d > 0) {
        await applyMove(String(it.id), `ret_${orderId}_${it.id}_${entryId}`, d, "return", { refId });
      } else {
        // a return was reduced/undone by admin -> take the stock back out
        await applyMove(String(it.id), `undo_${orderId}_${it.id}_${entryId}`, d, "return_undo", { refId });
      }
    }
  }
});

