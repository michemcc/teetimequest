/**
 * TeeTimeQuest — Daily round cleanup
 * Vercel Cron Job: runs at 4:00 AM UTC every day
 *
 * This calls the Supabase cleanup_old_rounds() function,
 * which deletes rounds the day after their tee date,
 * and stale collecting rounds older than 30 days.
 *
 * Uses the SERVICE_ROLE key (server-side only) so it can
 * bypass RLS and delete without restriction.
 *
 * Setup:
 *  1. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars (see below)
 *  2. Add the cron schedule to vercel.json (see CLEANUP_AUTOMATION.md)
 *  3. Deploy — Vercel runs this automatically
 */

export default async function handler(req, res) {
  // Only allow GET (Vercel cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Optional: protect with a secret so only Vercel can call this
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl     = process.env.VITE_SUPABASE_URL
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[cleanup] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  try {
    // Call the cleanup_old_rounds() SQL function via Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_old_rounds`, {
      method: 'POST',
      headers: {
        'apikey':        serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[cleanup] Supabase error:', error)
      return res.status(502).json({ error: 'Supabase call failed', details: error })
    }

    const result = await response.json()
    console.info('[cleanup] ✓ Cleanup complete:', result)

    return res.status(200).json({
      ok:  true,
      ...result,
    })

  } catch (err) {
    console.error('[cleanup] Unexpected error:', err)
    return res.status(500).json({ error: err.message })
  }
}
