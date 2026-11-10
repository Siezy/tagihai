# TagihAI — recording & submission guide

Everything you need to record the demo video and submit. The video itself is
the only part that needs your screen and your YouTube/Devpost accounts — the
script, voiceover, and submission text are already done.

## 0. Run the app on your own laptop

The server on Muse's VM runs on `localhost:3000` there — it is NOT reachable
from your device. Run your own copy:

```bash
git clone https://github.com/Siezy/tagihai.git
cd tagihai
npm install
cp .env.example .env
# fill in .env with YOUR keys (see below), then:
npm start
# open http://localhost:3000
```

**Keys for `.env`** (never show `.env` on camera, and never paste keys into
the video — the app UI never displays them):

- `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` — your PayPal sandbox app keys
  (the same app used tonight; find them in the Developer Dashboard → My Apps
  & Credentials → Sandbox, or in your chat history with Muse).
- `GEMINI_API_KEY` — your Google AI Studio API key (same one used tonight).

Check before recording: the badge at the top of the app must read
**LIVE SANDBOX** (not MOCK), and http://localhost:3000/api/health should
show `"mode":"live","parser":"gemini"`.

## 1. Buyer login (for shot 5)

- Buyer email: `sb-tagihai-buyer-001@personal.example.com` (Personal, US,
  $1,000 fake balance — created 2026-11-11).
- Password: open the PayPal Developer Dashboard → Sandbox Accounts → click
  the buyer account → view or reset the password there.
- Log the buyer in once before recording, so the payment step is one click.
  If PayPal shows a captcha, solve it yourself — bots can't.

## 2. Record (follow DEMO_SCRIPT.md)

- Screen recorder: OBS Studio, or your OS built-in recorder (Windows Game
  Bar / macOS Screenshot tool). Record 1080p.
- Close other tabs, hide bookmarks, silence notifications. Browser zoom 100%.
- Record the screen SILENTLY, shot by shot — the voiceover is already
  recorded (see below). Do the actions slowly; pause a beat after each send
  so the invoice card has time to appear.
- Demo client is **Rani** ($120, desain poster, 5 days). Don't reuse Budi —
  he already has an invoice.
- Never open `.env`, the terminal history with keys, or the PayPal dashboard
  with live credentials on camera.

## 3. Edit

- Voiceover files: `voiceover/shot-01.mp3` … `shot-10.mp3` (English, one per
  shot — lay each line over its shot). Shot 11 (end card) has no voiceover.
- End card text: `github.com/Siezy/tagihai` + `TagihAI — chat, invoice, get paid.`
- No background music (Devpost rule: no copyrighted material).
- Target total: under 180 seconds (script is ~165s).

## 4. Upload to YouTube

- Title: `TagihAI — AI billing agent for freelancers (PayPal AI Hackathon)`
- Description: `TagihAI turns plain-language chat into real PayPal invoices. Built for the PayPal AI Hackathon. Repo: https://github.com/Siezy/tagihai — demo uses the PayPal sandbox only, no real money moves.`
- Visibility: **Public** (Devpost requires a public video).
- Copy the video URL.

## 5. Submit on Devpost (before Fri 2026-11-13 03:00 WIB — aim Thu night)

Project: PayPal AI Hackathon (paypalaihackathon.devpost.com). Fill in:

- [ ] Title: `TagihAI — AI billing agent for freelancers`
- [ ] Tagline + description: copy from SUBMISSION.md
- [ ] Repo URL: https://github.com/Siezy/tagihai (public ✓)
- [ ] Demo video: your YouTube URL (public ✓)
- [ ] "How PayPal is used" + "How AI is used": copy from SUBMISSION.md
- [ ] Tools: Node.js + Express, PayPal Invoicing API v2 (sandbox), Google Gemini (gemini-3.5-flash), plain HTML/CSS/JS
- [ ] Submit, then paste the Devpost project URL back to Muse so it's recorded.
