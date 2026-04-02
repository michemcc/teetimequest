/**
 * TeeTimeQuest — invite email sender
 * Calls the Vercel serverless function at /api/send-invite.
 *
 * ⚠️  IMPORTANT — When does this actually send?
 *
 *   ✅ In production (deployed to Vercel): works automatically once
 *      BREVO_API_KEY is set in Vercel → Settings → Environment Variables.
 *
 *   ✅ Locally with `vercel dev`: works (Vercel CLI runs the /api/ functions).
 *
 *   ❌ Locally with `npm run dev` (Vite only): DOES NOT send.
 *      Vite doesn't run the /api/ folder. The fetch to /api/send-invite will
 *      get a 404, which is caught and logged as a warning — the round still
 *      creates successfully, you just won't receive the email in local dev.
 *
 * To test emails locally:
 *   npm install -g vercel
 *   vercel dev          ← runs both Vite frontend + /api/ functions together
 *
 * @param {object} round   — full round object from createRound()
 * @param {string} baseUrl — window.location.origin
 * @returns {Promise<{ sent, failed, total, errors }>}
 */
export async function sendInviteEmails(round, baseUrl) {
  const organizer = round.players.find(p => p.isOrganizer)
  const others    = round.players.filter(p => !p.isOrganizer)

  if (others.length === 0) {
    console.info('[email] No players to invite (organizer only)')
    return { sent: 0, failed: 0, total: 0, errors: [] }
  }

  const results = await Promise.allSettled(
    others.map(async (player) => {
      const res = await fetch('/api/send-invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerEmail:   player.email,
          playerName:    player.name,
          inviteLink:    `${baseUrl}/availability/${round.id}/${player.id}`,
          organizerName: organizer?.name || 'Someone',
          roundCity:     round.city,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // 404 = running with npm run dev (no /api/ support) — not a real error
        if (res.status === 404) {
          console.warn(
            '[email] /api/send-invite returned 404. ' +
            'Emails only work in production or with `vercel dev`. ' +
            'This is expected when using `npm run dev`.'
          )
          return { skipped: true }
        }
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      return res.json()
    })
  )

  const errors  = results.filter(r => r.status === 'rejected').map(r => r.reason?.message)
  const skipped = results.filter(r => r.value?.skipped).length
  const sent    = results.filter(r => r.status === 'fulfilled' && !r.value?.skipped).length
  const failed  = errors.length

  if (skipped > 0) {
    console.info(`[email] ${skipped} invite(s) skipped — running in Vite-only mode. Use vercel dev to test emails locally.`)
  }
  if (failed > 0) {
    console.warn(`[email] ${failed} invite(s) failed:`, errors)
  }
  if (sent > 0) {
    console.info(`[email] ${sent} invite(s) sent via Brevo ✓`)
  }

  return { sent, failed, skipped, total: others.length, errors }
}
