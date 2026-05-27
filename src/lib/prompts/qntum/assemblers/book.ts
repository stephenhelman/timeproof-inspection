import { getMasterPrompt } from '../master';
import { getBookMemoryModule } from '../memory/book';
import { getBookOpenerModule } from '../openers/book';
import { getBookDepthModule } from '../depth/book';
import type { BookContext } from '../types';

const DIVIDER = '\n\n---\n\n';

const BOOKING_SIGNAL_RULE =
`// ─── CRITICAL — BOOKING SIGNAL ─────────────────────────────────────────────
CRITICAL RULE — BOOKING SIGNAL:
When a homeowner confirms a time slot, you MUST emit [BOOKED: YYYY-MM-DD HH:MM] in your response using 24-hour time.
This signal is required. Without it the appointment cannot be saved.
Do NOT send a confirmation message without this signal.
Do NOT assume the booking is complete unless you have emitted this signal.
Format must be exactly: [BOOKED: YYYY-MM-DD HH:MM] — no slashes, no 12-hour time, no variations.`;

export function assembleBookPrompt(context: BookContext): string {
  const modules = [
    getMasterPrompt(),
    BOOKING_SIGNAL_RULE,
    getBookMemoryModule(context),
    getBookOpenerModule(context),
    getBookDepthModule(context),
  ];

  return modules
    .filter((m): m is string => m !== null && m !== undefined)
    .join(DIVIDER);
}
