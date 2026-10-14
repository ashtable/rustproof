# rustproof contact form — backend

`api/contact.js` receives the JSON posted by `public/contact.html` and sends two emails through the **Twilio Email API** (`https://comms.twilio.com/v1/Emails`). This is Twilio's native email product, billed per email on your Twilio account. It is not SendGrid and uses no SendGrid key.

1. Notification → `ash@autoretryai.com` with every field and the message.
2. Confirmation → the person who wrote, with a copy of their message.

## Environment variables

| Variable | Value |
|---|---|
| `TWILIO_API_KEY` / `TWILIO_API_SECRET` | A Twilio API key pair (Console → Account → API keys). The handler also accepts `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. |
| `FROM_ADDRESS` | `ash@autoretryai.com` |
| `NOTIFY_ADDRESS` | `ash@autoretryai.com` |
| `ALLOWED_ORIGIN` | `https://rustproof.dev` (CORS; `*` while testing) |

**Before the first send:** authenticate `autoretryai.com` in Twilio Email (Docs → Twilio Email → Authenticate using DNS). Twilio rejects `from` addresses on unauthenticated domains. Note the `from` field does not support Unicode.

## Request / response

`POST /api/contact` with `Content-Type: application/json`:

```json
{ "name": "Jonas Lind", "email": "jonas@example.com", "company": "Retry AI", "role": "Developer", "repo": "40k lines, 6 crates", "message": "…", "heard": "GitHub" }
```

Responses: `200 {ok, notify, confirm}` (Twilio operation ids; poll `operationLocation` from Twilio if you want delivery status), `422 {error}` on validation, `502 {error, detail}` if Twilio did not return `202 Accepted`. The hidden `website` field is a honeypot; filled → `200` without sending.

The page falls back to a **preview mode** (renders both emails, sends nothing) when the endpoint is missing or unreachable, so the static prototype works without a backend.

## Deploy

**Cloudflare Workers** — the file is already a Worker. `wrangler deploy api/contact.js`, set the variables as secrets, route `rustproof.dev/api/contact` to it.

**Vercel (Edge runtime)** — `api/contact.js` → add `export const config = { runtime: 'edge' }` and `export default (req) => handleContact(req, process.env)`.

**Netlify Functions (v2)** — `netlify/functions/contact.js`: `export default (req) => handleContact(req, Netlify.env.toObject())`.

**Node 18+ / Express** — wrap with a Request/Response adapter, or call `handleContact(new Request(url, { method, headers, body }), process.env)` and copy the status/body back.

## Test

```bash
curl -X POST https://rustproof.dev/api/contact -H 'Content-Type: application/json' \
  -d '{"name":"Test Person","email":"you@example.com","message":"Testing the contact form end to end."}'
```

## Hardening before launch

- Rate-limit by IP at the edge (Cloudflare rule or Vercel firewall); the handler is stateless.
- Set `ALLOWED_ORIGIN` to the production origin.
- Twilio Email is asynchronous (`202`); a `200` here means Twilio accepted the job, not that the mail was delivered. Delivery events are visible in Twilio logs.
