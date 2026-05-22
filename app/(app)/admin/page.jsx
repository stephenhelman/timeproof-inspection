"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/src/lib/use-permissions";
import { useRouter } from "next/navigation";
import { Users, Webhook, Settings, Users2, Plus, RefreshCw, CheckCircle2, XCircle, ChevronDown } from "lucide-react";

const ROLES = ["REP", "SETTER", "SETTER_MANAGER", "SALES_MANAGER", "REGIONAL", "ADMIN"];

// ── Utilities ──────────────────────────────────────────────────────────────
function Badge({ text, color }) {
  const colors = {
    ADMIN:          "bg-red-500/20 text-red-300",
    REGIONAL:       "bg-purple-500/20 text-purple-300",
    SALES_MANAGER:  "bg-blue-500/20 text-blue-300",
    SETTER_MANAGER: "bg-cyan-500/20 text-cyan-300",
    SETTER:         "bg-indigo-500/20 text-indigo-300",
    REP:            "bg-zinc-500/20 text-zinc-400",
    success:        "bg-emerald-500/20 text-emerald-300",
    error:          "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[text] ?? colors[color] ?? "bg-zinc-500/20 text-zinc-400"}`}>
      {text}
    </span>
  );
}

// ── Tab: Users ─────────────────────────────────────────────────────────────
function UsersTab({ perms }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", role: "REP", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveUser(id) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) { setEditingId(null); await load(); }
    else { const d = await res.json(); setError(d.error); }
    setSaving(false);
  }

  async function createUser() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    if (res.ok) {
      setShowCreate(false);
      setCreateForm({ name: "", email: "", role: "REP", password: "" });
      await load();
    } else {
      const d = await res.json();
      setError(d.error);
    }
    setSaving(false);
  }

  async function resetPassword(id, email) {
    const ok = confirm(`Send a password reset email to ${email}?`);
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: true }),
    });
    const d = await res.json();
    alert(d.ok ? "Reset email sent." : d.error);
  }

  if (loading) return <p className="text-text-secondary text-sm p-4">Loading users…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{users.length} users</p>
        {perms.canManageUsers && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 bg-brand-blue hover:bg-accent-blue-hover text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} /> New User
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {showCreate && (
        <div className="bg-bg-elevated border border-border rounded-xl p-4 flex flex-col gap-3">
          <p className="text-text-primary font-medium text-sm">Create User</p>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field" placeholder="Name" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
            <input className="input-field" placeholder="Email *" type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            <select className="input-field" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="input-field" placeholder="Password (optional)" type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-text-secondary text-sm px-3 py-1.5 rounded-lg hover:bg-bg-surface transition-colors">Cancel</button>
            <button onClick={createUser} disabled={saving || !createForm.email} className="bg-brand-blue hover:bg-accent-blue-hover text-white text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-text-secondary font-medium">Name</th>
              <th className="text-left p-3 text-text-secondary font-medium">Email</th>
              <th className="text-left p-3 text-text-secondary font-medium">Role</th>
              <th className="text-left p-3 text-text-secondary font-medium">Status</th>
              {perms.canManageUsers && <th className="p-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-bg-elevated transition-colors">
                {editingId === u.id ? (
                  <>
                    <td className="p-3">
                      <input className="input-field text-xs w-full" value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    </td>
                    <td className="p-3 text-text-secondary">{u.email}</td>
                    <td className="p-3">
                      <select className="input-field text-xs" value={editForm.role ?? u.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <select className="input-field text-xs" value={String(editForm.isActive ?? u.isActive)} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === "true" }))}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="text-text-secondary text-xs hover:text-text-primary">Cancel</button>
                        <button onClick={() => saveUser(u.id)} disabled={saving} className="text-brand-blue text-xs hover:underline disabled:opacity-50">Save</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 text-text-primary font-medium">{u.name || "—"}</td>
                    <td className="p-3 text-text-secondary">{u.email}</td>
                    <td className="p-3"><Badge text={u.role} /></td>
                    <td className="p-3">
                      <span className={`text-xs font-medium ${u.isActive ? "text-emerald-400" : "text-zinc-500"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {perms.canManageUsers && (
                      <td className="p-3">
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => { setEditingId(u.id); setEditForm({ name: u.name, role: u.role, isActive: u.isActive }); }}
                            className="text-text-secondary text-xs hover:text-text-primary"
                          >Edit</button>
                          <button onClick={() => resetPassword(u.id, u.email)} className="text-text-secondary text-xs hover:text-text-primary">Reset PW</button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Teams ─────────────────────────────────────────────────────────────
function TeamsTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
      const init = {};
      data.forEach(u => { init[u.id] = u.managerId ?? ""; });
      setAssignments(init);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveManager(userId) {
    setSaving(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId: assignments[userId] || null }),
    });
    setSaving(false);
    await load();
  }

  if (loading) return <p className="text-text-secondary text-sm p-4">Loading…</p>;

  const managers = users.filter(u => ["ADMIN", "REGIONAL", "SALES_MANAGER", "SETTER_MANAGER"].includes(u.role));

  return (
    <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-3 text-text-secondary font-medium">User</th>
            <th className="text-left p-3 text-text-secondary font-medium">Role</th>
            <th className="text-left p-3 text-text-secondary font-medium">Reports To</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map(u => (
            <tr key={u.id} className="hover:bg-bg-elevated transition-colors">
              <td className="p-3 text-text-primary font-medium">{u.name || u.email}</td>
              <td className="p-3"><Badge text={u.role} /></td>
              <td className="p-3">
                <select
                  className="input-field text-xs"
                  value={assignments[u.id] ?? ""}
                  onChange={e => setAssignments(a => ({ ...a, [u.id]: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {managers.filter(m => m.id !== u.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.email} ({m.role})</option>
                  ))}
                </select>
              </td>
              <td className="p-3">
                <button
                  onClick={() => saveManager(u.id)}
                  disabled={saving}
                  className="text-brand-blue text-xs hover:underline disabled:opacity-50"
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Webhook Logs ──────────────────────────────────────────────────────
function WebhookLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/webhook-logs?take=100");
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-text-secondary text-sm p-4">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{logs.length} recent entries</p>
        <button onClick={load} className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-text-secondary font-medium">Time</th>
              <th className="text-left p-3 text-text-secondary font-medium">Source</th>
              <th className="text-left p-3 text-text-secondary font-medium">Status</th>
              <th className="text-left p-3 text-text-secondary font-medium">Lead ID / Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-text-secondary text-xs">No webhook logs yet.</td>
              </tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-bg-elevated transition-colors">
                <td className="p-3 text-text-secondary text-xs">
                  {new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="p-3 text-text-primary font-mono text-xs">{log.source}</td>
                <td className="p-3"><Badge text={log.status} color={log.status} /></td>
                <td className="p-3 text-text-secondary text-xs font-mono">
                  {log.status === "success" ? log.leadId : log.errorMessage}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: System ────────────────────────────────────────────────────────────
function SystemTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [usersRes, logsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/webhook-logs?take=200"),
      ]);
      const users = usersRes.ok ? await usersRes.json() : [];
      const logs = logsRes.ok ? await logsRes.json() : [];
      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.isActive).length,
        roleBreakdown: ROLES.map(r => ({ role: r, count: users.filter(u => u.role === r).length })).filter(r => r.count > 0),
        webhookTotal: logs.length,
        webhookSuccess: logs.filter(l => l.status === "success").length,
        webhookError: logs.filter(l => l.status === "error").length,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-text-secondary text-sm p-4">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.totalUsers },
          { label: "Active Users", value: stats.activeUsers },
          { label: "Webhook Total", value: stats.webhookTotal },
          { label: "Webhook Errors", value: stats.webhookError },
        ].map(({ label, value }) => (
          <div key={label} className="bg-bg-surface border border-border rounded-xl p-4">
            <p className="text-text-secondary text-xs">{label}</p>
            <p className="text-text-primary text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <p className="text-text-primary font-semibold mb-3">Role Distribution</p>
        <div className="flex flex-col gap-2">
          {stats.roleBreakdown.map(({ role, count }) => (
            <div key={role} className="flex items-center gap-3">
              <Badge text={role} />
              <div className="flex-1 bg-bg-elevated rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-blue h-full rounded-full"
                  style={{ width: `${Math.max(4, (count / stats.totalUsers) * 100)}%` }}
                />
              </div>
              <span className="text-text-secondary text-xs w-5 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
const TABS = [
  { key: "users",    label: "Users",        icon: Users },
  { key: "teams",    label: "Teams",        icon: Users2 },
  { key: "webhooks", label: "Webhook Logs", icon: Webhook },
  { key: "system",   label: "System",       icon: Settings },
];

export default function AdminPage() {
  const perms = usePermissions();
  const router = useRouter();
  const [tab, setTab] = useState("users");

  // Wait for session to load before redirecting
  if (!perms.userId) return null;

  if (!perms.canAccessAdmin) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-text-primary text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-text-secondary text-sm mt-1">Manage users, teams, webhooks, and system configuration.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-elevated border border-border rounded-xl p-1 w-fit">
        {TABS.filter(t => {
          if (t.key === "users" || t.key === "teams") return perms.canAccessAdmin;
          if (t.key === "webhooks") return perms.canViewWebhookLogs;
          return perms.isAdmin;
        }).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "users"    && <UsersTab perms={perms} />}
        {tab === "teams"    && <TeamsTab />}
        {tab === "webhooks" && <WebhookLogsTab />}
        {tab === "system"   && <SystemTab />}
      </div>
    </div>
  );
}
