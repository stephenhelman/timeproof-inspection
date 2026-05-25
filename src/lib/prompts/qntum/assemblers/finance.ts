import { getJordanMasterPrompt } from '../jordan-master';
import { getFinanceMemoryModule } from '../memory/finance';
import { getFinanceOpenerModule } from '../openers/finance';
import { getFinanceDepthModule } from '../depth/finance';
import type { FinanceContext } from '../types';

const DIVIDER = '\n\n---\n\n';

export function assembleFinancePrompt(context: FinanceContext): string {
  const modules = [
    getJordanMasterPrompt(),
    getFinanceMemoryModule(context),
    getFinanceOpenerModule(context),
    getFinanceDepthModule(context),
  ];

  return modules
    .filter((m): m is string => m !== null && m !== undefined)
    .join(DIVIDER);
}
