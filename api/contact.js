const fs = require('fs');
const path = require('path');

let contacts = [];
const DATA_FILE = path.join(__dirname, '../data/contacts.json');

function loadContacts() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      contacts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    contacts = [];
  }
}
function saveContacts() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(contacts, null, 2));
  } catch (e) {
    // best-effort persistence on serverless (read-only FS); response still returned
  }
}
loadContacts();

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
    const contact = JSON.parse(body || '{}');

    if (!contact.name || !contact.mobile || !contact.email || !contact.concern) {
      res.status(400).json({ ok: false, error: 'All fields are required' });
      return;
    }

    const record = {
      id: 'HWA-CONTACT-' + Date.now(),
      createdAt: new Date().toISOString(),
      name: contact.name,
      mobile: contact.mobile,
      email: contact.email,
      concern: contact.concern
    };
    contacts.push(record);
    saveContacts();

    res.status(200).json({ ok: true, message: 'Message recorded in the demo contact log. No real support inbox is connected.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
};
