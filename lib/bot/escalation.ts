/**
 * Detects whether the Claude response triggered an escalation.
 * Checks for the key phrase from the escalation message defined
 * in master.ts. Returns true if detected — the route handler will
 * then add bot_paused and tpusa_escalated tags to the contact.
 */
export function checkEscalation(responseText: string): boolean {
  return /let me have someone from our team reach out/i.test(responseText);
}
