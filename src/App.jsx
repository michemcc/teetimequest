import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import LandingPage from './pages/LandingPage'
import CreateRoundPage from './pages/CreateRoundPage'
import AvailabilityPage from './pages/AvailabilityPage'
import ResultsPage from './pages/ResultsPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import PrivacyPage from './pages/PrivacyPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreateRoundPage />} />
        <Route path="/availability/:roundId/:playerId" element={<AvailabilityPage />} />
        <Route path="/results/:roundId" element={<ResultsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
