/**
 * TeeTimeQuest — Overpass API proxy
 * GET /api/courses?lat=42.20&lng=-71.23&radius=50000
 *
 * Why a proxy?
 *   - Overpass-api.de occasionally has CORS issues with browser POSTs
 *   - Running from a server IP avoids shared browser rate-limits
 *   - We can cache results and add our own timeout handling
 *   - No API key needed — Overpass is free
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { lat, lng, radius = '50000' } = req.query

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const latN   = parseFloat(lat)
  const lngN   = parseFloat(lng)
  const radN   = Math.min(parseInt(radius), 80000) // cap at 80km

  if (isNaN(latN) || isNaN(lngN)) {
    return res.status(400).json({ error: 'Invalid lat/lng' })
  }

  const query = `[out:json][timeout:25];
(
  node["leisure"="golf_course"](around:${radN},${latN},${lngN});
  way["leisure"="golf_course"](around:${radN},${latN},${lngN});
  relation["leisure"="golf_course"](around:${radN},${latN},${lngN});
);
out center tags;`

  // Try multiple Overpass instances in order
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ]

  let lastError = null

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
        signal:  AbortSignal.timeout(28000),
      })

      if (!response.ok) {
        lastError = `${endpoint} returned ${response.status}`
        continue
      }

      const data = await response.json()
      const elements = data.elements || []

      // Cache for 6 hours — courses don't change often
      res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600')
      return res.status(200).json({ elements, source: endpoint, count: elements.length })

    } catch (err) {
      lastError = `${endpoint}: ${err.message}`
      console.warn('[courses proxy] endpoint failed:', lastError)
      continue
    }
  }

  console.error('[courses proxy] All endpoints failed. Last error:', lastError)
  return res.status(502).json({ error: 'All Overpass endpoints failed', detail: lastError })
}
