# TagihAI — demo video shot list (< 3 minutes, ~165 seconds total)

Target: a public YouTube video under 180 seconds, showing the project working
end to end. Record the screen at http://localhost:3000 with the **LIVE SANDBOX**
badge visible. Speak English (or Indonesian with English captions) — keep it
to one sentence per shot.

| # | Shot (show this) | Say this | ~sec |
|---|------------------|----------|------|
| 1 | TagihAI open, stats bar at zero, MOCK/LIVE badge | "TagihAI is an AI billing agent for freelancers. You chat, it invoices." | 10 |
| 2 | Type: "Tagih Budi $150 buat desain logo, jatuh tempo 3 hari" → hit send | "I just type what I want in plain language — Indonesian works too." | 15 |
| 3 | Invoice card appears: number, $150, SENT, payment link | "It parsed the client, amount, and due date, then created a real PayPal sandbox invoice and sent it." | 15 |
| 4 | Click the payment link → PayPal sandbox checkout page | "Here's the payment link the client gets." | 10 |
| 5 | Pay it with the sandbox buyer account → "Payment complete" | "I pay it with a PayPal sandbox buyer account — no real money." | 20 |
| 6 | Back in TagihAI, type: "Status invoice Budi" | "Now I ask for the status…" | 10 |
| 7 | Reply + card show PAID; stats bar updates (paid 1) | "…and it's PAID. The dashboard updates live." | 10 |
| 8 | Type: "Siapa yang belum bayar?" → list of unpaid invoices | "It also lists everyone who still owes me." | 15 |
| 9 | Type: "Draf reminder buat Budi" → polite reminder draft | "And it drafts the awkward reminder message for me." | 15 |
| 10 | Quick scroll of the repo / README (or terminal `npm start`) | "It's open source — PayPal Invoicing API plus Gemini, with a keyless mock mode. Thanks!" | 15 |
| 11 | End card: repo URL + "TagihAI — chat, invoice, get paid." | — | 5 |

**Total: ~140 seconds + ~25 seconds of transitions = ~165 seconds. Under 180. ✅**

## Recording checklist

- [ ] `.env` filled with sandbox keys so the badge reads **LIVE SANDBOX** (not MOCK).
- [ ] PayPal sandbox buyer account logged in (or credentials ready) before recording.
- [ ] One fresh invoice in the demo (start from an empty store so stats go 0 → 1).
- [ ] No real API keys visible on screen at any point (the UI never shows them).
- [ ] Export 1080p, upload to YouTube as **Public**, paste the link in the Devpost form.
- [ ] Keep background music out (rule: no copyrighted material).
