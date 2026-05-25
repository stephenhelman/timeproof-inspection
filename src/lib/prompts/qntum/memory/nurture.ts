import type { NurtureContext } from '../types';

export function getNurtureMemoryModule(context: NurtureContext): string {
  const {
    source,
    rep,
    roof_type,
    roof_age,
    issues_noticed,
    last_inspected,
    address,
    used_insight_ids,
    is_drip,
    drip_sequence_position,
  } = context;

  const hasIssues = issues_noticed && issues_noticed.length > 0 && !issues_noticed.includes('None of the above');
  const firstIssue = hasIssues ? issues_noticed![0].toLowerCase() : null;

  let memory = `GUIDE_CONTEXT:\n`;

  // Source framing
  if (source === 'door') {
    memory += `This homeowner scanned a QR code from a physical binder left at their door${rep ? ` by ${rep}` : ''}. They have had prior contact with a Qntum rep. Do not introduce the company as if it's unfamiliar.\n`;
  } else if (source === 'card') {
    memory += `This homeowner tapped a digital business card link${rep ? ` shared by ${rep}` : ''}. They have had prior contact with a Qntum rep. Do not introduce the company as if it's unfamiliar.\n`;
  } else if (source === 'organic') {
    memory += `This homeowner reached out directly or was referred — not through a Facebook ad or a rep visit. No guide form data available. Introduce Qntum warmly. No assumptions about prior contact.\n`;
  } else {
    memory += `This homeowner came through a Facebook free guide ad. No prior rep contact. Introduce Qntum warmly but without assuming any prior relationship.\n`;
  }

  // Form data
  if (roof_type) {
    memory += `\nRoof type: ${roof_type}.`;
  }
  if (roof_age) {
    memory += `\nRoof age: ${roof_age}.`;
    if (roof_age === '20+ years' || roof_age === '15–20 years') {
      memory += ` This is an older roof — keep that as context for consequence questions if they surface naturally.`;
    }
  }
  if (hasIssues) {
    memory += `\nIssues they noted: ${issues_noticed!.join(', ')}. Reference the first one naturally if the conversation creates an opening — but do not read the list back to them.`;
  } else {
    memory += `\nNo issues noticed — or they selected "None of the above." Treat this as a problem-unaware lead until the conversation reveals otherwise.`;
  }
  if (last_inspected) {
    memory += `\nLast inspected: ${last_inspected}.`;
    if (last_inspected === 'Never') {
      memory += ` Never professionally inspected — meaningful context for consequence questions.`;
    }
  }
  if (address) {
    memory += `\nAddress: ${address}.`;
  }

  // Insight usage tracking
  if (used_insight_ids.length > 0) {
    memory += `\n\nINSIGHT_TRACKING:\nInsights already used in this thread: ${used_insight_ids.join(', ')}. Do not repeat any of these. Select from AVAILABLE_INSIGHTS only.`;
  } else {
    memory += `\n\nINSIGHT_TRACKING:\nNo insights used yet in this thread.`;
  }

  memory += `\nTotal insights used: ${used_insight_ids.length} of 6 maximum.`;

  // Drip context
  if (is_drip && drip_sequence_position !== null) {
    memory += `\n\nDRIP_CONTEXT:\nThis is a scheduled drip message (position ${drip_sequence_position} of 4). The homeowner did not send a new message — this is proactive outreach. Reference something specific from their prior conversation. Do not say "just checking in" or "following up." Feel like a natural continuation, not a re-engagement campaign.\n`;

    if (drip_sequence_position === 4) {
      memory += `This is the final drip message. If there is no response signal, close warmly. Emit [SOFT_CLOSE] at end of message.`;
    }
  }

  // Intent signal reminder
  memory += `\n\nINTENT_SIGNALS:\nWatch every homeowner message for these triggers:\n- Mentions a specific problem they've noticed\n- Asks what an inspection involves\n- Asks how long it takes or when you could come out\n- Expresses worry about their roof\n- Asks about cost or what happens if something is found\n- Mentions a concerning roof age unprompted\n- Asks about warranty on their current roof\n\nIf any of these are present, emit [INSPECTION_INTENT] at the end of your response and ask one NEPQ bridge question:\n"That's worth knowing about — I want to make sure we'd actually be able to help before going too far down that road. What's got you thinking about the roof right now?"`;

  if (firstIssue) {
    memory += `\n\nFIRST_ISSUE: ${firstIssue}`;
  }

  return memory;
}
