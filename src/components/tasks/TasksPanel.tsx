"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Clock, ArrowRight, CheckCircle2 } from "lucide-react";

type TaskType =
  | "SETTER_FOLLOWUP"
  | "REP_FOLLOWUP"
  | "FINANCE_REVIEW"
  | "ZIP_REVIEW"
  | "MANUAL_BOOKING"
  | "ESCALATION";

interface Task {
  id: string;
  type: TaskType;
  status: "PENDING" | "RESOLVED";
  context: string;
  outcome: string | null;
  createdAt: string;
  availableOutcomes: string[];
}

const TYPE_BADGE: Record<TaskType, string> = {
  SETTER_FOLLOWUP: "bg-blue-500/20 text-blue-300",
  REP_FOLLOWUP: "bg-purple-500/20 text-purple-300",
  FINANCE_REVIEW: "bg-yellow-500/20 text-yellow-300",
  ZIP_REVIEW: "bg-orange-500/20 text-orange-300",
  MANUAL_BOOKING: "bg-cyan-500/20 text-cyan-300",
  ESCALATION: "bg-red-500/20 text-red-300",
};

const TYPE_LABEL: Record<TaskType, string> = {
  SETTER_FOLLOWUP: "Setter Followup",
  REP_FOLLOWUP: "Rep Followup",
  FINANCE_REVIEW: "Finance Review",
  ZIP_REVIEW: "ZIP Review",
  MANUAL_BOOKING: "Manual Booking",
  ESCALATION: "Escalation",
};

function ageLabel(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface ResolveSheetProps {
  task: Task;
  onClose: () => void;
  onResolved: () => void;
}

function ResolveSheet({ task, onClose, onResolved }: ResolveSheetProps) {
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!outcome) { setError("Select an outcome."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) throw new Error();
      onResolved();
    } catch {
      setError("Failed to resolve task.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-surface border border-border rounded-2xl p-5 w-full max-w-sm space-y-4">
        <p className="text-text-primary font-semibold text-sm">Resolve: {TYPE_LABEL[task.type]}</p>
        <p className="text-text-secondary text-xs leading-relaxed">{task.context}</p>
        <div className="space-y-1.5">
          {task.availableOutcomes.map((o) => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                outcome === o
                  ? "border-brand-blue bg-brand-blue/10 text-text-primary"
                  : "border-border hover:border-border-hover text-text-secondary"
              }`}
            >
              {o.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-xl border border-border text-text-secondary hover:text-text-primary text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !outcome}
            className="flex-1 px-3 py-2 rounded-xl bg-brand-blue hover:bg-accent-blue-hover text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TasksPanelProps {
  leadId?: string;
  inspectionId?: string;
  className?: string;
}

export default function TasksPanel({ leadId, inspectionId, className = "" }: TasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<Task | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: "PENDING" });
    if (inspectionId) params.set("inspectionId", inspectionId);
    else if (leadId) params.set("leadId", leadId);
    const res = await fetch(`/api/task?${params}`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [leadId, inspectionId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleResolved = () => {
    setResolveTarget(null);
    showToast("Task resolved.");
    fetchTasks();
  };

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");

  return (
    <div className={`bg-bg-surface border border-border rounded-2xl ${className}`}>
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-bg-surface border border-border text-text-primary px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}
      {resolveTarget && (
        <ResolveSheet
          task={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolved={handleResolved}
        />
      )}

      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <ClipboardCheck size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h3 className="text-text-primary font-semibold text-sm">Tasks</h3>
        {pendingTasks.length > 0 && (
          <span className="ml-auto bg-brand-blue text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingTasks.length}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-text-secondary text-xs text-center py-6">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-6 text-text-secondary text-sm">
          <CheckCircle2 size={14} strokeWidth={1.75} className="text-green-500" />
          No open tasks.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tasks.map((task) => (
            <div key={task.id} className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[task.type]}`}>
                  {TYPE_LABEL[task.type]}
                </span>
                <span className="flex items-center gap-1 text-text-secondary text-xs">
                  <Clock size={10} />
                  {ageLabel(task.createdAt)}
                </span>
              </div>
              <p className="text-text-secondary text-xs leading-relaxed line-clamp-3">{task.context}</p>
              {task.outcome && (
                <p className="text-xs text-text-secondary">
                  Outcome: <span className="text-text-primary">{task.outcome.replace(/_/g, " ")}</span>
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <a
                  href="/tasks"
                  className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-xs transition-colors"
                >
                  All tasks <ArrowRight size={10} />
                </a>
                {task.status === "PENDING" && task.availableOutcomes.length > 0 && (
                  <button
                    onClick={() => setResolveTarget(task)}
                    className="ml-auto text-xs font-medium text-brand-blue hover:text-accent-blue-hover transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
