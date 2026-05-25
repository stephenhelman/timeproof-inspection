import { getMasterPrompt } from '../master';
import { getBookMemoryModule } from '../memory/book';
import { getBookOpenerModule } from '../openers/book';
import { getBookDepthModule } from '../depth/book';
import type { BookContext } from '../types';

const DIVIDER = '\n\n---\n\n';

export function assembleBookPrompt(context: BookContext): string {
  const modules = [
    getMasterPrompt(),
    getBookMemoryModule(context),
    getBookOpenerModule(context),
    getBookDepthModule(context),
  ];

  return modules
    .filter((m): m is string => m !== null && m !== undefined)
    .join(DIVIDER);
}
