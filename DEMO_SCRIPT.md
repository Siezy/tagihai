# TagihAI — demo video shooting script (FINAL, < 3 minutes)

Target: a public YouTube video under 180 seconds, showing the project working
end to end. Record the screen at http://localhost:3000 with the **LIVE SANDBOX**
badge visible. Voiceover is English — the 10 narration lines below are also
recorded as audio files in `voiceover/` (one file per shot), so you can record
the screen silently and lay each line over its shot.

## The demo client

Use a **fresh client, Rani** — Budi, Sari, Andi, and Dewi already have invoices
in the sandbox, so a new name keeps every step unambiguous on camera.

- Demo invoice: **Tagih Rani $120 buat desain poster, jatuh tempo 5 hari**
- Starting state (verified 2026-11-11 03:14 WIB): 4 invoices, 1 paid (Sari
  $9.09), 3 unpaid, outstanding $425.
- Ending state: 5 invoices, 2 paid, 3 unpaid, outstanding $425 (Rani's $120
  moves from unpaid to paid on camera).

## Shots

| # | Show this | Say this (voiceover file) | ~sec |
|---|-----------|---------------------------|------|
| 1 | TagihAI open, LIVE SANDBOX badge, stats bar (4 invoices, 1 paid) | "TagihAI is an AI billing agent for freelancers. You chat, it invoices." | 10 |
| 2 | Type: "Tagih Rani $120 buat desain poster, jatuh tempo 5 hari" → hit send | "I just type what I want in plain language. Indonesian works too." | 15 |
| 3 | Invoice card appears: new TG number, $120, SENT, payment link | "It parsed the client, the amount, and the due date — then created a real PayPal sandbox invoice and sent it." | 15 |
| 4 | Click the payment link → PayPal sandbox checkout page | "Here's the payment link the client gets." | 10 |
| 5 | Pay it with the sandbox buyer account → "Payment complete" | "I pay it with a PayPal sandbox buyer account. No real money moves." | 20 |
| 6 | Back in TagihAI, type: "Status invoice Rani" | "Now I ask for the status." | 10 |
| 7 | Reply + card show PAID; stats bar updates (paid 2) | "And it's paid. The dashboard updates live." | 10 |
| 8 | Type: "Siapa yang belum bayar?" → list of unpaid invoices | "It also lists everyone who still owes me." | 15 |
| 9 | Type: "Draf reminder buat Rani" → polite reminder draft | "And it drafts the awkward reminder message for me." | 15 |
| 10 | Quick scroll of the repo / README (or terminal `npm start`) | "It's open source. PayPal Invoicing API plus Gemini, with a keyless mock mode. Thanks for watching!" | 15 |
| 11 | End card: repo URL + "TagihAI — chat, invoice, get paid." | — | 5 |

**Total: ~140 seconds + ~25 seconds of transitions = ~165 seconds. Under 180. ✅**

## Before you press record

- [ ] App running locally (see RECORDING_GUIDE.md): `npm start` → http://localhost:3000, badge reads **LIVE SANDBOX** (not MOCK).
- [ ] Sandbox buyer account ready: `sb-tagihai-buyer-001@personal.example.com` (Personal, US, $1,000 fake balance). Password: open the PayPal Developer Dashboard → Sandbox Accounts → click the buyer account → view/reset the password there. Log the buyer in once before recording so checkout is one click.
- [ ] No real API keys visible on screen at any point (the UI never shows them — just never open `.env` on camera).
- [ ] Export 1080p, upload to YouTube as **Public**, paste the link in the Devpost form and in SUBMISSION.md.
- [ ] Keep background music out (rule: no copyrighted material).
