interface StatsBarProps {
  total: number;
  thisMonth: number;
  totalViews: number;
  avgViews: number;
}

export default function StatsBar({ total, thisMonth, totalViews, avgViews }: StatsBarProps) {
  const stats = [
    { label: "Total Inspections", value: total },
    { label: "This Month", value: thisMonth },
    { label: "Report Views", value: totalViews },
    { label: "Avg Views / Report", value: avgViews.toFixed(1) },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-sm">{s.label}</p>
          <p className="text-white text-3xl font-bold mt-1">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
