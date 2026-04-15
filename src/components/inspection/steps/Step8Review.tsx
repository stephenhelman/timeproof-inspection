"use client";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  initialData?: Record<string, unknown>;
  reportUuid?: string;
}

interface Package {
  id: string;
  name: string;
  nisi?: number | null;
  basePrice: number;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function Step8Review({ inspectionId, initialData, reportUuid }: Props) {
  const customerName = (initialData?.customerName as string) || "";
  const address = (initialData?.address as string) || "";
  const structures = (initialData?.structures as Array<Record<string, unknown>>) || [];
  const photos = (initialData?.photos as Array<Record<string, unknown>>) || [];
  const packages = (initialData?.packages as Package[]) || [];
  const findings = initialData?.findings as Record<string, boolean> | undefined;
  const findingCount = findings ? Object.values(findings).filter(Boolean).length : 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const reportUrl = reportUuid ? `${appUrl}/summary/${reportUuid}` : "";

  const copyLink = () => {
    if (reportUrl) navigator.clipboard.writeText(reportUrl);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Review</h2>
        <p className="text-text-secondary text-base mt-1">Summary before completing.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Customer */}
        <div className="bg-bg-surface border border-border rounded-2xl p-4">
          <p className="text-text-hint text-xs uppercase tracking-wider mb-2">Customer</p>
          <p className="text-text-primary text-base font-semibold">{customerName || "—"}</p>
          <p className="text-text-secondary text-sm">{address || "—"}</p>
        </div>

        {/* Findings */}
        <div className="bg-bg-surface border border-border rounded-2xl p-5 flex items-center justify-between">
          <p className="text-text-hint text-xs uppercase tracking-wider">Findings</p>
          <p className="text-text-primary font-semibold">{findingCount} issue{findingCount !== 1 ? "s" : ""}</p>
        </div>

        {/* Photos */}
        <div className="bg-bg-surface border border-border rounded-2xl p-5 flex items-center justify-between">
          <p className="text-text-hint text-xs uppercase tracking-wider">Photos</p>
          <div className="flex items-center gap-3">
            <p className="text-text-primary font-semibold">{photos.length}</p>
          </div>
        </div>

        {/* Structures */}
        <div className="bg-bg-surface border border-border rounded-2xl p-4">
          <p className="text-text-hint text-xs uppercase tracking-wider mb-2">Structures</p>
          {structures.length > 0 ? (
            <div className="flex flex-col gap-1">
              {structures.map((s) => (
                <div key={s.id as string} className="flex items-center justify-between">
                  <span className="text-text-primary text-sm">{s.name as string}</span>
                  {!!(s.recommendedPackage) && (
                    <span className="text-text-accent text-sm">{s.recommendedPackage as string}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-hint text-sm">No structures added</p>
          )}
        </div>

        {/* Packages */}
        {packages.length > 0 && (
          <div className="bg-bg-surface border border-border rounded-2xl p-4">
            <p className="text-text-hint text-xs uppercase tracking-wider mb-3">Packages</p>
            <div className="flex flex-col gap-2">
              {packages.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-text-primary text-sm font-medium">{p.name}</span>
                  <span className="text-text-accent text-sm font-semibold">
                    {p.nisi ? fmt(p.nisi) : fmt(p.basePrice)} NISI
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
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
