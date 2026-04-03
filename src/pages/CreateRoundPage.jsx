import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import CityPicker from '../components/CityPicker'
import { createRound } from '../utils/store'
import { sendInviteEmails } from '../utils/email'
import { getNextNDays, formatDate, groupByMonth } from '../utils/dates'
import styles from './CreateRoundPage.module.css'

const MAX_OTHERS = 7

const TIME_PREFS = [
  { id: 'early',     label: 'Early bird', desc: '7:00–7:30 AM' },
  { id: 'morning',   label: 'Morning',    desc: '8:00–9:30 AM' },
  { id: 'midday',    label: 'Midday',     desc: '10 AM–12 PM'  },
  { id: 'afternoon', label: 'Afternoon',  desc: '1:00–4:00 PM' },
]

export default function CreateRoundPage() {
  const navigate = useNavigate()

  const [organizer, setOrganizer] = useState({ name: '', email: '' })
  const [city,      setCity]      = useState('')
  const [players,   setPlayers]   = useState([''])
  const [selectedDates, setSelectedDates] = useState(new Set())
  const [timePref,  setTimePref]  = useState(new Set(['morning']))
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  const dates       = getNextNDays(15)
  const monthGroups = groupByMonth(dates)

  function updatePlayer(i, v) { const n = [...players]; n[i] = v; setPlayers(n) }
  function addPlayer()   { if (players.length < MAX_OTHERS) setPlayers([...players, '']) }
  function removePlayer(i) { if (players.length > 1) setPlayers(players.filter((_, j) => j !== i)) }

  function toggleDate(d) {
    setSelectedDates(p => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n })
  }
  function toggleTime(id) {
    setTimePref(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!organizer.name.trim())    return setError('Enter your name.')
    if (!organizer.email.includes('@')) return setError('Enter a valid email.')
    if (!city.trim())              return setError('Enter a city or region.')
    const valid = players.filter(p => p.trim())
    if (valid.length < 1)          return setError('Add at least one other player.')
    for (const em of valid) if (!em.includes('@')) return setError(`"${em}" doesn't look like a valid email.`)
    if (selectedDates.size === 0)  return setError("Mark at least one date you're available.")
    if (timePref.size === 0)       return setError('Choose at least one preferred tee time.')

    setLoading(true)
    try {
      const round = await createRound({
        organizerName:  organizer.name.trim(),
        organizerEmail: organizer.email.trim(),
        playerEmails:   valid,
        city:           city.trim(),
        organizerAvailability: {
          location: city.trim(),
          dates:    [...selectedDates],
          timePreferences: [...timePref],
        },
      })
      sendInviteEmails(round, window.location.origin).catch(err =>
        console.warn('Invite emails failed silently:', err)
      )
      navigate(`/results/${round.id}?new=1`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const totalPlayers = 1 + players.filter(p => p.trim()).length

  const StepRail = ({ num, icon }) => (
    <div className={styles.stepRail}>
      <div className={styles.stepBadge}>{num}</div>
      <span className={styles.stepIcon}>{icon}</span>
    </div>
  )

  return (
    <div className={styles.page}>
      <Nav />
      <div className={styles.pageInner}>
        <div className="container container--xs">

          <header className={styles.header}>
            <div className={styles.headerMeta}>
              <span className={styles.headerBadge}>New round</span>
            </div>
            <h1 className={styles.title}>Set up your group</h1>
            <p className={styles.subtitle}>
              Works for 2–8 players. Each person gets a private invite link — no account needed.
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>

            {/* ── Step 1: Your info ── */}
            <div className={styles.card}>
              <StepRail num="1" icon="👤" />
              <div className={styles.cardContent}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>Your info</span>
                </div>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="org-name">Name</label>
                    <input id="org-name" className={styles.input} type="text"
                      placeholder="Your name" autoComplete="name"
                      value={organizer.name} onChange={e => setOrganizer(o => ({ ...o, name: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="org-email">Email</label>
                    <input id="org-email" className={styles.input} type="email"
                      placeholder="you@example.com" autoComplete="email"
                      value={organizer.email} onChange={e => setOrganizer(o => ({ ...o, email: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Step 2: Location ── */}
            <div className={styles.card}>
              <StepRail num="2" icon="📍" />
              <div className={styles.cardContent}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>General area</span>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="city">City or region</label>
                  <CityPicker id="city" value={city} onChange={setCity}
                    placeholder="e.g. Boston, MA or Scottsdale, AZ" />
                  <p className={styles.hint}>We find public courses central to everyone's location.</p>
                </div>
              </div>
            </div>

            {/* ── Step 3: Other players ── */}
            <div className={styles.card}>
              <StepRail num="3" icon="👥" />
              <div className={styles.cardContent}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>Other players</span>
                  <span className={styles.playerBadge}>{totalPlayers} / 8</span>
                </div>
                <p className={styles.cardDesc}>Each person receives a unique invite link.</p>
                <div className={styles.playerList}>
                  {players.map((email, i) => (
                    <div key={i} className={styles.playerRow}>
                      <span className={styles.playerNum}>{i + 2}</span>
                      <input className={styles.input} type="email"
                        placeholder={`player${i + 2}@example.com`}
                        value={email} onChange={e => updatePlayer(i, e.target.value)}
                        aria-label={`Player ${i + 2} email`} />
                      {players.length > 1 && (
                        <button type="button" className={styles.removeBtn} onClick={() => removePlayer(i)} aria-label="Remove">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {players.length < MAX_OTHERS
                  ? <button type="button" className={styles.addBtn} onClick={addPlayer}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                      Add another player
                    </button>
                  : <p className={styles.maxNote}>Maximum 8 players reached.</p>
                }
              </div>
            </div>

            {/* ── Step 4: Your availability ── */}
            <div className={styles.card}>
              <StepRail num="4" icon="📅" />
              <div className={styles.cardContent}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>Your availability</span>
                  {selectedDates.size > 0 && <span className={styles.playerBadge}>{selectedDates.size} dates</span>}
                </div>
                <p className={styles.cardDesc}>
                  Your entry is pre-submitted — no need to visit your own invite link later.
                </p>

                {Object.entries(monthGroups).map(([month, mdates]) => (
                  <div key={month} className={styles.monthGroup}>
                    <p className={styles.monthLabel}>{month}</p>
                    <div className={styles.dateGrid}>
                      {mdates.map(d => (
                        <button key={d} type="button"
                          className={`${styles.dateBtn} ${selectedDates.has(d) ? styles.dateBtnOn : ''}`}
                          onClick={() => toggleDate(d)} aria-pressed={selectedDates.has(d)}>
                          {formatDate(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className={styles.timeDivider} />
                <p className={styles.timeLabel}>
                  Preferred tee time <span className={styles.timeLabelNote}>(select all that work)</span>
                </p>
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
            </div>

          </form>

          {error && (
            <div className={styles.error} role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button type="submit" form="" className={styles.submit} disabled={loading}
            onClick={handleSubmit}>
            {loading
              ? <><span className={styles.spinner}/> Creating round…</>
              : <>Create round &amp; send invites
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </>
            }
          </button>

        </div>
      </div>
      <Footer />
    </div>
  )
}
