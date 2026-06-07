"use client";

interface SectionView {
  id: string;
  sectionKey: string;
  secondsViewed: number;
}

interface ReportVisit {
  id: string;
  visitedAt: string | Date;
  device?: string | null;
  visitNumber: number;
  sections: SectionView[];
}

interface ReportVisitPanelProps {
  visits: ReportVisit[];
}

const SECTION_LABEL: Record<string, string> = {
  overview: "Overview",
  photos: "Photos",
  diagnosis: "Diagnosis",
  findings: "Findings",
  recommendation: "Recommendation",
  about: "About Us",
  contact: "Contact",
};

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportVisitPanel({ visits }: ReportVisitPanelProps) {
  if (!visits || visits.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-text-secondary text-sm">No report visits recorded yet.</p>
        <p className="text-text-hint text-xs mt-1">This panel updates when the homeowner opens the report link.</p>
      </div>
    );
  }

  // Aggregate section views across all visits
  const sectionTotals: Record<string, number> = {};
  for (const visit of visits) {
    for (const sec of visit.sections) {
      sectionTotals[sec.sectionKey] = (sectionTotals[sec.sectionKey] ?? 0) + sec.secondsViewed;
    }
  }
  const sortedSections = Object.entries(sectionTotals).sort((a, b) => b[1] - a[1]);
  const totalSeconds = Object.values(sectionTotals).reduce((a, b) => a + b, 0);
  const lastVisit = visits[0];

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Visits", value: visits.length },
          { label: "Time Spent", value: formatSeconds(totalSeconds) },
          { label: "Last Viewed", value: formatDate(lastVisit.visitedAt) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-bg-elevated border border-border rounded-xl p-3 text-center">
            <p className="text-text-hint text-[10px] font-semibold uppercase tracking-wider">{label}</p>
            <p className="text-text-primary text-sm font-semibold mt-0.5 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Sections breakdown */}
      {sortedSections.length > 0 && (
        <div>
          <p className="text-text-hint text-[10px] font-semibold uppercase tracking-wider mb-2">Sections Viewed</p>
          <div className="flex flex-col gap-1.5">
            {sortedSections.map(([key, secs]) => {
              const pct = totalSeconds > 0 ? (secs / totalSeconds) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-text-secondary text-xs w-24 truncate shrink-0">
                    {SECTION_LABEL[key] ?? key}
                  </span>
                  <div className="flex-1 bg-bg-elevated rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand-blue h-full rounded-full"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <span className="text-text-hint text-xs w-10 text-right tabular-nums shrink-0">
                    {formatSeconds(secs)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visit history */}
      <div>
        <p className="text-text-hint text-[10px] font-semibold uppercase tracking-wider mb-2">Visit History</p>
        <div className="flex flex-col gap-1.5">
          {visits.map((v) => {
            const visitTotal = v.sections.reduce((a, s) => a + s.secondsViewed, 0);
            return (
              <div key={v.id} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Visit #{v.visitNumber}</span>
                <span className="text-text-hint">{formatDate(v.visitedAt)}</span>
                <span className="text-text-secondary tabular-nums">{formatSeconds(visitTotal)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
