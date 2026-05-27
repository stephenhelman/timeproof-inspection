import type { BookContext } from '../types'

export function getBookOpenerModule(context: BookContext): string {
  const {
    message_history_count, trigger, qualify_summary,
    available_slots, address_collected, confirmed_address,
  } = context
  const { problem_confirmed, specific_issue, roof_age } = qualify_summary

  if (message_history_count > 0 && trigger !== 'qualified_handoff') {
    return `OPENER_INSTRUCTION:
Conversation in progress. Do not re-introduce. Pick up naturally from where the thread left off. Follow the depth module directive.`
  }

  if (trigger === 'stall_followup') {
    const slot1 = available_slots[0]?.label ?? 'a time this week'
    return `OPENER_TYPE: stall_followup

FIRST_MESSAGE_INSTRUCTION:
The homeowner said they'd check their schedule. It's been 24 hours. This is the one follow-up — don't make it feel like pressure.

If the original slot is still available:
"Hey — still have that ${slot1} if that works. Were you able to check?"

If the original slot is gone:
"Wanted to follow up — still have some time available this week. Did you get a chance to check your schedule?"

One sentence. Stop. This is the only stall follow-up.`
  }

  // qualified_handoff — STATE 1: address not yet collected
  if (!address_collected) {
    if (problem_confirmed && specific_issue) {
      return `OPENER_TYPE: qualified_handoff_ask_address_problem

FIRST_MESSAGE_INSTRUCTION:
Send the transition message now. The homeowner just qualified. Reference the specific issue they mentioned as the reason sending someone out makes sense. Then ask for their address — do NOT offer time slots yet.

Direction: "Based on what you mentioned about the ${specific_issue}, it makes sense to get someone out there. What address should we send our inspector to?"

One message. Two sentences max. Ask for address. Stop.`
    }

    if (roof_age === '20+ years' || roof_age === '15–20 years') {
      return `OPENER_TYPE: qualified_handoff_ask_address_age

FIRST_MESSAGE_INSTRUCTION:
Send the transition message now. No confirmed problem — roof age is the context. Ask for their address — do NOT offer time slots yet.

Direction: "Given the age of the roof, this is exactly the kind of thing worth catching early. What address should we send our inspector to?"

One message. Two sentences max. Ask for address. Stop.`
    }

    return `OPENER_TYPE: qualified_handoff_ask_address_default

FIRST_MESSAGE_INSTRUCTION:
Send the transition message now. General qualification — no specific problem, no strong age signal. Ask for their address — do NOT offer time slots yet.

Direction: "Based on what you shared, sounds like it's worth getting someone out there for a proper look. What address should we send our inspector to?"

One message. Two sentences max. Ask for address. Stop.`
  }

  // STATE 2: address already collected, move to slot offering
  const slot1 = available_slots[0]?.label ?? 'a time this week'
  const slot2 = available_slots[1]?.label ?? null
  const slotStr = slot2 ? `${slot1} or ${slot2}` : slot1

  return `OPENER_TYPE: qualified_handoff_offer_slots

FIRST_MESSAGE_INSTRUCTION:
Address has been confirmed: ${confirmed_address}. Move directly to slot offering.

Direction: "We've got time blocked in your area — ${slotStr}. Does either of those work?"

One message. One question. Stop.`
}
