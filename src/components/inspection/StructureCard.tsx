"use client";

import { useState } from "react";
import Toggle from "@/src/components/ui/Toggle";

// ── Types ─────────────────────────────────────────────────
interface Facet {
  id: string;
  structureId: string;
  order: number;
  name: string;
  pitch?: string | null;
  sqft?: number | null;
  ridge?: number | null;
  hip?: number | null;
  valley?: number | null;
  rake?: number | null;
  eave?: number | null;
  flashing?: number | null;
  stepFlashing?: number | null;
  parapets?: number | null;
  other?: number | null;
}

export interface Structure {
  id: string;
  name: string;
  inScope: boolean;
  entryMode: string;
  pitch?: string | null;
  sqft?: number | null;
  ridge?: number | null;
  hip?: number | null;
  valley?: number | null;
  rake?: number | null;
  eave?: number | null;
  flashing?: number | null;
  stepFlashing?: number | null;
  parapets?: number | null;
  other?: number | null;
  pipeBoots?: number | null;
  skylights?: number | null;
  chimneys?: number | null;
  boxVents?: number | null;
  turbines?: number | null;
  atticFans?: number | null;
  facets: Facet[];
}

interface StructureCardProps {
  structure: Structure;
  onUpdate: (id: string, data: Partial<Structure>) => Promise<void>;
  onStructureUpdate: (updated: Structure) => void;
  onDelete: (id: string) => void;
}

const PITCH_OPTIONS = [
  "0/12 — Flat", "1/12", "2/12", "3/12", "4/12", "5/12", "6/12",
  "7/12", "8/12", "9/12", "10/12", "11/12", "12/12",
  "13/12", "14/12", "15/12", "16/12+",
];

// ── Helpers ──────────────────────────────────────────────
function decimalToFtIn(decimal: number | null | undefined) {
  if (decimal == null) return { ft: "", ins: "" };
  const ft = Math.floor(decimal);
  const ins = Math.round((decimal - ft) * 12);
  return { ft: ft.toString(), ins: ins === 0 ? "" : ins.toString() };
}

function ftInToDecimal(ft: string, ins: string): number | null {
  if (ft === "" && ins === "") return null;
  return (parseInt(ft) || 0) + (parseInt(ins) || 0) / 12;
}

// ── Sub-components ────────────────────────────────────────
function NumberInput({
  label,
  value,
  onBlur,
}: {
  label: string;
  value: number | null | undefined;
  onBlur: (v: number | null) => void;
}) {
  const [local, setLocal] = useState(value?.toString() ?? "");
  return (
    <div className="flex flex-col gap-1">
      <label className="text-text-hint text-xs">{label}</label>
      <input
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onBlur(local === "" ? null : Number(local))}
        className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-3 text-sm focus:outline-none focus:border-text-accent w-full"
      />
    </div>
  );
}

function FeetInchesInput({
  label,
  value,
  onBlur,
}: {
  label: string;
  value: number | null | undefined;
  onBlur: (v: number | null) => void;
}) {
  const init = decimalToFtIn(value);
  const [ft, setFt] = useState(init.ft);
  const [ins, setIns] = useState(init.ins);
  const handleBlur = () => onBlur(ftInToDecimal(ft, ins));
  return (
    <div className="flex flex-col gap-1">
      <label className="text-text-hint text-xs">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={ft}
          onChange={(e) => setFt(e.target.value)}
          onBlur={handleBlur}
          placeholder="ft"
          className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-2 text-sm w-14 focus:outline-none focus:border-text-accent text-center"
        />
        <span className="text-text-hint text-sm font-medium">&apos;</span>
        <input
          type="number"
          min="0"
          max="11"
          value={ins}
          onChange={(e) => setIns(e.target.value)}
          onBlur={handleBlur}
          placeholder="in"
          className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-2 text-sm w-14 focus:outline-none focus:border-text-accent text-center"
        />
        <span className="text-text-hint text-sm font-medium">&quot;</span>
      </div>
    </div>
  );
}

function TotalField({ label, value }: { label: string; value: number | null | undefined }) {
  const display =
    value == null ? "—" : value % 1 === 0 ? value.toString() : value.toFixed(2);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-text-hint text-xs">{label}</label>
      <div className="bg-bg-elevated border border-border text-text-secondary rounded-lg min-h-10 px-3 text-sm flex items-center">
        {display}
      </div>
    </div>
  );
}

// ── FacetCard ─────────────────────────────────────────────
function FacetCard({
  facet,
  onUpdate,
  onDelete,
}: {
  facet: Facet;
  onUpdate: (id: string, data: Partial<Facet>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(facet.name);
  const [localPitch, setLocalPitch] = useState(facet.pitch ?? "");
  const isFlat = localPitch.startsWith("0/12");

  const patch = (data: Partial<Facet>) => onUpdate(facet.id, data);

  return (
    <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-text-hint text-xs">{open ? "▼" : "▶"}</span>
          <span className="text-text-primary text-sm font-medium">{name || "Facet"}</span>
          {localPitch && (
            <span className="text-text-hint text-xs ml-1">{localPitch}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onDelete(facet.id)}
          className="text-brand-red text-xs px-2 py-1 hover:opacity-75"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-3 border-t border-border">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-hint text-xs">Facet Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => patch({ name })}
                className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-3 text-sm focus:outline-none focus:border-text-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-text-hint text-xs">Pitch</label>
              <select
                value={localPitch}
                onChange={(e) => {
                  setLocalPitch(e.target.value);
                  patch({ pitch: e.target.value || null });
                }}
                className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-3 text-sm focus:outline-none focus:border-text-accent"
              >
                <option value="">—</option>
                {PITCH_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Sq Ft" value={facet.sqft} onBlur={(v) => patch({ sqft: v })} />
            <FeetInchesInput label="Ridge (lf)" value={facet.ridge} onBlur={(v) => patch({ ridge: v })} />
            <FeetInchesInput label="Hip (lf)" value={facet.hip} onBlur={(v) => patch({ hip: v })} />
            <FeetInchesInput label="Valley (lf)" value={facet.valley} onBlur={(v) => patch({ valley: v })} />
            <FeetInchesInput label="Rake (lf)" value={facet.rake} onBlur={(v) => patch({ rake: v })} />
            <FeetInchesInput label="Eave (lf)" value={facet.eave} onBlur={(v) => patch({ eave: v })} />
            <FeetInchesInput label="Flashing (lf)" value={facet.flashing} onBlur={(v) => patch({ flashing: v })} />
            <FeetInchesInput label="Step Flashing (lf)" value={facet.stepFlashing} onBlur={(v) => patch({ stepFlashing: v })} />
            {isFlat && (
              <FeetInchesInput label="Parapets (lf)" value={facet.parapets} onBlur={(v) => patch({ parapets: v })} />
            )}
            <FeetInchesInput label="Other (lf)" value={facet.other} onBlur={(v) => patch({ other: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function StructureCard({
  structure,
  onUpdate,
  onStructureUpdate,
  onDelete,
}: StructureCardProps) {
  const [name, setName] = useState(structure.name);
  const [entryMode, setEntryMode] = useState(structure.entryMode ?? "simple");
  const [facets, setFacets] = useState<Facet[]>(structure.facets ?? []);
  const [pitch, setPitch] = useState(structure.pitch ?? "");
  const [addingFacet, setAddingFacet] = useState(false);

  const isFlat = pitch.startsWith("0/12");
  const patch = (data: Partial<Structure>) => onUpdate(structure.id, data);

  const switchMode = async (mode: string) => {
    setEntryMode(mode);
    await patch({ entryMode: mode } as Partial<Structure>);
  };

  const addFacet = async () => {
    setAddingFacet(true);
    try {
      const res = await fetch("/api/facet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structureId: structure.id,
          name: `Facet ${facets.length + 1}`,
          order: facets.length,
        }),
      });
      const { facet } = await res.json();
      setFacets((prev) => [...prev, facet]);
    } finally {
      setAddingFacet(false);
    }
  };

  const updateFacet = async (id: string, data: Partial<Facet>) => {
    setFacets((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));
    const res = await fetch(`/api/facet/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const { facet, structure: updated } = await res.json();
    setFacets((prev) => prev.map((f) => (f.id === id ? facet : f)));
    if (updated) onStructureUpdate(updated);
  };

  const deleteFacet = async (id: string) => {
    if (!confirm("Delete this facet?")) return;
    setFacets((prev) => prev.filter((f) => f.id !== id));
    const res = await fetch(`/api/facet/${id}`, { method: "DELETE" });
    const { structure: updated } = await res.json();
    if (updated) {
      setFacets(updated.facets ?? []);
      onStructureUpdate(updated);
    }
  };

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => patch({ name })}
          className="flex-1 bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-text-accent"
          placeholder="Structure name"
        />
        <button
          onClick={() => onDelete(structure.id)}
          className="text-brand-red hover:opacity-75 min-h-12 px-3 text-sm"
        >
          🗑
        </button>
      </div>

      <Toggle
        label="In scope"
        value={structure.inScope}
        onChange={(v) => patch({ inScope: v })}
      />

      {structure.inScope && (
        <>
          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-text-hint text-xs uppercase tracking-wider mr-1">
              Entry Mode
            </span>
            {(["simple", "advanced"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchMode(mode)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  entryMode === mode
                    ? "bg-text-accent text-white"
                    : "bg-bg-elevated border border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {entryMode === "simple" ? (
            <div>
              <p className="text-text-hint text-xs uppercase tracking-wider mb-3">
                Measurements
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Total Sq Ft"
                  value={structure.sqft}
                  onBlur={(v) => patch({ sqft: v })}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-text-hint text-xs">Pitch</label>
                  <select
                    value={pitch}
                    onChange={(e) => {
                      setPitch(e.target.value);
                      patch({ pitch: e.target.value || null });
                    }}
                    className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-3 text-sm focus:outline-none focus:border-text-accent"
                  >
                    <option value="">—</option>
                    {PITCH_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <FeetInchesInput
                  label="Ridge (lf)"
                  value={structure.ridge}
                  onBlur={(v) => patch({ ridge: v })}
                />
                <FeetInchesInput
                  label="Hip (lf)"
                  value={structure.hip}
                  onBlur={(v) => patch({ hip: v })}
                />
                <FeetInchesInput
                  label="Valley (lf)"
                  value={structure.valley}
                  onBlur={(v) => patch({ valley: v })}
                />
                <FeetInchesInput
                  label="Rake (lf)"
                  value={structure.rake}
                  onBlur={(v) => patch({ rake: v })}
                />
                <FeetInchesInput
                  label="Eave (lf)"
                  value={structure.eave}
                  onBlur={(v) => patch({ eave: v })}
                />
                <FeetInchesInput
                  label="Flashing (lf)"
                  value={structure.flashing}
                  onBlur={(v) => patch({ flashing: v })}
                />
                <FeetInchesInput
                  label="Step Flashing (lf)"
                  value={structure.stepFlashing}
                  onBlur={(v) => patch({ stepFlashing: v })}
                />
                {isFlat && (
                  <FeetInchesInput
                    label="Parapets (lf)"
                    value={structure.parapets}
                    onBlur={(v) => patch({ parapets: v })}
                  />
                )}
                <FeetInchesInput
                  label="Other (lf)"
                  value={structure.other}
                  onBlur={(v) => patch({ other: v })}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Advanced: per-facet entry */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-text-hint text-xs uppercase tracking-wider">Facets</p>
                  <button
                    type="button"
                    onClick={addFacet}
                    disabled={addingFacet}
                    className="text-text-accent text-xs hover:underline disabled:opacity-50"
                  >
                    + Add Facet
                  </button>
                </div>
                {facets.length === 0 && (
                  <p className="text-text-hint text-xs text-center py-3">
                    No facets yet — add one above.
                  </p>
                )}
                {facets.map((facet) => (
                  <FacetCard
                    key={facet.id}
                    facet={facet}
                    onUpdate={updateFacet}
                    onDelete={deleteFacet}
                  />
                ))}
              </div>

              {/* Auto-summed totals */}
              <div>
                <p className="text-text-hint text-xs uppercase tracking-wider mb-3">
                  Totals (auto-computed)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <TotalField label="Total Sq Ft" value={structure.sqft} />
                  <div className="flex flex-col gap-1">
                    <label className="text-text-hint text-xs">Dominant Pitch</label>
                    <div className="bg-bg-elevated border border-border text-text-secondary rounded-lg min-h-10 px-3 text-sm flex items-center">
                      {structure.pitch ?? "—"}
                    </div>
                  </div>
                  <TotalField label="Ridge (lf)" value={structure.ridge} />
                  <TotalField label="Hip (lf)" value={structure.hip} />
                  <TotalField label="Valley (lf)" value={structure.valley} />
                  <TotalField label="Rake (lf)" value={structure.rake} />
                  <TotalField label="Eave (lf)" value={structure.eave} />
                  <TotalField label="Flashing (lf)" value={structure.flashing} />
                  <TotalField label="Step Flashing (lf)" value={structure.stepFlashing} />
                  <TotalField label="Parapets (lf)" value={structure.parapets} />
                  <TotalField label="Other (lf)" value={structure.other} />
                </div>
              </div>
            </>
          )}

          {/* Penetrations — always shown */}
          <div>
            <p className="text-text-hint text-xs uppercase tracking-wider mb-3">
              Penetrations
            </p>
            <div className="grid grid-cols-3 gap-3">
              <NumberInput
                label="Pipe Boots"
                value={structure.pipeBoots}
                onBlur={(v) => patch({ pipeBoots: v })}
              />
              <NumberInput
                label="Skylights"
                value={structure.skylights}
                onBlur={(v) => patch({ skylights: v })}
              />
              <NumberInput
                label="Chimneys"
                value={structure.chimneys}
                onBlur={(v) => patch({ chimneys: v })}
              />
              <NumberInput
                label="Box Vents"
                value={structure.boxVents}
                onBlur={(v) => patch({ boxVents: v })}
              />
              <NumberInput
                label="Turbines"
                value={structure.turbines}
                onBlur={(v) => patch({ turbines: v })}
              />
              <NumberInput
                label="Attic Fans"
                value={structure.atticFans}
                onBlur={(v) => patch({ atticFans: v })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
