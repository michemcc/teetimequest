import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import CityPicker from '../components/CityPicker'
import Footer from '../components/Footer'
import { getRound, saveAvailability } from '../utils/store'
import { getNextNDays, formatDate, groupByMonth } from '../utils/dates'
import styles from './AvailabilityPage.module.css'

const TIME_PREFS = [
  { id: 'early',     label: 'Early bird', desc: '6:00–8:00 AM'  },
  { id: 'morning',   label: 'Morning',    desc: '8:00–10:00 AM' },
  { id: 'midday',    label: 'Midday',     desc: '10:00 AM–12 PM'},
  { id: 'afternoon', label: 'Afternoon',  desc: '12:00–4:00 PM' },
]

export default function AvailabilityPage() {
  const { roundId, playerId } = useParams()
  const navigate = useNavigate()

  const [round,     setRound]     = useState(null)
  const [player,    setPlayer]    = useState(null)
  const [selected,  setSelected]  = useState(new Set())
  const [timePref,  setTimePref]  = useState(new Set(['morning']))
  const [location,  setLocation]  = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [notFound,  setNotFound]  = useState(false)

  const dates       = getNextNDays(15)
  const monthGroups = groupByMonth(dates)

  useEffect(() => {
    async function load() {
      try {
        const r = await getRound(roundId)
        if (!r) return setNotFound(true)
        const p = r.players.find(pl => pl.id === playerId)
        if (!p) return setNotFound(true)
        setRound(r)
        setPlayer(p)
        if (p.availability) {
          setSelected(new Set(p.availability.dates || []))
          const tp = p.availability.timePreferences ||
            (p.availability.timePreference ? [p.availability.timePreference] : ['morning'])
          setTimePref(new Set(tp))
          setLocation(p.availability.location || '')
          setSubmitted(true)
        }
      } catch (err) {
        console.error('Failed to load round:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [roundId, playerId])

  function toggleDate(d) {
    setSelected(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n })
  }
  function toggleTime(id) {
    setTimePref(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (selected.size === 0)  return setError("Pick at least one date you're available.")
    if (!location.trim())     return setError('Enter your starting location.')
    if (timePref.size === 0)  return setError('Choose at least one preferred tee time.')

    setSaving(true)
    try {
      const updated = await saveAvailability(roundId, playerId, {
        location: location.trim(),
        dates: [...selected],
        timePreferences: [...timePref],
      })
      setSubmitted(true)
      setRound(updated)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError('Something went wrong. Please try again.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  /* ── Loading / error states ── */
  if (loading) return (
    <div className={styles.page}>
      <Nav />
      <div className={styles.loaderWrap}>
        <div className={styles.loaderDots}><span/><span/><span/></div>
      </div>
      <Footer />
    </div>
  )

  if (notFound) return (
    <div className={styles.page}>
      <Nav />
      <div className={styles.pageInner}>
        <div className="container container--xs">
          <div className={styles.notFound}>
            <div className={styles.notFoundIcon}>⛳</div>
            <h1 className={styles.notFoundTitle}>Link not found</h1>
            <p className={styles.notFoundDesc}>This invite may be invalid or expired. Ask the organizer to resend it.</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )

  const respondedCount = round.players.filter(p => p.availability).length
  const allResponded   = respondedCount === round.players.length
  const organizer      = round.players.find(p => p.isOrganizer)

  return (
    <div className={styles.page}>
      <Nav />

      <div className={styles.pageInner}>
        <div className="container container--xs">

          {/* ── Header ── */}
          <header className={styles.header}>
            <div className={styles.eyebrow}>Invite</div>
            <h1 className={styles.title}>Hey {player.name}! 👋</h1>
            <p className={styles.subtitle}>
              <strong>{organizer?.name}</strong> is planning a round near <strong>{round.city}</strong>.
              Mark your availability below.
            </p>
            <div className={styles.progressRow}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${(respondedCount / round.players.length) * 100}%` }}/>
              </div>
              <span className={styles.progressLabel}>{respondedCount}/{round.players.length} responded</span>
            </div>
          </header>

          {/* ── Success banner ── */}
          {submitted && (
            <div className={styles.successCard}>
              <div className={styles.successCheck}>✓</div>
              <div className={styles.successBody}>
                <p className={styles.successTitle}>You're in!</p>
                <p className={styles.successDesc}>
                  {allResponded
                    ? 'Everyone responded, results are ready.'
                    : "We'll notify you when the tee time is confirmed."}
                </p>
              </div>
              {allResponded && (
                <button className={styles.resultsBtn} onClick={() => navigate(`/results/${roundId}`)}>
                  View results →
                </button>
              )}
            </div>
          )}

          {/* ── Form ── */}
          {!submitted && (
            <form className={styles.form} onSubmit={handleSubmit} noValidate>

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardNum}>01</span>
                  <span className={styles.cardTitle}>Your location</span>
                </div>
                <CityPicker value={location} onChange={setLocation} placeholder="City or ZIP code (e.g. Cambridge, MA)" />
                <p className={styles.hint}>Helps find courses central to everyone.</p>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardNum}>02</span>
                  <span className={styles.cardTitle}>Your available dates</span>
                  {selected.size > 0 && <span className={styles.badge}>{selected.size} selected</span>}
                </div>
                <p className={styles.hint} style={{marginBottom:'1rem'}}>Tap every day you could make it.</p>
                {Object.entries(monthGroups).map(([month, mdates]) => (
                  <div key={month} className={styles.monthGroup}>
                    <p className={styles.monthLabel}>{month}</p>
                    <div className={styles.dateGrid}>
                      {mdates.map(d => (
                        <button key={d} type="button"
                          className={`${styles.dateBtn} ${selected.has(d) ? styles.dateBtnOn : ''}`}
                          onClick={() => toggleDate(d)} aria-pressed={selected.has(d)}>
                          {formatDate(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardNum}>03</span>
                  <span className={styles.cardTitle}>Preferred tee times</span>
                </div>
                <p className={styles.hint} style={{marginBottom:'0.9rem'}}>Select all windows that work for you.</p>
                <div className={styles.timeGrid}>
                  {TIME_PREFS.map(t => (
                    <button key={t.id} type="button"
                      className={`${styles.timeBtn} ${timePref.has(t.id) ? styles.timeBtnOn : ''}`}
                      onClick={() => toggleTime(t.id)} aria-pressed={timePref.has(t.id)}>
                      <span className={styles.timeBtnLabel}>{t.label}</span>
                      <span className={styles.timeBtnDesc}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className={styles.error} role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" className={styles.submit} disabled={saving}>
                {saving ? (
                  <><span className={styles.submitSpinner}/>Saving…</>
                ) : (
                  <>Submit my availability
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </>
                )}
              </button>

            </form>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
