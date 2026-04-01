import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoMark}>TTQ</span>
            <span className={styles.logoText}>TeeTimeQuest</span>
          </Link>
          <p className={styles.tagline}>Golf scheduling, finally solved.</p>
        </div>

        <nav className={styles.links}>
          <div className={styles.linkGroup}>
            <p className={styles.linkGroupLabel}>Product</p>
            <Link to="/create" className={styles.link}>Plan a round</Link>
            <Link to="/#how" className={styles.link}>How it works</Link>
          </div>
          <div className={styles.linkGroup}>
            <p className={styles.linkGroupLabel}>Company</p>
            <Link to="/about" className={styles.link}>About</Link>
            <Link to="/contact" className={styles.link}>Contact</Link>
            <Link to="/privacy" className={styles.link}>Privacy</Link>
          </div>
          <div className={styles.linkGroup}>
            <p className={styles.linkGroupLabel}>Support</p>
            <a
              href="https://buymeacoffee.com/michemcc"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              ☕ Buy me a coffee
            </a>
          </div>
        </nav>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p className={styles.copy}>© {new Date().getFullYear()} TeeTimeQuest. All rights reserved.</p>
        <div className={styles.bottomLinks}>
          <Link to="/privacy" className={styles.bottomLink}>Privacy</Link>
          <Link to="/contact" className={styles.bottomLink}>Contact</Link>
        </div>
      </div>
    </footer>
  )
}
