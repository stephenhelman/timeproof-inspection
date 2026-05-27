// ─────────────────────────────────────────────────────────────────────────────
// TIME UTILITIES — Mountain Time aware
// All slot logic operates in Mountain Time (America/Denver)
// ─────────────────────────────────────────────────────────────────────────────

export const MT_TIMEZONE = 'America/Denver'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any'

// Time of day windows in MT (24h hours, end is exclusive)
export const TIME_WINDOWS: Record<TimeOfDay, {
  startHour: number
  endHour:   number
  label:     string
}> = {
  morning:   { startHour: 8,  endHour: 12, label: 'morning (8am–12pm)'   },
  afternoon: { startHour: 12, endHour: 17, label: 'afternoon (12pm–5pm)' },
  evening:   { startHour: 17, endHour: 20, label: 'evening (5pm–8pm)'    },
  any:       { startHour: 8,  endHour: 20, label: 'anytime'               },
}

// Get current date and time in Mountain Time
export function getNowMT(): {
  date:        Date
  dateStr:     string    // YYYY-MM-DD in MT
  hour:        number    // current hour in MT (0–23)
  minute:      number    // current minute in MT
  isMorning:   boolean
  isAfternoon: boolean
  isEvening:   boolean
} {
  const now = new Date()

  const mtParts = new Intl.DateTimeFormat('en-US', {
    timeZone: MT_TIMEZONE,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(now)

  const get = (type: string) =>
    mtParts.find(p => p.type === type)?.value ?? '0'

  const year   = get('year')
  const month  = get('month')
  const day    = get('day')
  const hour   = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)

  return {
    date:        now,
    dateStr:     `${year}-${month}-${day}`,
    hour,
    minute,
    isMorning:   hour < 12,
    isAfternoon: hour >= 12 && hour < 17,
    isEvening:   hour >= 17,
  }
}

// Get tomorrow's date string in MT (YYYY-MM-DD)
export function getTomorrowMT(): string {
  const now       = new Date()
  const tomorrow  = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MT_TIMEZONE,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
  }).formatToParts(tomorrow)

  const get = (type: string) =>
    parts.find(p => p.type === type)?.value ?? '0'

  return `${get('year')}-${get('month')}-${get('day')}`
}

// Convert a YYYY-MM-DD date string and an MT wall-clock hour to Unix ms (UTC).
// Uses the same offset-correction algorithm as formatDateLabel in bot-engine.ts.
export function toUnixMs(dateStr: string, hourMT: number): number {
  const [year, month, day] = dateStr.split('-').map(Number)

  // Guess: UTC hour = MT wall-clock hour (ignores DST offset to start)
  const guess = new Date(Date.UTC(year, month - 1, day, hourMT, 0, 0))

  // Find what MT hour this UTC instant actually represents
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MT_TIMEZONE,
    hour:     'numeric',
    hour12:   false,
  }).formatToParts(guess)
  const displayedH    = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const offsetMinutes = (displayedH - hourMT) * 60

  return guess.getTime() - offsetMinutes * 60 * 1000
}

// Detect time-of-day preference from a homeowner message.
// Returns null if no preference is detectable.
export function detectTimePreference(
  message: string
): { preference: TimeOfDay; startHour?: number } | null {
  const lower = message.toLowerCase()

  // "after X [am/pm]" — extract explicit hour
  const afterMatch = lower.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (afterMatch) {
    let hour       = parseInt(afterMatch[1], 10)
    const ampm     = afterMatch[3]
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    // Default to PM for ambiguous low numbers (1–8 with no ampm)
    if (!ampm && hour >= 1 && hour <= 8) hour += 12
    return { preference: 'afternoon', startHour: hour }
  }

  // Morning signals
  if (/\bmorning\b|early|before noon|before 12|\bam\b/.test(lower)) {
    return { preference: 'morning' }
  }

  // Afternoon signals
  if (/\bafternoon\b|after noon|after 12|\bpm\b|lunchtime/.test(lower)) {
    return { preference: 'afternoon' }
  }

  // Evening signals
  if (/\bevening\b|after (work|5)|late afternoon/.test(lower)) {
    return { preference: 'evening' }
  }

  // Flexible / any-time signals
  if (/anytime|any time|flexible|whenever|doesn.?t matter|don.?t mind|whatever works/.test(lower)) {
    return { preference: 'any' }
  }

  return null
}
