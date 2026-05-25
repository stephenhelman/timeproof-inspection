import { getMasterPrompt } from '../master';
import { getQualifyDepthModule } from '../depth/qualify';
import { getQualifyBranchModule } from '../branches/qualify';
import { getQualifyOpenerModule } from '../openers/qualify';
import { getQualifyMemoryModule } from '../memory/qualify';
import type { QualifyContext } from '../types';

const DIVIDER = '\n\n---\n\n';

export function assembleQualifyPrompt(context: QualifyContext): string {
  const modules = [
    getMasterPrompt(),
    getQualifyMemoryModule(context),
    getQualifyOpenerModule(context),
    getQualifyDepthModule(context),
    getQualifyBranchModule(context),
  ];

  return modules
    .filter((m): m is string => m !== null)
    .join(DIVIDER);
}
