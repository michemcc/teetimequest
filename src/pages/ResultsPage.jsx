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
  const [selectedCourse,  setSelectedCourse]  = useState(null)
  const [matchRevealed,   setMatchRevealed]   = useState(false)
  const [teeSlots,        setTeeSlots]        = useState([])        // real availability slots
  const [teeSlotsLoading, setTeeSlotsLoading] = useState(false)
  const [teeSlotsSource,  setTeeSlotsSource]  = useState(null)      // 'golfcourseapi' | etc
  const [selectedSlot,    setSelectedSlot]    = useState(null)      // chosen tee time slot
  const prevMatchRef = useRef(null)

  function copy(id, text) {
    copyText(text); setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  /* ── Fetch real tee time slots when a course is selected ── */
  async function selectCourse(courseId) {
    setSelectedCourse(courseId)
    setSelectedSlot(null)
    setTeeSlots([])
    setTeeSlotsSource(null)

    if (!courseId || !round?.match?.date) return

    // Only GolfCourseAPI courses have tee time data (id starts with gcapi-)
    if (!courseId.startsWith('gcapi-')) {
      setTeeSlotsSource('osm-course')
      return
    }

    setTeeSlotsLoading(true)
    try {
      const date    = round.match.date
      const players = round.players.length
      const res = await fetch(
        `/api/teetimes?courseId=${encodeURIComponent(courseId)}&date=${date}&players=${players}`
      )
      const data = await res.json()
      console.info('[teetimes] response:', data.source, '| slots:', data.slots?.length, '| debug:', data._debug)
      setTeeSlots(data.slots || [])
      setTeeSlotsSource(data.source || 'unknown')
    } catch (err) {
      console.warn('[teetimes] fetch failed:', err.message)
      setTeeSlotsSource('error')
    } finally {
      setTeeSlotsLoading(false)
    }
  }

  /* ── Initial load ── */
  useEffect(() => {
    async function load() {
      try {
        const r = await getRound(roundId)
        if (!r) return setNotFound(true)
        setRound(r)
        if (r.match?.confirmedCourse) setSelectedCourse(r.match.confirmedCourse)
        if (r.match) setMatchRevealed(true)
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
      setRound(prev => {
        // Trigger reveal animation when match first arrives
        if (!prev?.match && updated.match) {
          setTimeout(() => setMatchRevealed(true), 50)
        }
        return updated
      })
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
          setRound(prev => {
            if (!prev?.match && fresh.match) setTimeout(() => setMatchRevealed(true), 50)
            return fresh
          })
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

  const respondedCount  = round.players.filter(p => p.availability).length
  const hasMatch        = round.match && round.status === 'matched'
  const organizer       = round.players.find(p => p.isOrganizer)
  // True only when real OSM courses have arrived (Phase 2 complete)
  const hasRealCourses  = round.match?.suggestedCourses?.some(c => c.source === 'openstreetmap' || c.source === 'golfcourseapi')
  const coursesLoading  = hasMatch && !hasRealCourses

  return (
    <div className={styles.page}>
      <Nav />
      <div className={styles.pageInner}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.headerChip}>Round</span>
            {hasMatch && <span className={styles.headerChipGreen}>Match found</span>}
          </div>
          <h1 className={`${styles.title} ${hasMatch ? styles.titleMatched : ''}`}>
            {isNew ? 'Round created! ⛳' : hasMatch ? "You're on the tee." : 'Waiting on the crew…'}
          </h1>
          {hasMatch && (
            <div className={styles.headerMatchBadge}>
              <span className={styles.headerMatchPulse}/>
              Match found
            </div>
          )}
          <p className={styles.subtitle}>
            {hasMatch
              ? `Best date and tee time locked in. ${round.match.suggestedCourses?.length || 0} courses nearby.`
              : `${respondedCount} of ${round.players.length} players have responded. Copy and share the links below!`}
          </p>
        </div>

        <div className={styles.layout}>

          {/* ── Left: results ── */}
          <div className={`${styles.leftCol} ${hasMatch && matchRevealed ? styles.leftColRevealed : ""}`}>

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
                  {(()=> {
                    const sc = selectedCourse
                      ? round.match.suggestedCourses?.find(c => c.id === selectedCourse)
                      : round.match.suggestedCourses?.[0]
                    const city = sc?.address
                      ? sc.address.split(',').map(s=>s.trim()).filter(Boolean).slice(-2).join(', ')
                      : null
                    return city ? (
                      <div className={styles.matchMetaItem}>
                        <span className={styles.matchMetaIcon}>📍</span>
                        <span>{city}</span>
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
            )}

            {hasMatch && (
              <div className={styles.card}>
                <div className={styles.cardLabel}>Suggested courses nearby</div>

                {/* Skeleton — Phase 2 course lookup still running */}
                {coursesLoading && (
                  <div className={styles.courseSkeleton}>
                    <div className={styles.courseSkeletonIcon}>📍</div>
                    <div className={styles.courseSkeletonText}>
                      <p className={styles.courseSkeletonTitle}>Finding courses near your group…</p>
                      <p className={styles.courseSkeletonSub}>Searching public courses between all players. This takes a few seconds.</p>
                    </div>
                    <div className={styles.courseSkeletonDots}><span/><span/><span/></div>
                  </div>
                )}

                {/* Real courses — Phase 2 complete */}
                {hasRealCourses && (
                  <>
                    <p className={styles.cardDesc}>Select one to confirm your booking.</p>
                    <div className={styles.courseList}>
                      {round.match.suggestedCourses.map(course => (
                        <button
                          key={course.id} type="button"
                          className={`${styles.courseCard} ${selectedCourse === course.id ? styles.courseActive : ''}`}
                          onClick={() => selectCourse(course.id)}
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
                            </div>
                          </div>
                          <div className={`${styles.courseCheck} ${selectedCourse === course.id ? styles.courseCheckActive : ''}`}>
                            {selectedCourse === course.id ? '✓' : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* ── Tee time availability panel ── */}
                    {selectedCourse && (
                      <div className={styles.teeTimes}>
                        <div className={styles.teeTimesHeader}>
                          <span className={styles.teeTimesLabel}>Available tee times · {round.match.date}</span>
                          {teeSlotsLoading && <span className={styles.teeTimesSpinner}/>}
                        </div>

                        {/* Loading */}
                        {teeSlotsLoading && (
                          <div className={styles.teeSlotsLoading}>
                            <div className={styles.teeSlotsSkeleton}/>
                            <div className={styles.teeSlotsSkeleton}/>
                            <div className={styles.teeSlotsSkeleton}/>
                          </div>
                        )}

                        {/* No tee time data for this course type */}
                        {!teeSlotsLoading && teeSlotsSource === 'osm-course' && (
                          <p className={styles.teeTimesNote}>
                            Live tee times are available for GolfCourseAPI listings.
                            Check the course website to book.
                          </p>
                        )}

                        {/* No slots returned */}
                        {!teeSlotsLoading && teeSlotsSource === 'golfcourseapi' && teeSlots.length === 0 && (
                          <p className={styles.teeTimesNote}>
                            No available tee times found for {round.players.length} players on this date.
                            Try calling the course directly.
                          </p>
                        )}

                        {/* Real tee time slots */}
                        {!teeSlotsLoading && teeSlots.length > 0 && (
                          <div className={styles.teeSlotGrid}>
                            {teeSlots.map(slot => (
                              <button
                                key={slot.timeRaw}
                                type="button"
                                className={`${styles.teeSlot} ${selectedSlot?.timeRaw === slot.timeRaw ? styles.teeSlotActive : ''}`}
                                onClick={() => setSelectedSlot(slot)}
                              >
                                <span className={styles.teeSlotTime}>{slot.time}</span>
                                {slot.price != null && (
                                  <span className={styles.teeSlotPrice}>${slot.price}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Confirm button — only when a real slot is chosen */}
                        {selectedSlot && (
                          <button className={styles.confirmBtn}>
                            ⛳ Lock in {selectedSlot.time}
                            {selectedSlot.price != null && ` · $${selectedSlot.price * round.players.length} total`}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </>
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
