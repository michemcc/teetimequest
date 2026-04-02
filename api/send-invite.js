/**
 * TeeTimeQuest — Brevo invite email
 * Vercel Serverless Function: POST /api/send-invite
 *
 * ── Setup checklist before this works ──────────────────────────────────
 *
 * 1. BREVO_API_KEY set in Vercel → Settings → Environment Variables
 *    (get it from: app.brevo.com → Account → SMTP & API → API Keys)
 *
 * 2. Sender email verified in Brevo:
 *    app.brevo.com → Senders & IPs → Senders → Add a sender
 *    Then update the sender.email value below to match.
 *
 * 3. Deploy to Vercel (or run `vercel dev` locally)
 *    `npm run dev` alone will NOT run this function.
 *
 * ── POST body ───────────────────────────────────────────────────────────
 *   { playerEmail, playerName, inviteLink, organizerName, roundCity }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { playerEmail, playerName, inviteLink, organizerName, roundCity } = req.body || {}

  if (!playerEmail || !inviteLink || !organizerName) {
    return res.status(400).json({ error: 'Missing required fields: playerEmail, inviteLink, organizerName' })
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY
  if (!BREVO_API_KEY) {
    console.error('[send-invite] BREVO_API_KEY env var is not set')
    return res.status(500).json({
      error: 'Email not configured',
      hint:  'Add BREVO_API_KEY to Vercel → Settings → Environment Variables, then redeploy.',
    })
  }

  // ── Update this to your verified Brevo sender email ──
  const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@teetimequest.com'
  const SENDER_NAME  = 'TeeTimeQuest'

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept':       'application/json',
        'api-key':      BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: playerEmail, name: playerName || playerEmail.split('@')[0] }],
        subject: `⛳ ${organizerName} invited you to a golf round`,
        htmlContent: buildHTML({ playerName, organizerName, roundCity, inviteLink }),
        textContent: buildText({ playerName, organizerName, roundCity, inviteLink }),
      }),
    })

    const brevoData = await response.json()

    if (!response.ok) {
      console.error('[send-invite] Brevo error:', brevoData)
      return res.status(502).json({
        error:   'Brevo API error',
        details: brevoData,
        hint:    brevoData?.message?.includes('sender')
          ? 'Verify your sender email in Brevo: app.brevo.com → Senders & IPs → Senders'
          : undefined,
      })
    }

    console.info(`[send-invite] ✓ Sent to ${playerEmail} (messageId: ${brevoData.messageId})`)
    return res.status(200).json({ ok: true, messageId: brevoData.messageId })

  } catch (err) {
    console.error('[send-invite] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error', message: err.message })
  }
}

/* ── HTML email ─────────────────────────────────────────────────────── */
function buildHTML({ playerName, organizerName, roundCity, inviteLink }) {
  const first = playerName ? playerName.split(' ')[0] : 'there'
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#fdfcf7;font-family:'Outfit',system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fdfcf7;padding:40px 16px;">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

    <tr><td style="background:#142a16;border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.12em;text-transform:uppercase;font-family:monospace;">TeeTimeQuest</p>
      <p style="margin:8px 0 0;font-size:28px;">⛳</p>
    </td></tr>

    <tr><td style="background:#ffffff;padding:36px;border-left:1px solid #e8e4d8;border-right:1px solid #e8e4d8;">
      <h1 style="margin:0 0 12px;font-size:24px;font-weight:400;color:#1a1610;line-height:1.2;">
        Hey ${first},
      </h1>
      <p style="margin:0 0 18px;font-size:15px;color:#5c5748;line-height:1.7;">
        <strong style="color:#1a1610;">${organizerName}</strong> is organizing a golf round${roundCity ? ` near <strong style="color:#1a1610;">${roundCity}</strong>` : ''} and wants to know when you're free.
      </p>
      <p style="margin:0 0 28px;font-size:14px;color:#5c5748;line-height:1.7;">
        Tap below to mark your available dates and preferred tee time. Takes about 30 seconds.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#366840;border-radius:6px;">
          <a href="${inviteLink}" style="display:inline-block;padding:14px 28px;color:#fdfcf7;text-decoration:none;font-size:12px;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;font-weight:500;">
            Mark my availability →
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#a09a8e;">
        Or copy: <a href="${inviteLink}" style="color:#366840;word-break:break-all;">${inviteLink}</a>
      </p>
    </td></tr>

    <tr><td style="background:#f5f1e6;border:1px solid #e8e4d8;border-top:none;border-radius:0 0 12px 12px;padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a09a8e;font-family:monospace;">
        Sent by TeeTimeQuest &middot; <a href="https://teetimequest.com" style="color:#a09a8e;">teetimequest.com</a>
      </p>
      <p style="margin:5px 0 0;font-size:10px;color:#c5c0b4;font-family:monospace;">
        You received this because ${organizerName} added your email to a round.
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`
}

/* ── Plain text fallback ─────────────────────────────────────────── */
function buildText({ playerName, organizerName, roundCity, inviteLink }) {
  const first = playerName ? playerName.split(' ')[0] : 'there'
  return [
    `Hey ${first},`,
    '',
    `${organizerName} is organizing a golf round${roundCity ? ` near ${roundCity}` : ''} and wants to know when you're free.`,
    '',
    'Mark your availability here (takes ~30 seconds):',
    inviteLink,
    '',
    '— TeeTimeQuest · https://teetimequest.com',
  ].join('\n')
}
