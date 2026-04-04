import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import { getRound, subscribeToRound } from '../utils/store'
import Footer from '../components/Footer'
import { formatDateLong } from '../utils/dates'
import styles from './ResultsPage.module.css'

const BASE_URL = window.location.origin

function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); document.body.removeChild(ta)
  })
}

export default function ResultsPage() {
  const { roundId }       = useParams()
  const [searchParams]    = useSearchParams()
  const isNew             = searchParams.get('new') === '1'
  const navigate          = useNavigate()

  const [round,          setRound]          = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [notFound,       setNotFound]       = useState(false)
  const [copiedId,       setCopiedId]       = useState(null)
  const [selectedCourse, setSelectedCourse] = useState(null)

  function copy(id, text) {
    copyText(text); setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  /* ── Initial load ── */
  useEffect(() => {
    async function load() {
      try {
        const r = await getRound(roundId)
        if (!r) return setNotFound(true)
        setRound(r)
        if (r.match?.confirmedCourse) setSelectedCourse(r.match.confirmedCourse)
      } catch (err) {
        console.error('Failed to load round:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [roundId])

  /* ── Realtime subscription — subscribe once, never resubscribe ── */
  useEffect(() => {
    // Subscribe as soon as round is loaded. Stable dep array = never torn down.
    const unsub = subscribeToRound(roundId, (updated) => {
      setRound(updated)
      if (updated.match?.confirmedCourse) setSelectedCourse(updated.match.confirmedCourse)
    })
    return unsub
  }, [roundId])  // intentionally omit round.status — resubscribing breaks the channel

  /* ── Polling fallback — ref-based so cleanup is always reliable ── */
  const pollRef = useRef(null)

  useEffect(() => {
    // Clear any existing poll
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    if (!round) return
    const allResponded = round.players.length > 0 &&
      round.players.every(p => p.availability)

    // Only poll while everyone responded but match hasn't arrived yet
    if (!allResponded || round.match) return

    console.info('[poll] Starting 2s poll for match on round', roundId)

    pollRef.current = setInterval(async () => {
      try {
        const fresh = await getRound(roundId)
        if (fresh?.match) {
          console.info('[poll] Match arrived, stopping poll')
          clearInterval(pollRef.current)
          pollRef.current = null
          setRound(fresh)
          if (fresh.match?.confirmedCourse) setSelectedCourse(fresh.match.confirmedCourse)
        }
      } catch {}
    }, 2000)  // every 2s — faster than before

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  // Re-evaluate only when the match status actually changes
  }, [roundId, round?.match, round?.players?.length])

  /* ── Loading / not-found ── */
  if (loading) return (
    <div className={styles.page}>
      <Nav />
      <div className={styles.loader}>
        <div className={styles.loaderDots}><span/><span/><span/></div>
      </div>
      <Footer />
    </div>
  )

  if (notFound) return (
    <div className={styles.page}><Nav />
      <div className={styles.pageInner}>
        <div className={styles.notFound}>
          <div>⛳</div><h1>Round not found</h1>
          <p>This round doesn't exist. <button onClick={() => navigate('/create')}>Start a new one →</button></p>
        </div>
      </div>
      <Footer />
    </div>
  )

  const respondedCount = round.players.filter(p => p.availability).length
  const hasMatch       = round.match && round.status === 'matched'
  const organizer      = round.players.find(p => p.isOrganizer)

  return (
    <div className={styles.page}>
      <Nav />
      <div className={styles.pageInner}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.headerChip}>Round · {round.city}</span>
            {hasMatch && <span className={styles.headerChipGreen}>Match found</span>}
          </div>
          <h1 className={styles.title}>
            {isNew ? 'Round created!' : hasMatch ? "You're on the tee 🏌️" : 'Waiting on the crew…'}
          </h1>
          <p className={styles.subtitle}>
            {hasMatch
              ? 'All availability collected. Here\'s what we found.'
              : `${respondedCount} of ${round.players.length} players have responded. Copy and share the links below!`}
          </p>
        </div>

        <div className={styles.layout}>

          {/* ── Left: results ── */}
          <div className={styles.leftCol}>

            {hasMatch && round.match.storyline && (
              <div className={styles.storylineCard}>
                <div className={styles.storylineIcon}>⛳</div>
                <p className={styles.storylineText}>{round.match.storyline}</p>
              </div>
            )}

            {hasMatch && (
              <div className={styles.matchCard}>
                <div className={styles.matchGrid}>
                  <div>
                    <p className={styles.matchLabel}>Best date</p>
                    <p className={styles.matchDate}>{formatDateLong(round.match.date)}</p>
                  </div>
                  <div className={styles.matchTeeTime}>
                    <p className={styles.matchLabel}>Tee time</p>
                    <p className={styles.matchTimeValue}>{round.match.teeTime}</p>
                  </div>
                </div>
                <div className={styles.matchMeta}>
                  <div className={styles.matchMetaItem}>
                    <span className={styles.matchMetaIcon}>👥</span>
                    <span>{round.players.length} players</span>
                  </div>
                  <div className={styles.matchMetaItem}>
                    <span className={styles.matchMetaIcon}>📍</span>
                    <span>{round.city}</span>
                  </div>
                </div>
              </div>
            )}

            {hasMatch && round.match.suggestedCourses?.length > 0 && (
              <div className={styles.card}>
                <div className={styles.cardLabel}>Suggested courses nearby</div>
                <p className={styles.cardDesc}>Select one to confirm your booking.</p>
                <div className={styles.courseList}>
                  {round.match.suggestedCourses.map(course => (
                    <button
                      key={course.id} type="button"
                      className={`${styles.courseCard} ${selectedCourse === course.id ? styles.courseActive : ''}`}
                      onClick={() => setSelectedCourse(course.id)}
                    >
                      <div className={styles.courseEmoji}>⛳</div>
                      <div className={styles.courseInfo}>
                        <div className={styles.courseNameRow}>
                          <span className={styles.courseName}>{course.name}</span>
                          {course.rating != null && <span className={styles.courseRating}>★ {course.rating}</span>}
                        </div>
                        <span className={styles.courseAddr}>{course.address}</span>
                        {course.website && (
                          <a href={course.website} target="_blank" rel="noopener noreferrer" className={styles.courseWebsite}>
                            Visit website →
                          </a>
                        )}
                        <div className={styles.courseTags}>
                          <span className={styles.courseTag}>{course.holes || 18} holes</span>
                          <span className={styles.courseTag}>Par {course.par || 72}</span>
                          {course.price != null && (
                            <span className={`${styles.courseTag} ${styles.courseTagPrice}`}>${course.price}/player</span>
                          )}
                          {course.distanceMi != null && (
                            <span className={styles.courseTag}>{course.distanceMi} mi away</span>
                          )}
                          {course.source === 'openstreetmap' && (
                            <span className={styles.courseTagOsm}>OSM</span>
                          )}
                        </div>
                      </div>
                      <div className={`${styles.courseCheck} ${selectedCourse === course.id ? styles.courseCheckActive : ''}`}>
                        {selectedCourse === course.id ? '✓' : ''}
                      </div>
                    </button>
                  ))}
                </div>
                {selectedCourse && (
                  <button className={styles.confirmBtn}>
                    Confirm {round.match.teeTime} booking
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                )}
              </div>
            )}

            {!hasMatch && (
              <div className={styles.waitCard}>
                <div className={styles.waitDots}><span/><span/><span/></div>
                <h2 className={styles.waitTitle}>Waiting on the crew</h2>
                <p className={styles.waitDesc}>
                  Share the links on the right with your players. Once everyone responds,
                  we'll automatically find the best date and suggest courses near your group.
                  This page updates live as people respond.
                </p>
                <div className={styles.waitProgress}>
                  <div className={styles.waitProgressFill} style={{ width: `${(respondedCount / round.players.length) * 100}%` }} />
                </div>
                <p className={styles.waitLabel}>{respondedCount} / {round.players.length} responded</p>
              </div>
            )}
          </div>

          {/* ── Right: invite links ── */}
          <div className={styles.rightCol}>
            <div className={styles.card}>
              <div className={styles.linksHeader}>
                <span className={styles.cardLabel}>Invite links</span>
                <button
                  className={styles.copyAllBtn}
                  onClick={() => copy('all', round.players.map(p =>
                    `${p.name}: ${BASE_URL}/availability/${roundId}/${p.id}`
                  ).join('\n'))}
                >
                  {copiedId === 'all' ? '✓ Copied' : 'Copy all'}
                </button>
              </div>
              <p className={styles.cardDesc} style={{marginBottom:'1rem'}}>Each player's unique link. No sign-in needed.</p>

              <div className={styles.playerList}>
                {round.players.map(p => {
                  const link     = `${BASE_URL}/availability/${roundId}/${p.id}`
                  const responded = !!p.availability
                  return (
                    <div key={p.id} className={styles.playerRow}>
                      <div className={styles.avatar}>{p.name.charAt(0).toUpperCase()}</div>
                      <div className={styles.playerMeta}>
                        <div className={styles.playerNameRow}>
                          <span className={styles.playerName}>{p.name}</span>
                          {p.isOrganizer && <span className={styles.organizerTag}>you</span>}
                          <span className={`${styles.dot} ${responded ? styles.dotGreen : ''}`} />
                        </div>
                        <span className={styles.playerEmail}>{p.email}</span>
                      </div>
                      <button
                        className={`${styles.linkBtn} ${copiedId === p.id ? styles.linkBtnCopied : ''}`}
                        onClick={() => copy(p.id, link)} title="Copy link"
                      >
                        {copiedId === p.id
                          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        }
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className={styles.legend}>
                <span className={styles.dot}/> Not yet
                <span style={{width:7,height:7,borderRadius:'50%',background:'var(--accent)',display:'inline-block',flexShrink:0}}/> Responded
              </div>
            </div>

            {organizer && (
              <div className={styles.myLinkCard}>
                <p className={styles.myLinkLabel}>Your availability link</p>
                <p className={styles.myLinkUrl}>{`${BASE_URL}/availability/${roundId}/${organizer.id}`}</p>
                <button
                  className={styles.myLinkBtn}
                  onClick={() => copy('org', `${BASE_URL}/availability/${roundId}/${organizer.id}`)}
                >
                  {copiedId === 'org' ? '✓ Copied!' : 'Copy my link'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
