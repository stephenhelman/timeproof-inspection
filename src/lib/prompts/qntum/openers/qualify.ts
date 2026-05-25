import type { QualifyContext } from '../types';

export function getQualifyOpenerModule(context: QualifyContext): string {
  const {
    has_strong_signal,
    known_issues,
    message_history_count,
    source,
    came_from_nurture,
    scheduling_approved_pause,
  } = context;

  if (message_history_count > 0) {
    return `OPENER_INSTRUCTION:
The conversation is already in progress. Do not re-introduce yourself. Pick up naturally from where the thread left off. Follow the depth module directive.`;
  }

  // Pause lifted — human approved ZIP after manual review
  if (scheduling_approved_pause) {
    return `OPENER_TYPE: scheduling_approved_pause

FIRST_MESSAGE_INSTRUCTION:
There was a brief hold while the team confirmed availability in this area. Acknowledge it naturally — frame it as a logistics check, not a screening process. Move directly into the first qualification question based on what you know about this homeowner.

Do not say "you've been approved" or anything that sounds like a vetting process. Keep it warm and practical.

Direction: "Appreciate your patience — wanted to make sure we could get out to you before we got too far into this. We're good. Quick question — [first qualify question based on form data]"

One question. Stop.`;
  }

  // Came from Nurture — homeowner showed intent during guide conversation
  if (came_from_nurture && (source === 'facebook-guide' || source === 'door' || source === 'card')) {
    return `OPENER_TYPE: from_nurture_soft_entry

FIRST_MESSAGE_INSTRUCTION:
This homeowner was in a guide conversation before this one. Something they said or asked indicated real interest. The shift from learning-mode to this conversation should feel natural, not like they were switched to a sales pipeline.

Do not re-introduce yourself. You are already in a thread with this person.

Acknowledge the shift lightly and move into the first qualification question. The goal is to understand what specifically got them thinking about their roof right now.

Direction: "Sounds like something got you thinking — what is it about the roof that's on your mind?"

One question. Stop. Follow the 5 qualification jobs from here.`;
  }

  // Facebook inspection lead — strong signal (active issues or old roof)
  if (source === 'facebook-inspection' || source === null) {
    if (has_strong_signal && known_issues && known_issues.length > 0) {
      const firstIssue = known_issues[0].toLowerCase();
      return `OPENER_TYPE: strong_signal

FIRST_MESSAGE_INSTRUCTION:
This homeowner reported a specific issue. Your opener can reference it briefly and naturally — but only if it reads as genuine curiosity, not as reciting a form. The goal is to make them feel like someone actually looked at what they submitted.

Send one short message. Introduce yourself by first name and company. Reference their situation lightly and ask one open question about it. Do not mention the inspection yet.

Example register (do not use verbatim):
"Hey, this is Alex with Qntum Roofing. Saw you reached out — sounds like you've been dealing with some ${firstIssue}. How long has that been going on?"`;
    }

    return `OPENER_TYPE: weak_signal

FIRST_MESSAGE_INSTRUCTION:
This homeowner filled out a form or came from a Facebook ad with no strong indicators of a known problem. Do not assume they have an urgent issue. Your opener is warm, curious, and low-pressure.

Send one short message. Introduce yourself by first name and company. Ask one open question that gives them space to tell you where they're at.

Example register (do not use verbatim):
"Hey, this is Alex with Qntum Roofing — following up on your inspection request. What made you want to get your roof looked at?"`;
  }

  // Door or card source (not from nurture — direct scan/tap)
  return `OPENER_TYPE: warm_entry

FIRST_MESSAGE_INSTRUCTION:
This homeowner came from a door visit or digital business card. They've had some contact with a rep already. Do not re-introduce as if it's cold. Reference the guide or the visit briefly and move immediately into a soft situational question.

Send one short message. Introduce yourself by first name and company. Acknowledge the prior touchpoint naturally.

Example register (do not use verbatim):
"Hey, this is Alex with Qntum Roofing — following up on the guide. What's going on with the roof?"`;
}
