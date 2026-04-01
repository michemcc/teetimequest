import { useState } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './InfoPage.module.css'

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  function handleSubmit(e) {
    e.preventDefault()
    // TODO: wire up to a real form endpoint (Formspree, Resend, etc.)
    setSent(true)
  }

  return (
    <div className={styles.page}>
      <Nav />
      <div className={`container container--narrow ${styles.content}`}>

        <div className={styles.hero}>
          <div className={styles.chip}>Contact</div>
          <h1 className={styles.title}>Get in touch.</h1>
          <p className={styles.lead}>
            Bug report, feature idea, or just want to say hi — we'd love to hear from you.
          </p>
        </div>

        {sent ? (
          <div className={styles.successCard}>
            <span className={styles.successIcon}>✓</span>
            <div>
              <p className={styles.successTitle}>Message sent!</p>
              <p className={styles.successDesc}>We'll get back to you as soon as we can. Thanks for reaching out.</p>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="c-name">Name</label>
                <input id="c-name" className={styles.input} type="text" placeholder="Your name"
                  value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="c-email">Email</label>
                <input id="c-email" className={styles.input} type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="c-msg">Message</label>
              <textarea id="c-msg" className={styles.textarea} rows={5}
                placeholder="What's on your mind?"
                value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} required />
            </div>
            <button type="submit" className={styles.submitBtn}>Send message →</button>
          </form>
        )}

        <div className={styles.altContact}>
          <p className={styles.altContactText}>Prefer email directly?</p>
          <a href="mailto:hello@teetimequest.com" className={styles.inlineLink}>hello@teetimequest.com</a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
