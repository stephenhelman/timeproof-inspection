import { ConversationContext } from './types';
import { getMasterPrompt } from './master';
import { getOpenerModule } from './modules/opener';
import { getWarmthModule } from './modules/warmth';
import { getMemoryModule } from './modules/memory';
import { getDepthModule } from './modules/depth';
import { getBranchModule } from './modules/branch';

/**
 * Assembles the full system prompt for a given conversation context.
 * Combines the master prompt with all active context modules, filtering out any nulls.
 * Returns a single string ready to be passed as the system message to the LLM.
 */
export function assemblePrompt(context: ConversationContext): string {
  const sections: (string | null)[] = [
    getMasterPrompt(),
    // ─── OPENER MODULE ───────────────────────────────────────────────────────
    getOpenerModule(context),
    // ─── WARMTH MODULE ───────────────────────────────────────────────────────
    getWarmthModule(context),
    // ─── MEMORY MODULE ───────────────────────────────────────────────────────
    getMemoryModule(context),
    // ─── DEPTH MODULE ────────────────────────────────────────────────────────
    getDepthModule(context),
    // ─── BRANCH MODULE ───────────────────────────────────────────────────────
    getBranchModule(context),
  ];

  return sections
    .filter((section): section is string => section !== null)
    .join('\n\n');
}
