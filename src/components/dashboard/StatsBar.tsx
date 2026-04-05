interface StatsBarProps {
  total: number;
  thisMonth: number;
  totalViews: number;
  avgViews: number;
}

export default function StatsBar({ total, thisMonth, totalViews, avgViews }: StatsBarProps) {
  const stats = [
    { label: "Total Inspections", value: total, icon: "📋" },
    { label: "This Month", value: thisMonth, icon: "📅" },
    { label: "Report Views", value: totalViews, icon: "👁" },
    { label: "Avg Views / Report", value: avgViews.toFixed(1), icon: "📊" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{s.icon}</span>
            <p className="text-text-secondary text-sm font-medium">{s.label}</p>
          </div>
          <p className="text-text-primary text-4xl font-bold tracking-tight">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
