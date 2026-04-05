"use client";

import { useState, useEffect } from "react";
import Toggle from "@/src/components/ui/Toggle";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
  initialData?: Record<string, unknown>;
}

interface QuoteState {
  basePrice: string;
  nationalPromo: boolean;
  localPromo: boolean;
  fsp: boolean;
  commissionRate: string;
  estMonthly: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function Step6Quote({ onChange, initialData }: Props) {
  const q = (initialData?.quote as Record<string, unknown>) || {};

  const [state, setState] = useState<QuoteState>({
    basePrice: q.basePrice?.toString() || "",
    nationalPromo: !!(q.nationalPromo),
    localPromo: !!(q.localPromo),
    fsp: !!(q.fsp),
    commissionRate: q.commissionRate?.toString() || "",
    estMonthly: q.estMonthly?.toString() || "",
  });

  const update = (patch: Partial<QuoteState>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange({
      quote: {
        basePrice: parseFloat(next.basePrice) || 0,
        nationalPromo: next.nationalPromo,
        localPromo: next.localPromo,
        fsp: next.fsp,
        commissionRate: parseFloat(next.commissionRate) || 0,
        estMonthly: parseFloat(next.estMonthly) || 0,
      },
    });
  };

  const bp = parseFloat(state.basePrice) || 0;
  const np = state.nationalPromo;
  const lp = state.localPromo;
  const fsp = state.fsp;
  const cr = parseFloat(state.commissionRate) || 0;

  const npDiscount = bp * (np ? 0.05 : 0);
  const lpDiscount = (bp - npDiscount) * (lp ? 0.1 : 0);
  const fspDiscount = (bp - npDiscount - lpDiscount) * (fsp ? 0.1 : 0);
  const nisi = bp - npDiscount - lpDiscount - fspDiscount;
  const commission = nisi * cr;

  // Sync initial data to parent
  useEffect(() => {
    if (q.basePrice) {
      onChange({
        quote: {
          basePrice: q.basePrice,
          nationalPromo: q.nationalPromo,
          localPromo: q.localPromo,
          fsp: q.fsp,
          commissionRate: q.commissionRate,
          estMonthly: q.estMonthly,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white text-2xl font-semibold">Quote Builder</h2>
        <p className="text-gray-400 text-base mt-1">Build the customer&apos;s quote with NISI math.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Base Price */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Base Price ($)</label>
          <input
            type="number"
            placeholder="0"
            value={state.basePrice}
            onChange={(e) => update({ basePrice: e.target.value })}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Discount toggles */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-4">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Discounts</p>
          <Toggle label="National Promo (5%)" value={np} onChange={(v) => update({ nationalPromo: v })} />
          <Toggle label="Local Promo (10%)" value={lp} onChange={(v) => update({ localPromo: v })} />
          <Toggle label="FSP (10%)" value={fsp} onChange={(v) => update({ fsp: v })} />
        </div>

        {/* Commission rate */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Commission Rate (e.g. 0.08 = 8%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            placeholder="0.08"
            value={state.commissionRate}
            onChange={(e) => update({ commissionRate: e.target.value })}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Est monthly */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Est. Monthly Payment ($)</label>
          <input
            type="number"
            placeholder="0"
            value={state.estMonthly}
            onChange={(e) => update({ estMonthly: e.target.value })}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Live calculation */}
      {bp > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 font-mono text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-800">
            <span className="text-gray-400">Base Price</span>
            <span className="text-white">{fmt(bp)}</span>
          </div>
          {np && (
            <div className="flex justify-between py-1.5 border-b border-gray-800">
              <span className="text-gray-400">National Promo (5%)</span>
              <span className="text-red-400">-{fmt(npDiscount)}</span>
            </div>
          )}
          {lp && (
            <div className="flex justify-between py-1.5 border-b border-gray-800">
              <span className="text-gray-400">Local Promo (10%)</span>
              <span className="text-red-400">-{fmt(lpDiscount)}</span>
            </div>
          )}
          {fsp && (
            <div className="flex justify-between py-1.5 border-b border-gray-800">
              <span className="text-gray-400">FSP (10%)</span>
              <span className="text-red-400">-{fmt(fspDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b-2 border-gray-700 mt-1">
            <span className="text-white font-semibold">NISI</span>
            <span className="text-white font-semibold text-base">{fmt(nisi)}</span>
          </div>
          {cr > 0 && (
            <div className="flex justify-between py-1.5 border-b border-gray-800">
              <span className="text-gray-400">Commission ({(cr * 100).toFixed(0)}%)</span>
              <span className="text-yellow-400">{fmt(commission)}</span>
            </div>
          )}
          {state.estMonthly && (
            <div className="flex justify-between py-1.5">
              <span className="text-gray-400">Est. Monthly</span>
              <span className="text-green-400">{fmt(parseFloat(state.estMonthly))}/mo</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
