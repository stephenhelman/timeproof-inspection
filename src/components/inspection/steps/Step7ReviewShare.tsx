"use client";

import { useState } from "react";
import { WARNING_SIGNS } from "@/src/lib/warning-signs";

interface DiagnosisFinding {
  id: string;
  label: string;
  explanation: string;
  severity: "critical" | "high" | "medium";
  status: "confirmed" | "suspected";
  matchedRoofTags: string[];
  matchedAtticTags: string[];
  notes?: string;
}

interface Photo {
  id: string;
  photoNumber: number;
  r2Url: string;
  damageTags: string[];
  photoSection: string;
}

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  initialData?: Record<string, unknown>;
  reportUuid?: string;
}

const SEVERITY_STYLES = {
  critical: "bg-red-500/20 text-red-300 border border-red-500/30",
  high: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
};

export default function Step7ReviewShare({ inspectionId, initialData, reportUuid }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportedAt, setExportedAt] = useState(
    initialData?.qntumExportedAt ? String(initialData.qntumExportedAt) : null
  );

  const customerName = (initialData?.customerName as string) || "";
  const address = (initialData?.address as string) || "";
  const photos = (initialData?.photos as Photo[]) || [];
  const diagnosis = (Array.isArray(initialData?.diagnosis) ? initialData.diagnosis : []) as DiagnosisFinding[];
  const warningSignsCovered = (initialData?.warningSignsCovered as string[]) || [];
  const problemAwarenessBefore = (initialData?.problemAwarenessBefore as string) || "";
  const problemAwarenessAfter = (initialData?.problemAwarenessAfter as string) || "";

  const roofPhotos = photos.filter((p) => p.photoSection === "roof");
  const atticPhotos = photos.filter((p) => p.photoSection === "attic");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const reportUrl = reportUuid ? `${appUrl}/summary/${reportUuid}` : "";

  const copyLink = () => {
    if (reportUrl) navigator.clipboard.writeText(reportUrl);
  };

  const handleQntumExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/qntum/${inspectionId}`, { method: "POST" });
      const data = await res.json();
      if (data.exportedAt) setExportedAt(data.exportedAt);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const coveredSigns = WARNING_SIGNS.filter((s) => warningSignsCovered.includes(s.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Review & Share</h2>
        <p className="text-text-secondary text-base mt-1">Inspection summary ready to share.</p>
      </div>

      {/* Customer */}
      <div className="bg-bg-surface border border-border rounded-2xl p-4">
        <p className="text-text-hint text-xs uppercase tracking-wider mb-2">Customer</p>
        <p className="text-text-primary text-base font-semibold">{customerName || "—"}</p>
        <p className="text-text-secondary text-sm">{address || "—"}</p>
      </div>

      {/* Diagnosis */}
      {diagnosis.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-text-hint text-xs uppercase tracking-wider">Diagnosis ({diagnosis.length} finding{diagnosis.length !== 1 ? "s" : ""})</p>
          {diagnosis.map((f) => (
            <div key={f.id} className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEVERITY_STYLES[f.severity]}`}>
                  {f.severity.toUpperCase()}
                </span>
                <span className="text-text-primary font-medium text-sm">{f.label}</span>
                <span className="text-text-hint text-xs capitalize">({f.status})</span>
              </div>
              <p className="text-text-secondary text-xs leading-relaxed">{f.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Photos summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-text-primary text-2xl font-bold">{roofPhotos.length}</p>
          <p className="text-text-hint text-xs mt-0.5">Roof Photos</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-text-primary text-2xl font-bold">{atticPhotos.length}</p>
          <p className="text-text-hint text-xs mt-0.5">Attic Photos</p>
        </div>
      </div>

      {/* Problem Awareness */}
      {(problemAwarenessBefore || problemAwarenessAfter) && (
        <div className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-text-hint text-xs uppercase tracking-wider">Problem Awareness</p>
          {problemAwarenessBefore && (
            <div>
              <p className="text-text-secondary text-xs mb-1.5">Before inspection:</p>
              <blockquote className="border-l-2 border-brand-blue pl-3 text-text-primary text-sm italic leading-relaxed">
                {problemAwarenessBefore}
              </blockquote>
            </div>
          )}
          {problemAwarenessAfter && (
            <div>
              <p className="text-text-secondary text-xs mb-1.5">After findings review:</p>
              <blockquote className="border-l-2 border-accent-red pl-3 text-text-primary text-sm italic leading-relaxed">
                {problemAwarenessAfter}
              </blockquote>
            </div>
          )}
        </div>
      )}

      {/* Warning signs covered */}
      {coveredSigns.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-2xl p-4">
          <p className="text-text-hint text-xs uppercase tracking-wider mb-2">Topics Reviewed ({coveredSigns.length})</p>
          <ul className="flex flex-col gap-1">
            {coveredSigns.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-text-secondary text-sm">
                <span className="text-success-text">✓</span>
                {s.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        {/* Qntum Export */}
        <button
          type="button"
          onClick={handleQntumExport}
          disabled={exporting}
          className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary rounded-2xl min-h-14 text-base font-semibold transition-all flex items-center justify-center gap-2"
        >
          {exporting ? "Sending…" : exportedAt ? "↑ Re-send to Qntum Portal" : "↑ Send to Qntum Portal"}
        </button>
        {exportedAt && (
          <p className="text-success-text text-xs text-center">
            Last exported {new Date(exportedAt).toLocaleString()}
          </p>
        )}

        <a
          href={`/api/inspection/${inspectionId}/pdf`}
          className="w-full bg-bg-elevated border border-border text-text-secondary hover:text-text-primary rounded-xl min-h-12 px-6 text-base font-medium transition-colors flex items-center justify-center gap-2"
        >
          📄 Download PDF
        </a>
        {reportUrl && (
          <>
            <button
              type="button"
              onClick={copyLink}
              className="w-full bg-bg-elevated border border-border text-text-secondary hover:text-text-primary rounded-xl min-h-12 px-6 text-base font-medium transition-colors flex items-center justify-center gap-2"
            >
              🔗 Copy Report Link
            </button>
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-bg-elevated border border-border text-text-secondary hover:text-text-primary rounded-xl min-h-12 px-6 text-base font-medium transition-colors flex items-center justify-center gap-2 text-center"
            >
              👁 View Report
            </a>
          </>
        )}
      </div>
    </div>
  );
}
