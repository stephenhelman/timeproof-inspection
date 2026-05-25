import { getJordanMasterPrompt } from '../jordan-master';
import { getRevivalMemoryModule } from '../memory/revival';
import { getRevivalOpenerModule } from '../openers/revival';
import { getRevivalDepthModule } from '../depth/revival';
import { getRevivalBranchModule } from '../branches/revival';
import type { RevivalContext } from '../types';

const DIVIDER = '\n\n---\n\n';

export function assembleRevivalPrompt(context: RevivalContext): string {
  const modules = [
    getJordanMasterPrompt(),
    getRevivalMemoryModule(context),
    getRevivalOpenerModule(context),
    getRevivalDepthModule(context),
    getRevivalBranchModule(context),
  ];

  return modules
    .filter((m): m is string => m !== null && m !== undefined)
    .join(DIVIDER);
}
