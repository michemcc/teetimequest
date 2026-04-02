import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './CityPicker.module.css'

/**
 * CityPicker — autocomplete city selector using OpenStreetMap Nominatim (free, no API key).
 * Debounces requests, shows a styled dropdown, and returns the selected place name.
 */
export default function CityPicker({ value, onChange, id, placeholder }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  // Sync external value → internal query
  useEffect(() => { setQuery(value || '') }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(q)}&featuretype=city`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      // Filter to city/town/village/municipality results and format labels
      const places = data
        .filter(p => ['city','town','village','municipality','county','suburb','neighbourhood','administrative'].includes(p.type) || p.class === 'place')
        .slice(0, 6)
        .map(p => {
          const a = p.address || {}
          const city = a.city || a.town || a.village || a.municipality || a.county || p.display_name.split(',')[0]
          const state = a.state || a.region || ''
          const country = a.country_code?.toUpperCase() || ''
          const label = [city, state, country].filter(Boolean).join(', ')
          return { label, lat: p.lat, lon: p.lon, placeId: p.place_id }
        })
        // deduplicate by label
        .filter((p, i, arr) => arr.findIndex(x => x.label === p.label) === i)
      setSuggestions(places)
      setOpen(places.length > 0)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInputChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange(q) // pass raw text immediately so parent is never empty
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 320)
  }

  function handleSelect(place) {
    setQuery(place.label)
    onChange(place.label)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          className={styles.input}
          placeholder={placeholder || 'e.g. Boston, MA'}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
          role="combobox"
        />
        {loading && (
          <span className={styles.spinner} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </span>
        )}
        {!loading && query.length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => { setQuery(''); onChange(''); setSuggestions([]); setOpen(false); inputRef.current?.focus() }}
            aria-label="Clear"
            tabIndex={-1}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className={styles.dropdown} role="listbox" aria-label="City suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === activeIndex}
              className={`${styles.option} ${i === activeIndex ? styles.optionActive : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <svg className={styles.optionIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                <circle cx="12" cy="10" r="2.5"/>
              </svg>
              <span className={styles.optionLabel}>{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
