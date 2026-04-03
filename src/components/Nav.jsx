import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme.jsx'
import styles from './Nav.module.css'

const VERSION = '2026.2.7'

export default function Nav() {
  const { theme, toggle } = useTheme()

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>

        {/* Logo + version */}
        <Link to="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <rect x="4" y="1" width="1.5" height="18" rx="0.75" fill="currentColor"/>
              <path d="M5.5 1.5 L16 5.5 L5.5 10 Z" fill="var(--gold)"/>
              <circle cx="5.5" cy="19" r="2" fill="currentColor" opacity="0.5"/>
            </svg>
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>TeeTimeQuest</span>
            <span className={styles.logoVersion}>v{VERSION}</span>
          </div>
        </Link>

        {/* Center links */}
        <div className={styles.center}>
          <Link to="/about"   className={styles.navLink}>About</Link>
          <Link to="/create"  className={styles.navLink}>New round</Link>
          <Link to="/contact" className={styles.navLink}>Contact</Link>
        </div>

        {/* Right actions */}
        <div className={styles.actions}>
          <a
            href="https://buymeacoffee.com/michemcc"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.coffeeBtn}
            title="Buy me a coffee"
          >
            <span className={styles.coffeeIcon}>☕</span>
            <span className={styles.coffeeLabel}>Coffee</span>
          </a>

          <button
            className={styles.themeToggle}
            onClick={toggle}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>

          <Link to="/create" className={styles.cta}>
            Play
          </Link>
        </div>
      </div>
    </nav>
  )
}
