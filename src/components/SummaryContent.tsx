import { List, Lightbulb } from 'lucide-react';
import { parseSummary } from '../lib/summary';

export default function SummaryContent({ summary }: { summary: string }) {
  const { overview, keyPoints, takeaway } = parseSummary(summary);

  return (
    <div className="text-sm text-slate-300 leading-relaxed space-y-5">
      {overview.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}

      {keyPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Key Points</h4>
          <ul className="space-y-2.5">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <List className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {takeaway && (
        <div className="flex items-start gap-2.5 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
          <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <span className="text-amber-200/90">
            <span className="font-semibold">Key Takeaway: </span>
            {takeaway}
          </span>
        </div>
      )}
    </div>
  );
}
