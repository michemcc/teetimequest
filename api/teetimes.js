/**
 * TeeTimeQuest — Tee times proxy
 * GET /api/teetimes?courseId=gcapi-123&date=2026-04-15&players=4
 *
 * Proxies GolfCourseAPI /v1/courses/{id}/teetimes server-side
 * so the API key never reaches the browser.
 *
 * GolfCourseAPI teetimes response shape:
 * {
 *   "teetimes": [
 *     {
 *       "teetime": "2026-04-15T08:24:00",  ← full ISO datetime
 *       "available_spots": 4,
 *       "green_fee": 65.00,
 *       "cart_fee": 20.00
 *     }
 *   ]
 * }
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { courseId, date, players = '4' } = req.query

  if (!courseId || !date) {
    return res.status(400).json({ error: 'courseId and date are required' })
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY
  if (!apiKey) {
    return res.status(200).json({ slots: [], source: 'no-api-key' })
  }

  // courseId is prefixed "gcapi-{id}" — extract the numeric part
  const numericId = courseId.replace(/^gcapi-/, '')
  if (!numericId || isNaN(Number(numericId))) {
    return res.status(200).json({ slots: [], source: 'osm-course' })
  }

  try {
    const url = new URL(`https://api.golfcourseapi.com/v1/courses/${numericId}/teetimes`)
    url.searchParams.set('date',    date)
    url.searchParams.set('players', players)

    console.info(`[teetimes] Fetching: ${url.toString()}`)

    const apiRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Key ${apiKey}`,
        Accept:        'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (apiRes.status === 404) {
      console.info(`[teetimes] 404 — course ${numericId} has no tee time data`)
      return res.status(200).json({ slots: [], source: 'no-teetimes' })
    }

    if (!apiRes.ok) {
      const body = await apiRes.text().catch(() => '')
      console.warn(`[teetimes] HTTP ${apiRes.status}: ${body.slice(0, 300)}`)
      return res.status(200).json({ slots: [], source: 'api-error', status: apiRes.status })
    }

    const data = await apiRes.json()

    // Log the raw shape so we can see exactly what the API returns in Vercel logs
    const rawArray = Array.isArray(data.teetimes) ? data.teetimes
                   : Array.isArray(data)           ? data
                   : []
    console.info(`[teetimes] Raw response keys: ${Object.keys(data).join(', ')}`)
    console.info(`[teetimes] Raw teetimes count: ${rawArray.length}`)
    if (rawArray[0]) {
      console.info(`[teetimes] First slot sample: ${JSON.stringify(rawArray[0])}`)
    }

    const playerCount = parseInt(players) || 4

    const slots = rawArray
      .filter(t => {
        // Don't filter on spots too strictly — some courses don't return this field
        const spots = t.available_spots ?? t.spots_available ?? t.spots ?? null
        if (spots !== null && spots < playerCount) return false
        return true
      })
      .map(t => {
        // teetime is a full ISO datetime: "2026-04-15T08:24:00"
        // OR just a time string: "08:24" or "08:24:00"
        const rawTime = t.teetime || t.tee_time || t.time || t.start_time || ''

        let displayTime = rawTime  // fallback

        if (rawTime.includes('T')) {
          // ISO datetime — extract the time part after T
          const timePart = rawTime.split('T')[1] || ''           // "08:24:00"
          const [h, m]   = timePart.split(':').map(Number)       // [8, 24]
          if (!isNaN(h) && !isNaN(m)) {
            const ampm = h >= 12 ? 'PM' : 'AM'
            const hour = h % 12 === 0 ? 12 : h % 12
            displayTime = `${hour}:${String(m).padStart(2, '0')} ${ampm}`
          }
        } else if (rawTime.match(/^\d{1,2}:\d{2}/)) {
          // Plain time string "08:24" or "08:24:00"
          const [h, m] = rawTime.split(':').map(Number)
          if (!isNaN(h) && !isNaN(m)) {
            const ampm = h >= 12 ? 'PM' : 'AM'
            const hour = h % 12 === 0 ? 12 : h % 12
            displayTime = `${hour}:${String(m).padStart(2, '0')} ${ampm}`
          }
        }

        // Price — GolfCourseAPI uses green_fee + optional cart_fee
        const greenFee = t.green_fee ?? t.price ?? t.rate ?? null
        const cartFee  = t.cart_fee  ?? t.cart  ?? 0
        const price    = greenFee != null
          ? Math.round(Number(greenFee) + Number(cartFee))
          : null

        return {
          time:    displayTime,
          timeRaw: rawTime,
          price,
          players: t.available_spots ?? t.spots ?? playerCount,
          available: true,
        }
      })
      .filter(s => s.time && s.time !== '')
      // Sort chronologically by raw time string
      .sort((a, b) => a.timeRaw.localeCompare(b.timeRaw))

    console.info(`[teetimes] Returning ${slots.length} slots for course ${numericId} on ${date}`)

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60')
    return res.status(200).json({ slots, source: 'golfcourseapi' })

  } catch (err) {
    console.error('[teetimes] Error:', err.message)
    return res.status(200).json({ slots: [], source: 'error', message: err.message })
  }
}
