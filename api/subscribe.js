const fs = require('fs');
const path = require('path');

let subs = [];
const DATA_FILE = path.join(__dirname, '../data/subscriptions.json');

function loadSubs() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      subs = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    subs = [];
  }
}
function saveSubs() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(subs, null, 2));
  } catch (e) {
  }
}
loadSubs();

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function computeUnit(item) {
  const price = Number(item.price) || 0;
  if (item.amount != null) return Number(item.amount);
  const months = item.productId === 'build-your-own' ? 12 : 10;
  return item.freq === 'yearly' ? price * months : price;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const email = (url.searchParams.get('email') || '').toLowerCase();
    if (!email) {
      res.status(400).json({ ok: false, error: 'Email is required' });
      return;
    }
    const found = subs.filter((s) => s.customer && (s.customer.email || '').toLowerCase() === email);
    res.status(200).json({ ok: true, subscriptions: found });
    return;
  }

  if (req.method === 'PATCH') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      const record = subs.find((s) => s.id === payload.subscriptionId);
      if (!record) {
        res.status(404).json({ ok: false, error: 'Subscription not found' });
        return;
      }
      const action = payload.action;
      if (action === 'pause') { record.status = 'paused'; }
      else if (action === 'resume') { record.status = 'active'; }
      else if (action === 'cancel') { record.status = 'cancelled'; }
      else if (action === 'setQty') {
        const qty = Math.max(1, parseInt(payload.qty, 10) || 1);
        const unit = record.unitAmount != null ? record.unitAmount : computeUnit(record.items[0]);
        record.items[0].qty = qty;
        record.total = Math.round(unit * qty);
        if (record.billing) record.billing.amount = record.total;
      }
      else if (action === 'setDog') { record.dog = payload.dog || null; }
      else if (action === 'setDeliveryAddress') {
        record.deliveryAddress = payload.deliveryAddress || record.deliveryAddress;
        if (record.deliveryAddress && record.customer) {
          record.customer.address = record.deliveryAddress.address;
          record.customer.pincode = record.deliveryAddress.pincode;
        }
      }
      else if (action === 'setDeliveryPreferences') { record.deliveryPreferences = payload.deliveryPreferences || {}; }
      else if (action === 'skipDelivery') {
        if (record.frequency !== 'yearly') {
          res.status(400).json({ ok: false, error: 'Skipping a delivery is only available for yearly subscriptions' });
          return;
        }
        record.skippedDeliveries = record.skippedDeliveries || [];
        record.skippedDeliveries.push(record.nextDeliveryDate || record.renewalDate);
        record.nextDeliveryDate = addMonths(record.nextDeliveryDate ? new Date(record.nextDeliveryDate) : new Date(record.renewalDate), 1).toISOString();
      }
      else {
        res.status(400).json({ ok: false, error: 'Unsupported action. Billing frequency and product changes are not allowed.' });
        return;
      }
      record.updatedAt = new Date().toISOString();
      saveSubs();
      res.status(200).json({ ok: true, subscription: record });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'Server error' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const sub = JSON.parse(body || '{}');

    if (!sub.customer || !sub.customer.name || !sub.customer.email || !sub.customer.phone) {
      res.status(400).json({ ok: false, error: 'Missing required customer details' });
      return;
    }

    const address = sub.deliveryAddress || (sub.customer && sub.customer.address ? { address: sub.customer.address, pincode: sub.customer.pincode } : null);
    if (!address || !address.address || !address.pincode) {
      res.status(400).json({ ok: false, error: 'A common delivery address is required' });
      return;
    }

    const rawItems = Array.isArray(sub.items) ? sub.items : [];
    const items = rawItems.map(function (raw) {
      if (typeof raw === 'string') { return { productId: raw, name: raw, price: 0, qty: 1, freq: sub.frequency }; }
      return {
        productId: raw.productId || raw.id || sub.planType || 'plan',
        name: raw.name || raw.title || 'Subscription',
        price: Number(raw.price) || 0,
        qty: Number(raw.qty) || 1,
        freq: raw.freq || sub.frequency,
        config: raw.config || null,
        dogId: raw.dogId || null,
        amount: raw.amount
      };
    });
    if (items.length === 0) {
      res.status(400).json({ ok: false, error: 'No items to subscribe' });
      return;
    }
    for (const item of items) {
      if (item.freq !== 'monthly' && item.freq !== 'yearly') {
        res.status(400).json({ ok: false, error: 'Each item must have monthly or yearly billing' });
        return;
      }
    }

    const now = new Date();
    const orderId = typeof sub.orderId === 'string' && /^HWA-ORD-[0-9]+$/.test(sub.orderId)
      ? sub.orderId
      : 'HWA-ORD-' + now.getTime();
    const requestedIds = Array.isArray(sub.subscriptionIds) ? sub.subscriptionIds : [];
    const usedIds = new Set(subs.map((s) => s.id));
    let orderInitial = 0;
    for (const item of items) orderInitial += Math.round(computeUnit(item) * (Number(item.qty) || 1));

    const created = [];
    items.forEach((item, idx) => {
      const unit = computeUnit(item);
      const qty = Number(item.qty) || 1;
      const amount = Math.round(unit * qty);
      const dog = (sub.dogs || []).find((d) => d.id && item.dogId && d.id === item.dogId) || (sub.dog || null);
      const renewal = item.freq === 'yearly' ? addMonths(now, 12) : addMonths(now, 1);
      const nextDelivery = addMonths(now, 1);
      let recordId = typeof requestedIds[idx] === 'string' && /^HWA-SUB-/.test(requestedIds[idx])
        ? requestedIds[idx]
        : 'HWA-SUB-' + now.getTime() + '-' + (idx + 1);
      if (usedIds.has(recordId)) recordId = 'HWA-SUB-' + now.getTime() + '-' + (idx + 1) + '-r';
      while (usedIds.has(recordId)) recordId += 'r';
      usedIds.add(recordId);
      const record = {
        id: recordId,
        orderId: orderId,
        createdAt: now.toISOString(),
        frequency: item.freq,
        planType: item.productId === 'build-your-own' ? 'build-your-own' : 'curated',
        items: [{ productId: item.productId, name: item.name, price: Number(item.price) || 0, qty: qty, freq: item.freq, config: item.config || null }],
        unitAmount: unit,
        total: amount,
        initialPayment: orderInitial,
        billing: { type: item.freq, amount: amount, nextDueDate: renewal.toISOString(), chargedUpfrontMonths: item.freq === 'yearly' ? 12 : 1 },
        renewalDate: renewal.toISOString(),
        nextDeliveryDate: nextDelivery.toISOString(),
        skippedDeliveries: [],
        deliveryPreferences: sub.deliveryPreferences || {},
        deliveryAddress: address,
        customer: { name: sub.customer.name, email: sub.customer.email, phone: sub.customer.phone },
        dog: dog,
        editable: { billingFrequency: false, product: false, quantity: true, dog: true },
        paymentMethod: sub.paymentMethod || 'unspecified',
        paymentStatus: 'pending',
        promoCode: sub.promoCode || null,
        promoDiscount: Number(sub.promoDiscount) || 0,
        status: 'active'
      };
      subs.push(record);
      created.push(record);
    });
    saveSubs();

    res.status(200).json({ ok: true, orderId: orderId, initialPayment: orderInitial, paymentStatus: 'pending', subscriptions: created });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
};