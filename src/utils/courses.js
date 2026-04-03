/**
 * TeeTimeQuest — Course Discovery
 * Uses OpenStreetMap Overpass API to find real golf courses near a city.
 * Free, no API key. Replaces mock course data.
 *
 * Flow:
 *   1. Geocode city string → lat/lng via Nominatim
 *   2. Query Overpass for golf courses within 40km
 *   3. Return normalised course objects
 */

/* ── Step 1: Geocode a city string to lat/lng ────────────────── */
async function geocodeCity(city) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&addressdetails=0`
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'TeeTimeQuest/1.0' }
  })
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`)
  const data = await res.json()
  if (!data.length) throw new Error(`City not found: ${city}`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/* ── Step 2: Query Overpass for golf courses ─────────────────── */
async function fetchCoursesNear(lat, lng, radiusMeters = 40000) {
  const query = `
[out:json][timeout:15];
(
  node["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
  relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
);
out center tags;
`.trim()

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
  })
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`)
  const data = await res.json()
  return data.elements || []
}

/* ── Step 3: Normalise OSM elements → course objects ─────────── */
function normalise(el, centerLat, centerLng) {
  const tags = el.tags || {}
  const lat  = el.lat ?? el.center?.lat
  const lon  = el.lon ?? el.center?.lon

  // Build a readable address from OSM tags
  const addrParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:town'],
    tags['addr:state'],
  ].filter(Boolean)
  const address = addrParts.length ? addrParts.join(' ') : 'See map for address'

  // Compute rough distance in miles for display
  let distanceMi = null
  if (lat && lon) {
    const R    = 3958.8
    const dLat = ((lat - centerLat) * Math.PI) / 180
    const dLon = ((lon - centerLng) * Math.PI) / 180
    const a    = Math.sin(dLat/2)**2 + Math.cos(centerLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2
    distanceMi = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1)
  }

  return {
    id:         String(el.id),
    name:       tags.name || 'Golf Course',
    address,
    phone:      tags.phone || tags['contact:phone'] || null,
    website:    tags.website || tags['contact:website'] || null,
    holes:      parseInt(tags.holes) || 18,
    par:        parseInt(tags.par)   || 72,
    access:     tags.access || 'public',
    rating:     null,   // OSM has no ratings — GolfNow will fill this
    price:      null,   // OSM has no pricing
    distanceMi,
    lat,
    lon,
    source:     'openstreetmap',
  }
}

/* ── Main export ─────────────────────────────────────────────── */

/**
 * Find golf courses near a city string.
 * Returns up to `limit` courses, sorted by distance.
 *
 * @param {string} city     — e.g. "Boston, MA"
 * @param {number} limit    — max results (default 5)
 * @returns {Promise<object[]>} normalised course objects
 */
export async function findCoursesNearCity(city, limit = 5) {
  const { lat, lng } = await geocodeCity(city)
  const elements     = await fetchCoursesNear(lat, lng)

  const courses = elements
    .map(el => normalise(el, lat, lng))
    .filter(c => c.name !== 'Golf Course' || c.address !== 'See map for address')
    // Sort closest first
    .sort((a, b) => parseFloat(a.distanceMi || 999) - parseFloat(b.distanceMi || 999))
    // Deduplicate by name
    .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)

  // If Overpass returns nothing, fall back gracefully
  if (courses.length === 0) {
    console.warn('[courses] No OSM results for', city, '— using mock data')
    return null   // caller handles fallback
  }

  return courses.slice(0, limit)
}
