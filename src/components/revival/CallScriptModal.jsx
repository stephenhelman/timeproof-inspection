"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Send, ChevronDown, ChevronUp } from "lucide-react";

// ── Script data ───────────────────────────────────────────
const script = {
  opener: {
    title: "Opener",
    tone: "Warm, calm, unhurried. No urgency. Sound like you're checking in, not selling.",
    lines: [
      {
        label: "Introduction",
        text: "Hey [Name], this is [Your Name] calling from Qntum Roofing. I'm not sure if we've spoken before — I'm actually reaching out on behalf of our team to follow up on an inspection we ran at your property a little while back. Do you have just a couple minutes?",
        note: "If they say they're busy: 'Totally understand. When would be a better time to connect? I just want to make sure your experience with us was a good one.'",
      },
    ],
  },
  phases: [
    {
      id: 1,
      title: "Phase 1 — Connect & Establish Intent",
      tone: "Curious, genuine. Zero pressure. You're here to learn, not pitch.",
      steps: [
        {
          label: "Set the frame",
          text: "We've been doing a review of some of our past inspections to make sure every homeowner had a good experience — regardless of whether they moved forward with us or not. I just had a couple of quick questions, if that's okay.",
          note: "This removes the 'sales call' perception immediately.",
        },
        {
          label: "Warm check-in",
          text: "First — did everything go smoothly when our rep came out? Was the inspection process clear for you?",
          tone: "Genuinely curious. Let them talk.",
        },
      ],
    },
    {
      id: 2,
      title: "Phase 2 — Understand What Happened",
      tone: "Non-judgmental. Slightly confused, like you're just trying to understand. No edge.",
      steps: [
        {
          label: "Probe the outcome",
          text: "I see here that we weren't able to get you started with a project at that time. Can I ask — did you end up going in a different direction, or is it something that's still kind of up in the air?",
          note: "Their answer tells you everything. Listen for: went with competitor, couldn't get approval, price, didn't trust, forgot about it, life happened.",
        },
        {
          label: "Go deeper — NEPQ problem question",
          text: "What was the main thing that made you decide to hold off?",
          tone: "Soft. Pause after asking. Let silence work for you.",
        },
      ],
    },
    {
      id: 3,
      title: "Phase 3 — Objection Handling",
      tone: "Empathetic, never defensive. Agree first, then redirect.",
      steps: [],
    },
    {
      id: 4,
      title: "Phase 4 — Recovery or Review Ask",
      tone: "Low-key confident. You're offering value, not begging.",
      steps: [
        {
          label: "If open to revisiting",
          text: "We've actually had a few changes in how we're structuring things for homeowners in your situation. It might be worth a quick 10-minute conversation just to see if there's something that makes more sense now. Would that be something you'd be open to?",
          note: "Don't over-explain. Let the question breathe.",
        },
        {
          label: "If not open — pivot to review",
          text: "That's completely fair. I appreciate you being straight with me. One last thing — if your overall experience with our team was positive, even if the timing wasn't right, would you be open to leaving us a quick Google review? It really does help families like yours find us when they need help.",
          tone: "Humble. Grateful. Not pushy.",
        },
        {
          label: "If experience was negative",
          text: "I appreciate you sharing that. That's actually exactly why we're making these calls — we want to know when we missed the mark. Can I ask what specifically fell short so I can make sure it doesn't happen to the next homeowner?",
          note: "Turn negatives into intel. Don't get defensive. This can still end in a recovery.",
        },
      ],
    },
    {
      id: 5,
      title: "Phase 5 — Close the Loop",
      tone: "Gracious. Leave the door open without being needy.",
      steps: [
        {
          label: "Referral incentive pitch",
          text: "One more thing before I let you go — we actually have a referral program right now. If you know anyone who might need a roof inspection, whether it's a neighbor, family member, anyone — if they let us come out and do an inspection, we'll send you $500. It doesn't even have to turn into a project. Just the inspection.",
          tone: "Genuine, low-key excited. This is a gift, not a pitch. Let it land.",
          note: "The key word is 'just the inspection.' Remove all pressure. They get $500 for a phone number.",
        },
        {
          label: "Warm close",
          text: "I really appreciate your time. I'll make a note of everything you shared. And seriously — keep that $500 referral in mind. All it takes is one call.",
          note: "Short and clean. Don't over-explain the referral again. Plant it and go.",
        },
      ],
    },
  ],
  objections: [
    {
      trigger: "Went with another company",
      response: "That makes total sense — you had to make the best decision for your family at the time. Can I ask, how has that process been going for you so far?",
      tone: "Curious, not competitive. If they express frustration with the other company, that's your opening.",
      followup: "If issues with other contractor: 'I'm sorry to hear that. We do see that sometimes. Would it be helpful to have someone take a second look just to make sure everything was done right?'",
    },
    {
      trigger: "Insurance denied or didn't get approved",
      response: "That's actually more common than people realize, and it doesn't always mean it's the final answer. Did the rep walk you through a re-inspection option or a supplemental claim at the time?",
      tone: "Knowledgeable, helpful. Position as an advocate.",
      followup: "If no: 'That's something we can actually look at again at no cost to you. Would you be open to having someone take a second look?'",
    },
    {
      trigger: "Price was too high / couldn't afford it",
      response: "I hear that. Roofing is a big investment. Was it more about the out-of-pocket cost, or was there something about the scope that felt off?",
      tone: "Clarifying, not defending. You want to understand what 'too expensive' actually means.",
      followup: "If OOP cost: 'We do have some options now that might look different than what was presented before. Would it be worth a quick conversation?'",
    },
    {
      trigger: "Never heard back / fell through the cracks",
      response: "I'm really sorry about that — that's on us and it shouldn't have happened. I want to make sure we can make that right. Is the roof situation something that's still on your radar?",
      tone: "Own it fully. No excuses. This is actually a strong recovery opportunity.",
      followup: "'Would you be open to starting fresh? I'd personally make sure you have a clear answer either way.'",
    },
    {
      trigger: "Not interested / just wanted an inspection",
      response: "That's completely fine — honestly, that's what we're here for. I just want to make sure you have all the information you need. Is there anything about the inspection report that was unclear or that you still have questions on?",
      tone: "No pressure. Add value. Keep the door open.",
      followup: "Pivot to review ask.",
    },
    {
      trigger: "Already got the work done elsewhere",
      response: "That's great — glad you got it taken care of. How did everything turn out?",
      tone: "Genuinely happy for them. Then go straight to review ask.",
      followup: "'If the experience with our team was positive, even just the inspection piece, a quick Google review would mean a lot to us.'",
    },
  ],
  framework: [
    { step: 1, label: "Permission", desc: "Always ask if it's a good time. Never steamroll." },
    { step: 2, label: "Frame", desc: "Customer service call, not a sales call. Say it early." },
    { step: 3, label: "Listen First", desc: "Ask one question then stop talking. Silence is a tool." },
    { step: 4, label: "Clarify Before Pitching", desc: "You must understand the real objection before you offer anything." },
    { step: 5, label: "Agree Before Redirecting", desc: "Never fight an objection. Validate it, then ask a follow-up question." },
    { step: 6, label: "Two Paths Always", desc: "Every call ends with either a recovery attempt or a review ask. Never hang up with nothing." },
    { step: 7, label: "Referral Seed", desc: "Always mention the $500 referral before you hang up. They send someone for an inspection — not a sale, just an inspection — and they get $500. Plant it on every single call, even dead ones." },
  ],
};

const ALL_PHASES = [{ id: 0, title: "Opener" }, ...script.phases];

const PHASE_KEY_MAP = {
  0: "opener",
  1: "phase_1",
  2: "phase_2",
  3: "phase_3",
  4: "phase_4",
  5: "phase_5",
};

const PHASE_LABELS = {
  general: "General",
  opener: "Opener",
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  phase_3: "Phase 3",
  phase_4: "Phase 4",
  phase_5: "Phase 5",
};

function fmtNoteDate(val) {
  if (!val) return "";
  return new Date(val).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ── Objection Card (used inline in Phase 3) ───────────────
function ObjectionCard({ obj, idx, isOpen, onToggle, leadId }) {
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || !leadId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lead/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim(), phase: "phase_3" }),
      });
      if (!res.ok) throw new Error();
      setNoteContent("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left min-h-13"
      >
        <span className="text-text-primary text-sm font-medium">
          When they say:{" "}
          <span className="text-text-secondary font-normal">
            &ldquo;{obj.trigger}&rdquo;
          </span>
        </span>
        {isOpen
          ? <ChevronUp size={15} className="text-text-secondary shrink-0 ml-2" />
          : <ChevronDown size={15} className="text-text-secondary shrink-0 ml-2" />
        }
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <p
            className="text-text-primary text-base leading-relaxed pt-3"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {obj.response}
          </p>
          {obj.tone && (
            <p className="text-text-secondary text-sm italic">{obj.tone}</p>
          )}
          {obj.followup && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <p className="text-amber-400 text-sm">{obj.followup}</p>
            </div>
          )}

          {/* Inline note input */}
          {leadId && (
            <form onSubmit={handleSaveNote} className="pt-1 space-y-1.5">
              <div className="relative">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={2}
                  placeholder="Note what happened with this objection…"
                  className="w-full bg-bg-elevated border border-border text-text-primary rounded-xl px-4 py-2.5 pr-12 text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
                <button
                  type="submit"
                  disabled={!noteContent.trim() || saving}
                  className="absolute right-3 bottom-2.5 w-7 h-7 rounded-lg bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-40 flex items-center justify-center transition-colors"
                >
                  <Send size={11} strokeWidth={2} className="text-white" />
                </button>
              </div>
              {saved && (
                <p className="text-green-400 text-xs">Note saved ✓</p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notes Tab ─────────────────────────────────────────────
function NotesTab({ leadId, activePhaseId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  const currentPhaseKey = PHASE_KEY_MAP[activePhaseId] ?? "general";

  // Fetch notes when the lead is available
  useEffect(() => {
    if (!leadId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/lead/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        setNotes(Array.isArray(data.notes) ? data.notes : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]);

  const phaseNotes = notes
    .filter((n) => n.phase === currentPhaseKey)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const allNotesSorted = [...notes].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!content.trim() || !leadId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lead/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), phase: currentPhaseKey }),
      });
      if (!res.ok) throw new Error();
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      setContent("");
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  if (!leadId) {
    return (
      <div className="px-6 py-10 text-center text-text-secondary text-sm">
        Open this script from a lead page to enable note-taking.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Phase context label */}
      <div className="px-6 pt-5 pb-3 border-b border-border">
        <p className="text-text-secondary text-xs uppercase tracking-wider font-medium">
          Noting for:{" "}
          <span className="text-text-primary font-semibold">
            {PHASE_LABELS[currentPhaseKey] ?? "General"}
          </span>
          <span className="text-text-secondary font-normal"> — switch phases in the Script tab to change context</span>
        </p>
      </div>

      <div className="px-6 py-5 space-y-5 flex-1">
        {/* Add note form */}
        <form onSubmit={handleSave} className="space-y-2">
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder={`What happened during ${PHASE_LABELS[currentPhaseKey] ?? "this phase"}? What did they say?`}
              className="w-full bg-bg-input border border-border text-text-primary rounded-xl px-4 py-3 pr-12 text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={!content.trim() || saving}
              className="absolute right-3 bottom-3 w-8 h-8 rounded-lg bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-40 flex items-center justify-center transition-colors"
            >
              <Send size={13} strokeWidth={2} className="text-white" />
            </button>
          </div>
          <p className="text-text-secondary text-xs">
            Notes are saved to this lead and visible to all reps.
          </p>
        </form>

        {/* Phase-filtered notes */}
        {loading ? (
          <p className="text-text-secondary text-sm text-center py-4">Loading notes…</p>
        ) : phaseNotes.length === 0 ? (
          <p className="text-text-secondary text-sm text-center py-2">
            No notes yet for this phase.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">
              {PHASE_LABELS[currentPhaseKey]} notes ({phaseNotes.length})
            </p>
            {phaseNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}

        {/* All notes collapsible summary */}
        {allNotesSorted.length > 0 && (
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setShowAllNotes((v) => !v)}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm transition-colors w-full text-left"
            >
              {showAllNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              All notes — chronological ({allNotesSorted.length})
            </button>
            {showAllNotes && (
              <div className="mt-3 space-y-3">
                {allNotesSorted.map((note) => (
                  <NoteCard key={note.id} note={note} showPhase />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, showPhase = false }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {showPhase && note.phase && (
          <span className="text-text-secondary text-xs bg-bg-base px-2 py-0.5 rounded-md border border-border">
            {PHASE_LABELS[note.phase] ?? note.phase}
          </span>
        )}
        <span className="text-text-secondary text-xs ml-auto">{fmtNoteDate(note.createdAt)}</span>
      </div>
      <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
      {note.authorName && (
        <p className="text-text-secondary text-xs">— {note.authorName}</p>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────
export default function CallScriptModal({ isOpen, onClose, customerName, leadId }) {
  const [activeTab, setActiveTab] = useState("script");
  const [activePhaseId, setActivePhaseId] = useState(0);
  const [openObjections, setOpenObjections] = useState({});

  const handleClose = useCallback(() => {
    onClose();
    setActiveTab("script");
    setActivePhaseId(0);
    setOpenObjections({});
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const activePhase =
    activePhaseId === 0
      ? { ...script.opener, id: 0, steps: script.opener.lines }
      : script.phases.find((p) => p.id === activePhaseId);

  const toggleObjection = (idx) => {
    setOpenObjections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const TABS = [
    { id: "script", label: "Script" },
    { id: "notes", label: "Notes" },
    { id: "framework", label: "Framework" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full sm:max-w-2xl max-h-screen sm:max-h-[90vh] bg-bg-elevated border border-border rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-text-primary text-lg font-semibold">
              Lead Recovery Call Script
            </h2>
            {customerName && (
              <p className="text-text-secondary text-sm mt-0.5">{customerName}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-input transition-colors"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-6 overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "border-brand-blue text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* SCRIPT TAB */}
          {activeTab === "script" && (
            <div className="flex flex-col">
              {/* Phase selector */}
              <div className="flex gap-2 px-6 py-4 overflow-x-auto shrink-0 border-b border-border">
                {ALL_PHASES.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhaseId(phase.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[36px] ${
                      activePhaseId === phase.id
                        ? "bg-brand-blue text-white"
                        : "bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-input"
                    }`}
                  >
                    {phase.id === 0 ? "Opener" : `Ph.${phase.id}`}
                  </button>
                ))}
                {leadId && (
                  <button
                    onClick={() => setActiveTab("notes")}
                    className="shrink-0 ml-auto px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-hover transition-colors whitespace-nowrap min-h-[36px]"
                  >
                    + Add Note
                  </button>
                )}
              </div>

              {/* Phase content */}
              {activePhase && (
                <div className="px-6 py-5 space-y-5">
                  <div>
                    <h3 className="text-text-primary font-semibold text-base mb-1">
                      {activePhase.title}
                    </h3>
                    {activePhase.tone && (
                      <p className="text-text-secondary text-sm italic">{activePhase.tone}</p>
                    )}
                  </div>

                  {/* Phase 3 — objections rendered inline */}
                  {activePhaseId === 3 && (
                    <div className="space-y-3">
                      {script.objections.map((obj, idx) => (
                        <ObjectionCard
                          key={idx}
                          obj={obj}
                          idx={idx}
                          isOpen={!!openObjections[idx]}
                          onToggle={() => toggleObjection(idx)}
                          leadId={leadId}
                        />
                      ))}
                    </div>
                  )}

                  {activePhaseId !== 3 && activePhase.steps?.map((step, idx) => (
                    <div
                      key={idx}
                      className="bg-bg-surface border border-border rounded-xl p-4 space-y-3"
                    >
                      <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                        {step.label}
                      </p>
                      <p
                        className="text-text-primary text-base leading-relaxed"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {step.text}
                      </p>
                      {step.tone && (
                        <p className="text-text-secondary text-sm italic">{step.tone}</p>
                      )}
                      {step.note && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                          <p className="text-amber-400 text-sm">{step.note}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <NotesTab leadId={leadId} activePhaseId={activePhaseId} />
          )}

          {/* FRAMEWORK TAB */}
          {activeTab === "framework" && (
            <div className="px-6 py-5 space-y-3">
              {script.framework.map((item) => (
                <div
                  key={item.step}
                  className="bg-bg-surface border border-border rounded-xl px-4 py-4 flex gap-4"
                >
                  <span className="w-8 h-8 rounded-full bg-brand-blue text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-text-primary font-medium text-sm">{item.label}</p>
                    <p className="text-text-secondary text-sm mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
