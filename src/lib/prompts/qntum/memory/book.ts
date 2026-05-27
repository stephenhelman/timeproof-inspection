import type { BookContext } from '../types';

export function getBookMemoryModule(context: BookContext): string {
  const {
    qualify_summary, available_slots, locked_slot, trigger,
    timePreference, timeWindowLabel,
  } = context;
  const { problem_confirmed, specific_issue, roof_age, decision_maker_confirmed } = qualify_summary;

  let memory = `QUALIFICATION_SUMMARY:\n`;

  if (problem_confirmed && specific_issue) {
    memory += `Homeowner confirmed a specific issue: ${specific_issue}. Use this in the transition message — reference it naturally as the reason sending someone out makes sense.\n`;
  } else if (roof_age === '20+ years' || roof_age === '15–20 years') {
    memory += `No confirmed problem, but roof age is ${roof_age}. Frame the inspection as proactive — catching things early.\n`;
  } else {
    memory += `General interest — no confirmed problem, no strong age signal. Frame as a good-faith look at what they're actually dealing with.\n`;
  }

  if (!decision_maker_confirmed) {
    memory += `\nDECISION MAKER NOTE: Not confirmed. If the homeowner hesitates, this may be the real constraint. Do not raise it proactively — but if stalling emerges, ask gently whether they need to check with anyone else.\n`;
  }

  // Slot context
  if (available_slots.length > 0) {
    const slotLabels = available_slots.slice(0, 2).map(s => s.label).join(' or ');
    memory += `\nAVAILABLE_SLOTS: ${slotLabels}\nPresent slots as "time blocked in your area" — not "our calendar has openings."\nOffer two options max. One is better when possible.\n`;
  } else {
    memory += `\nAVAILABLE_SLOTS: No slots loaded yet.\n`;
    memory += `To fetch slots: emit [CHECK_MORE_SLOTS].\n`;
    memory += `If the homeowner has stated a time preference (e.g. "after 2 pm"), emit [CHECK_MORE_SLOTS: HH:MM] in 24-hour format — the system will fetch slots at or after that time.\n`;
  }

  if (locked_slot) {
    memory += `\nLOCKED_SLOT: ${locked_slot.label} — this slot is currently held for this lead. Offer it first.\n`;
  }

  // Time preference context
  if (timePreference !== 'any') {
    memory += `\nTIME_PREFERENCE: The homeowner has indicated they prefer ${timeWindowLabel}. Only offer slots within this window. Do not suggest times outside it.\n`;
  }

  // Trigger context
  if (trigger === 'qualified_handoff') {
    memory += `\nTRIGGER: This is the first message in the booking conversation. The homeowner just finished qualifying. Send the transition message now — do not wait for a homeowner reply.\n`;
  } else if (trigger === 'stall_followup') {
    memory += `\nTRIGGER: The homeowner said they needed to check their schedule 24 hours ago. This is the one follow-up. Check if the original slot is still available. If yes — reference it. If not — offer fresh slots. One follow-up only.\n`;
  }

  return memory;
}
