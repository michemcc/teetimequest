/**
 * TeeTimeQuest — Background match upgrade
 * POST /api/match  { roundId }
 *
 * Called by the browser after Phase 1 saves a quick sync match.
 * Geocodes player locations, finds the midpoint, then fetches real
 * courses — GolfCourseAPI first (if key set), Overpass OSM as fallback.
 *
 * Env vars required in Vercel:
 *   VITE_SUPABASE_URL      — Supabase project URL
 *   VITE_SUPABASE_ANON_KEY — Supabase anon key
 *   GOLF_COURSE_API_KEY    — from golfcourseapi.com (optional, falls back to OSM)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { roundId } = req.body || {}
  if (!roundId) return res.status(400).json({ error: 'roundId required' })

  const supabaseUrl     = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const gcApiKey        = process.env.GOLF_COURSE_API_KEY  // optional

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase env vars missing' })
  }

  const sbHeaders = {
    apikey:        supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  }

  try {
    /* ── 1. Fetch round + players ─────────────────────────── */
    const [roundRes, playersRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/rounds?id=eq.${roundId}&select=*`, { headers: sbHeaders }),
      fetch(`${supabaseUrl}/rest/v1/players?round_id=eq.${roundId}&select=*`, { headers: sbHeaders }),
    ])
    if (!roundRes.ok || !playersRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch from Supabase' })
    }
    const [rounds, players] = await Promise.all([roundRes.json(), playersRes.json()])
    const round = rounds[0]
    if (!round) return res.status(404).json({ error: 'Round not found' })

    const normalisedPlayers = players.map(p => ({
      id: p.id, name: p.name, email: p.email,
      isOrganizer: p.is_organizer, availability: p.availability,
    }))

    /* ── 2. Geocode player locations ──────────────────────── */
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

    /* ── 3. Geographic midpoint ───────────────────────────── */
    let x = 0, y = 0, z = 0
    for (const { lat, lng } of coords) {
      const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180
      x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la)
    }
    x /= coords.length; y /= coords.length; z /= coords.length
    const midLat = ((Math.atan2(z, Math.sqrt(x * x + y * y))) * 180) / Math.PI
    const midLng = ((Math.atan2(y, x)) * 180) / Math.PI
    console.info(`[match-api] Midpoint: ${midLat.toFixed(4)},${midLng.toFixed(4)} from [${locations.join(', ')}]`)

    /* ── 4. Fetch courses — GolfCourseAPI then OSM ────────── */
    let courses = null
    let courseSource = 'none'

    if (gcApiKey) {
      courses = await fetchGolfCourseAPI(midLat, midLng, gcApiKey)
      if (courses?.length) courseSource = 'golfcourseapi'
    }

    if (!courses?.length) {
      const reason = gcApiKey ? 'GCAPI returned nothing — possibly rate limited or key issue' : 'No GCAPI key set'
      console.info(`[match-api] ${reason}. Trying Overpass...`)
      courses = await fetchOverpass(midLat, midLng)
      if (courses?.length) courseSource = 'openstreetmap'
    }

    if (!courses?.length) {
      console.warn('[match-api] No courses found from any source')
      return res.status(200).json({ ok: true, source: 'no-courses' })
    }

    console.info(`[match-api] ${courses.length} courses from ${courseSource} | gcapi key set: ${!!gcApiKey}`)

    /* ── 5. Build complete match ──────────────────────────── */
    const dateSets = normalisedPlayers
      .filter(p => p.availability?.dates?.length)
      .map(p => new Set(p.availability.dates))

    if (!dateSets.length) return res.status(200).json({ ok: true, source: 'no-dates' })

    let commonDates = [...dateSets[0]]
    for (let i = 1; i < dateSets.length; i++) {
      commonDates = commonDates.filter(d => dateSets[i].has(d))
    }
    if (!commonDates.length) {
      const counts = {}
      normalisedPlayers.forEach(p =>
        p.availability?.dates?.forEach(d => { counts[d] = (counts[d] || 0) + 1 })
      )
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (!best) return res.status(200).json({ ok: true, source: 'no-common-dates' })
      commonDates = [best[0]]
    }
    commonDates.sort()
    const chosenDate = commonDates[0]

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
    const timeIdx = roundId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % timeCandidates.length
    const chosenTime = timeCandidates[timeIdx]

    // City for storyline — from top course address
    let city = round.city
    const topCourse = courses[0]
    if (topCourse?.address) {
      const parts = topCourse.address.split(',').map(s => s.trim()).filter(Boolean)
      city = parts.length >= 2 ? parts.slice(-2).join(', ') : parts[0] || city
    }

    const storyline = buildStoryline(roundId, normalisedPlayers, chosenDate, chosenTime, city, topCourse?.name)

    const fullMatch = {
      date:             chosenDate,
      teeTime:          chosenTime,
      commonDatesCount: commonDates.length,
      suggestedCourses: courses,
      confirmedCourse:  null,
      storyline,
      courseSource,
    }

    /* ── 6. Patch Supabase ────────────────────────────────── */
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/rounds?id=eq.${roundId}`, {
      method:  'PATCH',
      headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body:    JSON.stringify({ match: fullMatch, status: 'matched' }),
    })

    if (!patchRes.ok) {
      const err = await patchRes.text()
      console.error('[match-api] Supabase patch failed:', err)
      return res.status(502).json({ error: 'Failed to save match' })
    }

    console.info(`[match-api] ✓ round=${roundId} courses=${courses.length} source=${courseSource}`)
    return res.status(200).json({ ok: true, source: courseSource, courses: courses.length })

  } catch (err) {
    console.error('[match-api] Unexpected error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

/* ═══════════════════════════════════════════════════════════════
   GOLF COURSE API  —  https://golfcourseapi.com
   GET /v1/search?latitude=&longitude=&distance_km=
   Authorization: Key YOUR_API_KEY
═══════════════════════════════════════════════════════════════ */

async function fetchGolfCourseAPI(lat, lng, apiKey, radiusKm = 50) {
  try {
    const url = new URL('https://api.golfcourseapi.com/v1/search')
    url.searchParams.set('latitude',    lat)
    url.searchParams.set('longitude',   lng)
    url.searchParams.set('distance_km', radiusKm)

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Key ${apiKey}`,
        Accept:        'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[gcapi] HTTP ${res.status} — possible rate limit or invalid key: ${body.slice(0, 200)}`)
      // 429 = rate limited, 401/403 = bad key, 402 = plan upgrade needed
      return null
    }

    const data = await res.json()
    const raw  = Array.isArray(data.courses) ? data.courses : []
    console.info(`[gcapi] Raw results: ${raw.length}`)
    if (!raw.length) return null

    const PUBLIC_TYPES   = ['public', 'semi-private', 'resort', 'municipal']
    const PRIVATE_NAMES  = ['country club', 'yacht club', 'hunt club', 'polo club',
                            'athletic club', 'members only', 'private club']

    const haversine = (la1, lo1, la2, lo2) => {
      const R = 3958.8, dLa = ((la2-la1)*Math.PI)/180, dLo = ((lo2-lo1)*Math.PI)/180
      const a = Math.sin(dLa/2)**2 +
        Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2
      return (R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1)
    }

    const courses = raw
      .filter(c => {
        // Club type — filter private if the field exists
        if (c.club_type && !PUBLIC_TYPES.includes(c.club_type.toLowerCase())) return false
        // Name-based fallback filter
        const lower = (c.club_name || '').toLowerCase()
        if (PRIVATE_NAMES.some(kw => lower.includes(kw))) return false
        if (lower.endsWith(' club') && !lower.includes('golf club')) return false
        return true
      })
      .map(c => {
        const loc = c.location || {}

        // Build display name
        let name = c.club_name || 'Golf Course'
        if (
          c.course_name &&
          c.course_name !== c.club_name &&
          !c.course_name.toLowerCase().match(/^main|^championship|^course\s*\d*$/i)
        ) {
          name = `${c.club_name} — ${c.course_name}`
        }

        const addrParts = [loc.address, loc.city, loc.state].filter(Boolean)

        return {
          id:             `gcapi-${c.id}`,
          name,
          address:        addrParts.join(', ') || null,
          phone:          c.phone   || null,
          website:        c.website || null,
          holes:          c.num_holes || 18,
          par:            72,          // GolfCourseAPI doesn't expose par
          access:         c.club_type || 'public',
          rating:         null,
          price:          null,
          hasDrivingRange: !!c.has_driving_range,
          distanceMi:     loc.latitude && loc.longitude
                            ? haversine(lat, lng, loc.latitude, loc.longitude)
                            : null,
          lat:    loc.latitude,
          lon:    loc.longitude,
          source: 'golfcourseapi',
        }
      })
      .sort((a, b) => parseFloat(a.distanceMi || 999) - parseFloat(b.distanceMi || 999))
      .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)
      .slice(0, 5)

    console.info(`[gcapi] After filter: ${courses.length} public courses`)
    return courses.length ? courses : null

  } catch (err) {
    console.warn('[gcapi] Error:', err.message)
    return null
  }
}

/* ═══════════════════════════════════════════════════════════════
   OVERPASS / OPENSTREETMAP  —  fallback when no GolfCourseAPI key
═══════════════════════════════════════════════════════════════ */

async function fetchOverpass(lat, lng, radiusMeters = 50000) {
  const query = `[out:json][timeout:7];
(
  node["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
);
out center tags;`

  const PRIVATE_KEYWORDS = ['country club','yacht club','hunt club','polo club',
                             'athletic club','members only','private club']
  const PRIVATE_ACCESS   = ['private','members','permissive','no','restricted']

  const haversine = (la1, lo1, la2, lo2) => {
    const R = 3958.8, dLa = ((la2-la1)*Math.PI)/180, dLo = ((lo2-lo1)*Math.PI)/180
    const a = Math.sin(dLa/2)**2 +
      Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2
    return (R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1)
  }

  let elements = []
  for (const endpoint of [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]) {
    try {
      const r = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
        signal:  AbortSignal.timeout(6000),
      })
      if (!r.ok) continue
      const data = await r.json()
      elements = data.elements || []
      console.info(`[overpass] ${elements.length} elements from ${endpoint}`)
      break
    } catch { continue }
  }

  if (!elements.length) return null

  const courses = elements
    .map(el => {
      const tags = el.tags || {}
      const elLat = el.lat ?? el.center?.lat
      const elLon = el.lon ?? el.center?.lon
      const addrParts = [
        tags['addr:housenumber'] && tags['addr:street']
          ? `${tags['addr:housenumber']} ${tags['addr:street']}`
          : tags['addr:street'],
        tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
        tags['addr:state'],
      ].filter(Boolean)
      return {
        id:         String(el.id),
        name:       tags.name || null,
        address:    addrParts.length ? addrParts.join(', ') : null,
        phone:      tags.phone || null,
        website:    tags.website || null,
        holes:      parseInt(tags.holes) || 18,
        par:        parseInt(tags.par)   || 72,
        access:     tags.access || 'public',
        rating:     null, price: null,
        distanceMi: elLat && elLon ? haversine(lat, lng, elLat, elLon) : null,
        lat: elLat, lon: elLon,
        source: 'openstreetmap',
      }
    })
    .filter(c => c.name)
    .filter(c => !PRIVATE_ACCESS.includes(c.access?.toLowerCase()))
    .filter(c => {
      const lower = c.name.toLowerCase()
      if (PRIVATE_KEYWORDS.some(kw => lower.includes(kw))) return false
      if (lower.endsWith(' club') && !lower.includes('golf club')) return false
      return true
    })
    .sort((a, b) => parseFloat(a.distanceMi || 999) - parseFloat(b.distanceMi || 999))
    .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)
    .slice(0, 5)

  return courses.length ? courses : null
}

/* ═══════════════════════════════════════════════════════════════
   STORYLINE GENERATOR
═══════════════════════════════════════════════════════════════ */

function buildStoryline(roundId, players, date, teeTime, city, courseName) {
  const firstNames = players.map(p => (p.name || '').split(' ')[0]).filter(Boolean)
  let names
  if (firstNames.length === 1)      names = firstNames[0]
  else if (firstNames.length === 2) names = firstNames.join(' and ')
  else names = firstNames.slice(0, -1).join(', ') + ', and ' + firstNames[firstNames.length - 1]

  let dateStr = date
  try {
    const d = new Date(date + 'T00:00:00')
    dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } catch {}

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
    ({ names, city, teeTime, course }) =>
      `${names} are heading to ${city} for a morning on the links. Tee time is ${teeTime}${course ? ` at ${course}` : ''}. May the best player win, and may everyone else at least pretend to be happy about it.`,
    ({ names, city, teeTime, course }) =>
      `${names} have officially committed to ${city}. The ${teeTime} slot is locked in${course ? ` at ${course}` : ''}. Handicaps will be questioned, mulligans will be debated, and at least one person will blame the wind.`,
    ({ names, city, date, teeTime }) =>
      `The squad is teeing off in ${city}. ${teeTime} on ${date} — no excuses, no rain checks. ${names} made it happen against all scheduling odds. That's either impressive or slightly concerning.`,
    ({ names, city, course, teeTime }) =>
      `${city} better be ready. ${names} are descending on the fairways${course ? ` of ${course}` : ''} at ${teeTime}. Birdies will be attempted. Pars will be celebrated. Bogeys will be diplomatically not mentioned.`,
    ({ names, city, course, teeTime }) =>
      `${teeTime} in ${city}${course ? ` at ${course}` : ''}. ${names} finally stopped texting and actually locked in a date. Golf will be played. Stories will be told. Scores may or may not be recorded accurately.`,
  ]

  const seed   = roundId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const opener = OPENERS[seed % OPENERS.length]
  const format = FORMATS[(seed + 3) % FORMATS.length]
  return opener + ' ' + format({ names, city, date: dateStr, teeTime, course: courseName || null })
}
