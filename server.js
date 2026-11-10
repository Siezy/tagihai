/**
 * TagihAI — AI billing agent for freelancers.
 *
 * Chat in plain language (English or Indonesian). The agent parses the
 * intent, creates real PayPal invoices in the SANDBOX, tracks them, and
 * drafts payment reminders.
 *
 * Modes:
 *  - live: PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET are set → real PayPal
 *    sandbox API calls. No real money ever moves (sandbox only).
 *  - mock: no PayPal keys → in-memory fake invoice store, clearly labelled.
 *    The app starts and demos end-to-end with ZERO keys.
 *
 * Gemini (GEMINI_API_KEY) is used for intent parsing when configured;
 * otherwise a local regex parser with the same JSON output shape is used.
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

// Client-name registry: PayPal's invoice list does not return the recipient
// name (we only sent an email at create time), so name-based lookups
// ("Status invoice Sari") failed with "can't find". Keep id -> client here,
// persisted to disk so restarts keep it. New invoices also send the name
// to PayPal (billing_info.name) so PayPal itself stores it going forward.
const REGISTRY_PATH = path.join(__dirname, 'client-registry.json');
let clientRegistry = {};
try { clientRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch { clientRegistry = {}; }
function saveRegistry() {
  try { fs.writeFileSync(REGISTRY_PATH, JSON.stringify(clientRegistry, null, 2)); } catch { /* best effort */ }
}

const PORT = process.env.PORT || 3000;
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const PAYPAL_CONFIGURED = Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
const GEMINI_CONFIGURED = Boolean(GEMINI_API_KEY);
const MODE = PAYPAL_CONFIGURED ? 'live' : 'mock';

// ---------------------------------------------------------------- helpers
const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (v) => (Math.round(v * 100) / 100).toFixed(2);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// PayPal Invoicing supports a fixed currency list — IDR is NOT on it.
// Convert IDR to USD at a fixed approximate rate and always say so in the
// reply; never silently re-denominate. Other unsupported currencies error.
const IDR_PER_USD = 16500;
const PAYPAL_CURRENCIES = new Set(['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'ILS', 'INR', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RUB', 'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'USD']);
function toPayPalCurrency(amount, currency) {
  const cur = (currency || 'USD').toUpperCase();
  if (PAYPAL_CURRENCIES.has(cur)) return { amount, currency: cur, converted: null };
  if (cur === 'IDR') {
    const usd = Math.round((amount / IDR_PER_USD) * 100) / 100;
    return { amount: usd, currency: 'USD', converted: { from_amount: amount, from_currency: 'IDR', rate: IDR_PER_USD } };
  }
  throw new Error(`Currency ${cur} is not supported by PayPal invoicing — please use USD.`);
}

// ---------------------------------------------------------------- PayPal
let tokenCache = { token: null, expiresAt: 0 };

async function paypalToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

async function paypalRequest(method, path, body) {
  const token = await paypalToken();
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data && data.details
      ? data.details.map((d) => d.description || d.issue).join('; ')
      : (data && data.message) || text;
    throw new Error(`PayPal ${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

// PayPal TermType enum: only NET_10/15/30/45/60/90 exist (no NET_3/7/14).
// Any other due_days uses DUE_ON_DATE_SPECIFIED with the exact due date.
function datePlusDays(n) {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
}
function paymentTermForDueDays(d) {
  if (!d || d <= 0) return { term_type: 'DUE_ON_RECEIPT' };
  const allowed = [10, 15, 30, 45, 60, 90];
  if (allowed.includes(d)) return { term_type: `NET_${d}` };
  return { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: datePlusDays(d) };
}

function paymentLinkFromInvoice(inv) {
  const links = inv.links || [];
  const payer = links.find((l) => (l.rel || '') === 'payer-action');
  if (payer) return payer.href;
  return `https://www.sandbox.paypal.com/invoice/p/#${inv.id}`;
}

function normalizeLiveInvoice(inv) {
  const detail = inv.detail || {};
  const recip = (inv.primary_recipients && inv.primary_recipients[0]) || {};
  const billing = recip.billing_info || {};
  const name = billing.name
    ? `${billing.name.given_name || ''} ${billing.name.surname || ''}`.trim()
    : '';
  const reg = clientRegistry[inv.id];
  const amount = inv.amount || {};
  const items = inv.items || [];
  return {
    id: inv.id,
    number: detail.invoice_number || inv.id,
    client: (reg && reg.client) || name || billing.email_address || 'Client',
    client_email: billing.email_address || '',
    amount: parseFloat(amount.value || (items[0] && items[0].unit_amount && items[0].unit_amount.value) || 0),
    currency: amount.currency_code || detail.currency_code || 'USD',
    description: (reg && reg.description) || (items[0] && items[0].name) || '',
    due_days: null,
    status: inv.status || 'UNKNOWN',
    payment_link: paymentLinkFromInvoice(inv),
    created_at: detail.invoice_date || todayISO(),
    mock: false,
  };
}

// Split "Budi Santoso" -> { given_name: 'Budi', surname: 'Santoso' }.
// PayPal stores the name, so later list/get calls return it.
function splitName(full) {
  const parts = String(full || 'Client').trim().split(/\s+/);
  const out = { given_name: parts[0] || 'Client' };
  if (parts.length > 1) out.surname = parts.slice(1).join(' ');
  return out;
}

async function createInvoiceLive(d) {
  const value = money(d.amount);
  const payload = {
    detail: {
      invoice_number: d.number,
      invoice_date: todayISO(),
      currency_code: d.currency,
      payment_term: paymentTermForDueDays(d.due_days),
    },
    primary_recipients: [{ billing_info: {
      name: splitName(d.client),
      email_address: d.client_email,
    } }],
    items: [{
      name: d.description,
      quantity: '1',
      unit_amount: { currency_code: d.currency, value },
    }],
    amount: { breakdown: { item_total: { currency_code: d.currency, value } } },
  };
  const created = await paypalRequest('POST', '/v2/invoicing/invoices', payload);
  // PayPal create returns only a link object { rel:'self', href:'.../invoices/<id>' } — extract the id.
  const invoiceId = (created && created.id)
    || (created && created.href ? created.href.split('/').filter(Boolean).pop() : null);
  if (!invoiceId) throw new Error('PayPal create invoice returned no id');
  // Send it so the payer gets a usable payment link.
  await paypalRequest('POST', `/v2/invoicing/invoices/${invoiceId}/send`, { send_to_recipient: true });
  const full = await paypalRequest('GET', `/v2/invoicing/invoices/${invoiceId}`);
  const inv = normalizeLiveInvoice(full);
  inv.client = d.client;
  inv.description = d.description;
  inv.due_days = d.due_days;
  clientRegistry[invoiceId] = { client: d.client, description: d.description };
  saveRegistry();
  return inv;
}

async function getInvoiceLive(id) {
  const full = await paypalRequest('GET', `/v2/invoicing/invoices/${encodeURIComponent(id)}`);
  return normalizeLiveInvoice(full);
}

async function listInvoicesLive() {
  const data = await paypalRequest('GET', '/v2/invoicing/invoices?page=1&page_size=20&total_required=true');
  return (data.items || []).map(normalizeLiveInvoice);
}

// ---------------------------------------------------------------- mock store
const mockInvoices = [];
let mockCounter = 0;
let invoiceCounter = 0;

// Invoice numbers must be unique per PayPal merchant account. The old
// in-memory counter reset on every server restart and re-issued 001,
// which PayPal rejects with 422 duplicate. In live mode, derive the next
// number from the invoices PayPal already has for today.
async function nextInvoiceNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  if (MODE === 'live') {
    try {
      const all = await listInvoicesLive();
      let max = 0;
      for (const inv of all) {
        const m = /^TG-(\d{8})-(\d{3})$/.exec(inv.number || '');
        if (m && m[1] === ymd) max = Math.max(max, parseInt(m[2], 10));
      }
      return `TG-${ymd}-${String(max + 1).padStart(3, '0')}`;
    } catch { /* fall through to the in-memory counter */ }
  }
  invoiceCounter += 1;
  return `TG-${ymd}-${String(invoiceCounter).padStart(3, '0')}`;
}

function createInvoiceMock(d) {
  mockCounter += 1;
  const inv = {
    id: `MOCK-${String(mockCounter).padStart(4, '0')}`,
    number: d.number,
    client: d.client,
    client_email: d.client_email,
    amount: d.amount,
    currency: d.currency,
    description: d.description,
    due_days: d.due_days,
    status: 'SENT',
    payment_link: `https://www.sandbox.paypal.com/invoice/p/#MOCK-${String(mockCounter).padStart(4, '0')}`,
    created_at: todayISO(),
    mock: true,
  };
  mockInvoices.unshift(inv);
  return inv;
}

// ---------------------------------------------------------------- intent parsing
function detectLang(msg) {
  return /tagih|buat|belum|bayar|draf|ingatkan|jatuh|tempo|ribu|juta|siapa|bantuan|tolong|terima|halo|hai\b|kabar|selamat|pagi|siang|sore|malam/i.test(msg)
    ? 'id' : 'en';
}

// Parse numbers the way Indonesians and English speakers write them.
// "$150" → 150 USD · "150 ribu" → 150000 IDR · "1,5 juta" → 1500000 IDR
function parseAmountText(numStr, idContext) {
  let s = numStr.trim();
  if (idContext && /^\d{1,3}(\.\d{3})+([,.]\d+)?$/.test(s)) s = s.replace(/\./g, '');
  else s = s.replace(/,/g, '');
  if (idContext && s.includes(',')) s = s.replace(',', '.');
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function regexParse(message) {
  const msg = message.trim();
  const lang = detectLang(msg);
  const lower = msg.toLowerCase();

  if (/^(help|bantuan|bantu|tolong|apa yang bisa|what can you)/i.test(lower)) {
    return { intent: 'help' };
  }
  if (/(belum bayar|belum dibayar|unpaid|who hasn'?t paid|siapa.*belum|outstanding)/i.test(lower)) {
    return { intent: 'list_unpaid' };
  }
  if (/(draf|draft|ingatkan|remind|reminder)/i.test(lower)) {
    const m = msg.match(/(?:buat|untuk|for|ke|to)\s+([A-Za-z][A-Za-z'’.-]*)/i)
      || msg.match(/(?:draf|draft|ingatkan|remind)\s+([A-Za-z][A-Za-z'’.-]*)/i);
    return { intent: 'draft_reminder', client: m ? m[1] : null };
  }
  if (/(status|cek|check|paid\?|sudah bayar)/i.test(lower)) {
    const m = msg.match(/(?:status|cek|check)\s+(?:invoice\s+)?([A-Za-z][A-Za-z'’.-]*)/i);
    return { intent: 'invoice_status', client: m ? m[1] : null };
  }
  if (/(tagih|invoice|bill|charge|buatkan invoice|create invoice)/i.test(lower)) {
    let amount = null;
    let currency = 'USD';
    let m;
    if ((m = msg.match(/\$\s*([\d.,]+)/))) {
      amount = parseAmountText(m[1], false); currency = 'USD';
    } else if ((m = msg.match(/Rp\s*([\d.,]+)/i))) {
      amount = parseAmountText(m[1], true); currency = 'IDR';
    } else if ((m = msg.match(/([\d.,]+)\s*(?:juta|jt)\b/i))) {
      amount = parseAmountText(m[1], true); if (amount != null) amount *= 1e6; currency = 'IDR';
    } else if ((m = msg.match(/([\d.,]+)\s*(?:ribu|rb)\b/i))) {
      amount = parseAmountText(m[1], true); if (amount != null) amount *= 1e3; currency = 'IDR';
    } else if ((m = msg.match(/([\d.,]+)\s*(?:usd|dollar|dolar)\b/i))) {
      amount = parseAmountText(m[1], false); currency = 'USD';
    } else if ((m = msg.match(/(\d[\d.,]*)/))) {
      amount = parseAmountText(m[1], false); currency = 'USD';
    }

    let client = null;
    const cm = msg.match(/(?:tagih|invoice|bill|charge)\s+([A-Za-z][A-Za-z'’.-]*)/i);
    if (cm) client = cm[1];

    let dueDays = 7;
    const dm = msg.match(/(?:jatuh tempo|due in|tempo)\s*(\d+)\s*(?:hari|days?)?/i)
      || msg.match(/net[-\s]?(\d+)/i);
    if (dm) dueDays = parseInt(dm[1], 10);

    const em = msg.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    const email = em ? em[0] : null;

    // Description: whatever is left after removing command, client, amount, due clause.
    let desc = msg
      .replace(/(tagih|invoice|bill|charge|buatkan invoice|create invoice)\s*/i, '')
      .replace(client ? new RegExp(client, 'i') : /$^/, '')
      .replace(/\$\s*[\d.,]+|Rp\s*[\d.,]+|[\d.,]+\s*(?:juta|jt|ribu|rb|usd|dollar|dolar)\b/gi, '')
      .replace(/(?:jatuh tempo|due in|tempo)\s*\d+\s*(?:hari|days?)?/gi, '')
      .replace(/net[-\s]?\d+/gi, '')
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
      .trim()
      .replace(/^(buat|untuk|for)\s+/i, '')
      .replace(/[,.;:]+$/g, '')
      .trim();
    if (!desc) desc = 'Jasa';

    return {
      intent: 'create_invoice',
      client, amount, currency,
      description: desc, due_days: dueDays, email,
    };
  }
  return { intent: 'unknown' };
}

const GEMINI_SYSTEM = `You parse a freelancer's chat message into STRICT JSON. Reply with JSON only, no markdown, no extra text.
Possible intents:
{"intent":"create_invoice","client":"Name","amount":150,"currency":"USD","description":"logo design","due_days":3,"email":null}
{"intent":"list_unpaid"}
{"intent":"invoice_status","client":"Name"}
{"intent":"draft_reminder","client":"Name"}
{"intent":"help"}
{"intent":"unknown"}
Rules:
- "tagih Budi $150 buat desain logo, jatuh tempo 3 hari" → create_invoice, client Budi, amount 150, currency USD, description "desain logo", due_days 3.
- "$150" means 150 USD. "150 ribu" means 150000 IDR. "1,5 juta" means 1500000 IDR. "Rp 200.000" means 200000 IDR. A bare number means USD.
- Default currency USD, default due_days 7, default description "Jasa".
- Extract an email address into "email" when the message contains one, else null.
- "siapa yang belum bayar" / "who hasn't paid" → list_unpaid.
- "draf reminder buat Budi" / "remind Budi" → draft_reminder with client Budi.
- "status invoice Budi" / "cek Budi" → invoice_status with client Budi.
- "help" / "bantuan" → help.
- If you cannot tell what the user wants → unknown.`;

async function geminiParse(message) {
  const models = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash'];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(20000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: GEMINI_SYSTEM }] },
            contents: [{ parts: [{ text: message }] }],
            generationConfig: { response_mime_type: 'application/json', temperature: 0 },
          }),
        },
      );
      if (!res.ok) continue; // try next model
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return JSON.parse(text);
    } catch {
      continue;
    }
  }
  return null;
}

async function parseIntent(message) {
  if (GEMINI_CONFIGURED) {
    const parsed = await geminiParse(message);
    if (parsed && parsed.intent) return { ...parsed, parser: 'gemini' };
  }
  return { ...regexParse(message), parser: GEMINI_CONFIGURED ? 'regex-fallback' : 'regex' };
}

async function geminiReminder(lang, inv) {
  if (!GEMINI_CONFIGURED) return null;
  const prompt = lang === 'id'
    ? `Tulis pengingat pembayaran yang sopan (Bahasa Indonesia, 2-3 kalimat) untuk klien ${inv.client} yang belum membayar invoice ${inv.number} sebesar ${inv.currency} ${inv.amount} untuk "${inv.description}". Sertakan tautan pembayaran.`
    : `Write a polite payment reminder (English, 2-3 sentences) for client ${inv.client} who has not paid invoice ${inv.number} for ${inv.currency} ${inv.amount} for "${inv.description}". Include the payment link.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- replies
function fmtMoney(amount, currency) {
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const T = {
  id: {
    created: (inv) => `Invoice ${inv.number} buat ${inv.client} udah dibuat — ${fmtMoney(inv.amount, inv.currency)} (${inv.description}). Status: ${inv.status}. Link bayar ada di kartu bawah.`,
    createdMock: (inv) => `Invoice ${inv.number} buat ${inv.client} udah dibuat (mode MOCK — bukan PayPal beneran, cuma simulasi) — ${fmtMoney(inv.amount, inv.currency)} (${inv.description}). Status: ${inv.status}.`,
    noEmail: (email) => `Catatan: lu nggak kasih email klien, jadi gua pakai ${email} (email sandbox). Kasih email asli biar invoice-nya kekirim ke orang yang bener.`,
    needAmount: 'Berapa nominalnya? Contoh: "Tagih Budi $150 desain logo".',
    needClient: 'Buat siapa invoice-nya? Contoh: "Tagih Budi $150 desain logo".',
    unpaidNone: 'Semua invoice udah lunas. Nggak ada yang belum bayar. 🎉',
    unpaidList: (n, total) => `Ada ${n} invoice belum dibayar, total ${total}:`,
    statusNone: (c) => `Gua nggak nemu invoice buat ${c || 'klien itu'}. Coba "Siapa yang belum bayar?" buat lihat semuanya.`,
    status: (inv) => `Invoice ${inv.number} (${inv.client}, ${fmtMoney(inv.amount, inv.currency)}) statusnya ${inv.status}.`,
    reminderNone: (c) => `Nggak ada invoice belum dibayar buat ${c || 'klien itu'}, jadi nggak perlu reminder.`,
    reminder: (inv) => `Ini draf reminder buat ${inv.client} (invoice ${inv.number}, ${fmtMoney(inv.amount, inv.currency)}):`,
    help: 'Gua TagihAI, agent penagihan buat freelancer. Coba:\n• "Tagih Budi $150 desain logo" — bikin invoice PayPal\n• "Tagih Sari 150 ribu buat revisi web" — rupiah juga bisa\n• "Siapa yang belum bayar?" — list invoice belum lunas\n• "Status invoice Budi" — cek status satu invoice\n• "Draf reminder buat Budi" — bikin pesan pengingat',
    unknown: 'Hmm, gua nggak nangkep maksud lu. Coba "Tagih Budi $150 desain logo", atau ketik "bantuan".',
    error: 'Waduh, ada error pas proses tadi. Coba lagi, atau cek log server.',
  },
  en: {
    created: (inv) => `Invoice ${inv.number} for ${inv.client} is created — ${fmtMoney(inv.amount, inv.currency)} (${inv.description}). Status: ${inv.status}. Payment link is on the card below.`,
    createdMock: (inv) => `Invoice ${inv.number} for ${inv.client} is created (MOCK mode — not real PayPal, just a simulation) — ${fmtMoney(inv.amount, inv.currency)} (${inv.description}). Status: ${inv.status}.`,
    noEmail: (email) => `Note: you didn't give a client email, so I used ${email} (a sandbox placeholder). Give a real email so the invoice reaches the right person.`,
    needAmount: 'How much? Example: "Invoice Budi $150 for logo design".',
    needClient: 'Who is the invoice for? Example: "Invoice Budi $150 for logo design".',
    unpaidNone: 'All invoices are paid. Nothing outstanding. 🎉',
    unpaidList: (n, total) => `${n} unpaid invoice(s), total ${total}:`,
    statusNone: (c) => `I can't find an invoice for ${c || 'that client'}. Try "Who hasn't paid?" to see them all.`,
    status: (inv) => `Invoice ${inv.number} (${inv.client}, ${fmtMoney(inv.amount, inv.currency)}) is ${inv.status}.`,
    reminderNone: (c) => `No unpaid invoice for ${c || 'that client'}, so no reminder needed.`,
    reminder: (inv) => `Here's a reminder draft for ${inv.client} (invoice ${inv.number}, ${fmtMoney(inv.amount, inv.currency)}):`,
    help: 'I\'m TagihAI, a billing agent for freelancers. Try:\n• "Invoice Budi $150 for logo design" — create a PayPal invoice\n• "Invoice Sari 150 ribu for website fixes" — rupiah works too\n• "Who hasn\'t paid?" — list unpaid invoices\n• "Status of Budi\'s invoice" — check one invoice\n• "Draft a reminder for Budi" — write a payment reminder',
    unknown: 'Hmm, I didn\'t catch that. Try "Invoice Budi $150 for logo design", or type "help".',
    error: 'Oops, something went wrong processing that. Try again, or check the server log.',
  },
};

async function fetchAllInvoices() {
  if (MODE === 'live') return listInvoicesLive();
  return mockInvoices;
}

// ---------------------------------------------------------------- app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: MODE,
    paypal_configured: PAYPAL_CONFIGURED,
    gemini_configured: GEMINI_CONFIGURED,
    parser: GEMINI_CONFIGURED ? 'gemini' : 'regex',
  });
});

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await fetchAllInvoices();
    res.json({ mode: MODE, count: invoices.length, invoices });
  } catch (e) {
    res.status(502).json({ mode: MODE, error: String(e.message || e) });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const invoices = await fetchAllInvoices();
    const unpaid = invoices.filter((i) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(i.status));
    const paid = invoices.filter((i) => i.status === 'PAID');
    const byCurrency = {};
    const counts = {};
    for (const inv of unpaid) {
      byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + inv.amount;
      counts[inv.currency] = (counts[inv.currency] || 0) + 1;
    }
    // Headline currency = most invoices, USD preferred on ties (never compare
    // raw amounts across currencies — IDR nominals dwarf USD).
    const topCurrency = Object.keys(byCurrency).sort((a, b) =>
      (counts[b] - counts[a]) || (a === 'USD' ? -1 : b === 'USD' ? 1 : 0))[0] || 'USD';
    res.json({
      mode: MODE,
      total_invoices: invoices.length,
      paid_count: paid.length,
      unpaid_count: unpaid.length,
      outstanding_total: byCurrency[topCurrency] || 0,
      outstanding_currency: topCurrency,
      outstanding_by_currency: byCurrency,
    });
  } catch (e) {
    res.status(502).json({ mode: MODE, error: String(e.message || e) });
  }
});

// Mock-only: flip an invoice to PAID so the demo can show the full flow
// without real PayPal keys. Disabled entirely in live mode.
app.post('/api/invoices/:id/mark-paid', (req, res) => {
  if (MODE !== 'mock') return res.status(403).json({ error: 'mark-paid is mock-mode only' });
  const inv = mockInvoices.find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'invoice not found' });
  inv.status = 'PAID';
  res.json({ mode: MODE, invoice: inv });
});

app.post('/api/chat', async (req, res) => {
  const message = String((req.body && req.body.message) || '').trim();
  if (!message) return res.status(400).json({ error: 'message is required' });
  const lang = detectLang(message);
  const t = T[lang];
  try {
    const parsed = await parseIntent(message);
    let reply = '';
    let invoice = null;
    let invoices = null;

    if (parsed.intent === 'create_invoice') {
      if (!parsed.client) {
        reply = t.needClient;
      } else if (!parsed.amount || parsed.amount <= 0) {
        reply = t.needAmount;
      } else {
        const email = parsed.email || 'client@example.com';
        const conv = toPayPalCurrency(parsed.amount, parsed.currency || 'USD');
        const data = {
          number: await nextInvoiceNumber(),
          client: parsed.client,
          client_email: email,
          amount: conv.amount,
          currency: conv.currency,
          description: parsed.description || 'Jasa',
          due_days: parsed.due_days || 7,
        };
        invoice = MODE === 'live' ? await createInvoiceLive(data) : createInvoiceMock(data);
        reply = (MODE === 'mock' ? t.createdMock(invoice) : t.created(invoice));
        if (conv.converted) {
          reply += lang === 'id'
            ? `\n(Catatan: PayPal tidak support IDR, jadi Rp${conv.converted.from_amount.toLocaleString('id-ID')} dikonversi ke $${conv.amount} dengan kurs perkiraan Rp${conv.converted.rate.toLocaleString('id-ID')}/USD.)`
            : `\n(Note: PayPal doesn't support IDR, so Rp${conv.converted.from_amount.toLocaleString('en-US')} was converted to $${conv.amount} at an approximate rate of Rp${conv.converted.rate.toLocaleString('en-US')}/USD.)`;
        }
        if (!parsed.email) reply += `\n${t.noEmail(email)}`;
      }
    } else if (parsed.intent === 'list_unpaid') {
      const all = await fetchAllInvoices();
      const unpaid = all.filter((i) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(i.status));
      if (unpaid.length === 0) {
        reply = t.unpaidNone;
      } else {
        const byCurrency = {};
        for (const inv of unpaid) byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + inv.amount;
        const total = Object.entries(byCurrency)
          .map(([c, v]) => fmtMoney(v, c)).join(' + ');
        reply = t.unpaidList(unpaid.length, total);
        invoices = unpaid;
      }
    } else if (parsed.intent === 'invoice_status') {
      const all = await fetchAllInvoices();
      const found = parsed.client
        ? all.find((i) => i.client.toLowerCase().includes(parsed.client.toLowerCase()))
        : all[0];
      if (!found) {
        reply = t.statusNone(parsed.client);
      } else {
        const fresh = MODE === 'live' && !found.mock
          ? await getInvoiceLive(found.id).catch(() => found)
          : found;
        invoice = fresh;
        reply = t.status(fresh);
      }
    } else if (parsed.intent === 'draft_reminder') {
      const all = await fetchAllInvoices();
      const unpaid = all.filter((i) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(i.status));
      const found = parsed.client
        ? unpaid.find((i) => i.client.toLowerCase().includes(parsed.client.toLowerCase()))
        : unpaid[0];
      if (!found) {
        reply = t.reminderNone(parsed.client);
      } else {
        invoice = found;
        const aiDraft = await geminiReminder(lang, found);
        const fallback = lang === 'id'
          ? `Halo ${found.client}, mau ngingetin invoice ${found.number} sebesar ${fmtMoney(found.amount, found.currency)} untuk "${found.description}" yang belum dibayar. Bisa dibayar lewat link ini: ${found.payment_link} — makasih banyak!`
          : `Hi ${found.client}, just a friendly reminder about invoice ${found.number} for ${fmtMoney(found.amount, found.currency)} for "${found.description}", which is still unpaid. You can pay here: ${found.payment_link} — thanks so much!`;
        reply = `${t.reminder(found)}\n\n${aiDraft || fallback}`;
      }
    } else if (parsed.intent === 'help') {
      reply = t.help;
    } else {
      reply = t.unknown;
    }

    res.json({ reply, mode: MODE, parser: parsed.parser, invoice, invoices });
  } catch (e) {
    console.error('chat error:', e);
    res.status(502).json({ reply: t.error, mode: MODE, error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`TagihAI running on http://localhost:${PORT} (mode: ${MODE}, gemini: ${GEMINI_CONFIGURED ? 'on' : 'off'})`);
});
