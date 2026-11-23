const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, '../data/notifications.json');

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
  return [];
}
function save(list) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
  } catch (e) {}
}

const ALLOWED_TYPES = ['order_confirmation', 'shipping_update', 'delivery_confirmation', 'renewal_reminder'];

function buildEmail(type, data) {
  data = data || {};
  if (type === 'order_confirmation') {
    return {
      subject: 'Order ' + (data.orderId || '') + ' placed - payment pending',
      body: 'Thank you for your order ' + (data.orderId || '') + '. Items: ' + (data.itemsSummary || '') + '. Initial amount: Rs ' + (data.total || 0) + '. Payment status: PENDING (no real payment has been processed yet).'
    };
  }
  if (type === 'shipping_update') {
    return {
      subject: 'Your order ' + (data.orderId || '') + ' has shipped',
      body: 'Your order ' + (data.orderId || '') + ' is now SHIPPED and on its way.'
    };
  }
  if (type === 'delivery_confirmation') {
    return {
      subject: 'Your order ' + (data.orderId || '') + ' was delivered',
      body: 'Your order ' + (data.orderId || '') + ' has been marked DELIVERED. We hope your dog is happy!'
    };
  }
  if (type === 'renewal_reminder') {
    return {
      subject: 'Upcoming renewal for ' + (data.name || 'your subscription') + ' (' + (data.subscriptionId || '') + ')',
      body: 'Your subscription ' + (data.subscriptionId || '') + ' for ' + (data.name || '') + ' renews on ' + (data.renewalDate || '') + '. Billing amount: Rs ' + (data.amount || 0) + ' (' + (data.frequency || 'monthly') + ').'
    };
  }
  return { subject: 'Happy While Away update', body: 'An update about your account.' };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || '{}');
    const type = payload.type;
    const to = (payload.to || '').trim();
    if (ALLOWED_TYPES.indexOf(type) === -1) { res.status(400).json({ ok: false, error: 'Unsupported notification type' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { res.status(400).json({ ok: false, error: 'A valid recipient email is required' }); return; }

    const email = buildEmail(type, payload.data || {});
    const record = { id: 'HWA-EMAIL-' + Date.now() + '-' + Math.floor(Math.random() * 1000), createdAt: new Date().toISOString(), type: type, to: to, subject: email.subject, body: email.body, simulated: true };

    let delivered = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Happy While Away <onboarding@resend.dev>', to: [to], subject: email.subject, html: '<p>' + email.body.replace(/</g, '&lt;') + '</p>' })
        });
        if (r.ok) { delivered = true; record.simulated = false; }
      } catch (e) {}
    }

    const list = load();
    list.push(record);
    save(list);

    res.status(200).json({ ok: true, delivered: delivered, simulated: record.simulated, notification: record });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
};