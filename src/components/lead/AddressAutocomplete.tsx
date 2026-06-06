"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Prediction {
  place_id: string;
  description: string;
}

interface PlaceDetails {
  formattedAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
}

interface Props {
  value: string;
  onChange: (details: PlaceDetails) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "123 Main St, El Paso, TX",
  required,
  className,
}: Props) {
  const [input, setInput] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. on reset)
  useEffect(() => {
    setInput(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchPredictions = useCallback((q: string) => {
    if (q.length < 3) { setPredictions([]); setOpen(false); return; }
    setLoading(true);
    fetch(`/api/places/autocomplete?input=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        const preds = (d.predictions ?? []) as Prediction[];
        setPredictions(preds);
        setOpen(preds.length > 0);
      })
      .catch(() => setPredictions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (val: string) => {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 280);
  };

  const handleSelect = async (pred: Prediction) => {
    setOpen(false);
    setInput(pred.description);
    setPredictions([]);
    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(pred.place_id)}`);
      const details = (await res.json()) as PlaceDetails;
      onChange(details);
      setInput(details.formattedAddress);
    } catch {
      // If details fail, still use the description text
      onChange({
        formattedAddress: pred.description,
        streetAddress: pred.description,
        city: "",
        state: "",
        zip: "",
      });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={input}
        required={required}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (predictions.length > 0) setOpen(true); }}
        className={
          className ||
          "bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base placeholder:text-[#8fa3c8]/50 focus:outline-none focus:border-blue-500 transition-colors w-full"
        }
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-[#8fa3c8]/30 border-t-[#8fa3c8] rounded-full animate-spin" />
        </div>
      )}
      {open && predictions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-[#1a2236] border border-[#2a3a5c] rounded-xl shadow-2xl overflow-hidden">
          {predictions.map((pred) => (
            <li key={pred.place_id}>
              <button
                type="button"
                onClick={() => handleSelect(pred)}
                className="w-full text-left px-4 py-3 text-sm text-[#f0f4ff] hover:bg-[#2a3a5c] transition-colors truncate"
              >
                {pred.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
