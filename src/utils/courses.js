/**
 * TeeTimeQuest — Course Discovery
 * Uses OpenStreetMap Overpass API to find real golf courses.
 * Free, no API key required.
 *
 * Flow:
 *   1. Geocode each player's location via Nominatim
 *   2. Compute geographic midpoint of all player locations
 *   3. Query Overpass for golf courses within 50km of that midpoint
 *   4. Return normalised course objects sorted by distance to midpoint
 */

/* ── Geocode a single city/location string → { lat, lng } ─── */
async function geocodeLocation(location) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&addressdetails=0`
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'TeeTimeQuest/1.0 (teetimequest.com)' },
  })
  if (!res.ok) throw new Error(`Nominatim error ${res.status} for "${location}"`)
  const data = await res.json()
  if (!data.length) throw new Error(`Location not found: "${location}"`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/* ── Compute geographic midpoint from array of { lat, lng } ── */
function midpoint(points) {
  if (points.length === 0) throw new Error('No points to midpoint')
  if (points.length === 1) return points[0]

  // Convert to Cartesian, average, convert back
  let x = 0, y = 0, z = 0
  for (const { lat, lng } of points) {
    const la = (lat * Math.PI) / 180
    const lo = (lng * Math.PI) / 180
    x += Math.cos(la) * Math.cos(lo)
    y += Math.cos(la) * Math.sin(lo)
    z += Math.sin(la)
  }
  const n = points.length
  x /= n; y /= n; z /= n
  const lon = Math.atan2(y, x)
  const hyp = Math.sqrt(x * x + y * y)
  const lat = Math.atan2(z, hyp)
  return {
    lat: (lat * 180) / Math.PI,
    lng: (lon * 180) / Math.PI,
  }
}

/* ── Haversine distance in miles ─────────────────────────── */
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

/* ── Query Overpass for golf courses near a point ─────────── */
async function fetchCoursesNear(lat, lng, radiusMeters = 50000) {
  // Overpass QL — fetch nodes, ways, relations tagged as golf courses
  const query = `[out:json][timeout:20];
(
  node["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
);
out center tags;`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) throw new Error(`Overpass error ${res.status}`)
  const data = await res.json()
  return data.elements || []
}

/* ── Normalise OSM element → course object ───────────────── */
function normalise(el, centerLat, centerLng) {
  const tags = el.tags || {}
  const lat  = el.lat ?? el.center?.lat
  const lon  = el.lon ?? el.center?.lon

  // Address — try tagged fields first, fall back to city/state only
  const addrParts = [
    tags['addr:housenumber'] && tags['addr:street']
      ? `${tags['addr:housenumber']} ${tags['addr:street']}`
      : tags['addr:street'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:state'],
  ].filter(Boolean)
  const address = addrParts.length ? addrParts.join(', ') : null

  return {
    id:         String(el.id),
    name:       tags.name || null,
    address,
    phone:      tags.phone || tags['contact:phone'] || null,
    website:    tags.website || tags['contact:website'] || null,
    holes:      parseInt(tags.holes) || 18,
    par:        parseInt(tags.par)   || 72,
    access:     tags.access  || 'public',
    rating:     null,
    price:      null,
    distanceMi: (lat && lon) ? distanceMiles(centerLat, centerLng, lat, lon) : null,
    lat,
    lon,
    source:     'openstreetmap',
  }
}

/* ════════════════════════════════════════════════════════════
   MAIN EXPORT
   
   findCoursesNearPlayers(players, fallbackCity, limit)
   
   players  — array of player objects with availability.location
   fallbackCity — round.city, used if player locations unavailable
   limit    — max courses to return (default 5)
   
   Geocodes each player's location, computes the midpoint,
   then finds real courses near that midpoint.
════════════════════════════════════════════════════════════ */
export async function findCoursesNearPlayers(players, fallbackCity, limit = 5) {
  // Collect locations submitted by players
  const locations = players
    .map(p => p.availability?.location)
    .filter(Boolean)

  // If no player locations, use the round city
  if (locations.length === 0 && fallbackCity) {
    locations.push(fallbackCity)
  }
  if (locations.length === 0) {
    console.warn('[courses] No locations available for course search')
    return null
  }

  // Geocode all locations in parallel
  let coords
  try {
    coords = await Promise.all(locations.map(geocodeLocation))
    console.info(`[courses] Geocoded ${coords.length} player location(s)`)
  } catch (err) {
    console.warn('[courses] Geocoding failed:', err.message)
    // Try just the fallback city
    try {
      const fb = await geocodeLocation(fallbackCity)
      coords = [fb]
    } catch {
      return null
    }
  }

  // Compute the geographic midpoint
  const center = midpoint(coords)
  console.info(`[courses] Midpoint: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`)

  // Fetch real courses near that midpoint
  let elements
  try {
    elements = await fetchCoursesNear(center.lat, center.lng)
    console.info(`[courses] Overpass returned ${elements.length} elements`)
  } catch (err) {
    console.warn('[courses] Overpass failed:', err.message)
    return null
  }

  if (!elements.length) {
    console.warn('[courses] No courses found near midpoint')
    return null
  }

  const courses = elements
    .map(el => normalise(el, center.lat, center.lng))
    // Keep only named courses
    .filter(c => c.name)
    // Sort by distance to midpoint
    .sort((a, b) => parseFloat(a.distanceMi ?? 999) - parseFloat(b.distanceMi ?? 999))
    // Deduplicate by name
    .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)

  console.info(`[courses] ${courses.length} named courses after filter`)
  return courses.length ? courses.slice(0, limit) : null
}

/* Legacy export for backward compat — just uses fallback city */
export async function findCoursesNearCity(city, limit = 5) {
  return findCoursesNearPlayers([], city, limit)
}
