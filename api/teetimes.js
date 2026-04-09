/**
 * TeeTimeQuest — Tee times proxy
 * GET /api/teetimes?courseId=gcapi-123&date=2026-04-15&players=4
 *
 * Proxies GolfCourseAPI /v1/courses/{id}/teetimes server-side
 * so the API key never reaches the browser.
 *
 * Returns normalised slots:
 * {
 *   slots: [
 *     { time: "08:24", price: 85, players: 4, available: true, raw: {...} }
 *   ],
 *   source: "golfcourseapi" | "unavailable"
 * }
 *
 * Env var required: GOLF_COURSE_API_KEY
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { courseId, date, players = '4' } = req.query

  if (!courseId || !date) {
    return res.status(400).json({ error: 'courseId and date are required' })
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY
  if (!apiKey) {
    // Key not set — return unavailable gracefully so UI can degrade
    return res.status(200).json({ slots: [], source: 'no-api-key' })
  }

  // courseId is prefixed "gcapi-{id}" — extract the numeric id
  const numericId = courseId.replace(/^gcapi-/, '')
  if (!numericId || isNaN(Number(numericId))) {
    // OSM course IDs (no gcapi- prefix) don't support tee time lookup
    return res.status(200).json({ slots: [], source: 'osm-course' })
  }

  try {
    const url = new URL(`https://api.golfcourseapi.com/v1/courses/${numericId}/teetimes`)
    url.searchParams.set('date',    date)
    url.searchParams.set('players', players)

    const apiRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Key ${apiKey}`,
        Accept:        'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (apiRes.status === 404) {
      // Course exists but doesn't have tee time data via GCAPI
      return res.status(200).json({ slots: [], source: 'no-teetimes' })
    }

    if (!apiRes.ok) {
      const body = await apiRes.text().catch(() => '')
      console.warn(`[teetimes] HTTP ${apiRes.status}: ${body.slice(0, 200)}`)
      return res.status(200).json({ slots: [], source: 'api-error', status: apiRes.status })
    }

    const data = await apiRes.json()

    // GolfCourseAPI teetimes response shape:
    // { teetimes: [ { teetime: "08:24:00", price: 85, available_spots: 4, ... } ] }
    const raw = Array.isArray(data.teetimes) ? data.teetimes :
                Array.isArray(data)          ? data          : []

    const playerCount = parseInt(players) || 4

    const slots = raw
      .filter(t => {
        // Must have enough spots for the group
        const spots = t.available_spots ?? t.spots_available ?? t.available ?? 99
        return spots >= playerCount
      })
      .map(t => {
        // Normalise time — API returns "08:24:00" or "08:24"
        const rawTime = t.teetime || t.time || t.tee_time || ''
        const timeParts = rawTime.split(':')
        let hour = parseInt(timeParts[0]) || 0
        const min  = timeParts[1] || '00'
        const ampm = hour >= 12 ? 'PM' : 'AM'
        if (hour > 12) hour -= 12
        if (hour === 0) hour = 12
        const displayTime = `${hour}:${min} ${ampm}`

        // Price — may be per-player or total
        const priceRaw = t.price ?? t.rate ?? t.green_fee ?? null
        const price    = priceRaw != null ? Math.round(Number(priceRaw)) : null

        return {
          time:      displayTime,
          timeRaw:   rawTime,
          price,
          players:   t.available_spots ?? t.spots_available ?? playerCount,
          available: true,
        }
      })
      // Sort chronologically
      .sort((a, b) => a.timeRaw.localeCompare(b.timeRaw))

    // Cache: tee times change, but 2 min cache is fine to reduce hammering
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60')

    console.info(`[teetimes] course=${numericId} date=${date} players=${players} slots=${slots.length}`)
    return res.status(200).json({ slots, source: 'golfcourseapi' })

  } catch (err) {
    console.error('[teetimes] Error:', err.message)
    return res.status(200).json({ slots: [], source: 'error', message: err.message })
  }
}
