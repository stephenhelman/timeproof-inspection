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

// Get today's date string in MT (YYYY-MM-DD)
export function getTodayMT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MT_TIMEZONE }).format(new Date())
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
//
// NEGATION-AWARE (Bug-B fix): a homeowner who says "I can't do mornings" is
// stating an ANTI-preference, not a preference. The old version matched the bare
// word `morning` and returned { preference: 'morning' } — so an evenings-only lead
// who opened with "can't do mornings" was handed morning slots, the exact
// re-offered-rejected-mornings symptom. We now (1) detect negated windows and
// exclude them, and (2) when exactly one window remains after exclusion, infer it
// as the preference. A window is "negated" when a negation token (can't / cannot /
// no / not / never / unable / hate / avoid) precedes the window word within a short
// span.
export function detectTimePreference(
  message: string
): { preference: TimeOfDay; startHour?: number } | null {
  const lower = message.toLowerCase()

  // Which windows are explicitly ruled OUT ("can't do mornings", "no afternoons").
  const NEG = `(?:can'?t|cannot|can not|won'?t|wont|no|not|never|unable to|don'?t|do not|avoid|hate|rather not|prefer not)`
  // The negated window may sit at the head of an "or"/"and"/comma-joined list — one
  // negation distributes across it ("no afternoons or evenings", "can't do mornings
  // or afternoons"). The LIST prefix consumes the intervening window words.
  const LIST = `(?:\\w+\\s+(?:or|and|,)\\s+)*`
  const negated = (window: string): boolean =>
    new RegExp(`${NEG}\\s+(?:do\\s+|make\\s+)?(?:the\\s+)?${LIST}${window}`).test(lower)
  const negMorning   = negated('mornings?')   || negated('early')
  const negAfternoon = negated('afternoons?') || negated('middays?') || negated('noon')
  const negEvening   = negated('evenings?')   || negated('nights?') || negated('late')

  // "after X [am/pm]" — explicit hour (only if not part of a negation like "not after 5").
  const afterMatch = lower.match(/(?<!not\s)(?<!no\s)after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (afterMatch) {
    let hour       = parseInt(afterMatch[1], 10)
    const ampm     = afterMatch[3]
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    // Default to PM for ambiguous low numbers (1–8 with no ampm)
    if (!ampm && hour >= 1 && hour <= 8) hour += 12
    // "after 5pm" is an evening floor; "after 12/2pm" stays afternoon.
    return { preference: hour >= 17 ? 'evening' : 'afternoon', startHour: hour }
  }

  // Bare clock time — "6pm", "5 or 6pm", "at 7 pm". `\bpm\b` can't catch the attached
  // form ("6pm"), so match the digit+meridiem directly. A stated PM hour maps to its
  // window (≥5pm → evening, noon–4pm → afternoon); a stated AM hour → morning. Take
  // the LAST such mention so "5 or 6pm" lands on 6pm (the firmer ask).
  const clockMatches = [...lower.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/g)]
  if (clockMatches.length > 0) {
    const m = clockMatches[clockMatches.length - 1]
    let hour = parseInt(m[1], 10)
    const ampm = m[3]
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    if (hour >= 17) return { preference: 'evening', startHour: hour }
    if (hour >= 12) return { preference: 'afternoon', startHour: hour }
    return { preference: 'morning' }
  }

  // POSITIVE signals — but only when that window is NOT negated. "can't do mornings"
  // must not trip the morning branch even though the word "morning" appears.
  if (!negMorning && /\bmorning\b|\bmornings\b|early|before noon|before 12|\bam\b/.test(lower)) {
    return { preference: 'morning' }
  }
  if (!negAfternoon && /\bafternoon\b|\bafternoons\b|after noon|after 12|\bpm\b|lunchtime/.test(lower)) {
    return { preference: 'afternoon' }
  }
  if (!negEvening && /\bevening\b|\bevenings\b|after work|after 5|late afternoon|\bnight\b|\bnights\b/.test(lower)) {
    return { preference: 'evening' }
  }

  // No positive signal, but a negation narrowed it to a single remaining window →
  // infer that window. "I can't do mornings" → evening OR afternoon are both open;
  // only infer when exactly ONE window survives the exclusions.
  const anyNeg = negMorning || negAfternoon || negEvening
  if (anyNeg) {
    const survivors: TimeOfDay[] = []
    if (!negMorning) survivors.push('morning')
    if (!negAfternoon) survivors.push('afternoon')
    if (!negEvening) survivors.push('evening')
    if (survivors.length === 1) return { preference: survivors[0] }
    // Multiple windows still open — let the caller fall back to stored prefs / "any"
    // rather than guessing. (Don't return 'morning' for a "can't do mornings" lead.)
  }

  // Flexible / any-time signals
  if (/anytime|any time|flexible|whenever|doesn.?t matter|don.?t mind|whatever works/.test(lower)) {
    return { preference: 'any' }
  }

  return null
}
