const fs = require('fs');
const path = require('path');

let orders = [];
const DATA_FILE = path.join(__dirname, '../data/orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    orders = [];
  }
}
function saveOrders() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
  } catch (e) {
    // best-effort persistence on serverless (read-only FS); orders still returned in response
  }
}
loadOrders();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const order = JSON.parse(body || '{}');

    if (!order.name || !order.email || !order.address || !order.city || !order.pincode || !order.phone) {
      res.status(400).json({ ok: false, error: 'Missing required fields' });
      return;
    }
    if (!Array.isArray(order.items) || order.items.length === 0) {
      res.status(400).json({ ok: false, error: 'Cart is empty' });
      return;
    }

    const record = {
      id: 'HWA-' + Date.now(),
      createdAt: new Date().toISOString(),
      ...order
    };
    orders.push(record);
    saveOrders();

    res.status(200).json({ ok: true, orderId: record.id, total: order.total });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
};
