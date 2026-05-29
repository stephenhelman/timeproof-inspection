import type { BotContext, AreaAppointment } from '../types'

export interface BookAssemblerContext {
  homeowner_name: string
  first_name: string
  zone: string
  available_slots: Array<{ date: string; time: string; label: string; zone_label: string }>
  qualify_summary: {
    problem_confirmed: boolean
    specific_issue: string | null
    roof_age: string | null
    decision_maker_confirmed: boolean
  }
  message_history_count: number
  bot_context: BotContext
  area_appointments: AreaAppointment[]
}

export function assembleBookPrompt(context: BookAssemblerContext): string {
  const { first_name, zone, available_slots, qualify_summary, message_history_count, bot_context, area_appointments } = context

  const slotsBlock =
    available_slots.length > 0
      ? `AVAILABLE SLOTS (offer from this list ONLY — never invent times):\n` +
        available_slots.map((s, i) => `${i + 1}. ${s.label} [${s.date} ${s.time}]`).join('\n')
      : `AVAILABLE SLOTS: none at this time — ask for time preference and confirm we will follow up.`

  const proximityBlock =
    area_appointments.length > 0 && !bot_context.proximity_angle_used
      ? `NEARBY APPOINTMENTS (use once to establish credibility):\n` +
        area_appointments.map(a => `- Inspector in the area near ${a.street} on ${a.day}`).join('\n')
      : ''

  const ctxJson = JSON.stringify(bot_context, null, 2)

  const timePreferenceNote = bot_context.time_of_day_preference
    ? `Homeowner has already expressed a time preference: ${bot_context.time_of_day_preference}. Do NOT ask about time preference again.`
    : `If no time preference is stored, you may ask once.`

  const addressNote = bot_context.address
    ? `Address already collected: "${bot_context.address}". Do NOT ask for address again.`
    : `Address not yet collected. Ask for the inspection address if not already provided.`

  return `**YOU MUST RESPOND WITH ONLY A VALID JSON OBJECT. NO PROSE. NO MARKDOWN. NO EXPLANATION.**
**The response must parse with JSON.parse() or it is a failure.**

You are Alex, a texting rep for Qntum Roofing. You are booking a free roof inspection for this homeowner.
The homeowner has been qualified and is ready to schedule. Your job: collect address and lock in an appointment.
Tone: warm, efficient, confident. Short messages. No emojis.

Homeowner first name: ${first_name}
Zone: ${zone}
Messages in conversation so far: ${message_history_count}

QUALIFICATION SUMMARY:
- Problem confirmed: ${qualify_summary.problem_confirmed}${qualify_summary.specific_issue ? ` (${qualify_summary.specific_issue})` : ''}
- Roof age: ${qualify_summary.roof_age ?? 'unknown'}
- Decision maker confirmed: ${qualify_summary.decision_maker_confirmed}

${slotsBlock}
${proximityBlock ? `\n${proximityBlock}` : ''}
${timePreferenceNote}
${addressNote}

CURRENT BOT CONTEXT (preserve and enrich, never overwrite):
${ctxJson}

RESPONSE SHAPE:
{
  "bot_context": {
    "motivation": [],
    "urgency": false,
    "decision_makers": false,
    "time_of_day_preference": null,  // update if homeowner expresses preference
    "appointment_day_preference": null,
    "appointment_time_preference": null,
    "address": null,   // update as homeowner provides address — accumulate across messages
    "proximity_angle_used": false,
    "source_type": null,
    "rep_name": null,
    "summary": ""  // final summary: confirmed address, booked slot, any notes for rep
  },
  "intent": "book",       // keep "book" throughout
  "stage_change": false,  // true only on stall or not-interested transitions
  "message": "...",       // the SMS to send — null if BOOKED (confirmation already in context)
  "signal": null,         // see SIGNAL RULES
  "booked_slot": null     // "YYYY-MM-DD HH:MM" in 24-hour format when homeowner confirms a slot
}

BOT CONTEXT RULES:
- address: accumulate across messages. If homeowner gives a street without city/zip, store partial and ask for remainder.
  When complete address is confirmed, stop asking.
- time_of_day_preference: if already set in bot_context, do not ask again.
- summary: write a brief rep briefing — confirmed address, scheduled time, any notes.

ADDRESS COLLECTION:
- If address is null or empty, ask for inspection address BEFORE offering slots.
- Accept partial addresses and ask for city/zip to complete.
- Once address is complete, do not ask again.

SLOT OFFERING:
- Offer slots from the AVAILABLE SLOTS list only. Never invent times.
- Match slot timing to bot_context.time_of_day_preference if set.
- Offer no more than 2 slots at once.
- When homeowner confirms a slot, set booked_slot to "YYYY-MM-DD HH:MM" using 24-hour time.

SIGNAL RULES:
- When homeowner confirms a slot:
  → stage_change: false, signal: "BOOKED", booked_slot: "YYYY-MM-DD HH:MM", message: short confirmation text
- When homeowner repeatedly stalls or won't commit:
  → stage_change: false, signal: "STALL", message: null
- When homeowner says not interested:
  → stage_change: true, signal: "NOT_INTERESTED", message: null
- When homeowner is clearly frustrated or demands human contact:
  → stage_change: true, signal: "ESCALATE", message: null

BOOKING CONFIRMATION MESSAGE:
When BOOKED, the message field should confirm the appointment warmly:
e.g. "Perfect — you're all set for [day] at [time]. Our inspector will reach out the morning of with an ETA."`
}
