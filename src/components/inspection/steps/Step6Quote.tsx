"use client";

import { useState, useEffect } from "react";
import PackageCard from "@/src/components/inspection/PackageCard";

interface Package {
  id: string;
  name: string;
  basePrice: number;
  nationalPromo: boolean;
  localPromo: boolean;
  fsp: boolean;
  nisi?: number | null;
  recommended: boolean;
  order: number;
}

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  initialData?: Record<string, unknown>;
}

export default function Step6Quote({ inspectionId, initialData }: Props) {
  const [packages, setPackages] = useState<Package[]>(
    (initialData?.packages as Package[]) || []
  );
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.packages) setPackages(d.packages); })
      .catch(() => {});
  }, [inspectionId]);

  const addPackage = async () => {
    setAdding(true);
    try {
      const res = await fetch("/api/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId,
          name: "Essentials",
          order: packages.length,
        }),
      });
      const pkg = await res.json();
      setPackages((prev) => [...prev, pkg]);
    } finally {
      setAdding(false);
    }
  };

  const updatePackage = async (id: string, data: Partial<Package>) => {
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    const res = await fetch(`/api/package/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, nisi: updated.nisi } : p)));
  };

  const handleMarkRecommended = (id: string, value: boolean) => {
    // Clear recommended on all others in local state, then patch the target
    setPackages((prev) =>
      prev.map((p) => ({ ...p, recommended: p.id === id ? value : false }))
    );
    // If marking true, also clear siblings on server (the API handles this)
    // If marking false, just update this one
    fetch(`/api/package/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommended: value }),
    }).catch(() => {});
  };

  const deletePackage = async (id: string) => {
    if (!confirm("Delete this package?")) return;
    await fetch(`/api/package/${id}`, { method: "DELETE" });
    setPackages((prev) => prev.filter((p) => p.id !== id));
  };

  // Sort: recommended first
  const sorted = [...packages].sort((a, b) =>
    a.recommended === b.recommended ? 0 : a.recommended ? -1 : 1
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Packages</h2>
        <p className="text-text-secondary text-base mt-1">
          Build one or more pricing packages. Mark one as ⭐ Recommended to highlight it on the report.
        </p>
      </div>

      <button
        type="button"
        onClick={addPackage}
        disabled={adding}
        className="w-full bg-bg-elevated border-2 border-dashed border-border hover:border-text-accent text-text-secondary hover:text-text-primary rounded-2xl min-h-14 text-base font-medium transition-colors disabled:opacity-50"
      >
        {adding ? "Adding…" : "+ Add Package"}
      </button>

      {sorted.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          onUpdate={updatePackage}
          onDelete={deletePackage}
          onMarkRecommended={handleMarkRecommended}
        />
      ))}

      {packages.length === 0 && (
        <p className="text-text-hint text-center py-8">No packages yet. Tap &quot;Add Package&quot; to get started.</p>
      )}
    </div>
  );
}
