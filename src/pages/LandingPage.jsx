import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './LandingPage.module.css'

const steps = [
  { num:'01', title:'Create a round',    desc:'Enter names and emails. Done in 60 seconds.',                icon:'🏌️' },
  { num:'02', title:'Share links',       desc:'Each player gets a unique invite — no account needed.',     icon:'🔗' },
  { num:'03', title:'Mark availability', desc:'Everyone taps their open dates and preferred tee time.',    icon:'📅' },
  { num:'04', title:'We find the match', desc:'Best date, time and nearby courses — surfaced for you.',    icon:'📍' },
  { num:'05', title:'Confirm & play',    desc:'One tap to lock in the course. First tee awaits.',          icon:'⛳' },
]

const features = [
  { icon:'🗓️', label:'Smart scheduling',   desc:'Finds overlap across all players. Falls back to majority if needed.',      accent:true },
  { icon:'🗺️', label:'Course finder',      desc:'Triangulates public courses central to your whole group.'                       },
  { icon:'⏰', label:'Tee time match',     desc:'Surfaces open slots that fit your group\'s window.'                            },
  { icon:'📲', label:'Mobile first',       desc:'Built for the group chat. Every link works on any device.'                     },
  { icon:'🔗', label:'Zero friction',      desc:'No downloads. No accounts. Just a link and a tap.'                             },
  { icon:'🤝', label:'Group consensus',    desc:'Organizer confirms the final pick with one tap.'                               },
]

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <Nav />

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div>
            <div className={styles.heroEyebrow}>Golf scheduling, finally solved</div>
            <h1 className={styles.heroTitle}>
              Get your crew
              <em className={styles.heroTitleEm}>on the course.</em>
            </h1>
            <p className={styles.heroDesc}>
              TeeTimeQuest coordinates everyone's schedule, finds public courses nearby,
              and locks in a tee time — without the 47-message group chat.
            </p>
            <div className={styles.heroCtas}>
              <Link to="/create" className={styles.btnPrimary}>Plan a round →</Link>
              <a href="#how" className={styles.btnGhost}>How it works</a>
            </div>
          </div>

          <div className={styles.heroCard}>
            <div className={styles.heroCardBar}>
              <span className={styles.heroCardDot} style={{background:'#c0392b'}}/>
              <span className={styles.heroCardDot} style={{background:'#e67e22'}}/>
              <span className={styles.heroCardDot} style={{background:'var(--accent)'}}/>
              <span className={styles.heroCardBarLabel}>round_boston_2025.ttq</span>
            </div>
            <div className={styles.heroCardStats}>
              <div className={styles.heroStat}><span className={styles.heroStatNum}>4</span><span className={styles.heroStatLabel}>Invited</span></div>
              <div className={styles.heroStatDivider}/>
              <div className={styles.heroStat}><span className={styles.heroStatNum}>3</span><span className={styles.heroStatLabel}>Responded</span></div>
              <div className={styles.heroStatDivider}/>
              <div className={styles.heroStat}><span className={styles.heroStatNum}>Sat</span><span className={styles.heroStatLabel}>Best date</span></div>
            </div>
            <div className={styles.heroCardMatch}>
              <span className={styles.heroCardMatchIcon}>⛳</span>
              <div>
                <p className={styles.heroCardMatchName}>Pebble Creek Golf Club</p>
                <p className={styles.heroCardMatchMeta}>8:30 AM · Par 72 · $85 / player</p>
              </div>
              <span className={styles.heroCardMatchBadge}>Match</span>
            </div>
            <div className={styles.heroCardPlayers}>
              {['T','M','J','K'].map((l,i) => (
                <div key={l} className={styles.heroAvatar} style={{zIndex:4-i}}>
                  {l}
                  <span className={`${styles.heroAvatarDot} ${i<3?styles.green:''}`}/>
                </div>
              ))}
              <span className={styles.heroPlayersLabel}>3 of 4 responded</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className={styles.statsBar}>
        <div className={`container ${styles.statsGrid}`}>
          {[
            {num:'2–8', label:'players per round'},
            {num:'60s', label:'to set up'},
            {num:'0',   label:'accounts needed'},
            {num:'Free',label:'always'},
          ].map(s => (
            <div key={s.label} className={styles.statCell}>
              <span className={styles.statNum}>{s.num}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <section className={styles.section} id="how">
        <div className="container">
          <div className={styles.sectionHead}>
            <div className={styles.sectionRule}>How it works</div>
            <h2 className={styles.sectionTitle}>From group chat to first tee</h2>
            <p className={styles.sectionDesc}>Five steps. Zero chaos.</p>
          </div>
          <div className={styles.stepsGrid}>
            {steps.map(s => (
              <div key={s.num} className={styles.stepCell}>
                <div className={styles.stepTop}>
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

      {/* ── Features ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <div className={styles.sectionRule}>Features</div>
            <h2 className={styles.sectionTitle}>Everything you need</h2>
          </div>
          <div className={styles.featGrid}>
            {features.map(f => (
              <div key={f.label} className={`${styles.featCard} ${f.accent ? styles.featCardAccent : ''}`}>
                <span className={styles.featIcon}>{f.icon}</span>
                <h3 className={styles.featTitle}>{f.label}</h3>
                <p className={styles.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.ctaBand}>
        <div className={`container ${styles.ctaGrid}`}>
          <div className={styles.ctaContent}>
            <div className={styles.ctaEyebrow}>Free · No signup required</div>
            <h2 className={styles.ctaTitle}>Ready for your next round?</h2>
            <p className={styles.ctaDesc}>Set up your group in under a minute. No app, no account, no nonsense.</p>
            <Link to="/create" className={styles.btnPrimary}>Get started →</Link>
          </div>
          <div className={styles.ctaDeco} aria-hidden="true">
            {['⛳','📅','🏌️','📍','🔗','⏰','🤝','📲','🗺️'].map((e,i)=>(
              <div key={i} className={styles.ctaDecoCell}>{e}</div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
