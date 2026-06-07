"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, ArrowRight, Clock } from "lucide-react";

type TaskStatus = "PENDING" | "RESOLVED";
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
  status: TaskStatus;
  context: string;
  outcome: string | null;
  createdAt: string;
  resolvedAt: string | null;
  availableOutcomes: string[];
  lead: {
    id: string;
    customerName: string;
    streetAddress: string | null;
    city: string | null;
    state: string | null;
  };
  inspection: { id: string } | null;
  assignedUser: { id: string; name: string | null };
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

interface ResolveModalProps {
  task: Task;
  onClose: () => void;
  onResolved: () => void;
}

function ResolveModal({ task, onClose, onResolved }: ResolveModalProps) {
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
      if (!res.ok) throw new Error("Failed to resolve task");
      onResolved();
    } catch {
      setError("Failed to resolve task.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-text-primary font-semibold">Resolve Task</h2>
        <p className="text-text-secondary text-sm">{task.context}</p>
        <div className="space-y-2">
          {task.availableOutcomes.map((o) => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
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
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-border text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !outcome}
            className="flex-1 px-4 py-2 rounded-xl bg-brand-blue hover:bg-accent-blue-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | TaskStatus>("PENDING");
  const [typeFilter, setTypeFilter] = useState<"" | TaskType>("");
  const [resolveTarget, setResolveTarget] = useState<Task | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/task?${params}`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleResolved = () => {
    setResolveTarget(null);
    showToast("Task resolved.");
    fetchTasks();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-bg-surface border border-border text-text-primary px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      {resolveTarget && (
        <ResolveModal
          task={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolved={handleResolved}
        />
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} strokeWidth={1.75} className="text-text-secondary" />
          <h1 className="text-text-primary text-2xl font-bold tracking-tight">Tasks</h1>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | TaskStatus)}
            className="bg-bg-elevated border border-border text-text-secondary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-border-hover"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | TaskType)}
            className="bg-bg-elevated border border-border text-text-secondary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-border-hover"
          >
            <option value="">All Types</option>
            {(Object.keys(TYPE_LABEL) as TaskType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm py-12 text-center">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-text-secondary text-sm">No tasks found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const address = [task.lead.streetAddress, task.lead.city, task.lead.state]
              .filter(Boolean)
              .join(", ");
            const isPending = task.status === "PENDING";
            return (
              <div
                key={task.id}
                className="bg-bg-surface border border-border rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[task.type]}`}
                      >
                        {TYPE_LABEL[task.type]}
                      </span>
                      {task.status === "RESOLVED" && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-text-primary font-medium mt-1.5">
                      {task.lead.customerName}
                    </p>
                    {address && (
                      <p className="text-text-secondary text-xs mt-0.5">{address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-text-secondary text-xs shrink-0">
                    <Clock size={11} />
                    {ageLabel(task.createdAt)}
                  </div>
                </div>

                <p className="text-text-secondary text-sm leading-relaxed line-clamp-3">
                  {task.context}
                </p>

                {task.outcome && (
                  <p className="text-xs text-text-secondary">
                    Outcome: <span className="text-text-primary">{task.outcome.replace(/_/g, " ")}</span>
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <a
                    href={`/leads/${task.lead.id}`}
                    className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-xs transition-colors"
                  >
                    View Lead <ArrowRight size={11} />
                  </a>
                  {task.inspection && (
                    <a
                      href={`/inspection/${task.inspection.id}`}
                      className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-xs transition-colors"
                    >
                      View Inspection <ArrowRight size={11} />
                    </a>
                  )}
                  {isPending && task.availableOutcomes.length > 0 && (
                    <button
                      onClick={() => setResolveTarget(task)}
                      className="ml-auto px-3 py-1 rounded-lg bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue text-xs font-medium transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
