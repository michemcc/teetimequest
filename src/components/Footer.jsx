import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

const VERSION = '2026.3.6'

export default function Footer() {
  return (
    <footer className={styles.footer}>

      {/* ── Main body ── */}
      <div className={styles.body}>
        <div className={`container ${styles.grid}`}>

          {/* Brand */}
          <div className={styles.brand}>
            <Link to="/" className={styles.brandLogo}>
              <svg width="15" height="19" viewBox="0 0 20 24" fill="none">
                <rect x="4" y="1" width="1.5" height="22" rx="0.75" fill="currentColor" opacity="0.7"/>
                <path d="M5.5 2 L18 6.5 L5.5 12 Z" fill="var(--gold)"/>
                <circle cx="5.5" cy="23" r="2.5" fill="currentColor" opacity="0.5"/>
              </svg>
              <span className={styles.brandName}>TeeTimeQuest</span>
            </Link>
            <p className={styles.brandTagline}>Golf scheduling,<br/>finally solved.</p>
            <a
              href="https://buymeacoffee.com/michemcc"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.coffeeLink}
            >
              ☕ Buy me a coffee
            </a>
          </div>

          {/* Nav links */}
          <div className={styles.linkColumns}>
            <div className={styles.col}>
              <p className={styles.colLabel}>Product</p>
              <Link to="/create" className={styles.colLink}>Plan a round</Link>
              <a href="/#how" className={styles.colLink}>How it works</a>
            </div>
            <div className={styles.col}>
              <p className={styles.colLabel}>Company</p>
              <Link to="/about"    className={styles.colLink}>About</Link>
              <Link to="/contact"  className={styles.colLink}>Contact</Link>
              <Link to="/privacy"  className={styles.colLink}>Privacy</Link>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom bar ── single flex row, always centered ── */}
      <div className={styles.bottom}>
        <span className={styles.copy}>© {new Date().getFullYear()} TeeTimeQuest</span>
        <span className={styles.dot} aria-hidden="true">·</span>
        <span className={styles.version}>v{VERSION}</span>
        <span className={styles.dot} aria-hidden="true">·</span>
        <Link to="/privacy" className={styles.bottomLink}>Privacy</Link>
        <span className={styles.dot} aria-hidden="true">·</span>
        <Link to="/contact" className={styles.bottomLink}>Contact</Link>
      </div>

    </footer>
  )
}
