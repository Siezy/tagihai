# TagihAI — Devpost submission draft (PayPal AI Hackathon)
Deadline: Fri 2026-11-13 03:00 WIB. Status: DRAFT — update after live sandbox test.

## Title
TagihAI — AI billing agent for freelancers

## Tagline
Tell it who owes you. It invoices, tracks, and reminds — in plain language.

## Description (for the Devpost form)
Freelancers lose money to awkward follow-ups and forgotten invoices. TagihAI is a chat agent that turns plain language into real PayPal invoices: type "Tagih Budi $150 buat desain logo, jatuh tempo 3 hari" and it creates and sends a PayPal invoice (sandbox), returns a payment link, and tracks the status. Ask "Siapa yang belum bayar?" and it lists every unpaid invoice with totals. Ask for a reminder and it drafts a polite, ready-to-send message with the payment link. Built for freelancers and small sellers — especially in Indonesia, where chasing payments is a daily chore. Demo uses the PayPal sandbox only; no real money moves.

## How PayPal is used
- PayPal Invoicing API v2 (sandbox): create draft invoice, send invoice, get invoice status, list invoices — OAuth2 client-credentials flow.
- Payment links returned by the API are shown in chat; the payer completes payment in the PayPal sandbox, and the status flips to PAID.

## How AI is used
- Google Gemini (gemini-3.5-flash, free tier) parses each chat message into a strict-JSON intent (create_invoice / list_unpaid / invoice_status / draft_reminder / help), including amount + currency parsing ("$150" → USD 150; "150 ribu" → IDR 150,000) and due-date parsing.
- Gemini also drafts the polite payment reminders. A local regex parser is the fallback when no Gemini key is set, so the app still demos keyless.

## Tools / stack
Node.js + Express, PayPal sandbox (Invoicing API v2), Google Gemini 2.0 Flash, plain HTML/CSS/JS frontend. No build step.

## Demo video
Under 3 minutes, public on YouTube (to be recorded after the live sandbox test). Script: DEMO_SCRIPT.md.

## Repo
Public GitHub repo: https://github.com/Siezy/tagihai — MIT licensed, .env.example included, no secrets committed. Live-verified 2026-11-11: 4 sandbox invoices created via chat (Budi $150, Sari $9.09, Andi $200, Dewi $75), Sari's invoice paid end-to-end in sandbox (SENT → PAID).
