"use client";

import { useState } from "react";
import Toggle from "@/src/components/ui/Toggle";
import Input from "@/src/components/ui/Input";

interface IssueItem {
  id: string;
  type: string;
  location: string;
  duration: string;
  notes: string;
}

interface PreviousWorkItem {
  id: string;
  when: string;
  why: string;
  notes: string;
}

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
}

const OWNERSHIP_OPTIONS = ["Less than 1 year", "1–5 years", "5–10 years", "10+ years"];
const PRIORITY_CHIPS = ["Cost", "Durability", "Aesthetics", "Warranty", "Speed", "Financing"];

const ISSUE_TYPES = [
  { value: "leak", label: "Leak" },
  { value: "storm-damage", label: "Storm Damage" },
  { value: "missing-shingles", label: "Missing Shingles" },
  { value: "general-wear", label: "General Wear" },
  { value: "ventilation-problem", label: "Ventilation Problem" },
  { value: "structural-concern", label: "Structural Concern" },
  { value: "other", label: "Other" },
];

const ISSUE_DURATIONS = [
  { value: "just-noticed", label: "Just noticed" },
  { value: "few-weeks", label: "A few weeks" },
  { value: "several-months", label: "Several months" },
  { value: "over-a-year", label: "Over a year" },
  { value: "unknown", label: "Unknown" },
];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function PreviousWorkCard({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: PreviousWorkItem;
  index: number;
  onChange: (updated: PreviousWorkItem) => void;
  onRemove: () => void;
}) {
  const patch = (field: keyof PreviousWorkItem, value: string) =>
    onChange({ ...item, [field]: value });

  return (
    <div className="bg-bg-elevated border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-sm font-semibold">Previous Work {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-brand-red hover:text-accent-red-hover text-sm min-h-8 px-2"
        >
          🗑 Remove
        </button>
      </div>

      <Input
        label="When was it done?"
        placeholder="e.g. 2019, About 3 years ago"
        value={item.when}
        onChange={(e) => patch("when", e.target.value)}
      />

      <Input
        label="Why was it done?"
        placeholder="e.g. Storm damage, Age, Leak repair"
        value={item.why}
        onChange={(e) => patch("why", e.target.value)}
      />

      <div className="flex flex-col gap-1">
        <label className="text-text-secondary text-sm font-medium">Notes</label>
        <textarea
          value={item.notes}
          onChange={(e) => patch("notes", e.target.value)}
          placeholder="Any additional context..."
          rows={2}
          className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
        />
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  index,
  onChange,
  onRemove,
}: {
  issue: IssueItem;
  index: number;
  onChange: (updated: IssueItem) => void;
  onRemove: () => void;
}) {
  const patch = (field: keyof IssueItem, value: string) =>
    onChange({ ...issue, [field]: value });

  return (
    <div className="bg-bg-elevated border border-border rounded-2xl p-4 flex flex-col gap-3">
      {/* Card header */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-sm font-semibold">Issue {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-brand-red hover:text-accent-red-hover text-sm min-h-8 px-2"
        >
          🗑 Remove
        </button>
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1">
        <label className="text-text-secondary text-sm font-medium">Type</label>
        <select
          value={issue.type}
          onChange={(e) => patch("type", e.target.value)}
          className="bg-bg-input border border-border text-text-primary rounded-xl min-h-11 px-4 text-base focus:outline-none focus:border-text-accent transition-colors"
        >
          <option value="">Select type...</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Location */}
      <Input
        label="Location"
        placeholder="e.g. front eave, back valley, chimney area"
        value={issue.location}
        onChange={(e) => patch("location", e.target.value)}
      />

      {/* Duration */}
      <div className="flex flex-col gap-1">
        <label className="text-text-secondary text-sm font-medium">How long has this been an issue?</label>
        <select
          value={issue.duration}
          onChange={(e) => patch("duration", e.target.value)}
          className="bg-bg-input border border-border text-text-primary rounded-xl min-h-11 px-4 text-base focus:outline-none focus:border-text-accent transition-colors"
        >
          <option value="">Select duration...</option>
          {ISSUE_DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-text-secondary text-sm font-medium">Notes</label>
        <textarea
          value={issue.notes}
          onChange={(e) => patch("notes", e.target.value)}
          placeholder="Any additional details..."
          rows={2}
          className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
        />
      </div>
    </div>
  );
}

export default function Step2Discovery({ data, onChange }: Props) {
  const priorities = (data.priorities as string[]) || [];
  const [issues, setIssues] = useState<IssueItem[]>(
    (data.issues as IssueItem[]) || []
  );
  const [previousWork, setPreviousWork] = useState<PreviousWorkItem[]>(
    (data.previousWork as PreviousWorkItem[]) || []
  );

  const togglePriority = (chip: string) => {
    const next = priorities.includes(chip)
      ? priorities.filter((p) => p !== chip)
      : [...priorities, chip];
    onChange({ priorities: next });
  };

  const addPreviousWork = () => {
    const blank: PreviousWorkItem = { id: newId(), when: "", why: "", notes: "" };
    const next = [...previousWork, blank];
    setPreviousWork(next);
    onChange({ previousWork: next });
  };

  const updatePreviousWork = (updated: PreviousWorkItem) => {
    const next = previousWork.map((w) => (w.id === updated.id ? updated : w));
    setPreviousWork(next);
    onChange({ previousWork: next });
  };

  const removePreviousWork = (id: string) => {
    const next = previousWork.filter((w) => w.id !== id);
    setPreviousWork(next);
    onChange({ previousWork: next });
  };

  const addIssue = () => {
    const blank: IssueItem = { id: newId(), type: "", location: "", duration: "", notes: "" };
    const next = [...issues, blank];
    setIssues(next);
    onChange({ issues: next });
  };

  const updateIssue = (updated: IssueItem) => {
    const next = issues.map((i) => (i.id === updated.id ? updated : i));
    setIssues(next);
    onChange({ issues: next });
  };

  const removeIssue = (id: string) => {
    const next = issues.filter((i) => i.id !== id);
    setIssues(next);
    onChange({ issues: next });
  };

  const hasIssues = !!(data.activeLeaks);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Discovery Questions</h2>
        <p className="text-text-secondary text-base mt-1">Learn about the homeowner&apos;s situation.</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Ownership length */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">How long have you owned this home?</label>
          <select
            value={(data.ownershipLength as string) || ""}
            onChange={(e) => onChange({ ownershipLength: e.target.value })}
            className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
          >
            <option value="">Select...</option>
            {OWNERSHIP_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Previous roof work — multi-card */}
        <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
          <Toggle
            label="Previous roof work done?"
            value={!!(data.previousRoofWork)}
            onChange={(v) => {
              onChange({ previousRoofWork: v });
              if (!v) {
                setPreviousWork([]);
                onChange({ previousRoofWork: v, previousWork: [] });
              }
            }}
          />

          {!!(data.previousRoofWork) && (
            <>
              <button
                type="button"
                onClick={addPreviousWork}
                className="w-full bg-bg-base border-2 border-dashed border-border hover:border-text-accent text-text-secondary hover:text-text-primary rounded-xl min-h-12 text-base font-medium transition-colors"
              >
                + Add Previous Work
              </button>

              {previousWork.map((item, i) => (
                <PreviousWorkCard
                  key={item.id}
                  item={item}
                  index={i}
                  onChange={updatePreviousWork}
                  onRemove={() => removePreviousWork(item.id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Issues section */}
        <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
          <Toggle
            label="Currently experiencing issues?"
            value={hasIssues}
            onChange={(v) => {
              onChange({ activeLeaks: v });
              if (!v) {
                setIssues([]);
                onChange({ activeLeaks: v, issues: [] });
              }
            }}
          />

          {hasIssues && (
            <>
              <button
                type="button"
                onClick={addIssue}
                className="w-full bg-bg-base border-2 border-dashed border-border hover:border-text-accent text-text-secondary hover:text-text-primary rounded-xl min-h-12 text-base font-medium transition-colors"
              >
                + Add Issue
              </button>

              {issues.map((issue, i) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  index={i}
                  onChange={updateIssue}
                  onRemove={() => removeIssue(issue.id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Decision makers */}
        <div className="bg-bg-surface border border-border rounded-2xl p-4">
          <Toggle
            label="All decision makers present today?"
            value={!!(data.allDecisionMakers)}
            onChange={(v) => onChange({ allDecisionMakers: v })}
          />
        </div>

        {/* Priorities */}
        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-sm font-medium">What matters most? (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => togglePriority(chip)}
                className={`px-4 py-2.5 rounded-xl text-base font-medium transition-colors min-h-11 ${
                  priorities.includes(chip)
                    ? "bg-brand-blue text-text-primary"
                    : "bg-bg-elevated border border-border text-text-secondary hover:border-border-hover"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Things We Should Know — always visible */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">Things We Should Know</label>
          <textarea
            value={(data.thingsToKnow as string) || ""}
            onChange={(e) => onChange({ thingsToKnow: e.target.value })}
            placeholder="Anything else the homeowner mentioned that we should know going into this project..."
            rows={4}
            className="bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 resize-none transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
