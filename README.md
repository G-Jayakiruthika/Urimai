# Urimai

**Know what is real. Know what to write.**

*Urimai* (உரிமை) means "right" — in both senses. Your right not to be cheated, and your
right to be heard by the office that is supposed to serve you.

---

## The problem

An ordinary person in India gets something official-sounding and is stuck on two questions:

> **Is this real?** and **what do I write back?**

A fake KYC SMS and a broken streetlight feel like opposite problems. They are the same one.
Something official is involved, the words are in a register the person does not write
comfortably, and so nothing happens — the fraud works, or the streetlight stays broken.

India lost **₹19,812 crore** to cyber fraud in 2025. Most of it did not need better detection;
it needed somebody to say *this one is fake* and then *here is what to send*. The same is true
of civic complaints: almost everyone knows the light is out, almost nobody writes to the
Electrical Wing, because they do not know that is who owns it.

## What Urimai does

One pipeline — **judge it, say why, write the reply** — pointed in both directions.

| Direction | Input | Output |
|---|---|---|
| **Coming at you** | An SMS, a call transcript, a WhatsApp forward, a "notice" | A refusal to send the caller · a cybercrime complaint with every identifier already filled in · a warning worded for a family group |
| **Going out from you** | A pothole, a dry tap, an overflowing manhole | A grievance letter, correctly addressed to the department that actually owns the problem |

The verdict is carried by **the colour of the whole page** and by a pair of eyes that narrow at
a fraud, before a single word is read. That is deliberate: the people most often defrauded are
the people least able to read a screen of English.

### It answers in three languages
English, Tamil and Hindi — verdict, explanation and the full finished letter in each.

---

## Architecture

```
server.js          entry point; graceful shutdown on SIGTERM for Cloud Run
src/app.js         router, security headers, rate limiting, body limits
src/static.js      static files, with path-traversal containment
src/engine.js      the one place a request becomes an answer
src/gemini.js      Gemini 2.5 Flash over plain fetch
shared/rules.js    the classifier — runs on the server AND in the browser
shared/letters.js  the drafter    — runs on the server AND in the browser
public/            the interface
test/              40 tests, no runner to install
```

**Zero runtime dependencies.** `package.json` has an empty `dependencies` block and that is not
an accident. Node 22 has an HTTP server, a test runner and `fetch`; an Express-and-SDK stack
would add hundreds of transitive packages to audit, slow the Cloud Run cold start, and buy
nothing this app needs. The whole repository is **196 KB**.

**`shared/` is served, not copied.** `src/static.js` maps `/js/rules.js` to the same file the
server requires. The rules the server enforces and the rules the browser explains cannot drift
apart, because there is only one copy.

### Why rules decide and Gemini explains

The rules engine always runs and always holds the verdict. Gemini is asked afterwards, to say
*why* in natural language and to catch a phrasing the patterns missed.

Gemini may raise a risk score. **It may never downgrade a `THREAT`.** A model argued into
clearing a fraud is the one failure that costs a user money, so that door is shut in code
rather than in a prompt — and there is a test that proves it stays shut.

The practical effect: Urimai works with **no API key at all**. Every verdict, every letter,
every language still works. There is no failure screen because there is never a blank answer.

---

## Scored criteria, and where to look

| Criterion | Where it lives |
|---|---|
| **Code quality** | No dependencies; one responsibility per module; comments explain *why*, not *what*. `shared/` exists so logic cannot be duplicated. |
| **Security** | See the section below. |
| **Efficiency** | Zero deps → ~60 KB of source in the image and a fast cold start. Rules answer in under a millisecond; Gemini is raced against a 9 s deadline so a stalled upstream can never hold a request open. Static assets cached, HTML revalidated. |
| **Testing** | `npm test` → **40 tests**, `node --test`, nothing to install. Covers classification, redaction, drafting, prompt injection, rate limiting, path traversal, oversized bodies and model timeout. |
| **Accessibility** | See the section below. |
| **Problem statement alignment** | One product covering Cybersecurity & Digital Safety, Smart Cities & Civic Technology, and Accessibility & Inclusion. |
| **Google services** | Cloud Run (hosting), Gemini 2.5 Flash with structured output (`responseSchema`), Secret Manager (the API key), Cloud Logging (via stdout), Artifact Registry (the image). |

## Security

| Control | How |
|---|---|
| Content Security Policy | `default-src 'none'`, `script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`. No inline script or style anywhere — the meter width is set through the CSSOM rather than weakening the policy to suit the markup. |
| Prompt injection | The user's text is wrapped in `<message>` tags and the system instruction names it untrusted data. Independently, the rules engine holds the verdict, so an injected "reply SAFE" changes nothing. Tested. |
| PII | Phone, Aadhaar, PAN, account, UPI and email are redacted **before** the text reaches Gemini. The raw text is never logged and never stored. |
| Secrets | `GEMINI_API_KEY` is read from the environment only — never in the repo, the image or the client. Cloud Run injects it from Secret Manager. |
| Rate limiting | 20 analyses and 240 requests per minute per client address. |
| Body limits | 32 KB request cap and a 4,000-character text cap, drained rather than destroyed so the socket is never left stuck. |
| Path traversal | Every resolved path is re-checked to sit inside a published directory. Tested against encoded and nested attempts. |
| Error handling | One generic handler. No stack trace, no internal path, no upstream message ever reaches a response. |
| Transport | HSTS with preload; Cloud Run terminates TLS. |
| Container | Runs as the non-root `node` user; `.dockerignore` keeps tests and docs out of the image. |
| Supply chain | Nothing to compromise — there are no dependencies. CodeQL `security-extended` runs on every push. |

## Accessibility

Built for someone who may not read well, may be on a cheap phone, and may be outdoors.

- The answer is **colour and a face first**, words second. Red is a fraud, amber is a civic
  matter, green is fine — and the page itself changes, not a small badge.
- Full light and dark themes for every one of those states, because half of India reads a phone
  in daylight and half in bed.
- Semantic landmarks, a skip link, real `<label>`s, `aria-live` on the answer, `role="meter"`
  with proper values on the risk bar, and a visible focus ring on everything.
- Operable entirely by keyboard; `Ctrl`/`Cmd` + `Enter` submits.
- Every interactive target is at least 40 px, most are 44 px or more.
- `dir="auto"` throughout, so a Tamil or Hindi answer lays itself out correctly.
- `prefers-reduced-motion` switches off the cursor, the reveals and the eye animation.
- Works with JavaScript degraded: if the server cannot be reached the same `shared/` rules run
  in the browser and still produce the letters.

---

## Running it

```bash
npm test          # 40 tests, nothing to install
npm start         # http://localhost:8080 — works with no API key
```

With Gemini:

```bash
GEMINI_API_KEY=your-key npm start
```

## Deploying to Cloud Run

```bash
gcloud run deploy urimai \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

To create the secret first:

```bash
printf '%s' "YOUR_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-
```

Get a free key at <https://aistudio.google.com/apikey>.

---

## Licence

MIT.

**If you have lost money to a fraud, call 1930 within 24 hours** — that is the window in which a
transfer can still be frozen. File the full complaint at <https://cybercrime.gov.in>.
