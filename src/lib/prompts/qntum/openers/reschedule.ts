import type { RescheduleContext } from '../types';

export function getRescheduleOpenerModule(context: RescheduleContext): string {
  const { message_history_count, reschedule_reason, available_slots } = context;

  if (message_history_count > 0) {
    return `OPENER_INSTRUCTION:
Conversation in progress. Do not re-introduce. Pick up naturally. Follow the depth module.`;
  }

  const slot1 = available_slots[0]?.label ?? 'a time this week';

  // Each opener introduces Jordan with Qntum Roofing and is calibrated to the reason
  switch (reschedule_reason) {

    case 'cancelled_by_homeowner':
      return `OPENER_TYPE: cancelled_by_homeowner

FIRST_MESSAGE_INSTRUCTION:
Zero judgment. Something came up — totally fine. Offer one slot naturally.

Introduce yourself as Jordan with Qntum Roofing. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — something came up with the inspection time, totally understand. Does ${slot1} work better?"`;

    case 'one_legger':
      return `OPENER_TYPE: one_legger

FIRST_MESSAGE_INSTRUCTION:
Frame as wanting everyone part of the conversation — not a disqualification. Ask about availability, not decision authority.

Introduce yourself as Jordan. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — looks like we may have missed getting everyone together for the inspection. When would work for you all to be there?"`;

    case 'time_constraint':
      return `OPENER_TYPE: time_constraint

FIRST_MESSAGE_INSTRUCTION:
Take ownership — the inspection ran short on time. Offer to come back and finish it properly.

Introduce yourself as Jordan. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — we ran short on time and didn't get to finish the inspection properly. Want to come back out and do this right — does ${slot1} work?"`;

    case 'porched':
      return `OPENER_TYPE: porched

FIRST_MESSAGE_INSTRUCTION:
No guilt. Looks like a timing miss, not a rejection. Ask if they still want to get it done.

Introduce yourself as Jordan. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — looks like we may have just missed each other. Still want to get that done?"`;

    case 'rep_schedule_conflict':
      return `OPENER_TYPE: rep_schedule_conflict

FIRST_MESSAGE_INSTRUCTION:
Full ownership. Simple apology. Find a new time.

Introduce yourself as Jordan. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — there was a scheduling issue on our end and we need to find you a new time. Can we do ${slot1}?"`;

    case 'weather':
      return `OPENER_TYPE: weather

FIRST_MESSAGE_INSTRUCTION:
Brief and practical. Weather pushed it — reschedule.

Introduce yourself as Jordan. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — weather pushed the inspection. Does ${slot1} work to reschedule?"`;

    case 'booking_stall_exhausted':
      return `OPENER_TYPE: booking_stall_exhausted

FIRST_MESSAGE_INSTRUCTION:
Light reference to prior attempt without making it feel like a complaint. Ask if it's still something they want done.

Introduce yourself as Jordan. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — looks like we'd been trying to find a time to get an inspector out to you. Still something you want to get done?"`;

    default:
      return `OPENER_TYPE: other

FIRST_MESSAGE_INSTRUCTION:
Clean and simple. We need a new time.

Introduce yourself as Jordan. Two sentences max. One question.

Direction: "Hey [firstName], this is Jordan with Qntum Roofing — looks like we need to find a new time for the inspection. Does ${slot1} work?"`;
  }
}
