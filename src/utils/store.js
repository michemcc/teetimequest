/**
 * TeeTimeQuest — local data store (simulates a backend)
 * In production, replace these with real API calls.
 */

import { nanoid } from 'nanoid'

const STORAGE_KEY = 'teetimequest_rounds'

function getAllRounds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveRound(round) {
  const all = getAllRounds()
  all[round.id] = round
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getRound(roundId) {
  return getAllRounds()[roundId] || null
}

/**
 * Create a new round with a set of players.
 * @param {object} opts
 * @param {string} opts.organizerName
 * @param {string} opts.organizerEmail
 * @param {string[]} opts.playerEmails  - other player emails
 * @param {string} opts.city            - general area / city for course search
 * @returns {object} round
 */
export function createRound({ organizerName, organizerEmail, playerEmails, city }) {
  const roundId = nanoid(10)

  const players = [
    { id: nanoid(6), name: organizerName, email: organizerEmail, isOrganizer: true, availability: null },
    ...playerEmails
      .filter(e => e.trim())
      .map(email => ({
        id: nanoid(6),
        name: email.split('@')[0],
        email: email.trim(),
        isOrganizer: false,
        availability: null,
      })),
  ]

  const round = {
    id: roundId,
    city,
    players,
    createdAt: Date.now(),
    status: 'collecting', // collecting | matched | booked
    match: null,
  }

  saveRound(round)
  return round
}

/**
 * Save availability for a single player.
 * @param {string} roundId
 * @param {string} playerId
 * @param {object} availability - { location: string, dates: string[], timePreference: string }
 */
export function saveAvailability(roundId, playerId, availability) {
  const round = getRound(roundId)
  if (!round) throw new Error('Round not found')

  const player = round.players.find(p => p.id === playerId)
  if (!player) throw new Error('Player not found')

  player.availability = availability
  player.respondedAt = Date.now()

  // Try to compute a match if everyone has responded
  const allResponded = round.players.every(p => p.availability)
  if (allResponded) {
    round.match = computeMatch(round)
    round.status = round.match ? 'matched' : 'collecting'
  }

  saveRound(round)
  return round
}

/* ─── Course data (mock — replace with real tee-time API) ──────────────── */

const MOCK_COURSES = [
  { id: 'c1', name: 'Pebble Creek Golf Club', address: '1 Pebble Creek Dr', rating: 4.8, par: 72, holes: 18, price: 85, imageHint: 'coastal' },
  { id: 'c2', name: 'Meadowlark Links', address: '450 Links Blvd', rating: 4.5, par: 71, holes: 18, price: 60, imageHint: 'meadow' },
  { id: 'c3', name: 'The Highlands Course', address: '88 Highland Ave', rating: 4.7, par: 72, holes: 18, price: 110, imageHint: 'hills' },
  { id: 'c4', name: 'Fairview Municipal', address: '200 Park Rd', rating: 4.2, par: 70, holes: 18, price: 40, imageHint: 'municipal' },
  { id: 'c5', name: 'Sunridge Country Club', address: '9 Sunridge Ln', rating: 4.6, par: 72, holes: 18, price: 95, imageHint: 'upscale' },
]

const TEE_TIMES = ['7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM']

/**
 * Find the best matching date + courses for the group.
 * Real implementation would call a geolocation API + tee-time booking API.
 */
function computeMatch(round) {
  // Collect all date arrays from players
  const dateSets = round.players
    .filter(p => p.availability?.dates?.length)
    .map(p => new Set(p.availability.dates))

  if (dateSets.length === 0) return null

  // Find intersection of all available dates
  let commonDates = [...dateSets[0]]
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = commonDates.filter(d => dateSets[i].has(d))
  }

  if (commonDates.length === 0) {
    // Fallback: find most-common date (majority match)
    const dateCounts = {}
    round.players.forEach(p => {
      p.availability?.dates?.forEach(d => {
        dateCounts[d] = (dateCounts[d] || 0) + 1
      })
    })
    const best = Object.entries(dateCounts).sort((a, b) => b[1] - a[1])[0]
    if (!best) return null
    commonDates = [best[0]]
  }

  // Sort dates and pick the earliest
  commonDates.sort()
  const chosenDate = commonDates[0]

  // Determine time preference (pick most-common)
  const timePrefCounts = {}
  round.players.forEach(p => {
    const tp = p.availability?.timePreference
    if (tp) timePrefCounts[tp] = (timePrefCounts[tp] || 0) + 1
  })
  const timePreference = Object.entries(timePrefCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning'

  // Pick tee time based on preference
  const teeTimeMap = {
    early:   ['7:00 AM', '7:30 AM'],
    morning: ['8:00 AM', '8:30 AM', '9:00 AM'],
    midday:  ['10:00 AM', '11:00 AM'],
    afternoon: ['1:00 PM', '2:00 PM', '3:00 PM'],
  }
  const candidates = teeTimeMap[timePreference] || TEE_TIMES
  const teeTime = candidates[Math.floor(Math.random() * candidates.length)]

  // Pick 3 courses (shuffle deterministically by roundId)
  const shuffled = [...MOCK_COURSES].sort(() => (round.id.charCodeAt(0) % 2 === 0 ? 1 : -1))
  const suggestedCourses = shuffled.slice(0, 3)

  return {
    date: chosenDate,
    teeTime,
    commonDatesCount: commonDates.length,
    suggestedCourses,
    confirmedCourse: null,
  }
}
