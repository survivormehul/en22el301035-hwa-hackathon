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
    // best-effort persistence on serverless (read-only FS); response still returned
  }
}
loadSubs();

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
    const sub = JSON.parse(body || '{}');

    if (!sub.customer || !sub.customer.name || !sub.customer.email || !sub.customer.phone || !sub.customer.address || !sub.customer.pincode) {
      res.status(400).json({ ok: false, error: 'Missing required customer details' });
      return;
    }
    if (!sub.dog || !sub.dog.name || !sub.dog.breed || !sub.dog.size) {
      res.status(400).json({ ok: false, error: 'Missing required dog profile details' });
      return;
    }
    if (!sub.planType || (sub.planType === 'curated' && !sub.items) || (sub.planType === 'build-your-own' && !sub.items)) {
      res.status(400).json({ ok: false, error: 'Invalid plan selection' });
      return;
    }
    if (sub.frequency !== 'monthly' && sub.frequency !== 'yearly') {
      res.status(400).json({ ok: false, error: 'Frequency must be monthly or yearly' });
      return;
    }

    const record = {
      id: 'HWA-SUB-' + Date.now(),
      createdAt: new Date().toISOString(),
      frequency: sub.frequency,
      planType: sub.planType,
      items: sub.items,
      total: sub.total,
      customer: sub.customer,
      dog: sub.dog,
      status: 'active'
    };
    subs.push(record);
    saveSubs();

    res.status(200).json({ ok: true, subscriptionId: record.id, total: record.total, frequency: record.frequency });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
};
