# TagihAI — AI billing agent for freelancers 💸

**TagihAI** is a chat web app where a freelancer types plain language and gets a real
PayPal invoice back. No forms, no dashboard spelunking — just chat.

> "Tagih Budi $150 buat desain logo, jatuh tempo 3 hari"
> → TagihAI creates a PayPal invoice, sends it, and returns a payment link.
> "Siapa yang belum bayar?" → it lists every unpaid invoice.
> "Draf reminder buat Budi" → it drafts a polite payment reminder.

Built for the **PayPal AI Hackathon** (Nov 2026). It runs entirely against the
**PayPal sandbox** — no real money ever moves.

## The problem

Freelancers — especially in Indonesia and other markets where PayPal is the way
clients pay — lose hours chasing payments: opening the PayPal dashboard, filling
invoice forms, copying links, remembering who paid, writing reminder messages.
TagihAI collapses all of that into one chat box.

## How PayPal + AI are used

**PayPal (sandbox, `api-m.sandbox.paypal.com`):**
- `POST /v1/oauth2/token` — OAuth2 client-credentials flow, token cached until expiry.
- `POST /v2/invoicing/invoices` — create a draft invoice (number, date, payment
  term from the due date, billing email, line item, amount breakdown).
- `POST /v2/invoicing/invoices/{id}/send` — send it so the payer gets a real
  payment link.
- `GET /v2/invoicing/invoices/{id}` — fresh status (DRAFT / SENT / PAID) for
  status checks; `GET /v2/invoicing/invoices` — list for "who hasn't paid".

**AI (Google Gemini, free tier):**
- `gemini-3.5-flash` (fallbacks `gemini-3.6-flash`, `gemini-3.8-flash`) parses each chat message into
  strict JSON intents: `create_invoice`, `list_unpaid`, `invoice_status`,
  `draft_reminder`, `help`, `unknown`. Amount parsing understands `$150`,
  `150 ribu` (150.000 IDR), `1,5 juta` (1.500.000 IDR), and `Rp 200.000`.
- Gemini also writes the reminder drafts (polite, in the user's language).
- **No Gemini key?** A local regex parser with the exact same JSON output shape
  takes over, so the app still works end to end.

**Modes:**
- `live` — `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` are set: real sandbox
  invoices, real payment links, real status flips when the sandbox buyer pays.
- `mock` — no keys: an in-memory invoice store with fake payment links, every
  card clearly marked **SANDBOX MOCK**. The app starts and demos with zero keys.

## Setup

```bash
npm install
cp .env.example .env   # optional — fill in keys for live mode, or skip for mock mode
npm start              # → http://localhost:3000
```

Get keys (both free, ~5 minutes):
1. **PayPal sandbox:** [developer.paypal.com](https://developer.paypal.com) →
   My Apps & Credentials → Sandbox → create an app → copy Client ID + Secret
   into `.env`. (Sandbox buyer/seller test accounts are auto-created there too.)
2. **Gemini:** [Google AI Studio](https://aistudio.google.com) → Get API key →
   paste as `GEMINI_API_KEY` in `.env`.

## Demo the full flow (live sandbox)

1. Open http://localhost:3000. The badge says **LIVE SANDBOX**.
2. Type: `Tagih Budi $150 buat desain logo, jatuh tempo 3 hari`
   → invoice created + sent, payment link appears on the card.
3. Open the payment link, pay with a PayPal **sandbox buyer** account
   (from your developer dashboard).
4. Type: `Status invoice Budi` → status is now **PAID**. 🎉
5. Try: `Siapa yang belum bayar?` and `Draf reminder buat Budi`.

In mock mode the same flow works, with a "Tandai lunas (demo)" button on each
invoice card instead of a real sandbox payment.

## API

- `GET /api/health` → `{status, mode, paypal_configured, gemini_configured, parser}`
- `POST /api/chat` `{message}` → `{reply, mode, parser, invoice?, invoices?}`
- `GET /api/invoices` → `{mode, count, invoices}`
- `GET /api/stats` → `{mode, total_invoices, paid_count, unpaid_count, outstanding_total, outstanding_currency, outstanding_by_currency}`
- `POST /api/invoices/:id/mark-paid` → mock mode only, flips an invoice to PAID.

## Project structure

```
server.js            Express backend: PayPal client, Gemini client, regex fallback, mock store
public/
  index.html         Chat UI shell
  app.js             Chat logic, invoice cards, stats
  style.css          Dark chat theme (no CDN, no build step)
.env.example         The three optional env vars
DEMO_SCRIPT.md       <3-minute video shot list
```

## Notes for judges

- Everything is sandbox: the PayPal base URL is hardcoded to
  `api-m.sandbox.paypal.com`. There is no live-PayPal code path.
- No secrets are committed: `.env` is gitignored, keys only ever live in
  environment variables.
- The app degrades gracefully: no Gemini key → regex parser; no PayPal keys →
  mock store. Either way the chat, stats, and invoice cards all work.

## License

MIT — see [LICENSE](LICENSE).
