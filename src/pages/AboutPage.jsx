import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './InfoPage.module.css'

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <Nav />
      <div className={`container container--narrow ${styles.content}`}>

        <div className={styles.hero}>
          <div className={styles.chip}>About</div>
          <h1 className={styles.title}>Built for golfers,<br />by a golfer.</h1>
          <p className={styles.lead}>
            TeeTimeQuest exists because organizing a round with four people shouldn't take
            a week of back-and-forth texts.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <span className={styles.cardIcon}>⛳</span>
            <h2 className={styles.cardTitle}>The problem</h2>
            <p className={styles.cardText}>
              Every golfer knows the drill. Someone says "let's play this weekend" and then
              47 messages later, half the group can't make it and nobody booked a tee time.
              TeeTimeQuest cuts that entire loop down to one round-trip.
            </p>
          </div>

          <div className={styles.card}>
            <span className={styles.cardIcon}>🏌️</span>
            <h2 className={styles.cardTitle}>The solution</h2>
            <p className={styles.cardText}>
              The organizer creates a round in 60 seconds. Everyone gets a personal link
              to mark their available days. TeeTimeQuest finds the overlap, surfaces public
              courses near your group, and suggests an open tee time.
            </p>
          </div>

          <div className={styles.card}>
            <span className={styles.cardIcon}>🤝</span>
            <h2 className={styles.cardTitle}>Built with care</h2>
            <p className={styles.cardText}>
              TeeTimeQuest is a passion project. No VC funding, no ads, no selling your data.
              Just a clean tool that does one thing well — so you can spend less time
              scheduling and more time on the course.
            </p>
          </div>

          <div className={styles.card}>
            <span className={styles.cardIcon}>🗺️</span>
            <h2 className={styles.cardTitle}>What's next</h2>
            <p className={styles.cardText}>
              Live tee-time booking integrations, course reviews, handicap tracking, and
              a full round history are all on the roadmap. If you have ideas,{' '}
              <Link to="/contact" className={styles.inlineLink}>send them our way</Link>.
            </p>
          </div>
        </div>

        <div className={styles.cta}>
          <p className={styles.ctaText}>Ready to stop scheduling and start playing?</p>
          <Link to="/create" className={styles.ctaBtn}>
            Plan a round →
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
