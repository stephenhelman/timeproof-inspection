"use client";

import { useState, useRef, useEffect } from "react";
import Toggle from "@/src/components/ui/Toggle";

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

interface PackageCardProps {
  pkg: Package;
  onUpdate: (id: string, data: Partial<Package>) => Promise<void>;
  onDelete: (id: string) => void;
  onMarkRecommended: (id: string, value: boolean) => void;
}

const PRESETS = ["Essentials", "Elite", "Platinum"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function calcNisi(bp: number, np: boolean, lp: boolean, fsp: boolean) {
  return bp * (1 - (np ? 0.05 : 0)) * (1 - (lp ? 0.1 : 0)) * (1 - (fsp ? 0.1 : 0));
}

export default function PackageCard({ pkg, onUpdate, onDelete, onMarkRecommended }: PackageCardProps) {
  const [name, setName] = useState(pkg.name);
  const [basePrice, setBasePrice] = useState(pkg.basePrice > 0 ? pkg.basePrice.toString() : "");

  // Debounced auto-save — fires 600ms after the last keystroke
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = (data: Partial<Package>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(pkg.id, data), 600);
  };

  // Flush on unmount so navigating away doesn't lose unsaved text
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        // Final sync — fire immediately on cleanup
        const bp = parseFloat(basePrice) || 0;
        if (bp !== pkg.basePrice || name !== pkg.name) {
          onUpdate(pkg.id, { name, basePrice: bp });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, basePrice]);

  const bp = parseFloat(basePrice) || 0;
  const np = pkg.nationalPromo;
  const lp = pkg.localPromo;
  const fsp = pkg.fsp;

  const npDiscount = bp * (np ? 0.05 : 0);
  const lpDiscount = (bp - npDiscount) * (lp ? 0.1 : 0);
  const fspDiscount = (bp - npDiscount - lpDiscount) * (fsp ? 0.1 : 0);
  const nisi = calcNisi(bp, np, lp, fsp);

  const isRecommended = pkg.recommended;

  return (
    <div className={`border rounded-2xl flex flex-col gap-4 overflow-hidden transition-colors ${
      isRecommended
        ? "border-warning-text/60 bg-bg-surface shadow-lg shadow-warning/10"
        : "border-border bg-bg-surface"
    }`}>
      {/* Recommended banner */}
      {isRecommended && (
        <div className="bg-warning-text/15 border-b border-warning-text/30 px-4 py-2 flex items-center gap-2">
          <span className="text-warning-text text-sm font-semibold">⭐ Recommended</span>
        </div>
      )}

      <div className="px-4 pb-4 flex flex-col gap-4">
        {/* Header: name + recommended toggle + delete */}
        <div className="flex items-center gap-3 pt-4">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              scheduleSave({ name: e.target.value, basePrice: parseFloat(basePrice) || 0 });
            }}
            onBlur={() => onUpdate(pkg.id, { name, basePrice: parseFloat(basePrice) || 0 })}
            className="flex-1 bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base font-semibold focus:outline-none focus:border-text-accent"
            placeholder="Package name"
          />
          <button
            type="button"
            onClick={() => onMarkRecommended(pkg.id, !isRecommended)}
            title={isRecommended ? "Remove recommended" : "Mark as recommended"}
            className={`min-h-12 px-3 rounded-xl border text-sm transition-colors ${
              isRecommended
                ? "border-warning-text/60 text-warning-text bg-warning/10"
                : "border-border text-text-hint hover:text-warning-text hover:border-warning-text/40"
            }`}
          >
            ⭐
          </button>
          <button
            type="button"
            onClick={() => onDelete(pkg.id)}
            className="text-brand-red hover:text-accent-red-hover min-h-12 px-3 text-sm"
          >
            🗑
          </button>
        </div>

        {/* Preset name buttons */}
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setName(p);
                onUpdate(pkg.id, { name: p });
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                name === p
                  ? "bg-brand-blue text-text-primary"
                  : "bg-bg-elevated border border-border text-text-secondary hover:border-border-hover"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Base price */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">Base Price ($)</label>
          <input
            type="number"
            placeholder="0"
            value={basePrice}
            onChange={(e) => {
              setBasePrice(e.target.value);
              scheduleSave({ name, basePrice: parseFloat(e.target.value) || 0 });
            }}
            onBlur={() => onUpdate(pkg.id, { name, basePrice: parseFloat(basePrice) || 0 })}
            className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
          />
        </div>

        {/* Discount toggles */}
        <div className="bg-bg-elevated border border-border rounded-xl p-4 flex flex-col gap-2">
          <p className="text-text-hint text-xs uppercase tracking-wider mb-1">Discounts</p>
          <Toggle label="National Promo (5%)" value={np} onChange={(v) => onUpdate(pkg.id, { nationalPromo: v })} />
          <Toggle label="Local Promo (10%)" value={lp} onChange={(v) => onUpdate(pkg.id, { localPromo: v })} />
          <Toggle label="FSP (10%)" value={fsp} onChange={(v) => onUpdate(pkg.id, { fsp: v })} />
        </div>

        {/* Live NISI calculation */}
        {bp > 0 && (
          <div className="bg-bg-base border border-border rounded-xl p-4 font-mono text-sm flex flex-col gap-0.5">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-secondary">Base Price</span>
              <span className="text-text-primary">{fmt(bp)}</span>
            </div>
            {np && (
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">National Promo (5%)</span>
                <span className="text-brand-red">−{fmt(npDiscount)}</span>
              </div>
            )}
            {lp && (
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Local Promo (10%)</span>
                <span className="text-brand-red">−{fmt(lpDiscount)}</span>
              </div>
            )}
            {fsp && (
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">FSP (10%)</span>
                <span className="text-brand-red">−{fmt(fspDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 mt-1">
              <span className="text-text-primary font-bold">NISI</span>
              <span className="text-text-primary font-bold text-base">{fmt(nisi)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
