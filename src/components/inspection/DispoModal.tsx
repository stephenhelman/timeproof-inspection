"use client";

import { useState, useRef, useEffect } from "react";
import AppointmentBookingModal from "@/src/components/appointment/AppointmentBookingModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type OutcomeId =
  | "sold"
  | "demo_not_sold"
  | "no_show"
  | "porched"
  | "reschedule";

const TILES: { id: OutcomeId; icon: string; label: string; accent: string }[] = [
  { id: "sold",          icon: "✓",  label: "SOLD",          accent: "green" },
  { id: "demo_not_sold", icon: "✗",  label: "DEMO NOT SOLD", accent: "yellow" },
  { id: "no_show",       icon: "🚫", label: "NO SHOW",       accent: "red" },
  { id: "porched",       icon: "🚪", label: "PORCHED",       accent: "purple" },
  { id: "reschedule",    icon: "📅", label: "RESCHEDULE",    accent: "blue" },
];

const TILE_STYLES: Record<string, { tile: string; label: string }> = {
  green:  { tile: "border-green-500/50 bg-green-500/10 active:bg-green-500/20",   label: "text-green-400" },
  yellow: { tile: "border-yellow-500/50 bg-yellow-500/10 active:bg-yellow-500/20", label: "text-yellow-400" },
  red:    { tile: "border-red-500/50 bg-red-500/10 active:bg-red-500/20",         label: "text-red-400" },
  purple: { tile: "border-purple-500/50 bg-purple-500/10 active:bg-purple-500/20", label: "text-purple-400" },
  blue:   { tile: "border-blue-500/50 bg-blue-500/10 active:bg-blue-500/20",      label: "text-blue-400" },
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
  leadName?: string;
  leadAddress?: string;
  inspectionId?: string | null;
  appointmentId?: string | null;
  currentWizardStep: number;
  onClose: () => void;
  onComplete: () => void;
}

export default function DispoModal({
  leadId,
  leadName = "Homeowner",
  leadAddress,
  inspectionId,
  appointmentId,
  currentWizardStep,
  onClose,
  onComplete,
}: Props) {
  const [screen, setScreen] = useState<"grid" | "fork">("grid");
  const [selected, setSelected] = useState<OutcomeId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // Demo Not Sold fields
  const [primaryObjection, setPrimaryObjection] = useState("");

  // Porched fields — door (flat shut-down) vs soft (logistics deflection).
  // This rep-set toggle becomes sr_dispo_context door|soft (§8): the reschedule
  // handler derives porched_door / porched_soft from it, replacing the old
  // infer-the-sub-case-from-freeform-notes heuristic.
  const [porchedContext, setPorchedContext] = useState<"door" | "soft">("door");

  // Reschedule fields
  const [reschedulePath, setReschedulePath] = useState<"manual" | "office">("office");
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Shared notes
  const [notes, setNotes] = useState("");

  const soldLocked = currentWizardStep < 6;

  function selectOutcome(id: OutcomeId) {
    if (id === "sold" && soldLocked) return;
    setSelected(id);
    setScreen("fork");
    setError("");
    // Reset per-outcome state
    setPrimaryObjection("");
    setPorchedContext("door");
    setReschedulePath("office");
    setShowBookingModal(false);
    setNotes("");
  }

  function goBack() {
    setScreen("grid");
    setError("");
  }

  function isConfirmDisabled() {
    if (saving) return true;
    switch (selected) {
      case "demo_not_sold": return !primaryObjection;
      default:              return false;
    }
  }

  async function handleConfirm() {
    // Manual reschedule: open booking modal instead of submitting
    if (selected === "reschedule" && reschedulePath === "manual") {
      setShowBookingModal(true);
      return;
    }

    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      outcome: selected,
      ...(inspectionId ? { inspectionId } : {}),
      ...(appointmentId ? { appointmentId } : {}),
    };

    switch (selected) {
      case "demo_not_sold":
        body.dispoPrimaryObjection = primaryObjection || null;
        body.dispoNotes = notes || null;
        break;
      case "no_show":
        body.dispoNotes = notes || null;
        break;
      case "porched":
        body.porchedContext = porchedContext;
        body.dispoNotes = notes || null;
        break;
      case "reschedule":
        body.reschedulePath = reschedulePath;
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

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Called after AppointmentBookingModal successfully books a new appointment
  async function handleManualRescheduleBooked(
    _newAppointmentId: string,
    _newInspectionId: string,
  ) {
    setShowBookingModal(false);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/lead/${leadId}/dispo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "reschedule",
          reschedulePath: "manual",
          dispoNotes: notes || null,
          ...(inspectionId ? { inspectionId } : {}),
          ...(appointmentId ? { appointmentId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to save");
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

      {showBookingModal && (
        <AppointmentBookingModal
          leadId={leadId}
          leadName={leadName}
          address={leadAddress}
          onClose={() => setShowBookingModal(false)}
          onSuccess={handleManualRescheduleBooked}
        />
      )}

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
                <div className="bg-bg-elevated border border-border rounded-xl p-4">
                  <p className="text-text-secondary text-sm">
                    This will move the lead to <span className="text-text-primary font-semibold">Pending Manager Approval</span>. A manager will confirm the sale.
                  </p>
                </div>
              )}

              {/* DEMO NOT SOLD */}
              {selected === "demo_not_sold" && (
                <>
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Primary Objection *</p>
                    <select
                      value={primaryObjection}
                      onChange={(e) => setPrimaryObjection(e.target.value)}
                      className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl min-h-12 px-4 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                    >
                      <option value="">— select —</option>
                      <option value="think_about_it">Think About It</option>
                      <option value="price">Price</option>
                      <option value="urgency">Urgency</option>
                      <option value="insurance">Insurance</option>
                      <option value="finance_decline">Finance Decline</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {primaryObjection === "finance_decline" && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                      <p className="text-orange-300 text-xs font-semibold mb-0.5">Finance Decline Path</p>
                      <p className="text-text-secondary text-xs">
                        Jordan will open Finance Discovery. Lead tagged <span className="text-text-primary">sr_finance_declined</span>.
                      </p>
                    </div>
                  )}
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* NO SHOW */}
              {selected === "no_show" && (
                <>
                  <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3">
                    <p className="text-text-secondary text-sm">
                      Nobody home — zero contact. Jordan fires a soft re-engagement sequence.
                    </p>
                  </div>
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* PORCHED */}
              {selected === "porched" && (
                <>
                  <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3">
                    <p className="text-text-secondary text-sm">
                      Made contact, could not get in. Jordan surfaces resistance before attempting rebook.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">How did it go?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { id: "door", emoji: "🚪", label: "Door Slam", hint: "Flat shut-down" },
                        { id: "soft", emoji: "🤷", label: "Soft Deflection", hint: "Bad timing / not home" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPorchedContext(opt.id)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border py-4 px-3 text-center transition-all ${
                            porchedContext === opt.id
                              ? "border-purple-500 bg-purple-500/10 text-text-primary"
                              : "border-border text-text-secondary hover:border-border-hover"
                          }`}
                        >
                          <span className="text-xl">{opt.emoji}</span>
                          <span className="text-xs font-bold tracking-wide">{opt.label}</span>
                          <span className="text-xs text-text-hint">{opt.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              {/* RESCHEDULE */}
              {selected === "reschedule" && (
                <>
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Reschedule Path</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["manual", "office"] as const).map((path) => (
                        <button
                          key={path}
                          type="button"
                          onClick={() => setReschedulePath(path)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border py-4 px-3 text-center transition-all ${
                            reschedulePath === path
                              ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                              : "border-border text-text-secondary hover:border-border-hover"
                          }`}
                        >
                          <span className="text-xl">{path === "manual" ? "📲" : "🤖"}</span>
                          <span className="text-xs font-bold tracking-wide capitalize">{path === "manual" ? "Book Now" : "Send to Office"}</span>
                          <span className="text-xs text-text-hint">
                            {path === "manual" ? "Rep books directly" : "Jordan finds new time"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {reschedulePath === "office" && (
                    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3">
                      <p className="text-text-secondary text-xs">
                        Jordan will reach out to find a new time. <span className="text-text-primary">sr_bot_stage</span> set to reschedule.
                      </p>
                    </div>
                  )}
                  {reschedulePath === "manual" && (
                    <div className="bg-brand-navy border border-brand-blue/30 rounded-xl px-4 py-3">
                      <p className="text-text-accent text-xs font-semibold mb-0.5">Book Now</p>
                      <p className="text-text-secondary text-xs">
                        Tapping Confirm will open the booking modal to schedule a new appointment directly.
                      </p>
                    </div>
                  )}
                  <NotesField value={notes} onChange={setNotes} />
                </>
              )}

              <button
                type="button"
                disabled={isConfirmDisabled()}
                onClick={handleConfirm}
                className="w-full bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-text-primary font-semibold rounded-xl py-3.5 text-base transition-all min-h-13"
              >
                {saving ? "Saving…" : selected === "reschedule" && reschedulePath === "manual" ? "Book Appointment →" : "Confirm"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
