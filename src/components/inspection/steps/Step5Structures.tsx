"use client";

import { useState, useEffect } from "react";
import StructureCard from "@/src/components/inspection/StructureCard";

interface Structure {
  id: string;
  name: string;
  inScope: boolean;
  sqft?: number | null;
  squares?: number | null;
  pitch?: string | null;
  stories?: number | null;
  ridge?: number | null;
  hip?: number | null;
  valley?: number | null;
  rake?: number | null;
  eave?: number | null;
  pipeBoots?: number | null;
  skylights?: number | null;
  chimneys?: number | null;
  boxVents?: number | null;
  turbines?: number | null;
  atticFans?: number | null;
  shingleType?: string | null;
  layers?: number | null;
  gutterType?: string | null;
  gutterColor?: string | null;
  recommendedPackage?: string | null;
}

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  initialData?: Record<string, unknown>;
}

export default function Step5Structures({ inspectionId, initialData }: Props) {
  const [structures, setStructures] = useState<Structure[]>(
    (initialData?.structures as Structure[]) || []
  );
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/inspection/${inspectionId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.structures) setStructures(d.structures); })
      .catch(() => {});
  }, [inspectionId]);

  const addStructure = async () => {
    setAdding(true);
    try {
      const res = await fetch("/api/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId,
          name: `Structure ${structures.length + 1}`,
          order: structures.length,
        }),
      });
      const s = await res.json();
      setStructures((prev) => [...prev, s]);
    } finally {
      setAdding(false);
    }
  };

  const updateStructure = async (id: string, data: Partial<Structure>) => {
    setStructures((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    await fetch(`/api/structure/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  const deleteStructure = async (id: string) => {
    if (!confirm("Delete this structure?")) return;
    await fetch(`/api/structure/${id}`, { method: "DELETE" });
    setStructures((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Structures</h2>
        <p className="text-text-secondary text-base mt-1">Document each structure on the property.</p>
      </div>

      <button
        type="button"
        onClick={addStructure}
        disabled={adding}
        className="w-full bg-bg-elevated border-2 border-dashed border-border hover:border-text-accent text-text-secondary hover:text-text-primary rounded-2xl min-h-14 text-base font-medium transition-colors disabled:opacity-50"
      >
        + Add Structure
      </button>

      {structures.map((structure) => (
        <StructureCard
          key={structure.id}
          structure={structure}
          onUpdate={updateStructure}
          onDelete={deleteStructure}
        />
      ))}

      {structures.length === 0 && (
        <p className="text-text-hint text-center py-8">No structures added yet.</p>
      )}
    </div>
  );
}
