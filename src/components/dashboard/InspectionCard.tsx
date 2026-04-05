"use client";

import Badge from "@/src/components/ui/Badge";

interface ReportVisit {
  visitedAt: string | Date;
}

interface Quote {
  nisi?: number | null;
}

interface Structure {
  recommendedPackage?: string | null;
  inScope: boolean;
}

interface Customer {
  name: string;
  address: string;
}

interface Inspection {
  id: string;
  reportUuid: string;
  status: string;
  repName?: string | null;
  date: string | Date;
  customer?: Customer | null;
  quote?: Quote | null;
  structures?: Structure[];
  reportVisits?: ReportVisit[];
}

interface InspectionCardProps {
  inspection: Inspection;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function InspectionCard({ inspection }: InspectionCardProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const reportUrl = `${appUrl}/summary/${inspection.reportUuid}`;
  const visitCount = inspection.reportVisits?.length || 0;
  const lastVisit = inspection.reportVisits?.[inspection.reportVisits.length - 1];
  const recentlyViewed = lastVisit
    ? Date.now() - new Date(lastVisit.visitedAt).getTime() < 86400000
    : false;
  const packageName = inspection.structures?.find((s) => s.inScope && s.recommendedPackage)?.recommendedPackage;

  const copyLink = () => navigator.clipboard.writeText(reportUrl);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge status={inspection.status as "draft" | "complete"} />
          {recentlyViewed && (
            <span className="text-green-400 text-xs font-medium">👁 viewed recently</span>
          )}
        </div>
        <span className="text-gray-500 text-sm flex-shrink-0">
          {new Date(inspection.date).toLocaleDateString()}
        </span>
      </div>

      {/* Name + address */}
      <div>
        <p className="text-white font-semibold text-base">
          {inspection.customer?.name || "Unnamed Inspection"}
        </p>
        {inspection.customer?.address && (
          <p className="text-gray-400 text-sm mt-0.5">{inspection.customer.address}</p>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap text-sm text-gray-500">
        {packageName && <span>Package: <span className="text-blue-400">{packageName}</span></span>}
        {inspection.quote?.nisi && <span>{fmt(inspection.quote.nisi)} NISI</span>}
        {visitCount > 0 && <span>Views: {visitCount}</span>}
        {lastVisit && <span>Last viewed: {timeAgo(String(lastVisit.visitedAt))}</span>}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={`/inspection/${inspection.id}`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium min-h-[44px] flex items-center"
        >
          Edit
        </a>
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium min-h-[44px] flex items-center"
        >
          View Report
        </a>
        <button
          onClick={copyLink}
          className="px-4 py-2 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium min-h-[44px]"
        >
          Copy Link
        </button>
        <a
          href={`/api/inspection/${inspection.id}/pdf`}
          className="px-4 py-2 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium min-h-[44px] flex items-center"
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
