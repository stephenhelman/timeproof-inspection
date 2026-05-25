import { getMasterPrompt } from '../master';
import { getNurtureMemoryModule } from '../memory/nurture';
import { getNurtureOpenerModule } from '../openers/nurture';
import { getNurtureDepthModule } from '../depth/nurture';
import { getAvailableInsightsBlock } from '@/src/data/roofKnowledge';
import type { NurtureContext } from '../types';

const DIVIDER = '\n\n---\n\n';

export function assembleNurturePrompt(context: NurtureContext): string {
  const modules = [
    getMasterPrompt(),
    getNurtureMemoryModule(context),
    getNurtureOpenerModule(context),
    getNurtureDepthModule(context),
    getAvailableInsightsBlock(context.used_insight_ids),
  ];

  return modules
    .filter((m): m is string => m !== null && m !== undefined)
    .join(DIVIDER);
}
