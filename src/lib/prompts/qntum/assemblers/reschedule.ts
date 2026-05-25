import { getJordanMasterPrompt } from '../jordan-master';
import { getRescheduleMemoryModule } from '../memory/reschedule';
import { getRescheduleOpenerModule } from '../openers/reschedule';
import { getRescheduleDepthModule } from '../depth/reschedule';
import type { RescheduleContext } from '../types';

const DIVIDER = '\n\n---\n\n';

export function assembleReschedulePrompt(context: RescheduleContext): string {
  const modules = [
    getJordanMasterPrompt(),
    getRescheduleMemoryModule(context),
    getRescheduleOpenerModule(context),
    getRescheduleDepthModule(context),
  ];

  return modules
    .filter((m): m is string => m !== null && m !== undefined)
    .join(DIVIDER);
}
