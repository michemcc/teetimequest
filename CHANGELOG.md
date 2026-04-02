# TeeTimeQuest — Changelog

Version format: `YYYY.MAJOR.MINOR`
- `YYYY` — the year of release
- `MAJOR` — significant feature additions or breaking changes
- `MINOR` — bug fixes, polish, small additions

---

## [2026.2.0] — 2026-04-02

### Added
- **Supabase integration** — rounds and players now stored in Postgres; localStorage remains as automatic fallback when env vars are absent
- `src/utils/supabase.js` — singleton Supabase client
- `supabase/migration_2026_2_0.sql` — full schema with RLS policies and realtime publication
- **Realtime updates** — `subscribeToRound()` in `store.js` replaces the 5-second polling interval on the Results page; players see live updates the moment someone submits
- Supabase env vars added to `.env.example`

### Changed
- `src/utils/store.js` — all three public functions (`createRound`, `getRound`, `saveAvailability`) are now `async`; backend auto-detects Supabase vs localStorage
- `src/pages/ResultsPage.jsx` — uses `subscribeToRound()` realtime subscription
- `src/pages/AvailabilityPage.jsx` — all store calls are now `await`-ed; loading and saving states added
- `src/pages/CreateRoundPage.jsx` — `createRound` is now `await`-ed
- `package.json` — version bumped to `2026.2.0`; `@supabase/supabase-js@2.47.10` added (pinned)

### Dependencies added
```
@supabase/supabase-js  2.47.10
```

---

## [2026.1.1] — 2026-04-02

### Added
- **Brevo email integration** — invite emails sent automatically to every player when a round is created (`api/send-invite.js` Vercel serverless function)
- **Versioning system** — `YYYY.MAJOR.MINOR` format starting with `2026.1.1`
- `src/utils/email.js` — `sendInviteEmails()` utility; fires per-player, fails silently so a bad address never blocks the round
- `CHANGELOG.md` — this file

### Changed
- `package.json` — all dependency versions pinned exactly (no `^` or `~`) for reproducible installs
- `API_INTEGRATIONS.md` — updated to mark Brevo as the **active** email provider; other options moved to alternatives section

### Dependencies (pinned)
```
react              18.3.1
react-dom          18.3.1
react-router-dom   6.28.1
date-fns           4.1.0
nanoid             5.0.9
@vitejs/plugin-react 4.3.4
vite               6.0.11
```

---

## [2026.1.0] — 2026-03-28 *(pre-release)*

### Added
- Initial full application
- Landing page, Create Round, Availability, Results, About, Contact, Privacy pages
- Dark / light mode toggle with localStorage persistence
- City autocomplete via OpenStreetMap Nominatim (free, no key)
- Multi-select tee time preferences
- Organizer availability pre-submitted on round creation (no second form visit needed)
- Up to 8 players per round
- Vercel deployment config (`vercel.json`)
- SVG favicon + `sitemap.xml` + `robots.txt`
- `DEPLOYMENT.md` — Vercel + AWS Route 53 setup guide
- `API_INTEGRATIONS.md` — full guide for courses, tee times, email, and database

---

## How to version a new release

1. Update `"version"` in `package.json`
2. Add a new `## [YYYY.MAJOR.MINOR]` section at the top of this file
3. List changes under `### Added`, `### Changed`, `### Fixed`, `### Removed`
4. Commit with message: `chore: release 2026.x.x`
5. Tag the commit: `git tag v2026.x.x && git push --tags`

### Version bump guide
- Bug fix or copy change → increment MINOR (e.g. `2026.1.1` → `2026.1.2`)
- New feature, no breaking changes → increment MAJOR (e.g. `2026.1.1` → `2026.2.0`)
- New year → reset to `YYYY.1.0` (e.g. `2026.3.4` → `2027.1.0`)
