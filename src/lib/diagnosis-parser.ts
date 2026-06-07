export type ZoneBlock =
  | { type: "paragraph"; text: string }
  | { type: "callout"; text: string }
  | { type: "question"; text: string };

export interface ParsedZone {
  name: string;
  blocks: ZoneBlock[];
}

// Strip surrounding curly/straight quotes from callout text
const OUTER_QUOTES_RE = /^[“”‘’"']+|[“”‘’"']+$/g;

function extractInlineBlocks(paragraph: string): Array<{ type: "paragraph" | "callout"; text: string }> {
  const result: Array<{ type: "paragraph" | "callout"; text: string }> = [];
  const boldRe = /\*\*([^*]+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRe.exec(paragraph)) !== null) {
    const before = paragraph.slice(lastIndex, match.index).trim();
    if (before) result.push({ type: "paragraph", text: before });
    const calloutText = match[1].replace(OUTER_QUOTES_RE, "").trim();
    if (calloutText) result.push({ type: "callout", text: calloutText });
    lastIndex = boldRe.lastIndex;
  }

  const after = paragraph.slice(lastIndex).trim();
  if (after) result.push({ type: "paragraph", text: after });

  return result;
}

function extractQuestion(bodyBlocks: string[]): { bodyBlocks: string[]; question: string | null } {
  for (let i = bodyBlocks.length - 1; i >= 0; i--) {
    const block = bodyBlocks[i].trim();
    if (!block.endsWith("?")) continue;

    const qPos = block.lastIndexOf("?");
    let sentenceStart = 0;
    for (let j = qPos - 1; j >= 0; j--) {
      if (block[j] === "." || block[j] === "!" || block[j] === "?") {
        let k = j + 1;
        while (k < qPos && /\s/.test(block[k])) k++;
        sentenceStart = k;
        break;
      }
    }

    const question = block.slice(sentenceStart, qPos + 1).trim();
    const remaining = block.slice(0, sentenceStart).trim();
    if (!question) continue;

    const newBlocks = [...bodyBlocks];
    if (remaining) {
      newBlocks[i] = remaining;
    } else {
      newBlocks.splice(i, 1);
    }

    return { bodyBlocks: newBlocks, question };
  }

  return { bodyBlocks, question: null };
}

export function parseDiagnosisText(text: string): ParsedZone[] {
  const rawBlocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  // A zone header is a standalone bold line: **Zone Name**
  const zoneHeaderRe = /^\*\*([^*]{1,80})\*\*\s*$/;

  const zones: ParsedZone[] = [];
  let currentName: string | null = null;
  let pendingBlocks: string[] = [];

  function flush() {
    if (currentName === null) return;
    const { bodyBlocks, question } = extractQuestion(pendingBlocks);
    const zoneBlocks: ZoneBlock[] = bodyBlocks.flatMap((b) =>
      b.trim() ? extractInlineBlocks(b) : [],
    );
    if (question) zoneBlocks.push({ type: "question", text: question });
    zones.push({ name: currentName, blocks: zoneBlocks });
  }

  for (const raw of rawBlocks) {
    const m = raw.match(zoneHeaderRe);
    if (m) {
      flush();
      pendingBlocks = [];
      currentName = m[1];
    } else if (currentName !== null) {
      pendingBlocks.push(raw);
    }
  }
  flush();

  // Fallback: no zone headers — wrap entire text as one zone
  if (zones.length === 0 && text.trim()) {
    const { bodyBlocks, question } = extractQuestion(rawBlocks);
    const blocks: ZoneBlock[] = bodyBlocks.flatMap((b) => extractInlineBlocks(b));
    if (question) blocks.push({ type: "question", text: question });
    zones.push({ name: "", blocks });
  }

  return zones;
}
