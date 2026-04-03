/**
 * TeeTimeQuest — Course Discovery
 *
 * Geocodes player locations via Nominatim, computes the geographic
 * midpoint, then fetches real golf courses via our /api/courses proxy
 * (which calls OpenStreetMap Overpass server-side to avoid CORS issues).
 *
 * Falls back to direct Overpass if the proxy isn't available (local dev).
 */

/* ── Geocode a location string → { lat, lng } ──────────────── */
async function geocodeLocation(location) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&addressdetails=0`
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'TeeTimeQuest/1.0 (teetimequest.com)',
    },
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${location}"`)
  const data = await res.json()
  if (!data.length) throw new Error(`Location not found: "${location}"`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/* ── Geographic midpoint (Cartesian average method) ────────── */
function midpoint(points) {
  if (points.length === 0) throw new Error('No points')
  if (points.length === 1) return points[0]
  let x = 0, y = 0, z = 0
  for (const { lat, lng } of points) {
    const la = (lat * Math.PI) / 180
    const lo = (lng * Math.PI) / 180
    x += Math.cos(la) * Math.cos(lo)
    y += Math.cos(la) * Math.sin(lo)
    z += Math.sin(la)
  }
  x /= points.length; y /= points.length; z /= points.length
  return {
    lat: ((Math.atan2(z, Math.sqrt(x * x + y * y))) * 180) / Math.PI,
    lng: ((Math.atan2(y, x)) * 180) / Math.PI,
  }
}

/* ── Haversine distance in miles ────────────────────────────── */
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R    = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
}

/* ── Fetch courses via proxy (production) or direct (dev) ───── */
async function fetchCoursesNear(lat, lng, radiusMeters = 50000) {
  // In production use the /api/courses proxy to avoid CORS + rate limits
  // In local dev (no /api/), fall back to direct Overpass
  let elements = null

  // Try proxy first
  try {
    const proxyUrl = `/api/courses?lat=${lat}&lng=${lng}&radius=${radiusMeters}`
    const res = await fetch(proxyUrl)
    if (res.ok) {
      const data = await res.json()
      elements = data.elements || []
      console.info(`[courses] Proxy returned ${elements.length} elements`)
      return elements
    }
  } catch {
    // proxy not available (local npm run dev) — fall through to direct
  }

  // Direct Overpass fallback (local dev only)
  console.info('[courses] Proxy unavailable, trying direct Overpass...')
  const query = `[out:json][timeout:20];
(
  node["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
);
out center tags;`

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) continue
      const data = await res.json()
      elements = data.elements || []
      console.info(`[courses] Direct Overpass (${endpoint}) returned ${elements.length} elements`)
      return elements
    } catch {
      continue
    }
  }

  throw new Error('All course fetch methods failed')
}

/* ── Normalise OSM element → course object ──────────────────── */
function normalise(el, centerLat, centerLng) {
  const tags = el.tags || {}
  const lat  = el.lat ?? el.center?.lat
  const lon  = el.lon ?? el.center?.lon

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
    phone:      tags.phone || tags['contact:phone'] || null,
    website:    tags.website || tags['contact:website'] || null,
    holes:      parseInt(tags.holes) || 18,
    par:        parseInt(tags.par)   || 72,
    access:     tags.access || 'public',
    rating:     null,
    price:      null,
    distanceMi: (lat && lon) ? distanceMiles(centerLat, centerLng, lat, lon) : null,
    lat,
    lon,
    source:     'openstreetmap',
  }
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT

   Geocodes each player's location, finds the geographic midpoint,
   and returns real golf courses near that midpoint.
══════════════════════════════════════════════════════════════ */
export async function findCoursesNearPlayers(players, fallbackCity, limit = 5) {
  // Collect unique player locations
  const locations = [...new Set(
    players.map(p => p.availability?.location).filter(Boolean)
  )]
  if (!locations.length && fallbackCity) locations.push(fallbackCity)
  if (!locations.length) return null

  // Geocode all locations
  let coords
  try {
    coords = await Promise.all(locations.map(geocodeLocation))
    console.info(`[courses] Geocoded: ${locations.join(' | ')}`)
  } catch (err) {
    console.warn('[courses] Geocoding failed:', err.message)
    // Try just the fallback city
    try {
      coords = [await geocodeLocation(fallbackCity)]
    } catch {
      return null
    }
  }

  // Compute midpoint
  const center = midpoint(coords)
  console.info(`[courses] Midpoint: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`)

  // Fetch courses
  let elements
  try {
    elements = await fetchCoursesNear(center.lat, center.lng)
  } catch (err) {
    console.warn('[courses] Fetch failed:', err.message)
    return null
  }

  if (!elements.length) return null

  const courses = elements
    .map(el => normalise(el, center.lat, center.lng))
    .filter(c => c.name)                                                    // must have a name
    .sort((a, b) => parseFloat(a.distanceMi ?? 999) - parseFloat(b.distanceMi ?? 999))
    .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)    // deduplicate

  console.info(`[courses] ${courses.length} named courses found`)
  return courses.length ? courses.slice(0, limit) : null
}

// Legacy compat
export async function findCoursesNearCity(city, limit = 5) {
  return findCoursesNearPlayers([], city, limit)
}
