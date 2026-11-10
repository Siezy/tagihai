const chat = document.getElementById('chat');
const input = document.getElementById('input');
const composer = document.getElementById('composer');
const modeBadge = document.getElementById('modeBadge');
const modeNote = document.getElementById('modeNote');
let MODE = 'mock';

const fmtMoney = (amount, currency) =>
  `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function addMsg(text, who) {
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function invoiceCard(inv) {
  const card = document.createElement('div');
  card.className = 'invoice-card';
  const status = inv.status || 'UNKNOWN';
  card.innerHTML = `
    <div class="row"><span class="num">Invoice ${escapeHtml(inv.number)}</span><span class="status status-${escapeHtml(status)}">${escapeHtml(status)}</span></div>
    <div class="row"><span>${escapeHtml(inv.client)}</span><span class="amount">${escapeHtml(fmtMoney(inv.amount, inv.currency))}</span></div>
    <div>${escapeHtml(inv.description || '')}</div>
    ${inv.mock ? '<div class="mock-tag">⚠ SANDBOX MOCK — bukan invoice PayPal beneran</div>' : ''}
    <a class="pay-link" href="${escapeHtml(inv.payment_link)}" target="_blank" rel="noopener">🔗 Buka link pembayaran →</a>
    ${MODE === 'mock' && status !== 'PAID' ? `<button class="mini-btn" data-pay="${escapeHtml(inv.id)}">✓ Tandai lunas (demo)</button>` : ''}
  `;
  const btn = card.querySelector('[data-pay]');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      const res = await fetch(`/api/invoices/${encodeURIComponent(inv.id)}/mark-paid`, { method: 'POST' });
      const data = await res.json();
      if (data.invoice) {
        card.replaceWith(invoiceCard(data.invoice));
        addMsg(`Invoice ${data.invoice.number} udah ditandai LUNAS (demo).`, 'agent');
        refreshStats();
      } else {
        btn.disabled = false;
        btn.textContent = '✓ Tandai lunas (demo)';
      }
    });
  }
  chat.appendChild(card);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function refreshStats() {
  try {
    const res = await fetch('/api/stats');
    const s = await res.json();
    document.getElementById('statOutstanding').textContent = fmtMoney(s.outstanding_total || 0, s.outstanding_currency || 'USD');
    document.getElementById('statPaid').textContent = s.paid_count ?? 0;
    document.getElementById('statUnpaid').textContent = s.unpaid_count ?? 0;
    document.getElementById('statTotal').textContent = s.total_invoices ?? 0;
  } catch { /* stats are best-effort */ }
}

async function sendMessage(text) {
  const clean = text.trim();
  if (!clean) return;
  addMsg(clean, 'user');
  input.value = '';
  const typing = addMsg('TagihAI lagi mikir…', 'agent typing');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: clean }),
    });
    const data = await res.json();
    typing.remove();
    addMsg(data.reply || 'Hmm, ada yang error.', 'agent');
    if (data.invoice) invoiceCard(data.invoice);
    if (data.invoices) data.invoices.forEach(invoiceCard);
    refreshStats();
  } catch {
    typing.remove();
    addMsg('Waduh, server nggak bisa dihubungi. Coba lagi.', 'agent');
  }
}

composer.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(input.value); });
document.getElementById('chips').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (btn) sendMessage(btn.dataset.msg);
});

document.getElementById('showAllBtn').addEventListener('click', async (e) => {
  const panel = document.getElementById('allInvoices');
  const btn = e.target;
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    btn.textContent = 'Lihat semua invoice ↓';
    return;
  }
  const res = await fetch('/api/invoices');
  const data = await res.json();
  panel.innerHTML = '';
  if (!data.invoices || data.invoices.length === 0) {
    panel.innerHTML = '<div>Belum ada invoice. Coba chip "Tagih Budi $150 desain logo" di bawah.</div>';
  } else {
    data.invoices.forEach((inv) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:14px;';
      row.innerHTML = `<span>${escapeHtml(inv.number)} — ${escapeHtml(inv.client)}</span><span>${escapeHtml(fmtMoney(inv.amount, inv.currency))}</span><span class="status status-${escapeHtml(inv.status)}">${escapeHtml(inv.status)}</span>`;
      panel.appendChild(row);
    });
  }
  panel.classList.remove('hidden');
  btn.textContent = 'Sembunyikan invoice ↑';
});

(async function init() {
  try {
    const res = await fetch('/api/health');
    const h = await res.json();
    MODE = h.mode || 'mock';
    modeBadge.textContent = MODE === 'live' ? 'LIVE SANDBOX' : 'MOCK';
    modeBadge.className = 'badge ' + (MODE === 'live' ? 'badge-live' : 'badge-mock');
    if (MODE === 'live') {
      modeNote.textContent = 'Mode LIVE SANDBOX: invoice dibuat lewat PayPal sandbox API beneran (uang sandbox, bukan uang asli). Parser: ' + (h.parser || 'regex') + '.';
    } else {
      modeNote.textContent = 'Mode MOCK: tanpa API key, invoice hanya simulasi (SANDBOX MOCK). Isi PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET di .env untuk invoice PayPal sandbox beneran — tidak pernah ada uang asli.';
    }
  } catch { /* stay in mock display */ }
  refreshStats();
  addMsg('Halo! Gua TagihAI. Ketik aja kayak ngobrol, contoh: "Tagih Budi $150 buat desain logo, jatuh tempo 3 hari". Atau pencet chip di bawah. 😊', 'agent');
})();
