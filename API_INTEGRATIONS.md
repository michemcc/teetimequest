# TeeTimeQuest — API Integration Guide

How to connect real data to TeeTimeQuest. All options listed here have free tiers.

---

## Overview

The entire data layer lives in one file: `src/utils/store.js`

There are three integration points:

| Function | Current | Replace with |
|---|---|---|
| `createRound()` | localStorage | POST to your backend / Supabase |
| `getRound()` | localStorage | GET from your backend / Supabase |
| `saveAvailability()` | localStorage | PATCH to your backend |
| `computeMatch()` → courses | Mock data | Real course/tee-time API |

You can swap each one independently. Start with courses (most impactful), then add a real database.

---

## 1. Course Discovery — Google Places API (Free tier)

**What it does:** Find golf courses near a lat/lng coordinate.
**Free tier:** $200 credit/month (~40,000 requests).
**Docs:** https://developers.google.com/maps/documentation/places/web-service

### Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → enable **Places API** and **Geocoding API**
3. Create an API key under **APIs & Services → Credentials**
4. Restrict the key to your domain for security

### Add to your `.env`
```
VITE_GOOGLE_PLACES_KEY=your_key_here
```

### Replace `computeMatch()` courses section in `store.js`

```js
async function fetchNearbyCourses(city) {
  // Step 1: Geocode the city to lat/lng
  const geoRes = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${import.meta.env.VITE_GOOGLE_PLACES_KEY}`
  )
  const geoData = await geoRes.json()
  const { lat, lng } = geoData.results[0].geometry.location

  // Step 2: Nearby search for golf courses
  const placesRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=25000&type=golf_course&key=${import.meta.env.VITE_GOOGLE_PLACES_KEY}`
  )
  const placesData = await placesRes.json()

  return placesData.results.slice(0, 3).map(p => ({
    id: p.place_id,
    name: p.name,
    address: p.vicinity,
    rating: p.rating || 'N/A',
    par: 72, // Places API doesn't return golf-specific data
    holes: 18,
    price: null, // Use GolfNow for pricing
  }))
}
```

---

## 2. Live Tee Times — GolfNow API

**What it does:** Real tee time availability and booking.
**Free tier:** Partner program — apply at https://partners.golfnow.com
**Docs:** https://api.golfnow.com (requires partner account)

### What you get
- Live available tee times by course and date
- Pricing per player
- Direct booking links
- Course details (par, holes, slope, rating)

### Integration sketch

```js
async function fetchTeeTimes(courseId, date) {
  const res = await fetch(
    `https://api.golfnow.com/v1/teetimes?courseId=${courseId}&date=${date}`,
    { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_GOLFNOW_KEY}` } }
  )
  const data = await res.json()
  return data.teeTimes // [{ time, price, spotsAvailable, bookingUrl }]
}
```

---

## 3. Alternative Tee Times — TeeOff API

**What it does:** Similar to GolfNow — tee time search and booking.
**Free tier:** Apply at https://www.teeoff.com/partners
**Docs:** Available after partner signup

TeeOff has slightly broader course coverage in certain US regions. Consider using both and merging results.

---

## 4. Database — Supabase (Free tier, open source)

**What it does:** Replaces localStorage with a real Postgres database.
**Free tier:** 500MB storage, 2GB bandwidth, unlimited API calls.
**Docs:** https://supabase.com/docs

### Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run this SQL in the Supabase SQL editor:

```sql
create table rounds (
  id text primary key,
  city text not null,
  status text default 'collecting',
  match jsonb,
  created_at timestamptz default now()
);

create table players (
  id text primary key,
  round_id text references rounds(id) on delete cascade,
  name text not null,
  email text not null,
  is_organizer boolean default false,
  availability jsonb,
  responded_at timestamptz
);
```

3. Add your keys to `.env`:
```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

4. Install the client:
```bash
npm install @supabase/supabase-js
```

### Replace `store.js` functions

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Create a round
export async function createRound({ organizerName, organizerEmail, playerEmails, city }) {
  const roundId = nanoid(10)

  const { error: roundError } = await supabase
    .from('rounds')
    .insert({ id: roundId, city, status: 'collecting' })

  if (roundError) throw roundError

  const players = [
    { id: nanoid(6), round_id: roundId, name: organizerName, email: organizerEmail, is_organizer: true },
    ...playerEmails.map(email => ({
      id: nanoid(6), round_id: roundId,
      name: email.split('@')[0], email, is_organizer: false
    }))
  ]

  const { error: playerError } = await supabase.from('players').insert(players)
  if (playerError) throw playerError

  return { id: roundId, players, city, status: 'collecting' }
}

// Get a round
export async function getRound(roundId) {
  const { data: round } = await supabase
    .from('rounds').select('*').eq('id', roundId).single()

  const { data: players } = await supabase
    .from('players').select('*').eq('round_id', roundId)

  if (!round) return null
  return { ...round, players }
}
```

---

## 5. Email — Resend (Free tier)

**What it does:** Send players their invite links automatically.
**Free tier:** 3,000 emails/month, 100/day.
**Docs:** https://resend.com/docs

Because this requires a server secret (you can't expose API keys in the browser),
you'll need a small backend function. The easiest options:

**Option A: Vercel Serverless Function**

Create `api/send-invite.js` in your project root:

```js
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY) // server-side only

export default async function handler(req, res) {
  const { playerEmail, playerName, inviteLink, organizerName } = req.body

  await resend.emails.send({
    from: 'TeeTimeQuest <noreply@teetimequest.com>',
    to: playerEmail,
    subject: `${organizerName} invited you to a round`,
    html: `
      <h2>You're invited to a round! ⛳</h2>
      <p>Hi ${playerName},</p>
      <p>${organizerName} is organizing a round and wants to know your availability.</p>
      <p><a href="${inviteLink}" style="background:#8ddd1a;color:#3a6600;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">
        Mark my availability →
      </a></p>
    `
  })

  res.status(200).json({ ok: true })
}
```

**Option B: Supabase Edge Function** (if you're already using Supabase)

```bash
supabase functions new send-invite
```

Then deploy with `supabase functions deploy send-invite`.

---

## 6. Geocoding for course triangulation — Mapbox (Free tier)

**What it does:** Convert player zip codes/cities to lat/lng, then find the geographic center.
**Free tier:** 100,000 requests/month.
**Docs:** https://docs.mapbox.com/api/search/geocoding

```js
async function geocode(location) {
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&limit=1`
  )
  const data = await res.json()
  const [lng, lat] = data.features[0].center
  return { lat, lng }
}

function getCenter(coords) {
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length
  return { lat, lng }
}

// Usage in computeMatch:
const playerCoords = await Promise.all(
  round.players.map(p => geocode(p.availability.location))
)
const center = getCenter(playerCoords)
const courses = await fetchNearbyCourses(center) // pass lat/lng directly
```

---

## Recommended Integration Order

Start simple and add complexity as you grow:

1. **Supabase** — replace localStorage first so data persists across devices
2. **Google Places** — replace mock courses with real ones near the group
3. **Resend** — automate invite emails so the organizer doesn't have to copy-paste links
4. **Mapbox** — true geographic triangulation instead of just using the organizer's city
5. **GolfNow / TeeOff** — real tee time availability and booking

---

## Environment Variables Reference

Add these to a `.env.local` file in your project root (never commit this file):

```bash
# Google (course discovery + geocoding)
VITE_GOOGLE_PLACES_KEY=

# Mapbox (geocoding + triangulation)
VITE_MAPBOX_TOKEN=

# Supabase (database)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# GolfNow (tee times — requires partner account)
VITE_GOLFNOW_KEY=

# Resend (email) — SERVER SIDE ONLY, use in Vercel functions
RESEND_API_KEY=
```

In Vercel, add these under **Settings → Environment Variables**.
Server-side keys (like `RESEND_API_KEY`) should NOT have the `VITE_` prefix — they won't be exposed to the browser.
