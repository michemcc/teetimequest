import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import { getRound, saveAvailability } from '../utils/store'
import { getNextNDays, formatDate, groupByMonth } from '../utils/dates'
import styles from './AvailabilityPage.module.css'

const TIME_PREFS = [
  { id: 'early',     label: 'Early bird',  desc: '7:00–7:30 AM' },
  { id: 'morning',   label: 'Morning',     desc: '8:00–9:30 AM' },
  { id: 'midday',    label: 'Midday',      desc: '10 AM–12 PM' },
  { id: 'afternoon', label: 'Afternoon',   desc: '1:00–4:00 PM' },
]

export default function AvailabilityPage() {
  const { roundId, playerId } = useParams()
  const navigate = useNavigate()
  const [round, setRound] = useState(null)
  const [player, setPlayer] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [timePref, setTimePref] = useState('morning')
  const [location, setLocation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const dates = getNextNDays(28)
  const monthGroups = groupByMonth(dates)

  useEffect(() => {
    const r = getRound(roundId)
    if (!r) return setNotFound(true)
    const p = r.players.find(pl => pl.id === playerId)
    if (!p) return setNotFound(true)
    setRound(r); setPlayer(p)
    if (p.availability) {
      setSelected(new Set(p.availability.dates || []))
      setTimePref(p.availability.timePreference || 'morning')
      setLocation(p.availability.location || '')
      setSubmitted(true)
    }
  }, [roundId, playerId])

  function toggle(d) {
    setSelected(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n })
  }

  function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (selected.size === 0) return setError('Pick at least one available date.')
    if (!location.trim()) return setError('Enter your starting location.')
    try {
      const updated = saveAvailability(roundId, playerId, { dates: [...selected], timePreference: timePref, location: location.trim() })
      setSubmitted(true); setRound(updated)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setError('Something went wrong. Please try again.') }
  }

  if (notFound) return (
    <div className={styles.page}><Nav />
      <div className={`container container--xs ${styles.content}`}>
        <div className={styles.notFound}>
          <div className={styles.notFoundIcon}>⛳</div>
          <h1>Link not found</h1>
          <p>This invite may be invalid. Ask the organizer to resend it.</p>
        </div>
      </div>
    </div>
  )

  if (!round || !player) return (
    <div className={styles.page}><Nav />
      <div className={styles.loader}><div className={styles.loaderDots}><span/><span/><span/></div></div>
    </div>
  )

  const respondedCount = round.players.filter(p => p.availability).length
  const allResponded = respondedCount === round.players.length
  const organizer = round.players.find(p => p.isOrganizer)

  return (
    <div className={styles.page}>
      <Nav />
      <div className={`container container--xs ${styles.content}`}>
        <div className={styles.header}>
          <div className={styles.headerChip}>Invite</div>
          <h1 className={styles.title}>Hey {player.name}! 👋</h1>
          <p className={styles.subtitle}>
            <strong>{organizer?.name}</strong> is planning a round near <strong>{round.city}</strong>.
            Mark your availability below.
          </p>
          <div className={styles.progress}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${(respondedCount / round.players.length) * 100}%` }} />
            </div>
            <span className={styles.progressLabel}>{respondedCount}/{round.players.length} responded</span>
          </div>
        </div>

        {submitted && (
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successContent}>
              <p className={styles.successTitle}>You're in!</p>
              <p className={styles.successDesc}>
                {allResponded ? 'Everyone responded — the results are ready.' : "We'll notify you when the tee time is set."}
              </p>
            </div>
            {allResponded && (
              <button className={styles.resultsBtn} onClick={() => navigate(`/results/${roundId}`)}>
                View results →
              </button>
            )}
          </div>
        )}

        {!submitted && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>

            <div className={styles.card}>
              <div className={styles.cardLabel}>Your location</div>
              <input className={styles.input} type="text" placeholder="City or ZIP code (e.g. Cambridge, MA)"
                value={location} onChange={e => setLocation(e.target.value)} />
              <p className={styles.hint}>Helps us find courses near everyone.</p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardLabelRow}>
                <span className={styles.cardLabel}>Available dates</span>
                {selected.size > 0 && <span className={styles.badge}>{selected.size} selected</span>}
              </div>
              <p className={styles.hint} style={{marginBottom:'1rem'}}>Tap every day you could make it.</p>

              {Object.entries(monthGroups).map(([month, mdates]) => (
                <div key={month} className={styles.monthGroup}>
                  <p className={styles.monthLabel}>{month}</p>
                  <div className={styles.dateGrid}>
                    {mdates.map(d => (
                      <button key={d} type="button"
                        className={`${styles.dateBtn} ${selected.has(d) ? styles.dateBtnActive : ''}`}
                        onClick={() => toggle(d)} aria-pressed={selected.has(d)}>
                        {formatDate(d)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <div className={styles.cardLabel}>Preferred tee time</div>
              <div className={styles.timeGrid}>
                {TIME_PREFS.map(t => (
                  <button key={t.id} type="button"
                    className={`${styles.timeBtn} ${timePref === t.id ? styles.timeBtnActive : ''}`}
                    onClick={() => setTimePref(t.id)} aria-pressed={timePref === t.id}>
                    <span className={styles.timeBtnLabel}>{t.label}</span>
                    <span className={styles.timeBtnDesc}>{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.submit}>
              Submit my availability
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
