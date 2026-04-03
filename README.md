# ⛳ TeeTimeQuest

**Coordinate golf tee times with your group — zero group-chat chaos.**

TeeTimeQuest lets a group of golfers share their availability, then automatically finds the best date, suggests public courses central to everyone's location, and surfaces an available tee time.

---

## Features

- **Round creation** — organizer enters player emails in 60 seconds
- **Personal invite links** — each player gets a unique link (no login required)
- **Availability picker** — tap dates + choose preferred tee time window
- **Smart matching** — finds intersection of available dates; falls back to majority if needed
- **Course triangulation** — suggests public courses near the group's center point
- **Tee time suggestion** — picks a time slot matching the group's preferences
- **Mobile-first** — fully responsive, works great on any phone
- **Instant copy** — one-tap copy of any player's invite link

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | CSS Modules |
| Date utils | date-fns |
| ID generation | nanoid |
| Storage | localStorage (swap for a real backend) |

---

## Getting Started

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## Project Structure

```
teetimequest/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles/global.css
    ├── components/
    │   ├── Nav.jsx
    │   └── Nav.module.css
    ├── pages/
    │   ├── LandingPage.jsx / .module.css
    │   ├── CreateRoundPage.jsx / .module.css
    │   ├── AvailabilityPage.jsx / .module.css
    │   ├── ResultsPage.jsx / .module.css
    │   └── NotFoundPage.jsx / .module.css
    └── utils/
        ├── store.js      ← swap this for your real API
        └── dates.js
```

---

## Routes

| Route | Page |
|---|---|
| `/` | Landing / marketing |
| `/create` | Organizer setup form |
| `/results/:roundId` | Dashboard + invite links |
| `/availability/:roundId/:playerId` | Player date picker |

---

## Connecting a Real Backend

All data logic lives in `src/utils/store.js`. Replace the three functions with real API calls:

- `createRound()` → `POST /api/rounds`
- `getRound()` → `GET /api/rounds/:id`
- `saveAvailability()` → `PATCH /api/rounds/:roundId/players/:playerId`

Add email delivery on round creation so each player automatically receives their invite link.

---

## Tee-Time API Suggestions

Replace the mock courses in `computeMatch()` with:

- **GolfNow / TeeOff API** — live tee time availability + booking
- **Google Places API** — course discovery by lat/lng
- **Mapbox Geocoding** — convert player zip codes to coordinates for triangulation

---

## License

MIT

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step instructions on:
- Deploying to Vercel (free tier)
- Buying a domain on AWS Route 53
- Connecting your custom domain to Vercel
- SSL setup (automatic)

---

## Package safety

Dependencies are pinned to exact versions. See **[NPM_SAFETY.md](./NPM_SAFETY.md)** for the full guide on keeping installs reproducible and avoiding packages published less than 7 days ago.
