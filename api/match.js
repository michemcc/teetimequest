/**
 * TeeTimeQuest — Background match upgrade
 * POST /api/match  { roundId }
 *
 * Called by the browser AFTER Phase 1 has already saved a quick sync match.
 * This function has its own 30s budget (Pro) or 10s (Hobby).
 * It geocodes player locations, hits Overpass, and upgrades the match
 * with real courses if available.
 *
 * Vercel Hobby: 10s — Nominatim (~1s) + Overpass (~6s) = usually fits
 * Vercel Pro:   30s — always fits
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { roundId } = req.body || {}
  if (!roundId) return res.status(400).json({ error: 'roundId required' })

  const supabaseUrl     = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase env vars missing' })
  }

  const headers = {
    apikey:        supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  }

  try {
    /* ── 1. Fetch the round + players ── */
    const [roundRes, playersRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/rounds?id=eq.${roundId}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/players?round_id=eq.${roundId}&select=*`, { headers }),
    ])

    if (!roundRes.ok || !playersRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch round from Supabase' })
    }

    const [rounds, players] = await Promise.all([roundRes.json(), playersRes.json()])
    const round = rounds[0]
    if (!round) return res.status(404).json({ error: 'Round not found' })

    // Normalise player rows
    const normalisedPlayers = players.map(p => ({
      id:           p.id,
      name:         p.name,
      email:        p.email,
      isOrganizer:  p.is_organizer,
      availability: p.availability,
    }))

    const fullRound = { ...round, players: normalisedPlayers }

    /* ── 2. Geocode player locations ── */
    const locations = [...new Set(
      normalisedPlayers.map(p => p.availability?.location).filter(Boolean)
    )]
    if (!locations.length && round.city) locations.push(round.city)
    if (!locations.length) return res.status(200).json({ ok: true, source: 'no-locations' })

    const geocodeOne = async (loc) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc)}&limit=1`
      const r = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'TeeTimeQuest/1.0 (teetimequest.com)' },
        signal: AbortSignal.timeout(4000),
      })
      const data = await r.json()
      if (!data[0]) throw new Error(`Not found: ${loc}`)
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }

    let coords
    try {
      coords = await Promise.all(locations.map(geocodeOne))
    } catch (err) {
      console.warn('[match-api] Geocoding failed:', err.message)
      return res.status(200).json({ ok: true, source: 'geocode-failed' })
    }

    /* ── 3. Compute geographic midpoint ── */
    let x = 0, y = 0, z = 0
    for (const { lat, lng } of coords) {
      const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180
      x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la)
    }
    x /= coords.length; y /= coords.length; z /= coords.length
    const midLat = ((Math.atan2(z, Math.sqrt(x*x+y*y))) * 180) / Math.PI
    const midLng = ((Math.atan2(y, x)) * 180) / Math.PI

    /* ── 4. Fetch courses from Overpass ── */
    const overpassQuery = `[out:json][timeout:7];
(
  node["leisure"="golf_course"](around:50000,${midLat},${midLng});
  way["leisure"="golf_course"](around:50000,${midLat},${midLng});
  relation["leisure"="golf_course"](around:50000,${midLat},${midLng});
);
out center tags;`

    let elements = []
    for (const endpoint of [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ]) {
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: AbortSignal.timeout(6000),
        })
        if (!r.ok) continue
        const data = await r.json()
        elements = data.elements || []
        console.info(`[match-api] Overpass returned ${elements.length} elements from ${endpoint}`)
        break
      } catch { continue }
    }

    if (!elements.length) {
      return res.status(200).json({ ok: true, source: 'overpass-empty' })
    }

    /* ── 5. Normalise + filter courses ── */
    const PRIVATE = ['country club','yacht club','hunt club','polo club','athletic club','members only','private club']
    const PRIVATE_ACCESS = ['private','members','permissive','no','restricted']

    const haversine = (la1,lo1,la2,lo2) => {
      const R=3958.8, dLa=((la2-la1)*Math.PI)/180, dLo=((lo2-lo1)*Math.PI)/180
      const a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2
      return (R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1)
    }

    const courses = elements
      .map(el => {
        const tags = el.tags || {}
        const lat = el.lat ?? el.center?.lat
        const lon = el.lon ?? el.center?.lon
        const addrParts = [
          tags['addr:housenumber'] && tags['addr:street'] ? `${tags['addr:housenumber']} ${tags['addr:street']}` : tags['addr:street'],
          tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
          tags['addr:state'],
        ].filter(Boolean)
        return {
          id: String(el.id), name: tags.name || null,
          address: addrParts.length ? addrParts.join(', ') : null,
          phone: tags.phone || null, website: tags.website || null,
          holes: parseInt(tags.holes) || 18, par: parseInt(tags.par) || 72,
          access: tags.access || 'public', rating: null, price: null,
          distanceMi: lat && lon ? haversine(midLat, midLng, lat, lon) : null,
          lat, lon, source: 'openstreetmap',
        }
      })
      .filter(c => c.name)
      .filter(c => !PRIVATE_ACCESS.includes(c.access?.toLowerCase()))
      .filter(c => {
        const lower = c.name.toLowerCase()
        if (PRIVATE.some(kw => lower.includes(kw))) return false
        if (lower.endsWith(' club') && !lower.includes('golf club')) return false
        return true
      })
      .sort((a,b) => parseFloat(a.distanceMi||999) - parseFloat(b.distanceMi||999))
      .filter((c,i,arr) => arr.findIndex(x => x.name===c.name)===i)
      .slice(0, 5)

    if (!courses.length) {
      return res.status(200).json({ ok: true, source: 'all-filtered' })
    }

    /* ── 6. Compute a complete match with real courses ──
       Don't rely on reading Phase 1 data from DB (race condition).
       Compute date/teeTime ourselves from player availability,
       then attach the real courses we just fetched.              */

    // Date matching logic (same as computeMatchSync)
    const dateSets = normalisedPlayers
      .filter(p => p.availability?.dates?.length)
      .map(p => new Set(p.availability.dates))

    if (!dateSets.length) {
      return res.status(200).json({ ok: true, source: 'no-dates' })
    }

    let commonDates = [...dateSets[0]]
    for (let i = 1; i < dateSets.length; i++) {
      commonDates = commonDates.filter(d => dateSets[i].has(d))
    }
    if (!commonDates.length) {
      const counts = {}
      normalisedPlayers.forEach(p => p.availability?.dates?.forEach(d => {
        counts[d] = (counts[d] || 0) + 1
      }))
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (!best) return res.status(200).json({ ok: true, source: 'no-common-dates' })
      commonDates = [best[0]]
    }
    commonDates.sort()
    const chosenDate = commonDates[0]

    // Tee time from preferences
    const prefCounts = {}
    normalisedPlayers.forEach(p =>
      (p.availability?.timePreferences || []).forEach(tp => {
        prefCounts[tp] = (prefCounts[tp] || 0) + 1
      })
    )
    const topPref = Object.entries(prefCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning'
    const teeTimeMap = {
      early:     ['6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM'],
      morning:   ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM'],
      midday:    ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
      afternoon: ['12:00 PM', '12:30 PM', '1:00 PM', '2:00 PM', '3:00 PM'],
    }
    const timeCandidates = teeTimeMap[topPref] || ['8:00 AM', '8:30 AM']
    // Deterministic pick from round ID so same round = same time
    const timeIdx = roundId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % timeCandidates.length
    const chosenTime = timeCandidates[timeIdx]

    // Storyline city from top course address
    const topCourse = courses[0]
    let city = round.city
    if (topCourse?.address) {
      const parts = topCourse.address.split(',').map(s => s.trim()).filter(Boolean)
      city = parts.length >= 2 ? parts.slice(-2).join(', ') : parts[0] || city
    }

    // Build the complete match object — no dependency on Phase 1
    const fullMatch = {
      date:             chosenDate,
      teeTime:          chosenTime,
      commonDatesCount: commonDates.length,
      suggestedCourses: courses,
      confirmedCourse:  null,
      storyline:        null, // client computes this on display if null
    }

    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/rounds?id=eq.${roundId}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ match: fullMatch, status: 'matched' }),
      }
    )

    if (!patchRes.ok) {
      const err = await patchRes.text()
      console.error('[match-api] Supabase patch failed:', err)
      return res.status(502).json({ error: 'Failed to save upgraded match' })
    }

    console.info('[match-api] Upgraded match with', courses.length, 'real courses for round', roundId)
    return res.status(200).json({ ok: true, source: 'openstreetmap', courses: courses.length })

  } catch (err) {
    console.error('[match-api] Unexpected error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
