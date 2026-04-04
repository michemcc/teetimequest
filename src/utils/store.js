/**
 * TeeTimeQuest — data store
 * Version: 2026.2.0
 *
 * Backend: Supabase (Postgres).
 * Falls back to localStorage automatically if Supabase env vars are not set,
 * so local development works without a database.
 *
 * All three public functions are async:
 *   createRound(opts)              → Promise<round>
 *   getRound(roundId)              → Promise<round | null>
 *   saveAvailability(id, pid, av)  → Promise<round>
 *
 * The shape of the round object returned is identical in both backends,
 * so the rest of the app doesn't care which one is active.
 */

import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import { findCoursesNearPlayers } from './courses'

/* ─── Backend detection ─────────────────────────────────────────────────── */

function useSupabase() {
  return (
    !!import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC API — same signatures, works with both backends
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a new round.
 * organizerAvailability is pre-submitted so organizer doesn't visit their link.
 *
 * @param {object}   opts
 * @param {string}   opts.organizerName
 * @param {string}   opts.organizerEmail
 * @param {string[]} opts.playerEmails
 * @param {string}   opts.city
 * @param {object}   [opts.organizerAvailability]
 * @returns {Promise<object>} round
 */
export async function createRound(opts) {
  return useSupabase()
    ? _supabase_createRound(opts)
    : _local_createRound(opts)
}

/**
 * Fetch a round by ID, including all players.
 *
 * @param {string} roundId
 * @returns {Promise<object|null>}
 */
export async function getRound(roundId) {
  return useSupabase()
    ? _supabase_getRound(roundId)
    : _local_getRound(roundId)
}

/**
 * Save availability for a single player, then re-check if all responded.
 *
 * @param {string} roundId
 * @param {string} playerId
 * @param {object} availability  — { location, dates, timePreferences }
 * @returns {Promise<object>} updated round
 */
export async function saveAvailability(roundId, playerId, availability) {
  return useSupabase()
    ? _supabase_saveAvailability(roundId, playerId, availability)
    : _local_saveAvailability(roundId, playerId, availability)
}

/**
 * Update a player's display name.
 * Called when a player edits their name on the invite page.
 */
export async function updatePlayerName(roundId, playerId, name) {
  if (useSupabase()) {
    const { error } = await supabase
      .from('players')
      .update({ name: name.trim() })
      .eq('id', playerId)
      .eq('round_id', roundId)
    if (error) throw new Error(`updatePlayerName: ${error.message}`)
    return _supabase_getRound(roundId)
  } else {
    const all   = _ls_getAll()
    const round = all[roundId]
    if (!round) throw new Error('Round not found')
    const player = round.players.find(p => p.id === playerId)
    if (!player) throw new Error('Player not found')
    player.name = name.trim()
    _ls_save(round)
    return Promise.resolve(round)
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPABASE BACKEND
═══════════════════════════════════════════════════════════════════════════ */

async function _supabase_createRound({
  organizerName,
  organizerEmail,
  playerEmails,
  city,
  organizerAvailability = null,
}) {
  const roundId = nanoid(10)
  const now = new Date().toISOString()

  /* 1 ── Insert round row */
  const { error: roundError } = await supabase
    .from('rounds')
    .insert({
      id:         roundId,
      city,
      status:     'collecting',
      match:      null,
      created_at: now,
    })

  if (roundError) throw new Error(`createRound (round): ${roundError.message}`)

  /* 2 ── Build player rows */
  const playerRows = [
    {
      id:           nanoid(6),
      round_id:     roundId,
      name:         organizerName,
      email:        organizerEmail,
      is_organizer: true,
      availability: organizerAvailability,
      responded_at: organizerAvailability ? now : null,
    },
    ...playerEmails.filter(e => e.trim()).map(email => ({
      id:           nanoid(6),
      round_id:     roundId,
      name:         email.split('@')[0],
      email:        email.trim(),
      is_organizer: false,
      availability: null,
      responded_at: null,
    })),
  ]

  const { error: playerError } = await supabase.from('players').insert(playerRows)
  if (playerError) throw new Error(`createRound (players): ${playerError.message}`)

  /* 3 ── If organizer pre-submitted, check for an instant match */
  const round = await _supabase_getRound(roundId)
  const allResponded = round.players.every(p => p.availability)

  if (allResponded) {
    // Use two-phase: instant mock match first, real courses upgrade async
    _computeAndSaveMatch(roundId, round)
    round.status = 'matched'
  }

  return round
}

async function _supabase_getRound(roundId) {
  const { data: roundRow, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()

  if (roundError || !roundRow) return null

  const { data: playerRows, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('round_id', roundId)
    .order('id', { ascending: true })

  if (playerError) return null

  /* Normalise DB column names → camelCase shape the app expects */
  return _normaliseRound(roundRow, playerRows)
}

async function _supabase_saveAvailability(roundId, playerId, availability) {
  const now = new Date().toISOString()

  /* ── 1. Save availability immediately ── */
  const { error } = await supabase
    .from('players')
    .update({ availability, responded_at: now })
    .eq('id', playerId)
    .eq('round_id', roundId)

  if (error) throw new Error(`saveAvailability: ${error.message}`)

  /* ── 2. Re-fetch round to check if everyone responded ── */
  const round = await _supabase_getRound(roundId)
  if (!round) throw new Error('Round not found after update')

  const allResponded = round.players.every(p => p.availability)

  if (allResponded) {
    /* ── 3. Return to user immediately, run course lookup in background ──
       computeMatch hits Nominatim + Overpass which can take 5-15s.
       We don't want the user staring at a spinner for that.
       Fire it async, update Supabase when done — realtime subscription
       on ResultsPage will pick up the change automatically. */
    _computeAndSaveMatch(roundId, round)
    // Return the round with status 'matched' optimistically so the
    // success banner shows immediately
    round.status = 'matched'
  }

  return round
}

/**
 * Background job — two-phase approach:
 *
 * Phase 1 (instant, <100ms): save a sync match with mock courses immediately.
 *   → Page transitions right away. No waiting on any API.
 *
 * Phase 2 (async, 5-30s): try to upgrade with real OSM courses.
 *   → If it works, overwrites the match with real courses. Realtime pushes update.
 *   → If it fails or times out, the mock match stays. No harm done.
 */
async function _computeAndSaveMatch(roundId, round) {
  /* ── Phase 1: instant sync match ── */
  try {
    const quickMatch = computeMatchSync(round)
    if (quickMatch) {
      await supabase
        .from('rounds')
        .update({ match: quickMatch, status: 'matched' })
        .eq('id', roundId)
      console.info('[match] Phase 1 saved (mock courses) for round', roundId)
    }
  } catch (err) {
    console.error('[match] Phase 1 failed:', err.message)
    return // if even this fails, give up
  }

  /* ── Phase 2: call /api/match to upgrade courses server-side ──
     This runs in its own Vercel function with a fresh timeout budget.
     It geocodes, hits Overpass, filters private clubs, and patches
     the round with real courses. Realtime subscription picks it up.    */
  try {
    fetch('/api/match', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ roundId }),
    }).then(r => r.json()).then(d => {
      console.info('[match] Phase 2 result:', d)
    }).catch(err => {
      console.info('[match] Phase 2 call failed (non-critical):', err.message)
    })
  } catch {
    // Phase 2 is fire-and-forget — Phase 1 mock match already saved
  }
}

/** Synchronous fallback match using only mock courses — no network calls */
function computeMatchSync(round) {
  const dateSets = round.players
    .filter(p => p.availability?.dates?.length)
    .map(p => new Set(p.availability.dates))
  if (!dateSets.length) return null

  let common = [...dateSets[0]]
  for (let i = 1; i < dateSets.length; i++) common = common.filter(d => dateSets[i].has(d))
  if (!common.length) {
    const counts = {}
    round.players.forEach(p => p.availability?.dates?.forEach(d => { counts[d] = (counts[d]||0)+1 }))
    const best = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]
    if (!best) return null
    common = [best[0]]
  }
  common.sort()

  const prefCounts = {}
  round.players.forEach(p => (p.availability?.timePreferences||[]).forEach(tp => { prefCounts[tp]=(prefCounts[tp]||0)+1 }))
  const topPref = Object.entries(prefCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'morning'
  const teeTimeMap = { early:['7:00 AM','7:30 AM'], morning:['8:00 AM','8:30 AM','9:00 AM'], midday:['10:00 AM','11:00 AM'], afternoon:['12:00 PM','1:00 PM','2:00 PM'] }
  const candidates = teeTimeMap[topPref] || ['8:30 AM']
  const teeTime = candidates[Math.floor(Math.random() * candidates.length)]

  const shuffled = [...MOCK_COURSES].sort(() => (round.id.charCodeAt(0) % 2 === 0 ? 1 : -1))
  const storyline = generateStoryline(round, common[0], teeTime, shuffled[0])

  return { date: common[0], teeTime, commonDatesCount: common.length,
           suggestedCourses: shuffled.slice(0,3), confirmedCourse: null, storyline }
}

/* ── Shape normaliser ── DB uses snake_case; app expects camelCase ── */
function _normaliseRound(roundRow, playerRows) {
  return {
    id:        roundRow.id,
    city:      roundRow.city,
    status:    roundRow.status,
    match:     roundRow.match,
    createdAt: roundRow.created_at,
    players:   (playerRows || []).map(p => ({
      id:           p.id,
      name:         p.name,
      email:        p.email,
      isOrganizer:  p.is_organizer,
      availability: p.availability,
      respondedAt:  p.responded_at,
    })),
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPABASE REALTIME — subscribe to a round's player updates
   Used by ResultsPage to replace the 5-second polling interval.

   Usage:
     const unsub = subscribeToRound(roundId, (updatedRound) => setRound(updatedRound))
     return () => unsub()   // call in useEffect cleanup
═══════════════════════════════════════════════════════════════════════════ */

export function subscribeToRound(roundId, onUpdate) {
  if (!useSupabase()) return () => {}   // no-op for localStorage mode

  const channel = supabase
    .channel(`round:${roundId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'players',
        filter: `round_id=eq.${roundId}`,
      },
      async () => {
        // Any player change → re-fetch full round and push to caller
        const updated = await _supabase_getRound(roundId)
        if (updated) onUpdate(updated)
      }
    )
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'rounds',
        filter: `id=eq.${roundId}`,
      },
      async () => {
        const updated = await _supabase_getRound(roundId)
        if (updated) onUpdate(updated)
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOCALSTORAGE BACKEND — unchanged, used as fallback
═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'teetimequest_rounds'

function _ls_getAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function _ls_save(round) {
  const all = _ls_getAll()
  all[round.id] = round
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

function _local_getRound(roundId) {
  return Promise.resolve(_ls_getAll()[roundId] || null)
}

async function _local_createRound({
  organizerName,
  organizerEmail,
  playerEmails,
  city,
  organizerAvailability = null,
}) {
  const roundId = nanoid(10)

  const players = [
    {
      id: nanoid(6), name: organizerName, email: organizerEmail,
      isOrganizer: true,
      availability: organizerAvailability,
      respondedAt:  organizerAvailability ? Date.now() : null,
    },
    ...playerEmails.filter(e => e.trim()).map(email => ({
      id: nanoid(6), name: email.split('@')[0], email: email.trim(),
      isOrganizer: false, availability: null, respondedAt: null,
    })),
  ]

  const round = { id: roundId, city, players, createdAt: Date.now(), status: 'collecting', match: null }

  const allResponded = round.players.every(p => p.availability)
  if (allResponded) {
    round.match  = computeMatchSync(round)
    round.status = round.match ? 'matched' : 'collecting'
  }

  _ls_save(round)
  return Promise.resolve(round)
}

async function _local_saveAvailability(roundId, playerId, availability) {
  const all = _ls_getAll()
  const round = all[roundId]
  if (!round) return Promise.reject(new Error('Round not found'))

  const player = round.players.find(p => p.id === playerId)
  if (!player) return Promise.reject(new Error('Player not found'))

  player.availability = availability
  player.respondedAt  = Date.now()

  const allResponded = round.players.every(p => p.availability)
  if (allResponded) {
    round.match  = computeMatchSync(round)
    round.status = round.match ? 'matched' : 'collecting'
  }

  _ls_save(round)
  return Promise.resolve(round)
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATCH COMPUTATION — shared by both backends
═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   STORYLINE GENERATOR
   Creates a fun, punchy narrative about the round. Pure client-side —
   no API call, instant, works offline. Uses player names, city, date,
   tee time and course name to produce something that feels personal.
═══════════════════════════════════════════════════════════════════════════ */

const OPENERS = [
  "The crew is locked in.",
  "It's official — the round is on.",
  "Mark the calendar.",
  "Game day is coming.",
  "The fairways await.",
  "Clubs out, chaos incoming.",
  "The group chat can finally rest.",
  "Someone's going home with a story.",
]

const FORMATS = [
  ({ names, city, date, teeTime, course }) =>
    `${names} are heading to ${city} for a morning on the links. Tee time is ${teeTime} — ${course ? `at ${course}` : 'course TBD'}. May the best player win, and may everyone else at least pretend to be happy about it.`,

  ({ names, city, teeTime, course }) =>
    `${names} have officially committed to ${city}. The ${teeTime} slot is locked in${course ? ` at ${course}` : ''}. Handicaps will be questioned, mulligans will be debated, and at least one person will blame the wind.`,

  ({ names, city, date, teeTime }) =>
    `The squad is teeing off in ${city}. ${teeTime} on ${date} — no excuses, no rain checks. ${names} made it happen against all scheduling odds. That's either impressive or slightly concerning.`,

  ({ names, city, course, teeTime }) =>
    `${city} better be ready. ${names} are descending on the fairways${course ? ` of ${course}` : ''} at ${teeTime}. Birdies will be attempted. Pars will be celebrated. Bogeys will be diplomatically not mentioned.`,

  ({ names, teeTime, city, course }) =>
    `${teeTime} in ${city}${course ? ` at ${course}` : ''}. ${names} finally stopped texting and actually locked in a date. Golf will be played. Stories will be told. Scores may or may not be recorded accurately.`,
]

function generateStoryline(round, date, teeTime, topCourse) {
  // Build a readable list of player first names
  const firstNames = round.players.map(p => p.name.split(' ')[0])
  let names
  if (firstNames.length === 1) {
    names = firstNames[0]
  } else if (firstNames.length === 2) {
    names = firstNames.join(' and ')
  } else {
    names = firstNames.slice(0, -1).join(', ') + ', and ' + firstNames[firstNames.length - 1]
  }

  // Format the date nicely
  let dateStr = date
  try {
    const d = new Date(date + 'T00:00:00')
    dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } catch {}

  // Use the course's city if available (e.g. "Rehoboth, MA"), not the organizer's city.
  // Course address is typically "123 Main St, Rehoboth, MA" — take last two comma-parts.
  let city = round.city  // fallback
  if (topCourse?.address) {
    const parts = topCourse.address.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length >= 2) {
      // Last two parts are typically "City, STATE" or just "City"
      city = parts.slice(-2).join(', ')
    } else if (parts.length === 1) {
      city = parts[0]
    }
  }

  const ctx = {
    names,
    city,
    date:    dateStr,
    teeTime,
    course:  topCourse?.name || null,
  }

  // Pick opener and format seeded by round ID so same round = same story
  const seed    = round.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const opener  = OPENERS[seed % OPENERS.length]
  const format  = FORMATS[(seed + 3) % FORMATS.length]

  return `${opener} ${format(ctx)}`
}

const MOCK_COURSES = [
  { id: 'c1', name: 'Pebble Creek Golf Club', address: '1 Pebble Creek Dr', rating: 4.8, par: 72, holes: 18, price: 85  },
  { id: 'c2', name: 'Meadowlark Links',        address: '450 Links Blvd',    rating: 4.5, par: 71, holes: 18, price: 60  },
  { id: 'c3', name: 'The Highlands Course',    address: '88 Highland Ave',   rating: 4.7, par: 72, holes: 18, price: 110 },
  { id: 'c4', name: 'Fairview Municipal',      address: '200 Park Rd',       rating: 4.2, par: 70, holes: 18, price: 40  },
  { id: 'c5', name: 'Sunridge Country Club',   address: '9 Sunridge Ln',     rating: 4.6, par: 72, holes: 18, price: 95  },
]

async function computeMatch(round) {
  const dateSets = round.players
    .filter(p => p.availability?.dates?.length)
    .map(p => new Set(p.availability.dates))

  if (dateSets.length === 0) return null

  let commonDates = [...dateSets[0]]
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = commonDates.filter(d => dateSets[i].has(d))
  }

  if (commonDates.length === 0) {
    const counts = {}
    round.players.forEach(p => {
      p.availability?.dates?.forEach(d => { counts[d] = (counts[d] || 0) + 1 })
    })
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (!best) return null
    commonDates = [best[0]]
  }

  commonDates.sort()

  const prefCounts = {}
  round.players.forEach(p => {
    const prefs = p.availability?.timePreferences || []
    prefs.forEach(tp => { prefCounts[tp] = (prefCounts[tp] || 0) + 1 })
  })
  const topPref = Object.entries(prefCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning'

  const teeTimeMap = {
    early:     ['6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM'],
    morning:   ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM'],
    midday:    ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
    afternoon: ['12:00 PM', '12:30 PM', '1:00 PM', '2:00 PM', '3:00 PM'],
  }
  const candidates = teeTimeMap[topPref] || ['8:00 AM', '8:30 AM', '9:00 AM']
  const teeTime = candidates[Math.floor(Math.random() * candidates.length)]

  /* ── Real course discovery via OpenStreetMap ── */
  let suggestedCourses = null
  try {
    suggestedCourses = await findCoursesNearPlayers(round.players, round.city, 5)
  } catch (err) {
    console.warn('[courses] OSM lookup failed, falling back to mock:', err.message)
  }

  // Fall back to mock data if OSM returns nothing or errors
  if (!suggestedCourses || suggestedCourses.length === 0) {
    const shuffled = [...MOCK_COURSES].sort(() => (round.id.charCodeAt(0) % 2 === 0 ? 1 : -1))
    suggestedCourses = shuffled.slice(0, 3)
  }

  /* ── Storyline generation ── */
  const storyline = generateStoryline(round, commonDates[0], teeTime, suggestedCourses[0])

  return {
    date: commonDates[0],
    teeTime,
    commonDatesCount: commonDates.length,
    suggestedCourses,
    confirmedCourse:  null,
    storyline,
  }
}
