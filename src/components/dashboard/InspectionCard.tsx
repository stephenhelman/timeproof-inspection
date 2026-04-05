"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/src/components/ui/Badge";

interface ReportVisit {
  visitedAt: string | Date;
}

interface Quote {
  nisi?: number | null;
}

interface Package {
  id: string;
  name: string;
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
  packages?: Package[];
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
  const router = useRouter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const reportUrl = `${appUrl}/summary/${inspection.reportUuid}`;
  const visitCount = inspection.reportVisits?.length || 0;
  const lastVisit = inspection.reportVisits?.[inspection.reportVisits.length - 1];
  const recentlyViewed = lastVisit
    ? Date.now() - new Date(lastVisit.visitedAt).getTime() < 86400000
    : false;

  const [deleting, setDeleting] = useState(false);

  const copyLink = () => navigator.clipboard.writeText(reportUrl);

  const handleDelete = async () => {
    if (!confirm(`Delete inspection for "${inspection.customer?.name || "this customer"}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/inspection/${inspection.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  // Show packages if present, fall back to legacy quote
  const packagePills = inspection.packages?.filter((p) => p.nisi) ?? [];
  const legacyNisi = inspection.quote?.nisi;

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5 hover:border-border-hover transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge status={inspection.status as "draft" | "complete"} />
          {recentlyViewed && (
            <span className="text-success-text text-xs font-semibold bg-success/30 px-2.5 py-1 rounded-full">
              👁 Viewed recently
            </span>
          )}
        </div>
        <span className="text-text-hint text-sm shrink-0 pt-0.5">
          {new Date(inspection.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* Name + address */}
      <div className="flex flex-col gap-1">
        <p className="text-text-primary font-semibold text-xl leading-tight">
          {inspection.customer?.name || "Unnamed Inspection"}
        </p>
        {inspection.customer?.address && (
          <p className="text-text-secondary text-base">{inspection.customer.address}</p>
        )}
      </div>

      {/* Meta pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {packagePills.map((p) => (
          <span key={p.id} className="text-text-accent text-sm font-medium bg-brand-navy/40 border border-border px-3 py-1 rounded-full">
            {p.name} · {fmt(p.nisi!)}
          </span>
        ))}
        {packagePills.length === 0 && legacyNisi && (
          <span className="text-text-secondary text-sm bg-bg-elevated px-3 py-1 rounded-full">
            {fmt(legacyNisi)} NISI
          </span>
        )}
        {visitCount > 0 && (
          <span className="text-text-secondary text-sm bg-bg-elevated px-3 py-1 rounded-full">
            {visitCount} view{visitCount !== 1 ? "s" : ""}
          </span>
        )}
        {lastVisit && (
          <span className="text-text-hint text-sm">
            Last viewed {timeAgo(String(lastVisit.visitedAt))}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-1 border-t border-border">
        <a
          href={`/inspection/${inspection.id}`}
          className="px-5 py-2.5 bg-brand-blue hover:bg-accent-blue-hover text-text-primary rounded-xl text-sm font-semibold min-h-11 flex items-center transition-colors"
        >
          Edit
        </a>
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl text-sm font-medium min-h-11 flex items-center transition-colors"
        >
          View Report
        </a>
        <button
          onClick={copyLink}
          className="px-5 py-2.5 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl text-sm font-medium min-h-11 transition-colors"
        >
          Copy Link
        </button>
        <a
          href={`/api/inspection/${inspection.id}/pdf`}
          className="px-5 py-2.5 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl text-sm font-medium min-h-11 flex items-center transition-colors"
        >
          PDF
        </a>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-5 py-2.5 border border-brand-red/40 text-brand-red hover:bg-brand-red hover:text-white rounded-xl text-sm font-medium min-h-11 transition-colors disabled:opacity-50 ml-auto"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
