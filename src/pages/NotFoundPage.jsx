import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <Nav />
      <div className={`container container--xs ${styles.content}`}>
        <div className={styles.inner}>
          <div className={styles.icon}>⛳</div>
          <h1 className={styles.title}>Out of bounds</h1>
          <p className={styles.desc}>This page doesn't exist. Might be a bad link or a typo in the URL.</p>
          <Link to="/" className={styles.btn}>
            Back to TeeTimeQuest
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
