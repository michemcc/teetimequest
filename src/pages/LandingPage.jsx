import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './LandingPage.module.css'

const steps = [
  { num: '01', title: 'Create a round', desc: 'Enter names and emails. 60 seconds flat.', icon: '🏌️' },
  { num: '02', title: 'Share links', desc: 'Each player gets a unique link — no account needed.', icon: '🔗' },
  { num: '03', title: 'Mark availability', desc: 'Everyone taps their open dates and preferred tee time.', icon: '📅' },
  { num: '04', title: 'We find the match', desc: 'TeeTimeQuest surfaces the best date, time, and courses.', icon: '📍' },
  { num: '05', title: 'Confirm and play', desc: 'One tap to lock in the course. See you on the first tee.', icon: '⛳' },
]

const features = [
  { icon: '🗓️', label: 'Smart scheduling', desc: 'Finds overlap across all players. Falls back to majority if needed.' },
  { icon: '🗺️', label: 'Course finder', desc: 'Triangulates public courses central to your whole group.' },
  { icon: '⏰', label: 'Tee time match', desc: 'Surfaces available slots that fit your group\'s window.' },
  { icon: '📲', label: 'Mobile first', desc: 'Built for the group chat. Every link works on any device.' },
  { icon: '🔗', label: 'Zero friction', desc: 'No downloads, no accounts. Just a link.' },
  { icon: '🤝', label: 'Group consensus', desc: 'Organizer confirms the final pick with one tap.' },
]

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <Nav />

      {/* ─── Hero grid ───────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroLeft}>
            <div className={styles.chip}>
              <span className={styles.chipDot} />
              Golf scheduling, finally solved
            </div>
            <h1 className={styles.heroTitle}>
              Get your crew<br />
              <em className={styles.heroEm}>on the course.</em>
            </h1>
            <p className={styles.heroDesc}>
              TeeTimeQuest coordinates everyone's schedule, finds public courses nearby,
              and locks in a tee time — without the 47-message group chat.
            </p>
            <div className={styles.heroCtas}>
              <Link to="/create" className={styles.btnPrimary}>
                Plan a round
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
              <a href="#how" className={styles.btnGhost}>How it works</a>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.heroCard}>
              <div className={styles.heroCardHeader}>
                <span className={styles.heroCardDot} style={{background:'#ef4444'}}/>
                <span className={styles.heroCardDot} style={{background:'#f59e0b'}}/>
                <span className={styles.heroCardDot} style={{background:'var(--accent)'}}/>
                <span className={styles.heroCardTitle}>Round · Boston, MA</span>
              </div>
              <div className={styles.heroCardBody}>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum}>4</span>
                  <span className={styles.heroStatLabel}>players invited</span>
                </div>
                <div className={styles.heroStatDivider}/>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum}>3</span>
                  <span className={styles.heroStatLabel}>responded</span>
                </div>
                <div className={styles.heroStatDivider}/>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum}>Sat</span>
                  <span className={styles.heroStatLabel}>best match</span>
                </div>
              </div>
              <div className={styles.heroCardMatch}>
                <span className={styles.heroCardMatchIcon}>📍</span>
                <div>
                  <p className={styles.heroCardMatchTitle}>Pebble Creek Golf Club</p>
                  <p className={styles.heroCardMatchSub}>8:30 AM · Par 72 · $85/player</p>
                </div>
                <span className={styles.heroCardMatchBadge}>Match</span>
              </div>
              <div className={styles.heroCardPlayers}>
                {['T','M','J','K'].map((l,i) => (
                  <div key={l} className={styles.heroCardAvatar} style={{zIndex:4-i}}>
                    {l}
                    <span className={`${styles.heroCardAvatarDot} ${i < 3 ? styles.green : ''}`}/>
                  </div>
                ))}
                <span className={styles.heroCardPlayersLabel}>3 of 4 responded</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats bar ───────────────────────────────────── */}
      <div className={styles.statsBar}>
        <div className={`container ${styles.statsInner}`}>
          {[
            { num: '4–8', label: 'players per round' },
            { num: '60s', label: 'to set up' },
            { num: '0', label: 'accounts needed' },
            { num: '100%', label: 'free to use' },
          ].map(s => (
            <div key={s.label} className={styles.statItem}>
              <span className={styles.statNum}>{s.num}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── How it works ────────────────────────────────── */}
      <section className={styles.section} id="how">
        <div className="container">
          <div className={styles.sectionHead}>
            <div className={styles.sectionChip}>How it works</div>
            <h2 className={styles.sectionTitle}>From group chat to first tee</h2>
            <p className={styles.sectionDesc}>Five steps. Zero chaos.</p>
          </div>
          <div className={styles.stepsGrid}>
            {steps.map((s, i) => (
              <div key={s.num} className={styles.stepCell}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNum}>{s.num}</span>
                  <span className={styles.stepIcon}>{s.icon}</span>
                </div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features grid ───────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <div className={styles.sectionChip}>Features</div>
            <h2 className={styles.sectionTitle}>Everything you need</h2>
          </div>
          <div className={styles.featGrid}>
            {features.map((f, i) => (
              <div key={f.label} className={`${styles.featCard} ${i === 0 ? styles.featCardWide : ''}`}>
                <span className={styles.featIcon}>{f.icon}</span>
                <h3 className={styles.featTitle}>{f.label}</h3>
                <p className={styles.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={`container ${styles.ctaInner}`}>
          <div className={styles.ctaContent}>
            <div className={styles.chip} style={{marginBottom:'1.25rem'}}>
              <span className={styles.chipDot}/>Free · No signup
            </div>
            <h2 className={styles.ctaTitle}>Ready for your next round?</h2>
            <p className={styles.ctaDesc}>Set up your group in under a minute.</p>
            <Link to="/create" className={styles.btnPrimary}>
              Get started
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>
          <div className={styles.ctaGrid} aria-hidden="true">
            {Array.from({length:9}).map((_,i) => (
              <div key={i} className={styles.ctaGridCell}>{['⛳','📅','🏌️','📍','🔗','⏰','🤝','📲','🗺️'][i]}</div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
