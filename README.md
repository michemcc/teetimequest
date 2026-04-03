# ⛳ TeeTimeQuest — v2026.2.2

**Coordinate golf tee times with your group. Zero group-chat chaos.**

TeeTimeQuest lets a group of 2-8 golfers share availability, then automatically finds the best shared date, suggests public courses central to everyone's location, and surfaces a matching tee time. No accounts. No downloads. Just a link.

---

## Quick start

```bash
npm install
npm run dev
```

For email invites and the cleanup cron to work locally, use `vercel dev` instead (requires Vercel CLI).

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.3.1 |
| Build | Vite | 6.0.11 |
| Routing | React Router | 6.28.1 |
| Database | Supabase (Postgres) | 2.47.10 |
| Email | Brevo | REST API |
| Contact form | Formspree | mojpnkyn |
| Date utils | date-fns | 4.1.0 |
| IDs | nanoid | 5.0.9 |

---

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | anon key, safe to expose |
| `BREVO_API_KEY` | api/send-invite.js | Server-side only |
| `BREVO_SENDER_EMAIL` | api/send-invite.js | Must be verified in Brevo |
| `SUPABASE_SERVICE_ROLE_KEY` | api/cleanup.js | Server-side only, never VITE_ prefix |
| `CRON_SECRET` | api/cleanup.js | Random string, protects the endpoint |

---

## Project structure

```
teetimequest/
├── api/
│   ├── send-invite.js     Brevo invite email (Vercel serverless)
│   └── cleanup.js         Daily round cleanup (Vercel cron)
├── src/
│   ├── components/        Nav, Footer, CityPicker
│   ├── pages/             All page components + CSS modules
│   ├── styles/global.css  Design system tokens
│   └── utils/
│       ├── store.js        Supabase + localStorage fallback
│       ├── supabase.js     Supabase client singleton
│       ├── email.js        sendInviteEmails() utility
│       └── dates.js
└── supabase/
    ├── migration_2026_2_0.sql   Run once: schema setup
    └── cleanup_rounds.sql       Run once: cleanup function
```

---

## Database setup

Run these files in order in your Supabase SQL Editor:

1. `supabase/migration_2026_2_0.sql` -- creates rounds + players tables, RLS, realtime
2. `supabase/cleanup_rounds.sql` -- creates the cleanup_old_rounds() function

---

## Automated round cleanup

Rounds delete automatically the day after the matched tee date. Stale collecting rounds delete after 30 days. Players delete via CASCADE.

**How it works:** `api/cleanup.js` is called daily by Vercel Cron at 4am UTC, which calls `cleanup_old_rounds()` in Postgres using the service role key. Configured in `vercel.json`:

```json
"crons": [{ "path": "/api/cleanup", "schedule": "0 4 * * *" }]
```

**Preview what would be deleted (safe, no deletes):**
```sql
SELECT id, city, status, match->>'date' AS tee_date
FROM rounds
WHERE
  (status IN ('matched','booked') AND (match->>'date')::date < current_date)
  OR (status = 'collecting' AND created_at < now() - interval '30 days');
```

**Run manually:**
```sql
SELECT cleanup_old_rounds();
```

Or via curl:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://teetimequest.com/api/cleanup
```

**Supabase Pro alternative:** Schedule directly with pg_cron instead of the Vercel function:
```sql
SELECT cron.schedule('cleanup-old-rounds', '0 4 * * *', 'SELECT cleanup_old_rounds()');
```

---

## Versioning

Format: `YYYY.MAJOR.MINOR`. Bump in three places when releasing:
- `src/components/Nav.jsx` -- const VERSION
- `src/components/Footer.jsx` -- const VERSION
- `package.json` -- "version"

---

## Deployment

See `DEPLOYMENT.md` for Vercel + AWS Route 53 instructions.

---

## Package safety

All deps pinned to exact versions. `.npmrc` enforces `save-exact=true`. See `NPM_SAFETY.md`.

---

## License

MIT
