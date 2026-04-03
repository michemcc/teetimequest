import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './InfoPage.module.css'

const sections = [
  {
    title: 'What we collect',
    body: `When you create a round, we store the names and email addresses you enter, along with availability data submitted by players. We don't require passwords or account creation. All data is stored locally in your browser (localStorage) in the current version , nothing is sent to a server yet.`
  },
  {
    title: 'How we use it',
    body: `We use the information you provide solely to coordinate your golf round , matching availability, suggesting courses, and generating invite links. We do not sell, share, or use your data for advertising.`
  },
  {
    title: 'Cookies',
    body: `TeeTimeQuest uses a single localStorage entry to remember your light/dark mode preference. We do not use tracking cookies or third-party analytics cookies.`
  },
  {
    title: 'Third-party services',
    body: `Google Fonts are loaded to render the Syne and Outfit typefaces. This involves a network request to Google's servers. In a future version with server-side storage, we may use services like Supabase or PlanetScale , this policy will be updated accordingly.`
  },
  {
    title: 'Data retention',
    body: `Because data is currently stored in your browser's localStorage, it persists until you clear your browser data. There is no server-side data retention at this time.`
  },
  {
    title: 'Your rights',
    body: `You can clear all TeeTimeQuest data at any time by clearing your browser's localStorage. If you have questions about your data, contact us at hello@teetimequest.com.`
  },
  {
    title: 'Changes to this policy',
    body: `We may update this privacy policy as the product evolves. Material changes will be noted at the top of this page with a date. Continued use of TeeTimeQuest after changes constitutes acceptance of the updated policy.`
  },
]

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <Nav />
      <div className={`container container--narrow ${styles.content}`}>

        <div className={styles.hero}>
          <div className={styles.chip}>Privacy</div>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lead}>
            Short version: we collect only what's needed to run your round. We don't sell data. Ever.
          </p>
          <p className={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className={styles.policyList}>
          {sections.map(s => (
            <div key={s.title} className={styles.policySection}>
              <h2 className={styles.policySectionTitle}>{s.title}</h2>
              <p className={styles.policySectionBody}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
