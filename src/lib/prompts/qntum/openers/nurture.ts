import type { NurtureContext } from '../types';

export function getNurtureOpenerModule(context: NurtureContext): string {
  const { message_history_count, source, issues_noticed, is_drip } = context;

  // Drip messages — homeowner hasn't said anything, this is proactive
  if (is_drip) {
    return `OPENER_INSTRUCTION:
This is a drip message — the homeowner has not sent a new message. You are reaching out proactively. Do not re-introduce yourself. Reference something specific from what the homeowner shared in your prior conversation. Deliver one new educational insight if relevant. Ask one soft question. Feel like a natural continuation.

Do not say "just checking in." Do not say "following up." Start with something specific and real.`;
  }

  if (message_history_count > 0) {
    return `OPENER_INSTRUCTION:
Conversation in progress. Do not re-introduce yourself. Pick up naturally. Follow the depth module directive.`;
  }

  const hasIssues =
    issues_noticed &&
    issues_noticed.length > 0 &&
    !issues_noticed.includes('None of the above');
  const firstIssue = hasIssues ? issues_noticed![0].toLowerCase() : null;

  // Organic — direct/referral, no guide form context, no rep contact
  if (source === 'organic') {
    return `OPENER_TYPE: organic_entry

FIRST_MESSAGE_INSTRUCTION:
This homeowner reached out directly or was referred — they did not come through a Facebook ad or a rep visit. No form data is available. Lead with one El Paso-specific educational insight (prefer climate or aging-roof context). Ask one soft open-ended question about their roof.

Introduce yourself by first name and company. Two sentences max. One question. Keep it warm and low-pressure.

Example direction (do not use verbatim):
"Hey, this is Alex with Qntum Roofing — one thing most homeowners in El Paso don't expect is how fast UV exposure breaks down roofing materials out here. What do you know about the current condition of yours?"`;
  }

  // Door or card — homeowner met a rep already
  if (source === 'door' || source === 'card') {
    return `OPENER_TYPE: warm_rep_entry

FIRST_MESSAGE_INSTRUCTION:
This homeowner has already met or heard from a Qntum rep. Do not re-introduce the company as if it's new. Reference the guide or the visit briefly. Lead immediately with one relevant educational insight from AVAILABLE_INSIGHTS. End with one soft situational question about their roof.

Two sentences max. Do not mention inspection yet. Keep it low pressure.

Example direction (do not use verbatim):
"Hey, this is Alex with Qntum — just wanted to share something about roofs in El Paso specifically that's worth knowing. [Insert insight.] What does your roof look like — any age or condition you're aware of?"`;
  }

  // Facebook guide lead with reported issues
  if (source === 'facebook-guide' && firstIssue) {
    return `OPENER_TYPE: guide_with_issues

FIRST_MESSAGE_INSTRUCTION:
This homeowner noted a specific issue on their guide form. Do not waste time on a generic welcome. Reference the issue naturally — it shows you actually looked at what they shared. Ask one simple question about it.

Introduce yourself by first name and company. One question. Stop.

Example direction (do not use verbatim):
"Hey, this is Alex with Qntum Roofing — saw you mentioned ${firstIssue}. How long has that been going on?"`;
  }

  // Facebook guide lead, no reported issues
  return `OPENER_TYPE: guide_no_issues

FIRST_MESSAGE_INSTRUCTION:
This homeowner came through the guide but didn't report any specific issues — they may be curious or proactive. Lead with one El Paso-specific educational insight (prefer climate or hidden damage timeline). End with one soft question about their roof.

Introduce yourself by first name and company. Two sentences max. One question. Keep it curious and low-pressure.

Example direction (do not use verbatim):
"Hey, this is Alex with Qntum Roofing — one thing most people don't realize about roofs in El Paso specifically is [insert climate or hidden-damage insight]. What do you know about the current condition of yours?"`;
}
