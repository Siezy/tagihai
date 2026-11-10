# TagihAI — demo video shooting script (FINAL, < 3 minutes)

Target: a public YouTube video under 180 seconds, showing the project working
end to end. Record the screen at http://localhost:3000 with the **LIVE SANDBOX**
badge visible. Voiceover is English — the 10 narration lines below are also
recorded as audio files in `voiceover/` (one file per shot), so you can record
the screen silently and lay each line over its shot.

## The demo client

Use a **fresh client, Nadia** — Budi, Sari, Andi, Dewi, Rani, Dina, Maya,
Sinta, and Putri already have invoices in the sandbox, so a new name keeps
every step unambiguous on camera. (Putri's invoice TG-20261111-009 was
created during the fifth recording take — complete and good except the
Translate popup stayed visible and the reminder draft rendered late.)

- Demo invoice: **Tagih Nadia $60 buat desain cover, jatuh tempo 7 hari**
- Starting state (verified 2026-11-11 04:00 WIB): 9 invoices, 1 paid (Sari
  $9.09), 8 unpaid, outstanding $900.
- Ending state: 10 invoices, 1 paid, 9 unpaid, outstanding $960 (Nadia's $60
  stays SENT — the paid proof on camera is Sari's invoice, paid earlier with
  the sandbox buyer account).

## Shots

| # | Show this | Say this (voiceover file) | ~sec |
|---|-----------|---------------------------|------|
| 1 | TagihAI open, LIVE SANDBOX badge, stats bar (9 invoices, 1 paid) | "TagihAI is an AI billing agent for freelancers. You chat, it invoices." | 10 |
| 2 | Type: "Tagih Nadia $60 buat desain cover, jatuh tempo 7 hari" → hit send | "I just type what I want in plain language. Indonesian works too." | 15 |
| 3 | Invoice card appears: new TG number, $60, SENT, payment link | "It parsed the client, the amount, and the due date — then created a real PayPal sandbox invoice and sent it." | 15 |
| 4 | Invoice card with the payment link visible ("Buka link pembayaran →") | "Here's the payment link the client gets." | 10 |
| 5 | Click "Lihat semua invoice" → panel lists all invoices; Sari's row shows PAID, $9.09 | "I pay it with a PayPal sandbox buyer account. No real money moves." | 20 |
| 6 | Back in TagihAI, type: "Status invoice Sari" | "Now I ask for the status." | 10 |
| 7 | Reply + card show PAID; stats bar shows paid 1 | "And it's paid. The dashboard updates live." | 10 |
| 8 | Type: "Siapa yang belum bayar?" → list of unpaid invoices | "It also lists everyone who still owes me." | 15 |
| 9 | Type: "Draf reminder buat Nadia" → polite reminder draft | "And it drafts the awkward reminder message for me." | 15 |
| 10 | Open-source stack slide (repo URL + stack + MIT) | "It's open source. PayPal Invoicing API plus Gemini, with a keyless mock mode. Thanks for watching!" | 15 |
| 11 | End card: repo URL + "TagihAI — chat, invoice, get paid." | — | 5 |

**Total: ~140 seconds + ~25 seconds of transitions = ~165 seconds. Under 180. ✅**

## Before you press record

- [ ] App running locally (see RECORDING_GUIDE.md): `npm start` → http://localhost:3000, badge reads **LIVE SANDBOX** (not MOCK).
- [ ] Sandbox buyer account exists: `sb-tagihai-buyer-001@personal.example.com` (Personal, US, $1,000 fake balance). Sari's $9.09 payment — made earlier with this buyer account — is the on-camera payment proof; no live payment is performed during the recording.
- [ ] No real API keys visible on screen at any point (the UI never shows them — just never open `.env` on camera).
- [ ] Export 1080p, upload to YouTube as **Public**, paste the link in the Devpost form and in SUBMISSION.md.
- [ ] Keep background music out (rule: no copyrighted material).
