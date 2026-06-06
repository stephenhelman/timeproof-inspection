"use client";

import { useRouter } from "next/navigation";

const APPT_STATUS_BADGE: Record<string, string> = {
  SCHEDULED: "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30",
  EN_ROUTE: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  IN_PROGRESS: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  COMPLETED: "bg-green-500/20 text-green-300 border border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border border-red-500/30",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.NEXT_PUBLIC_TZ ?? "America/Denver",
  });
}

function fmtDayHeader(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = d.toDateString() === today.toDateString();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + (isToday ? " — Today" : "");
}

function prevDay(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDay(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Appointment {
  id: string;
  status: string;
  scheduledAt: string;
  lead: {
    id: string;
    customerName: string;
    address: string | null;
    streetAddress: string | null;
    city: string | null;
    state: string | null;
  };
  inspection: { id: string } | null;
  assignedUser: { id: string; name: string | null } | null;
}

interface Props {
  appointments: Appointment[];
  currentDate: string;
  isManager: boolean;
}

export default function CalendarView({ appointments, currentDate, isManager }: Props) {
  const router = useRouter();

  const navigate = (date: string) => {
    router.push(`/calendar?date=${date}`);
  };

  const currentSlice = currentDate.slice(0, 10);

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[#f0f4ff] text-xl font-bold">Calendar</h1>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(prevDay(currentSlice))}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#2a3a5c] text-[#8fa3c8] hover:text-[#f0f4ff] hover:border-[#1B3A7A] transition-colors text-lg"
            aria-label="Previous day"
          >
            ‹
          </button>
          <div className="flex-1 text-center">
            <p className="text-[#f0f4ff] font-semibold text-sm">
              {fmtDayHeader(currentDate)}
            </p>
          </div>
          <button
            onClick={() => navigate(nextDay(currentSlice))}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#2a3a5c] text-[#8fa3c8] hover:text-[#f0f4ff] hover:border-[#1B3A7A] transition-colors text-lg"
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {currentSlice !== todayDate() && (
          <div className="text-center -mt-2">
            <button
              onClick={() => navigate(todayDate())}
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              ← Back to Today
            </button>
          </div>
        )}

        {/* Appointment list */}
        {appointments.length === 0 ? (
          <div className="bg-[#111827] border border-[#2a3a5c] rounded-2xl p-8 text-center">
            <p className="text-[#8fa3c8] text-sm">No appointments scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => {
              const address =
                appt.lead.address ??
                [appt.lead.streetAddress, appt.lead.city, appt.lead.state]
                  .filter(Boolean)
                  .join(", ") ??
                "";
              const inspectionHref = appt.inspection
                ? `/inspection/${appt.inspection.id}`
                : `/leads/${appt.lead.id}`;

              return (
                <button
                  key={appt.id}
                  onClick={() => router.push(inspectionHref)}
                  className="w-full bg-[#111827] border border-[#2a3a5c] rounded-2xl px-5 py-4 hover:border-[#1B3A7A] transition-colors text-left space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[#f0f4ff] font-semibold text-sm truncate">
                        {appt.lead.customerName}
                      </p>
                      {address && (
                        <p className="text-[#8fa3c8] text-xs mt-0.5 truncate">{address}</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        APPT_STATUS_BADGE[appt.status] ?? "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {appt.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#8fa3c8]">
                    <span className="font-medium text-[#f0f4ff]">
                      {fmtTime(appt.scheduledAt)}
                    </span>
                    {isManager && appt.assignedUser?.name && (
                      <span>{appt.assignedUser.name}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
