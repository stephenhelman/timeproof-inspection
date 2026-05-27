import type { BookContext } from '../types'

export function getBookDepthModule(context: BookContext): string {
  const {
    message_history_count,
    last_message_context,
    available_slots,
    locked_slot,
    address_collected,
    confirmed_address,
    qualify_summary,
    time_preference,
    trigger,
  } = context

  // ── Hard overrides ──────────────────────────────────────────────────────────

  if (last_message_context === 'escalation_needed') {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
Send the escalation message and stop.

ESCALATION_MESSAGE:
"I want to make sure you get the right answer on that — let me have someone from our team give you a quick call. What time works best?"

LENGTH_RULE: No further exchanges.`
  }

  if (last_message_context === 'confirmed') {
    return `CONVERSATION_POSITION: booked

CURRENT_DIRECTIVE:
The homeowner confirmed a slot.
Use the EXACT slot label from locked_slot — do not reformat or recalculate the date or day name.

Confirmation message:
"You're all set — got you down for [locked_slot.label]. Our inspector will reach out the morning of with a heads up. See you then."

Emit: [BOOKED: YYYY-MM-DD HH:MM]
Use the date and time from locked_slot exactly. Use 24-hour time in the signal.

LENGTH_RULE: One message. Stop.`
  }

  // ── STATE 1 — Address collection (limit: 5 exchanges) ──────────────────────
  // Run until homeowner provides address. Hard limit at 5 exchanges then stall.

  if (!address_collected) {

    if (last_message_context === 'stall' || message_history_count >= 5) {
      return `CONVERSATION_POSITION: stall_no_address

CURRENT_DIRECTIVE:
The homeowner hasn't provided an address after several exchanges. Don't push. Close warmly and emit [STALL].

"No problem — just reach out when you're ready to get someone out there. We're easy to find."

Emit: [STALL]

LENGTH_RULE: One message. Stop.`
    }

    if (trigger === 'qualified_handoff' && message_history_count === 0) {
      return `CONVERSATION_POSITION: opening_address_request

CURRENT_DIRECTIVE:
This is the first message from the book bot.
Ask for the address naturally, connecting it to what was learned in the qualify conversation.

${qualify_summary.specific_issue
  ? `Reference their specific issue: "${qualify_summary.specific_issue}"`
  : qualify_summary.roof_age
    ? `Reference the roof age: "${qualify_summary.roof_age}"`
    : 'Keep it simple and direct.'}

Message direction:
"Based on what you mentioned about [issue/age], it makes sense to get someone out there. What address should we send our inspector to?"

One question. Stop. Wait for address.

LENGTH_RULE: Two sentences max.`
    }

    return `CONVERSATION_POSITION: waiting_for_address

CURRENT_DIRECTIVE:
You are waiting for the homeowner to provide their address. If they asked a question instead, answer it briefly then redirect back to the address.

If they seem hesitant about providing their address:
"Just need it so our inspector knows where to head — we'll confirm everything before we come out."

One question. Stop.

LENGTH_RULE: Two sentences max.`
  }

  // ── STATE 2 — Slot selection (NO message count limit) ──────────────────────
  // Address has been collected. Run until [BOOKED], [STALL], or not interested.

  if (last_message_context === 'stall') {
    return `CONVERSATION_POSITION: stall_detected

CURRENT_DIRECTIVE:
Homeowner needs to check their schedule or check with someone. Acknowledge and let go.

"No problem — I'll check back with you. Take your time."

Emit: [STALL]

LENGTH_RULE: One message. Stop.`
  }

  if (last_message_context === 'slot_rejected' ||
      last_message_context === 'needs_different_time') {
    const altSlots = available_slots
      .slice(0, 3)
      .map(s => s.label)
      .join(' or ')

    return `CONVERSATION_POSITION: re_offering

CURRENT_DIRECTIVE:
The homeowner said the offered time doesn't work. Offer alternatives naturally.

${!altSlots
  ? 'No slots available right now. Emit [CHECK_MORE_SLOTS].'
  : `Alternatives: ${altSlots}
Offer naturally — not as a numbered list.
"Also have ${altSlots} — any of those better?"`}

LENGTH_RULE: One message. One question. Stop.`
  }

  if (last_message_context === 'address_provided') {
    return `CONVERSATION_POSITION: address_confirmed

CURRENT_DIRECTIVE:
The homeowner just gave their address. Confirm it naturally and ask about time preference in the same message. Do not offer slots yet — ask time first.

"Got it — heading to ${confirmed_address}. Does morning or afternoon tend to work better for you?"

TIME OF DAY REFERENCE (use these exact definitions):
  Morning:   start of day to 12:00 PM
  Afternoon: 12:00 PM to 5:00 PM
  Evening:   5:00 PM to end of day

One message. One question. Stop.

LENGTH_RULE: Two sentences max.`
  }

  // Default slot offering state
  const slotStr = available_slots
    .slice(0, 2)
    .map(s => s.label)
    .join(' or ')

  const timeContext = time_preference !== 'any'
    ? `TIME WINDOW ACTIVE: Only offer slots within the homeowner's stated preference. Do not offer slots outside this window even if they exist.\n\n`
    : ''

  return `CONVERSATION_POSITION: offering_slots

${timeContext}CURRENT_DIRECTIVE:
No message count limit — address has been collected. Run this conversation until booked or stalled.

${available_slots.length === 0
  ? `No slots available. Emit [CHECK_MORE_SLOTS] and apologize naturally.
"Let me check what else we have open — give me just a second."`
  : `Available: ${slotStr}

${locked_slot
  ? `You already offered ${locked_slot.label}.
If not rejected, lead with that slot first.`
  : `Offer the slots naturally as routing language:
"We've got time blocked in your area ${slotStr} — does either of those work?"`}

When homeowner confirms a slot:
Repeat it back clearly and emit:
[BOOKED: YYYY-MM-DD HH:MM]
Use 24-hour time in the signal.
Use the EXACT date and label from available_slots.
DO NOT recalculate or reformat the day name.

Watch for stall signals ("let me check", "need to ask", "not sure yet") → emit [STALL]`}

LENGTH_RULE: Two sentences max. One question. Stop.`
}
