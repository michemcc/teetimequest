import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import styles from './LandingPage.module.css'

const steps = [
  { num: '01', title: 'Create a round', desc: 'Enter your group\'s emails. Done in 60 seconds.', icon: '🏌️' },
  { num: '02', title: 'Everyone picks dates', desc: 'Each player gets their own link — no account needed.', icon: '📅' },
  { num: '03', title: 'We find the sweet spot', desc: 'Tee\'d Up matches availability and surfaces nearby courses.', icon: '📍' },
  { num: '04', title: 'Book and play', desc: 'Confirm the course and tee time as a group.', icon: '⛳' },
]

const features = [
  { icon: '🗓️', label: 'Availability matching', desc: 'Finds the date that works for everyone — or the best majority vote.' },
  { icon: '🗺️', label: 'Course triangulation', desc: 'Suggests public courses central to your group\'s locations.' },
  { icon: '⏰', label: 'Tee time search', desc: 'Surfaces open slots matching your group\'s preferred window.' },
  { icon: '📲', label: 'Mobile first', desc: 'Every link works perfectly on any phone. No pinching required.' },
  { icon: '🔗', label: 'No accounts', desc: 'Players respond via a personal link. Zero signup friction.' },
  { icon: '🤝', label: 'One-tap confirm', desc: 'Organizer locks in the final pick. Everyone gets notified.' },
]

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <Nav />

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroChip}>
            <span className={styles.chipDot} />
            Golf scheduling, finally solved
          </div>

          <h1 className={styles.heroTitle}>
            Get your crew<br />
            <span className={styles.heroAccent}>on the course.</span>
          </h1>

          <p className={styles.heroDesc}>
            TeeTimeQuest coordinates everyone's schedule, finds public courses nearby,
            and locks in a tee time — without the 47-message group chat.
          </p>

          <div className={styles.heroCtas}>
            <Link to="/create" className={styles.btnPrimary}>
              Plan a round
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <a href="#how" className={styles.btnGhost}>See how it works</a>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>4–8</span>
              <span className={styles.statLabel}>players</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>60s</span>
              <span className={styles.statLabel}>to set up</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>0</span>
              <span className={styles.statLabel}>signups needed</span>
            </div>
          </div>
        </div>

        <div className={styles.heroBadge} aria-hidden="true">⛳</div>
      </section>

      {/* ─── How it works ─────────────────────────────────── */}
      <section className={styles.howSection} id="how">
        <div className="container">
          <div className={styles.sectionLabel}>How it works</div>
          <h2 className={styles.sectionTitle}>From group chat to first tee</h2>

          <div className={styles.stepsGrid}>
            {steps.map((s, i) => (
              <div key={s.num} className={styles.stepCard}>
                <div className={styles.stepTop}>
                  <span className={styles.stepNum}>{s.num}</span>
                  <span className={styles.stepIcon}>{s.icon}</span>
                </div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
                {i < steps.length - 1 && <div className={styles.stepArrow} aria-hidden="true">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────── */}
      <section className={styles.featuresSection}>
        <div className="container">
          <div className={styles.sectionLabel}>Features</div>
          <h2 className={styles.sectionTitle}>Everything you need</h2>
          <div className={styles.featureGrid}>
            {features.map(f => (
              <div key={f.label} className={styles.featureCard}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <h3 className={styles.featureName}>{f.label}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={`container container--xs ${styles.ctaInner}`}>
          <div className={styles.ctaChip}>Free · No signup</div>
          <h2 className={styles.ctaTitle}>Ready for your next round?</h2>
          <p className={styles.ctaDesc}>Set up your group in under a minute.</p>
          <Link to="/create" className={styles.btnPrimary}>
            Get started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerInner}>
            <span className={styles.footerLogo}>⛳ TeeTimeQuest</span>
            <a
              href="https://buymeacoffee.com/michemcc"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerCoffee}
            >
              ☕ Buy me a coffee
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
