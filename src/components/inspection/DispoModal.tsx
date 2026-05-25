"use client";

import { useState, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OutcomeId =
  | "sold"
  | "demo_not_sold"
  | "credit_fail"
  | "no_show"
  | "porched"
  | "reschedule"
  | "escalate";

const TILES: { id: OutcomeId; icon: string; label: string; accent: string }[] = [
  { id: "sold",          icon: "✓",  label: "SOLD",          accent: "green" },
  { id: "demo_not_sold", icon: "✗",  label: "DEMO NOT SOLD", accent: "yellow" },
  { id: "credit_fail",   icon: "💳", label: "CREDIT FAIL",   accent: "orange" },
  { id: "no_show",       icon: "🚫", label: "NO SHOW",       accent: "red" },
  { id: "porched",       icon: "🚪", label: "PORCHED",       accent: "purple" },
  { id: "reschedule",    icon: "📅", label: "RESCHEDULE",    accent: "blue" },
  { id: "escalate",      icon: "🚨", label: "ESCALATE",      accent: "rose" },
];

const TILE_STYLES: Record<string, { tile: string; label: string }> = {
  green:  { tile: "border-green-500/50 bg-green-500/10 active:bg-green-500/20",   label: "text-green-400" },
  yellow: { tile: "border-yellow-500/50 bg-yellow-500/10 active:bg-yellow-500/20", label: "text-yellow-400" },
  orange: { tile: "border-orange-500/50 bg-orange-500/10 active:bg-orange-500/20", label: "text-orange-400" },
  red:    { tile: "border-red-500/50 bg-red-500/10 active:bg-red-500/20",         label: "text-red-400" },
  purple: { tile: "border-purple-500/50 bg-purple-500/10 active:bg-purple-500/20", label: "text-purple-400" },
  blue:   { tile: "border-blue-500/50 bg-blue-500/10 active:bg-blue-500/20",      label: "text-blue-400" },
  rose:   { tile: "border-rose-600/50 bg-rose-600/10 active:bg-rose-600/20",      label: "text-rose-400" },
};

// ── Confetti ──────────────────────────────────────────────────────────────────

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#F06B30", "#4CAF50", "#2196F3", "#FFC107", "#E91E63", "#9C27B0"];
    type Particle = { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rot: number; rotV: number };
    const particles: Particle[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -300 - 10,
      w: Math.random() * 10 + 6,
      h: Math.random() * 5 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * 5 + 2,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 7,
    }));

    const start = performance.now();
    const DURATION = 3800;
    let raf: number;

    const draw = (now: number) => {
      const elapsed = now - start;
      const alpha = Math.max(0, 1 - Math.max(0, elapsed - 2600) / 1200);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07;
        p.rot += p.rotV;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (elapsed < DURATION) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 60 }} />;
}

// ── Shared field components ───────────────────────────────────────────────────

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">{label}</p>
      <div className="flex gap-3">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              value === v
                ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                : "border-border text-text-secondary hover:border-border-hover"
            }`}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Notes</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Additional context for the team…"
        className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl px-4 py-3 text-sm placeholder:text-text-hint focus:outline-none focus:border-brand-blue transition-colors resize-none"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  leadId: string;
  inspectionId?: string | null;
  currentWizardStep: number;
  onClose: () => void;
  onComplete: () => void;
  onReschedule?: (reason: string) => void;
}

export default function DispoModal({
  leadId,
  inspectionId,
  currentWizardStep,
  onClose,
  onComplete,
  onReschedule,
}: Props) {
  const [screen, setScreen] = useState<"grid" | "fork">("grid");
  const [selected, setSelected] = useState<OutcomeId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // Fork fields
  const [decisionMakerPresent, setDecisionMakerPresent] = useState<boolean | null>(null);
  const [primaryObjection, setPrimaryObjection] = useState("");
  const [lenderAttempted, setLenderAttempted] = useState("");
  const [madeContact, setMadeContact] = useState<boolean | null>(null);
  const [waitTime, setWaitTime] = useState("");
  const [respondedToContact, setRespondedToContact] = useState<boolean | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [notes, setNotes] = useState("");

  const soldLocked = currentWizardStep < 6;

  function selectOutcome(id: OutcomeId) {
    if (id === "sold" && soldLocked) return;
    setSelected(id);
    setScreen("fork");
    setError("");
  }

  function goBack() {
    setScreen("grid");
    setError("");
  }

  function isConfirmDisabled() {
    if (saving) return true;
    switch (selected) {
      case "demo_not_sold": return decisionMakerPresent === null || !primaryObjection;
      case "no_show":       return madeContact === null;
      case "porched":       return !waitTime || respondedToContact === null;
      case "reschedule":    return !rescheduleReason;
      default:              return false;
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      outcome: selected,
      ...(inspectionId ? { inspectionId } : {}),
    };

    switch (selected) {
      case "demo_not_sold":
        body.dispoDecisionMakerPresent = decisionMakerPresent;
        body.dispoPrimaryObjection = primaryObjection || null;
        body.dispoNotes = notes || null;
        break;
      case "credit_fail":
        body.lenderAttempted = lenderAttempted || null;
        body.dispoNotes = notes || null;
        break;
      case "no_show":
        body.madeContact = madeContact;
        body.dispoNotes = notes || null;
        break;
      case "porched":
        body.waitTime = waitTime || null;
        body.respondedToContact = respondedToContact;
        body.dispoNotes = notes || null;
        break;
      case "reschedule":
        body.rescheduleReason = rescheduleReason;
        body.dispoNotes = notes || null;
        break;
      case "escalate":
        body.dispoNotes = notes || null;
        break;
    }

    try {
      const res = await fetch(`/api/lead/${leadId}/dispo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to save");

      if (selected === "sold") {
        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
          onComplete();
        }, 3800);
        return;
      }

      if (selected === "porched") {
        onReschedule?.("porched");
        onComplete();
        return;
      }

      if (selected === "reschedule") {
        onReschedule?.(rescheduleReason);
        onComplete();
        return;
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const tileLabel = TILES.find((t) => t.id === selected)?.label ?? "";

  return (
    <>
      {showConfetti && <Confetti />}

      <div className="fixed inset-0 z-50 flex flex-col bg-bg-base animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-safe-top py-4 border-b border-border shrink-0">
          {screen === "fork" && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="flex-1 text-text-primary text-lg font-semibold">
            {screen === "grid" ? "Demo Disposition" : tileLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-none px-5 py-5">

          {/* ── Screen 1: Outcome grid ── */}
          {screen === "grid" && (
            <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
              {TILES.map((tile) => {
                const styles = TILE_STYLES[tile.accent];
                const locked = tile.id === "sold" && soldLocked;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    disabled={locked}
                    title={locked ? "Complete the inspection report before logging a sale." : undefined}
                    onClick={() => selectOutcome(tile.id)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border py-7 px-3 text-center transition-all ${
                      locked
                        ? "border-border bg-bg-elevated opacity-40 cursor-not-allowed"
                        : styles.tile
                    }`}
                  >
                    <span className="text-3xl leading-none">{tile.icon}</span>
                    <span className={`text-xs font-bold tracking-wide leading-tight ${locked ? "text-text-hint" : styles.label}`}>
                      {tile.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Screen 2: Fork per outcome ── */}
          {screen === "fork" && selected && (
            <div className="space-y-5 max-w-lg mx-auto">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* SOLD */}
              {selected === "sold" && (
                <p className="text-text-secondary text-sm">Log this lead as SOLD?</p>
              )}

              {/* DEMO NOT SOLD */}
              {selected === "demo_not_sold" && (
                <>
                  <YesNo
                    label="Were all decision makers present? *"
                    value={decisionMakerPresent}
                    onChange={setDecisionMakerPresent}
                  />
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Primary Objection *</p>
                    <select
                      value={primaryObjection}
                      onChange={(e) => setPrimaryObjection(e.target.value)}
                      className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl min-h-12 px-4 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                    >
                      <option value="">— select —</option>
                      <option value="price">Price</option>
                      <option value="timing">Timing — not ready yet</option>
                      <option value="need_to_think">Need to think about it</option>
                      <option value="spouse">Spouse / partner not on board</option>
                      <option value="competitor">Going with a competitor</option>
                      <option value="insurance_denial">Insurance denial</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* CREDIT FAIL */}
              {selected === "credit_fail" && (
                <>
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Lender Attempted</p>
                    <input
                      type="text"
                      value={lenderAttempted}
                      onChange={(e) => setLenderAttempted(e.target.value)}
                      placeholder="e.g. Chase, local credit union…"
                      className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl min-h-12 px-4 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                    />
                  </div>
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* NO SHOW */}
              {selected === "no_show" && (
                <>
                  <YesNo label="Did you make contact? *" value={madeContact} onChange={setMadeContact} />
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* PORCHED */}
              {selected === "porched" && (
                <>
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">How long did you wait? *</p>
                    <div className="space-y-2">
                      {["Under 5 minutes", "5–10 minutes", "10+ minutes"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setWaitTime(opt)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                            waitTime === opt
                              ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                              : "border-border text-text-secondary hover:border-border-hover"
                          }`}
                        >
                          {opt}
                          {waitTime === opt && <span className="text-brand-blue text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <YesNo
                    label="Did they respond to knocking or calling? *"
                    value={respondedToContact}
                    onChange={setRespondedToContact}
                  />
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* RESCHEDULE */}
              {selected === "reschedule" && (
                <>
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Reason *</p>
                    <select
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                      className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl min-h-12 px-4 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                    >
                      <option value="">— select —</option>
                      <option value="homeowner_request">Cancelled by homeowner</option>
                      <option value="one_legger">One legger — decision maker not present</option>
                      <option value="time_constraint">Time constraint — ran out of time</option>
                      <option value="rep_conflict">Rep schedule conflict</option>
                      <option value="weather">Weather</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* ESCALATE */}
              {selected === "escalate" && (
                <>
                  <p className="text-text-secondary text-sm">Pause all bot contact and flag for manager review?</p>
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              <button
                type="button"
                disabled={isConfirmDisabled()}
                onClick={handleConfirm}
                className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3.5 text-base transition-all min-h-13"
              >
                {saving ? "Saving…" : "Confirm"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
