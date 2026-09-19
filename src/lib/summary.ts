export interface ParsedSummary {
  overview: string[];
  keyPoints: string[];
  takeaway: string;
}

type Section = 'overview' | 'points' | 'takeaway';

// Section headings the AI is asked to write (older summaries used slightly different ones)
const HEADINGS: { section: Section; pattern: RegExp }[] = [
  { section: 'overview', pattern: /^(summary|overview|main theme)\s*(:|$)\s*/i },
  { section: 'points', pattern: /^key (points|concepts)\s*(:|$)\s*/i },
  { section: 'takeaway', pattern: /^(key )?takeaways?\s*(:|$)\s*/i },
];

const BULLET = /^([•\-*]|\d+[.)])\s+/;

/**
 * Splits the AI's plain-text answer into its three parts:
 * a summary paragraph, the key points, and the key takeaway.
 */
export function parseSummary(text: string): ParsedSummary {
  const overview: string[] = [];
  const keyPoints: string[] = [];
  const takeaway: string[] = [];
  let section: Section = 'overview';

  for (const rawLine of text.split('\n')) {
    // Remove markdown symbols the AI sometimes adds anyway
    let line = rawLine.replace(/\*\*|__/g, '').replace(/^#+\s*/, '').trim();
    if (!line) continue;

    const heading = HEADINGS.find((h) => h.pattern.test(line.replace(BULLET, '')));
    if (heading) {
      section = heading.section;
      line = line.replace(BULLET, '').replace(heading.pattern, '').trim();
      if (!line) continue;
    }

    if (BULLET.test(line) || section === 'points') {
      keyPoints.push(line.replace(BULLET, ''));
    } else if (section === 'takeaway') {
      takeaway.push(line);
    } else {
      overview.push(line);
    }
  }

  return { overview, keyPoints, takeaway: takeaway.join(' ') };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
