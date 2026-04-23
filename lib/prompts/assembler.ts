import { ConversationContext, OpenerType, PromptModule } from './types';
import { getMasterPrompt } from './master';
import { getOpenerModule } from './modules/opener';
import { getWarmthModule } from './modules/warmth';
import { getMemoryModule } from './modules/memory';
import { getDepthModule } from './modules/depth';
import { getBranchModule } from './modules/branch';

const DIVIDER = '\n\n---\n\n';

const VALID_OPENER_TYPES: OpenerType[] = [
  'curiosity_hook',
  'warm_acknowledgment',
  'door_opener',
  'grateful_reply',
  'low_friction_referral',
];

/**
 * Assembles the full system prompt for a given conversation context.
 * Calls all prompt modules in priority order, parses opener type from
 * opener.ts output for use by depth.ts, filters null module outputs,
 * and joins all sections with a standard divider. The returned string
 * is passed directly to the Claude API system parameter. No prompt
 * logic or instruction text lives in this function — it is pure
 * orchestration.
 */
export function assemblePrompt(context: ConversationContext): string {
  const openerOutput = getOpenerModule(context);
  const openerTypeMatch = openerOutput.match(/OPENER_TYPE:\s*(\S+)/);
  const parsedType = openerTypeMatch?.[1]?.trim();

  const openerType: OpenerType = VALID_OPENER_TYPES.includes(parsedType as OpenerType)
    ? (parsedType as OpenerType)
    : 'warm_acknowledgment';

  const modules: (PromptModule | null)[] = [
    getMasterPrompt(),
    getWarmthModule(context),
    getMemoryModule(context),
    openerOutput,
    getDepthModule(context, openerType),
    getBranchModule(context),
  ];

  return modules.filter((m): m is PromptModule => m !== null).join(DIVIDER);
}
