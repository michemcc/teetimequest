import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import { createRound } from '../utils/store'
import styles from './CreateRoundPage.module.css'

const MAX_PLAYERS = 7

export default function CreateRoundPage() {
  const navigate = useNavigate()
  const [organizer, setOrganizer] = useState({ name: '', email: '' })
  const [players, setPlayers] = useState(['', '', ''])
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updatePlayer(i, v) {
    const next = [...players]; next[i] = v; setPlayers(next)
  }
  function addPlayer() {
    if (players.length < MAX_PLAYERS - 1) setPlayers([...players, ''])
  }
  function removePlayer(i) {
    if (players.length > 1) setPlayers(players.filter((_, j) => j !== i))
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!organizer.name.trim()) return setError('Enter your name.')
    if (!organizer.email.includes('@')) return setError('Enter a valid email.')
    if (!city.trim()) return setError('Enter a city or region for the round.')
    const valid = players.filter(p => p.trim())
    if (valid.length < 1) return setError('Add at least one other player.')
    for (const em of valid) if (!em.includes('@')) return setError(`"${em}" isn't a valid email.`)
    setLoading(true)
    try {
      const round = createRound({ organizerName: organizer.name.trim(), organizerEmail: organizer.email.trim(), playerEmails: valid, city: city.trim() })
      navigate(`/results/${round.id}?new=1`)
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <Nav />
      <div className={`container container--xs ${styles.content}`}>
        <div className={styles.header}>
          <div className={styles.headerChip}>New round</div>
          <h1 className={styles.title}>Set up your group</h1>
          <p className={styles.subtitle}>We'll send each player a link to mark their availability.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Your info</div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="org-name">Name</label>
                <input id="org-name" className={styles.input} type="text" placeholder="Your name"
                  value={organizer.name} onChange={e => setOrganizer(o => ({ ...o, name: e.target.value }))} autoComplete="name" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="org-email">Email</label>
                <input id="org-email" className={styles.input} type="email" placeholder="you@example.com"
                  value={organizer.email} onChange={e => setOrganizer(o => ({ ...o, email: e.target.value }))} autoComplete="email" />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Location</div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="city">City or region</label>
              <input id="city" className={styles.input} type="text" placeholder="e.g. Boston, MA or North Shore"
                value={city} onChange={e => setCity(e.target.value)} />
              <p className={styles.hint}>We use player locations to find courses central to everyone.</p>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabelRow}>
              <span className={styles.cardLabel}>Other players</span>
              <span className={styles.cardCount}>{players.length}/{MAX_PLAYERS - 1}</span>
            </div>
            <div className={styles.playerList}>
              {players.map((email, i) => (
                <div key={i} className={styles.playerRow}>
                  <input className={styles.input} type="email" placeholder={`player${i + 2}@example.com`}
                    value={email} onChange={e => updatePlayer(i, e.target.value)} aria-label={`Player ${i + 2} email`} />
                  {players.length > 1 && (
                    <button type="button" className={styles.removeBtn} onClick={() => removePlayer(i)} aria-label="Remove">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {players.length < MAX_PLAYERS - 1 && (
              <button type="button" className={styles.addBtn} onClick={addPlayer}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Add player
              </button>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Creating round…' : 'Create round & get links'}
            {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>}
          </button>
        </form>
      </div>
    </div>
  )
}
