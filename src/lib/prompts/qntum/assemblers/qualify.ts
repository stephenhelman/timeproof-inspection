import { getMasterPrompt } from '../master';
import { getQualifyDepthModule } from '../depth/qualify';
import { getQualifyBranchModule } from '../branches/qualify';
import { getQualifyOpenerModule } from '../openers/qualify';
import { getQualifyMemoryModule } from '../memory/qualify';
import type { QualifyContext } from '../types';

const DIVIDER = '\n\n---\n\n';

const QUALIFY_SIGNAL_RULE =
`// ─── CRITICAL — SIGNAL RULES ────────────────────────────────────────────────
[QUALIFIED] — emit ONLY when the homeowner has confirmed genuine interest AND
the right decision makers will be present. Emit on its own line. Do NOT include
scheduling language before or after it. Do NOT describe a handoff.

[SOFT_CLOSE] — emit when the homeowner declines after the inspection is confirmed
free, or after one consequence question has already been asked and they still hedge.
Emit on its own line.

[NOT_INTERESTED] — emit only when the homeowner explicitly says they do not want
to proceed and there is no path to re-engagement. Emit on its own line.

NEVER emit [BOOKED], [BOOKED:], or any booking signal. That belongs to a
different bot. If you find yourself writing a time or date, stop — emit
[QUALIFIED] instead and let the booking bot handle it.`;

export function assembleQualifyPrompt(context: QualifyContext): string {
  const modules = [
    getMasterPrompt(),
    QUALIFY_SIGNAL_RULE,
    getQualifyMemoryModule(context),
    getQualifyOpenerModule(context),
    getQualifyDepthModule(context),
    getQualifyBranchModule(context),
  ];

  return modules
    .filter((m): m is string => m !== null)
    .join(DIVIDER);
}
