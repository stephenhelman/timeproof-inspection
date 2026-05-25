import knowledgeData from './roofKnowledge.json';
export const roofKnowledge = knowledgeData;

export interface RoofInsight {
  id: string;
  category: string;
  conversationHook: string;
  naturalLanguage: string;
  explanation: string;
}

export function getAllInsights(): RoofInsight[] {
  const insights: RoofInsight[] = [];
  const skip = ['meta', 'usageRules'];
  for (const [, section] of Object.entries(roofKnowledge)) {
    const s = section as Record<string, unknown>;
    if (skip.includes((s.id as string) ?? '')) continue;
    if (!s.insights) continue;
    for (const insight of s.insights as Record<string, string>[]) {
      insights.push({
        id: insight.id,
        category: s.category as string,
        conversationHook: insight.conversationHook,
        naturalLanguage: insight.naturalLanguage,
        explanation: insight.explanation,
      });
    }
  }
  return insights;
}

export function getAvailableInsightsBlock(usedIds: string[]): string {
  const all = getAllInsights();
  const available = all.filter(i => !usedIds.includes(i.id));

  if (available.length === 0) {
    return `AVAILABLE_INSIGHTS:\nAll insights have been used in this thread. Do not repeat any. Respond naturally without inserting a new insight.`;
  }

  const lines = available
    .map(i => `[${i.id}]\nWhen to use: ${i.conversationHook}\nDirection: ${i.naturalLanguage}`)
    .join('\n\n');

  return `AVAILABLE_INSIGHTS:\nSelect ONE insight from this list most relevant to what the homeowner just said. Use naturalLanguage as directional guidance only — do not read it verbatim. Deliver it as a knowledgeable neighbor would, woven naturally into your response.\n\nDo not use more than one insight per message.\nDo not use any insight already used in this thread.\n\n${lines}`;
}
