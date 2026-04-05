import { getPackageById, getWarrantySummary } from "@/src/lib/packages";

interface PackageCardProps {
  packageId: string;
  isRecommended?: boolean;
}

export default function PackageCard({ packageId, isRecommended }: PackageCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = getPackageById(packageId) as any;
  if (!pkg) return null;

  const warrantyLines = getWarrantySummary(packageId) as string[] | null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      {isRecommended && (
        <span className="inline-block bg-[#1B3A7A] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
          ★ Recommended
        </span>
      )}

      <h3 className="text-2xl font-bold text-[#1B3A7A] mt-2">{pkg.label} Package</h3>
      <p className="text-gray-600 text-sm mt-1 mb-6">{pkg.tagline}</p>

      {/* Products table */}
      {pkg.products.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            What&apos;s Included
          </p>
          <div className="rounded-xl overflow-hidden border border-gray-100">
            {pkg.products.map(
              (product: { category: string; name: string }, i: number) => (
                <div
                  key={product.category}
                  className={`flex items-center px-4 py-2.5 ${
                    i % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <span className="text-gray-500 text-sm w-48 shrink-0">{product.category}</span>
                  <span className="text-gray-900 font-medium text-sm">{product.name}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Warranty block */}
      {warrantyLines && warrantyLines.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Warranty Coverage
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-2">
            {warrantyLines.map((line, i) => {
              const isTruProtection = i === 0;
              const isInstall = line.startsWith("10-year installation");
              const isAfter = i === warrantyLines.length - 1 && !isTruProtection;
              return (
                <p
                  key={i}
                  className={
                    isTruProtection
                      ? "text-[#1B3A7A] font-semibold text-sm"
                      : isInstall
                      ? "text-green-700 font-medium text-sm"
                      : isAfter
                      ? "text-gray-500 text-sm"
                      : "text-gray-700 text-sm"
                  }
                >
                  {isInstall ? "✓ " : ""}{line}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
