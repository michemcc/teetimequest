# TeeTimeQuest — API Integration Guide
Version: 2026.1.1

---

## Status overview

| Integration | Status | Provider |
|---|---|---|
| Email — invite sends | ✅ **Active** | Brevo |
| Course discovery | 🔜 Pending partner approval | GolfNow |
| Course discovery (fallback) | ✅ Available now | OpenStreetMap |
| Geocoding / city search | ✅ Active | Nominatim (free) |
| Database | 🔲 Not yet connected | localStorage for now |

---

## 1. Email Invites — Brevo ✅ ACTIVE

Brevo is the live email provider. Invites are sent automatically when a round is created.

**Free tier:** 300 emails/day, unlimited contacts.
**Docs:** https://developers.brevo.com

### How it works in this codebase

```
User creates round
  → CreateRoundPage.jsx calls createRound()
  → sendInviteEmails() in src/utils/email.js fires
  → POST /api/send-invite (Vercel serverless function)
  → api/send-invite.js calls Brevo API
  → Each non-organizer player receives an email with their unique invite link
```

### Setup steps

**Step 1 — Add your Brevo API key to Vercel**

In your Vercel dashboard: Settings → Environment Variables → Add:

```
BREVO_API_KEY = your_brevo_api_key_here
```

> Never put this in your code or commit it to Git. Server-side only.

**Step 2 — Verify a sender email in Brevo**

1. Log in to Brevo → Senders & IPs → Senders
2. Add and verify `noreply@teetimequest.com` (or any email you own)
3. Update the `sender.email` in `api/send-invite.js` to match

**Step 3 — Redeploy**

```bash
git add api/send-invite.js
git commit -m "feat: add Brevo invite emails"
git push
```

Vercel will redeploy automatically. The `BREVO_API_KEY` env var is injected at runtime.

### Testing locally

Vercel functions run locally with `vercel dev` (requires Vercel CLI):

```bash
npm install -g vercel
vercel dev
```

Then test with curl:

```bash
curl -X POST http://localhost:3000/api/send-invite \
  -H "Content-Type: application/json" \
  -d '{
    "playerEmail": "test@example.com",
    "playerName": "Tiger",
    "inviteLink": "http://localhost:3000/availability/abc/xyz",
    "organizerName": "You",
    "roundCity": "Boston, MA"
  }'
```

### Email template

The invite email is built in `api/send-invite.js` in two versions:
- `buildEmailHTML()` — rich HTML with dark forest header, gold accent, and CTA button
- `buildEmailText()` — plain text fallback (all email clients receive both)

To customize the look, edit those two functions directly.

### Error handling

- If Brevo is down or the key is wrong, the error is logged but the round still creates successfully
- The `sendInviteEmails()` utility uses `Promise.allSettled` — one bad email address won't block the others
- Check Vercel function logs for any delivery failures: Vercel dashboard → Functions → send-invite

---

## 2. Course Discovery — GolfNow *(partner approval pending)*

**Status:** Applied for partner access. Awaiting approval.
**What you'll get:** Live tee time availability, pricing, booking links.

Once approved:

1. Add to Vercel env vars:
   ```
   GOLFNOW_API_KEY = your_key
   ```

2. Create `api/courses.js` serverless function (keeps key server-side):
   ```js
   export default async function handler(req, res) {
     const { lat, lng, date } = req.query
     const response = await fetch(
       `https://api.golfnow.com/v1/courses?lat=${lat}&lng=${lng}&date=${date}`,
       { headers: { Authorization: `Bearer ${process.env.GOLFNOW_API_KEY}` } }
     )
     const data = await response.json()
     res.status(200).json(data)
   }
   ```

3. Replace `MOCK_COURSES` and `computeMatch()` in `src/utils/store.js` with a call to `/api/courses`

---

## 3. Course Discovery — OpenStreetMap Overpass *(free fallback, no key)*

Use this while GolfNow approval is pending.

```js
// src/utils/courses.js
export async function findGolfCoursesNear(lat, lng, radiusMeters = 25000) {
  const query = `
    [out:json];
    (
      node["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
      way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  })
  const data = await res.json()
  return data.elements.map(e => ({
    id: String(e.id),
    name: e.tags?.name || 'Golf Course',
    address: [e.tags?.['addr:street'], e.tags?.['addr:city']].filter(Boolean).join(', ') || 'See map',
    lat: e.lat || e.center?.lat,
    lon: e.lon || e.center?.lon,
    website: e.tags?.website || null,
    phone: e.tags?.phone || null,
    rating: null,
    par: 72,
    holes: 18,
    price: null,
  }))
}
```

To wire this in, replace `MOCK_COURSES` in `store.js` with a call to `findGolfCoursesNear()`. 
You'll need to geocode the `round.city` first — use Nominatim (already used by CityPicker).

---

## 4. Geocoding — Nominatim ✅ ACTIVE

Already active in the CityPicker component. Convert a city string to lat/lng:

```js
async function geocodeCity(city) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data = await res.json()
  if (!data[0]) throw new Error('City not found')
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}
```

---

## 5. Database — Supabase *(when ready to move off localStorage)*

**Free tier:** 500MB, unlimited API calls.
**Docs:** https://supabase.com/docs

### Schema (run in Supabase SQL editor)

```sql
create table rounds (
  id          text primary key,
  city        text not null,
  status      text default 'collecting',
  match       jsonb,
  created_at  timestamptz default now()
);

create table players (
  id           text primary key,
  round_id     text references rounds(id) on delete cascade,
  name         text not null,
  email        text not null,
  is_organizer boolean default false,
  availability jsonb,
  responded_at timestamptz
);

-- Index for fast round lookups
create index on players(round_id);
```

### Environment variables

```
VITE_SUPABASE_URL      = https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY = your_anon_key
```

---

## 6. Alternative email providers

Brevo is the current choice. If you ever need to switch:

| Provider | Free tier | Needs backend | Notes |
|---|---|---|---|
| **Brevo** | 300/day | Yes | ✅ Current choice |
| Resend | 3,000/mo | Yes | Excellent DX |
| Formspree | 50/mo | No | Contact form only |
| EmailJS | 200/mo | No | Browser-side, no key needed |
| Nodemailer + Gmail | ~500/day | Yes | Free forever |

---

## 7. Recommended production stack (all free tiers)

| Layer | Service | Cost |
|---|---|---|
| Frontend hosting | Vercel | Free |
| Email invites | Brevo | Free (300/day) |
| Course data | OpenStreetMap Overpass | Free |
| Tee times | GolfNow (pending) | Free partner |
| Geocoding | Nominatim | Free |
| Database | Supabase | Free (500MB) |
| Domain | AWS Route 53 | ~$14/yr |
| **Total** | | **~$14/year** |

---

## 8. Environment variables reference

Add these to `.env.local` locally and to Vercel → Settings → Environment Variables in production:

```bash
# ── Active ──────────────────────────────────────────
# Brevo (server-side only — never prefix with VITE_)
BREVO_API_KEY=

# ── Ready to add when approved ──────────────────────
GOLFNOW_API_KEY=

# ── Add when moving to Supabase ─────────────────────
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# ── Optional (Google Places for richer course data) ─
VITE_GOOGLE_PLACES_KEY=
```

> `VITE_` prefix = accessible in the browser (public).
> No prefix = server-side only (secret). Never put API keys with no prefix in client code.
