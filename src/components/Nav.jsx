import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme.jsx'
import styles from './Nav.module.css'

export default function Nav() {
  const { theme, toggle } = useTheme()

  return (
    <nav className={styles.nav}>
      <div className={`container ${styles.inner}`}>

        <Link to="/" className={styles.logo}>
          <svg className={styles.logoFlag} viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="1" width="1.5" height="22" rx="0.75" fill="currentColor" opacity="0.9"/>
            <path d="M5.5 2 L18 6.5 L5.5 12 Z" fill="var(--gold)"/>
            <circle cx="5.5" cy="23" r="2.5" fill="currentColor" opacity="0.6"/>
          </svg>
          <span className={styles.logoText}>TeeTimeQuest</span>
        </Link>

        <div className={styles.center}>
          <Link to="/about" className={styles.navLink}>About</Link>
          <Link to="/create" className={styles.navLink}>Plan a round</Link>
          <Link to="/contact" className={styles.navLink}>Contact</Link>
        </div>

        <div className={styles.actions}>
          <a
            href="https://buymeacoffee.com/michemcc"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.coffeeBtn}
            title="Buy me a coffee"
          >
            <span>☕</span>
            <span className={styles.coffeeLabel}>Coffee</span>
          </a>

          <button
            className={styles.themeToggle}
            onClick={toggle}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>

          <Link to="/create" className={styles.cta}>Play</Link>
        </div>
      </div>
    </nav>
  )
}
