import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import {
  ClipboardList,
  Eye,
  PhoneCall,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Users,
  DollarSign,
  PhoneMissed,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

function fmtCurrency(val: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: val >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtDate(val: Date | string) {
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, iconColor = "text-text-secondary", sub }: StatCardProps) {
  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={16} strokeWidth={1.75} className={iconColor} />
        <p className="text-text-secondary text-sm font-medium">{label}</p>
      </div>
      <p className="text-text-primary text-3xl font-bold tracking-tight leading-none">{value}</p>
      {sub && <p className="text-text-secondary text-xs">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });

  const isAdmin = dbUser.role === "ADMIN";
  const leadWhere = isAdmin ? {} : { assignedUserId: userId };

  // Parallel data fetch
  const [
    inspections,
    totalViews,
    leadStats,
    recentLeads,
    recentInspections,
    pendingTaskCount,
  ] = await Promise.all([
    prisma.inspection.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerName: true,
        address: true,
        _count: { select: { reportVisits: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.reportVisit.count({ where: { inspection: { userId } } }),
    // Revival breakdown
    prisma.lead.groupBy({
      by: ["status"],
      where: leadWhere,
      _count: true,
    }),
    prisma.lead.findMany({
      where: leadWhere,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        customerName: true,
        streetAddress: true,
        city: true,
        state: true,
        zip: true,
        status: true,
        updatedAt: true,
        highestEstimateValue: true,
      },
    }),
    prisma.inspection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        customerName: true,
        _count: { select: { reportVisits: true } },
      },
    }),
    prisma.task.count({
      where: {
        status: "PENDING",
        ...(isAdmin ? {} : { assignedUserId: userId }),
      },
    }),
  ]);

  // Aggregate revival stats
  const statusMap = Object.fromEntries(
    leadStats.map((s) => [s.status, s._count])
  );
  const totalLeads = leadStats.reduce((a, s) => a + s._count, 0);
  const revivalPending = statusMap["REVIVAL_PENDING"] ?? 0;
  const revivalRecovered = statusMap["REVIVAL_RECOVERED"] ?? 0;
  const deadLeads = statusMap["DEAD"] ?? 0;

  // Revenue = sum of highestEstimateValue on all leads
  const revenueAgg = await prisma.lead.aggregate({
    where: { ...leadWhere, highestEstimateValue: { not: null } },
    _sum: { highestEstimateValue: true },
  });
  const totalRevenue = revenueAgg._sum.highestEstimateValue ?? 0;

  // Inspection stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalInspections = await prisma.inspection.count({ where: { userId } });
  const thisMonthInspections = await prisma.inspection.count({
    where: { userId, createdAt: { gte: monthStart } },
  });

  // Revival funnel counts from groupBy (more specific)
  const revivalAttempted = await prisma.lead.count({
    where: { ...leadWhere, revivalCalledAt: { not: null } },
  });
  const notInterested = await prisma.lead.count({
    where: { ...leadWhere, revivalStatus: "NOT_INTERESTED" },
  });
  const noAnswer = await prisma.lead.count({
    where: { ...leadWhere, revivalStatus: "NO_ANSWER" },
  });

  // Total ever-revival leads (any status that went through revival)
  const everRevival = await prisma.lead.count({
    where: {
      ...leadWhere,
      status: {
        in: ["REVIVAL_PENDING", "REVIVAL_RECOVERED", "DEAD"],
      },
    },
  });

  const LEAD_STATUS_BADGE: Record<string, string> = {
    NEW: "bg-blue-500/20 text-blue-300",
    INSPECTION_SCHEDULED: "bg-purple-500/20 text-purple-300",
    INSPECTION_COMPLETE: "bg-indigo-500/20 text-indigo-300",
    QUOTED: "bg-cyan-500/20 text-cyan-300",
    SOLD: "bg-green-500/20 text-green-300",
    DENIED: "bg-red-500/20 text-red-300",
    NO_SHOW: "bg-orange-500/20 text-orange-300",
    DEMO_NOT_SOLD: "bg-yellow-500/20 text-yellow-300",
    REVIVAL_PENDING: "bg-amber-500/20 text-amber-300",
    REVIVAL_RECOVERED: "bg-emerald-500/20 text-emerald-300",
    DEAD: "bg-zinc-500/20 text-zinc-400",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-text-primary text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Overview of leads, revival activity, and inspections.</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <StatCard
          label="Total Leads"
          value={totalLeads}
          icon={Users}
          iconColor="text-blue-400"
        />
        <StatCard
          label="Revival Pending"
          value={revivalPending}
          icon={PhoneCall}
          iconColor="text-amber-400"
        />
        <StatCard
          label="Recovered"
          value={revivalRecovered}
          icon={CheckCircle2}
          iconColor="text-emerald-400"
        />
        <StatCard
          label="Inspections"
          value={totalInspections}
          icon={ClipboardList}
          iconColor="text-purple-400"
          sub={`${thisMonthInspections} this month`}
        />
        <StatCard
          label="Report Views"
          value={totalViews}
          icon={Eye}
          iconColor="text-sky-400"
        />
        <StatCard
          label="Lead Revenue"
          value={totalRevenue > 0 ? fmtCurrency(totalRevenue) : "—"}
          icon={DollarSign}
          iconColor="text-green-400"
          sub="sum of est. values"
        />
        <a href="/tasks" className="block">
          <StatCard
            label="Pending Tasks"
            value={pendingTaskCount}
            icon={ClipboardCheck}
            iconColor={pendingTaskCount > 0 ? "text-orange-400" : "text-text-secondary"}
            sub={pendingTaskCount > 0 ? "tap to action" : "all clear"}
          />
        </a>
      </div>

      {/* ── Revival Funnel ─────────────────────────────────────── */}
      {everRevival > 0 && (
        <div className="bg-bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} strokeWidth={1.75} className="text-text-secondary" />
              <h2 className="text-text-primary font-semibold">Revival Funnel</h2>
            </div>
            <a
              href="/revival"
              className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm transition-colors"
            >
              Open queue <ArrowRight size={13} />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Total Revival", value: everRevival, color: "border-border text-text-primary" },
              { label: "Called", value: revivalAttempted, color: "border-amber-500/40 text-amber-300" },
              { label: "Recovered", value: revivalRecovered, color: "border-emerald-500/40 text-emerald-300" },
              { label: "Not Interested", value: notInterested, color: "border-orange-500/40 text-orange-300" },
              { label: "No Answer", value: noAnswer, color: "border-zinc-500/40 text-zinc-400" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className={`bg-bg-elevated border rounded-xl p-4 flex flex-col gap-1 ${color}`}
              >
                <span className="text-2xl font-bold leading-none">{value}</span>
                <span className="text-xs text-text-secondary">{label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {everRevival > 0 && (
            <div className="mt-5">
              <div className="h-2 bg-bg-elevated rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${Math.round((revivalRecovered / everRevival) * 100)}%` }}
                />
                <div
                  className="bg-orange-500 h-full transition-all"
                  style={{ width: `${Math.round((notInterested / everRevival) * 100)}%` }}
                />
                <div
                  className="bg-zinc-600 h-full transition-all"
                  style={{ width: `${Math.round((deadLeads / everRevival) * 100)}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Recovered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Not interested
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" /> Dead
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recent Activity ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={15} strokeWidth={1.75} className="text-text-secondary" />
              <h2 className="text-text-primary font-semibold">Recent Leads</h2>
            </div>
            <a
              href="/leads"
              className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm transition-colors"
            >
              All leads <ArrowRight size={13} />
            </a>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-text-secondary text-sm py-4 text-center">No leads yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentLeads.map((lead) => (
                <a
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between py-3 hover:opacity-80 transition-opacity gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">{lead.customerName}</p>
                    <p className="text-text-secondary text-xs truncate">{[lead.streetAddress, lead.city].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.highestEstimateValue && (
                      <span className="text-emerald-400 text-xs font-medium">
                        {fmtCurrency(lead.highestEstimateValue)}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEAD_STATUS_BADGE[lead.status] ?? "bg-zinc-500/20 text-zinc-400"}`}>
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Recent Inspections */}
        <div className="bg-bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList size={15} strokeWidth={1.75} className="text-text-secondary" />
              <h2 className="text-text-primary font-semibold">Recent Inspections</h2>
            </div>
            <a
              href="/inspections"
              className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm transition-colors"
            >
              All <ArrowRight size={13} />
            </a>
          </div>
          {recentInspections.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-text-secondary text-sm">No inspections yet.</p>
              <a
                href="/inspection/new"
                className="mt-2 inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Start one →
              </a>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentInspections.map((insp) => (
                <a
                  key={insp.id}
                  href={`/inspection/${insp.id}`}
                  className="flex items-center justify-between py-3 hover:opacity-80 transition-opacity gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">
                      {insp.customerName ?? "Unnamed"}
                    </p>
                    <p className="text-text-secondary text-xs">{fmtDate(insp.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-text-secondary text-xs">
                      <Eye size={11} /> {insp._count.reportVisits}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      insp.status === "complete"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-zinc-500/20 text-zinc-400"
                    }`}>
                      {insp.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty state — first time user */}
      {totalLeads === 0 && totalInspections === 0 && (
        <div className="bg-bg-surface border border-border rounded-2xl p-10 text-center space-y-4">
          <p className="text-text-primary font-semibold text-lg">Welcome to Scope Reports</p>
          <p className="text-text-secondary text-sm max-w-md mx-auto">
            Get started by adding your first lead or running a new inspection report.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="/leads"
              className="bg-brand-blue hover:bg-accent-blue-hover text-white font-medium rounded-xl px-5 py-2.5 text-sm transition-colors"
            >
              Add Lead
            </a>
            <a
              href="/inspection/new"
              className="bg-bg-elevated border border-border hover:border-border-hover text-text-primary font-medium rounded-xl px-5 py-2.5 text-sm transition-colors"
            >
              New Inspection
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
