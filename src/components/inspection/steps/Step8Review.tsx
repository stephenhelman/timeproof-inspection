"use client";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  initialData?: Record<string, unknown>;
  reportUuid?: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function Step8Review({ inspectionId, initialData, reportUuid }: Props) {
  const customer = initialData?.customer as Record<string, string> | undefined;
  const structures = (initialData?.structures as Array<Record<string, unknown>>) || [];
  const photos = (initialData?.photos as Array<Record<string, unknown>>) || [];
  const quote = initialData?.quote as Record<string, unknown> | undefined;
  const findings = initialData?.findings as Record<string, boolean> | undefined;
  const findingCount = findings ? Object.values(findings).filter(Boolean).length : 0;
  const driveFolderUrl = initialData?.driveFolderUrl as string | undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const reportUrl = reportUuid ? `${appUrl}/summary/${reportUuid}` : "";

  const copyLink = () => {
    if (reportUrl) navigator.clipboard.writeText(reportUrl);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white text-2xl font-semibold">Review</h2>
        <p className="text-gray-400 text-base mt-1">Summary before completing.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Customer */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Customer</p>
          <p className="text-white text-base font-semibold">{customer?.name || "—"}</p>
          <p className="text-gray-400 text-sm">{customer?.address || "—"}</p>
        </div>

        {/* Findings */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Findings</p>
          <p className="text-white font-semibold">{findingCount} issue{findingCount !== 1 ? "s" : ""}</p>
        </div>

        {/* Photos */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Photos</p>
          <div className="flex items-center gap-3">
            <p className="text-white font-semibold">{photos.length}</p>
            {driveFolderUrl && (
              <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm">
                📁 Drive
              </a>
            )}
          </div>
        </div>

        {/* Structures */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Structures</p>
          {structures.length > 0 ? (
            <div className="flex flex-col gap-1">
              {structures.map((s) => (
                <div key={s.id as string} className="flex items-center justify-between">
                  <span className="text-white text-sm">{s.name as string}</span>
                  {!!(s.recommendedPackage) && (
                    <span className="text-blue-400 text-sm">{s.recommendedPackage as string}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No structures added</p>
          )}
        </div>

        {/* Quote */}
        {quote && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <p className="text-gray-400 text-xs uppercase tracking-wider">NISI</p>
            <p className="text-white font-semibold text-lg">{fmt((quote.nisi as number) || 0)}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <a
          href={`/api/inspection/${inspectionId}/pdf`}
          className="w-full bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-xl min-h-12 px-6 text-base font-medium transition-colors flex items-center justify-center gap-2"
        >
          📄 Download PDF
        </a>
        {reportUrl && (
          <>
            <button
              type="button"
              onClick={copyLink}
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-xl min-h-12 px-6 text-base font-medium transition-colors flex items-center justify-center gap-2"
            >
              🔗 Copy Report Link
            </button>
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-xl min-h-12 px-6 text-base font-medium transition-colors flex items-center justify-center gap-2 text-center"
            >
              👁 View Report
            </a>
          </>
        )}
      </div>
    </div>
  );
}
