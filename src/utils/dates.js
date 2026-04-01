import { format, addDays, startOfDay, parseISO } from 'date-fns'

/** Generate an array of date strings (YYYY-MM-DD) for the next N days */
export function getNextNDays(n = 30) {
  const today = startOfDay(new Date())
  return Array.from({ length: n }, (_, i) => format(addDays(today, i + 1), 'yyyy-MM-dd'))
}

/** Format a date string nicely */
export function formatDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'EEE, MMM d')
  } catch {
    return dateStr
  }
}

/** Format a date string for the results page */
export function formatDateLong(dateStr) {
  try {
    return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy')
  } catch {
    return dateStr
  }
}

/** Group an array of date strings by month */
export function groupByMonth(dates) {
  const groups = {}
  dates.forEach(d => {
    try {
      const month = format(parseISO(d), 'MMMM yyyy')
      if (!groups[month]) groups[month] = []
      groups[month].push(d)
    } catch {}
  })
  return groups
}
