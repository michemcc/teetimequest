import { useState } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './InfoPage.module.css'

/**
 * Contact form — powered by Formspree (free tier: 50 submissions/month).
 *
 * Setup (one-time, 2 minutes):
 *  1. Go to https://formspree.io and sign up (free)
 *  2. Click "New Form" → give it a name → copy your Form ID (looks like "xpzvwqab")
 *  3. ✅ Done — ID is already set to 'mojpnkyn'
 *  4. Verify your email when Formspree sends you a confirmation
 *  Done — submissions land in your inbox and Formspree dashboard.
 *
 * The form uses Formspree's AJAX endpoint so the page doesn't redirect.
 */
const FORMSPREE_ID = 'mojpnkyn' // ← replace this

export default function ContactPage() {
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [form,    setForm]    = useState({ name: '', email: '', message: '' })

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim())    return setError('Please enter your name.')
    if (!form.email.includes('@')) return setError('Please enter a valid email.')
    if (!form.message.trim()) return setError('Please enter a message.')

    // If the Formspree ID hasn't been set yet, show a friendly dev note
    if (!FORMSPREE_ID || FORMSPREE_ID === 'YOUR_FORMSPREE_ID') {
      setError('Contact form not yet configured. See ContactPage.jsx for setup instructions.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ name: form.name, email: form.email, message: form.message }),
      })

      const data = await res.json()

      if (res.ok) {
        setSent(true)
      } else {
        // Formspree returns { errors: [{ message }] } on failure
        const msg = data?.errors?.[0]?.message || 'Something went wrong. Please try again.'
        setError(msg)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Nav />
      <div className={`container container--narrow ${styles.content}`}>

        <div className={styles.hero}>
          <div className={styles.chip}>Contact</div>
          <h1 className={styles.title}>Get in touch.</h1>
          <p className={styles.lead}>
            Bug report, feature idea, or just want to say hi — we'd love to hear from you.
          </p>
        </div>

        {sent ? (
          <div className={styles.successCard}>
            <span className={styles.successIcon}>✓</span>
            <div>
              <p className={styles.successTitle}>Message sent!</p>
              <p className={styles.successDesc}>
                Thanks for reaching out. We'll get back to you soon.
              </p>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="c-name">Name</label>
                <input
                  id="c-name"
                  className={styles.input}
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={update('name')}
                  disabled={loading}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="c-email">Email</label>
                <input
                  id="c-email"
                  className={styles.input}
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={update('email')}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="c-msg">Message</label>
              <textarea
                id="c-msg"
                className={styles.textarea}
                rows={5}
                placeholder="What's on your mind?"
                value={form.message}
                onChange={update('message')}
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className={styles.formError} role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <><span className={styles.submitSpinner}/> Sending…</>
              ) : (
                'Send message →'
              )}
            </button>

          </form>
        )}

        <div className={styles.altContact}>
          <p className={styles.altContactText}>Prefer email directly?</p>
          <a href="mailto:hello@teetimequest.com" className={styles.inlineLink}>
            hello@teetimequest.com
          </a>
        </div>

      </div>
      <Footer />
    </div>
  )
}
