"use client";

import { useState } from "react";
import Toggle from "@/src/components/ui/Toggle";

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

interface StructureCardProps {
  structure: Structure;
  onUpdate: (id: string, data: Partial<Structure>) => Promise<void>;
  onDelete: (id: string) => void;
}

const PITCH_OPTIONS = ["4/12", "5/12", "6/12", "7/12", "8/12", "9/12", "10/12", "12/12"];
const PACKAGE_OPTIONS = ["Good", "Better", "Best", "Platinum"];

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

// ── Main component ────────────────────────────────────────
export default function StructureCard({ structure, onUpdate, onDelete }: StructureCardProps) {
  const [name, setName] = useState(structure.name);

  const patch = (data: Partial<Structure>) => onUpdate(structure.id, data);

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
          className="text-brand-red hover:text-accent-red-hover min-h-12 px-3 text-sm"
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
          {/* Measurements */}
          <div>
            <p className="text-text-hint text-xs uppercase tracking-wider mb-3">Measurements</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumberInput label="Sq Ft" value={structure.sqft} onBlur={(v) => patch({ sqft: v })} />
              <NumberInput label="Squares" value={structure.squares} onBlur={(v) => patch({ squares: v })} />
              <div className="flex flex-col gap-1">
                <label className="text-text-hint text-xs">Pitch</label>
                <select
                  defaultValue={structure.pitch ?? ""}
                  onBlur={(e) => patch({ pitch: e.target.value || null })}
                  onChange={(e) => patch({ pitch: e.target.value || null })}
                  className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-3 text-sm focus:outline-none focus:border-text-accent"
                >
                  <option value="">—</option>
                  {PITCH_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <NumberInput label="Stories" value={structure.stories} onBlur={(v) => patch({ stories: v })} />
            </div>
          </div>

          {/* Linear measurements in ft + in */}
          <div>
            <p className="text-text-hint text-xs uppercase tracking-wider mb-3">Linear Measurements</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FeetInchesInput label="Ridge" value={structure.ridge} onBlur={(v) => patch({ ridge: v })} />
              <FeetInchesInput label="Hip" value={structure.hip} onBlur={(v) => patch({ hip: v })} />
              <FeetInchesInput label="Valley" value={structure.valley} onBlur={(v) => patch({ valley: v })} />
              <FeetInchesInput label="Rake" value={structure.rake} onBlur={(v) => patch({ rake: v })} />
              <FeetInchesInput label="Eave" value={structure.eave} onBlur={(v) => patch({ eave: v })} />
            </div>
          </div>

          {/* Penetrations */}
          <div>
            <p className="text-text-hint text-xs uppercase tracking-wider mb-3">Penetrations</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumberInput label="Pipe Boots" value={structure.pipeBoots} onBlur={(v) => patch({ pipeBoots: v })} />
              <NumberInput label="Skylights" value={structure.skylights} onBlur={(v) => patch({ skylights: v })} />
              <NumberInput label="Chimneys" value={structure.chimneys} onBlur={(v) => patch({ chimneys: v })} />
              <NumberInput label="Box Vents" value={structure.boxVents} onBlur={(v) => patch({ boxVents: v })} />
              <NumberInput label="Turbines" value={structure.turbines} onBlur={(v) => patch({ turbines: v })} />
              <NumberInput label="Attic Fans" value={structure.atticFans} onBlur={(v) => patch({ atticFans: v })} />
            </div>
          </div>

          {/* Existing materials */}
          <div>
            <p className="text-text-hint text-xs uppercase tracking-wider mb-3">Existing Materials</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Shingle Type", field: "shingleType" as const },
                { label: "Layers", field: "layers" as const },
                { label: "Gutter Type", field: "gutterType" as const },
                { label: "Gutter Color", field: "gutterColor" as const },
              ].map(({ label, field }) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-text-hint text-xs">{label}</label>
                  <input
                    type={field === "layers" ? "number" : "text"}
                    defaultValue={structure[field]?.toString() ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value;
                      patch({ [field]: field === "layers" ? (val ? Number(val) : null) : (val || null) });
                    }}
                    className="bg-bg-input border border-border text-text-primary rounded-lg min-h-10 px-3 text-sm focus:outline-none focus:border-text-accent"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Package */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-hint text-xs uppercase tracking-wider">Recommended Package</label>
            <div className="flex gap-2 flex-wrap">
              {PACKAGE_OPTIONS.map((pkg) => (
                <button
                  key={pkg}
                  type="button"
                  onClick={() => patch({ recommendedPackage: pkg })}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-11 ${
                    structure.recommendedPackage === pkg
                      ? "bg-brand-blue text-text-primary"
                      : "bg-bg-elevated border border-border text-text-secondary hover:border-border-hover"
                  }`}
                >
                  {pkg}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
