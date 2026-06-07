"use client";

const BOT_STAGE_LABEL = {
  revival: "Revival",
  reschedule: "Reschedule",
  finance: "Finance Discovery",
};

const BOT_STAGE_COLOR = {
  revival: "bg-amber-500/20 text-amber-300",
  reschedule: "bg-blue-500/20 text-blue-300",
  finance: "bg-purple-500/20 text-purple-300",
};

const DISPO_LABEL = {
  think_about_it: "Think About It",
  price: "Price",
  urgency: "Urgency",
  insurance: "Insurance",
  finance_decline: "Finance Decline",
  other: "Other",
  demo_not_sold: "Demo Not Sold",
  no_show: "No Show",
  porched: "Porched",
  reschedule: "Reschedule",
};

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass ?? "bg-zinc-500/20 text-zinc-400"}`}>
      {label}
    </span>
  );
}

export default function RevivalQueue({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-text-secondary text-base">No leads currently in Jordan&apos;s active sequences.</p>
        <a href="/admin" className="text-brand-blue text-sm mt-3 inline-block hover:underline">← Back to Admin</a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-text-primary text-3xl font-bold tracking-tight">Revival Queue</h1>
        <p className="text-text-secondary text-sm mt-1">
          {rows.length} lead{rows.length !== 1 ? "s" : ""} in Jordan&apos;s active sequences. Read-only — actions happen through Tasks.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div
            key={row.leadId}
            className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col gap-3"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <p className="text-text-primary font-semibold text-base">{row.customerName}</p>
                <p className="text-text-secondary text-sm">
                  {[row.streetAddress, row.city, row.state].filter(Boolean).join(", ")}
                </p>
                {row.phone && (
                  <p className="text-text-hint text-xs">{row.phone}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge
                  label={BOT_STAGE_LABEL[row.botStage] ?? row.botStage}
                  colorClass={BOT_STAGE_COLOR[row.botStage]}
                />
                {row.dispoPrimaryObjection && (
                  <Badge
                    label={`Last: ${DISPO_LABEL[row.dispoPrimaryObjection] ?? row.dispoPrimaryObjection}`}
                    colorClass="bg-zinc-500/20 text-zinc-400"
                  />
                )}
                {row.daysSince !== null && (
                  <Badge
                    label={`${row.daysSince}d since appt`}
                    colorClass={row.daysSince > 14 ? "bg-red-500/20 text-red-300" : "bg-zinc-500/20 text-zinc-400"}
                  />
                )}
              </div>
            </div>

            {/* Bot context summary */}
            {row.botContextSummary && (
              <div className="bg-bg-elevated border border-border rounded-lg px-3 py-2.5">
                <p className="text-text-hint text-[10px] font-semibold uppercase tracking-wider mb-1">Bot Context</p>
                <p className="text-text-secondary text-sm leading-relaxed">{row.botContextSummary}</p>
              </div>
            )}

            {/* Action links */}
            <div className="flex gap-3 flex-wrap pt-0.5">
              <a
                href={`/leads/${row.leadId}`}
                className="text-brand-blue hover:underline text-xs font-medium"
              >
                View Lead →
              </a>
              {row.inspectionId && (
                <a
                  href={`/inspection/${row.inspectionId}`}
                  className="text-text-secondary hover:text-text-primary hover:underline text-xs"
                >
                  View Inspection →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
