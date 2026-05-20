"use client";

import { useState, useEffect, useCallback } from "react";
import { generateDiagnosis } from "@/src/lib/diagnosis-engine";

const SEVERITY_STYLES = {
  critical: { badge: "bg-red-500/20 text-red-300 border border-red-500/30", label: "CRITICAL" },
  high:     { badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30", label: "HIGH" },
  medium:   { badge: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30", label: "MEDIUM" },
};

const STATUS_STYLES = {
  confirmed: "bg-brand-blue/20 text-text-accent border border-brand-blue/40",
  suspected: "border border-text-hint/40 text-text-secondary",
};

function FindingCard({ finding, onNotesChange }) {
  const sev = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.medium;
  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 className="text-text-primary font-semibold text-base">{finding.label}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sev.badge}`}>{sev.label}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[finding.status]}`}>
            {finding.status}
          </span>
        </div>
      </div>

      <p className="text-text-secondary text-sm leading-relaxed">{finding.explanation}</p>

      <div className="flex flex-col gap-2 text-xs">
        {finding.matchedRoofTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-text-hint">Roof indicators:</span>
            {finding.matchedRoofTags.map((t) => (
              <span key={t} className="bg-bg-elevated border border-border text-text-secondary px-2 py-0.5 rounded-md">{t}</span>
            ))}
          </div>
        )}
        {finding.matchedAtticTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-text-hint">Attic indicators:</span>
            {finding.matchedAtticTags.map((t) => (
              <span key={t} className="bg-bg-elevated border border-border text-text-secondary px-2 py-0.5 rounded-md">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-text-hint text-xs">Rep notes on this finding (optional)</label>
        <textarea
          value={finding.notes || ""}
          onChange={(e) => onNotesChange(finding.id, e.target.value)}
          rows={2}
          placeholder="Add context or observations…"
          className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
        />
      </div>
    </div>
  );
}

export default function Step4Diagnosis({ inspectionId, initialData }) {
  const [findings, setFindings] = useState(
    Array.isArray(initialData?.diagnosis) ? initialData.diagnosis : []
  );
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(findings.length > 0);

  const runDiagnosis = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/inspection/${inspectionId}`);
      const data = await res.json();
      const photos = data.photos || [];

      const roofTags = photos.filter((p) => p.photoSection === "roof").flatMap((p) => p.damageTags);
      const atticTags = photos.filter((p) => p.photoSection === "attic").flatMap((p) => p.damageTags);

      const results = generateDiagnosis(roofTags, atticTags);

      // Preserve any existing notes
      const notesMap = {};
      findings.forEach((f) => { if (f.notes) notesMap[f.id] = f.notes; });
      const withNotes = results.map((r) => ({ ...r, notes: notesMap[r.id] || "" }));

      setFindings(withNotes);
      setGenerated(true);

      await fetch(`/api/inspection/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosis: withNotes }),
      });
    } finally {
      setSaving(false);
    }
  }, [inspectionId, findings]);

  // Auto-run on mount if no existing diagnosis
  useEffect(() => {
    if (!generated) runDiagnosis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotesChange = async (findingId, notes) => {
    const updated = findings.map((f) => (f.id === findingId ? { ...f, notes } : f));
    setFindings(updated);
    await fetch(`/api/inspection/${inspectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnosis: updated }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-text-primary text-2xl font-semibold">Diagnosis</h2>
          <p className="text-text-secondary text-base mt-1">Auto-generated from tagged photos.</p>
        </div>
        <button
          type="button"
          onClick={runDiagnosis}
          disabled={saving}
          className="shrink-0 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl px-4 min-h-10 text-sm transition-colors disabled:opacity-50"
        >
          {saving ? "Running…" : "↺ Regenerate"}
        </button>
      </div>

      {saving && (
        <div className="text-center py-8 text-text-secondary text-sm">Analyzing photos…</div>
      )}

      {!saving && findings.length === 0 && (
        <div className="bg-success/10 border border-success-text/20 rounded-2xl p-6 text-center">
          <p className="text-success-text font-semibold text-base mb-1">No Issues Detected</p>
          <p className="text-text-secondary text-sm">
            No correlated findings were identified from the tagged photos.
            Continue to the intake form.
          </p>
        </div>
      )}

      {!saving && findings.length > 0 && (
        <div className="flex flex-col gap-4">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onNotesChange={handleNotesChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
