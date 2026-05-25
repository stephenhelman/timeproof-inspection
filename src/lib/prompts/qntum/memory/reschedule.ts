import type { RescheduleContext } from '../types';

export function getRescheduleMemoryModule(context: RescheduleContext): string {
  const {
    reschedule_reason,
    inspection_completed,
    inspection_findings,
    prior_outcome,
    dispo_notes,
    available_slots,
    locked_slot,
    from_booking_stall,
    has_pivoted_to_revival,
  } = context;

  let memory = `RESCHEDULE_CONTEXT:\n`;
  memory += `Reason: ${reschedule_reason}.\n`;

  if (from_booking_stall) {
    memory += `This lead came from a booking stall — the homeowner was qualified and offered a slot, said they'd check their schedule, and never responded. Jordan is following up after Alex exhausted the stall sequence.\n`;
  }

  if (inspection_completed && inspection_findings) {
    memory += `\nINSPECTION FINDINGS (available if pivot to revival occurs):\n${inspection_findings}\n`;
  }

  if (prior_outcome) {
    memory += `\nPrior outcome: ${prior_outcome}.`;
  }

  if (dispo_notes) {
    memory += `\nRep notes: ${dispo_notes}. Background context only — do not reference directly.`;
  }

  // Slot context
  if (available_slots.length > 0) {
    const slotLabels = available_slots.slice(0, 2).map(s => s.label).join(' or ');
    memory += `\n\nAVAILABLE_SLOTS: ${slotLabels}\nOffer ONE slot at a time — not a menu. Paralysis kills bookings.\n`;
  } else {
    memory += `\n\nAVAILABLE_SLOTS: No slots loaded yet. End with [CHECK_MORE_SLOTS] if needed.\n`;
  }

  if (locked_slot) {
    memory += `LOCKED_SLOT: ${locked_slot.label} — offer this first.\n`;
  }

  if (has_pivoted_to_revival) {
    memory += `\nPIVOT_STATE: This conversation has pivoted from rescheduling to revival mode. Stop offering slots. Follow the revival NEPQ sequence from the depth module. Emit [RE_QUALIFY] or [DEAD] — not [RESCHEDULED].\n`;
    if (inspection_findings) {
      memory += `Use ONE inspection finding as a consequence hook if relevant.\n`;
    } else {
      memory += `No inspection findings available. Start from curiosity — is the roof still something they're thinking about?\n`;
    }
  }

  return memory;
}
