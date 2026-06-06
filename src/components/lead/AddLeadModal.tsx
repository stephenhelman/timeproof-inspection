"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete from "./AddressAutocomplete";
import AppointmentBookingModal from "@/src/components/appointment/AppointmentBookingModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlaceDetails {
  formattedAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
}

interface LookupLead {
  id: string;
  customerName: string;
  address: string | null;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  status: string;
  ghlContactId: string | null;
  dispoPrimaryObjection: string | null;
  dispoNotes: string | null;
  updatedAt: string;
  assignedUser: { id: string; name: string } | null;
  srLead: { srBotStage: string } | null;
  botContextSummary: string | null;
  _count: { inspections: number; tasks: number };
}

// Bot stages that mean "not actively in conversation"
const SILENT_STAGES = new Set(["silent"]);
function isActiveBotStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return !SILENT_STAGES.has(stage);
}
function botLabel(stage: string): string {
  if (["nurture", "qualifying", "booking"].includes(stage)) return "Alex";
  return "Jordan";
}

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-blue-500/20 text-blue-300",
  INSPECTION_SCHEDULED: "bg-purple-500/20 text-purple-300",
  DEMO_NOT_SOLD: "bg-yellow-500/20 text-yellow-300",
  REVIVAL_PENDING: "bg-amber-500/20 text-amber-300",
  SOLD: "bg-green-500/20 text-green-300",
  NO_SHOW: "bg-orange-500/20 text-orange-300",
  DEAD: "bg-zinc-500/20 text-zinc-400",
};

const SMS_CONSENT_TEXT =
  "I agree to receive SMS messages from Scope Reports at this number. Message and data rates may apply. Reply STOP to opt out.";

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#8fa3c8] text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base placeholder:text-[#8fa3c8]/50 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onCreated: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

type FlowStep = "phone" | "summary" | "botGate" | "form" | "booking" | "done";

export default function AddLeadModal({
  onClose,
  onCreated,
  currentUserId,
  currentUserName,
}: Props) {
  const router = useRouter();

  // ── Step state ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState<FlowStep>("phone");

  // Phone lookup
  const [phone, setPhone] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [foundLead, setFoundLead] = useState<LookupLead | null>(null);

  // Claim state (bot gate)
  const [claiming, setClaiming] = useState(false);

  // Creation form
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    address: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    smsConsent: false,
    scheduleNow: false,
  });
  const [addressSelected, setAddressSelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdLead, setCreatedLead] = useState<{ id: string; customerName: string } | null>(null);

  // Booking sub-modal (inline or standalone)
  const [showBooking, setShowBooking] = useState(false);
  const [bookingLeadId, setBookingLeadId] = useState<string | null>(null);
  const [bookingLeadName, setBookingLeadName] = useState("");
  const [bookingAddress, setBookingAddress] = useState("");

  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Phone lookup ─────────────────────────────────────────────────────────────

  const doLookup = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) { setStep("form"); return; }
    setLooking(true);
    setLookupError("");
    try {
      const res = await fetch(`/api/lead/lookup?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.found) {
        setFoundLead(data.lead as LookupLead);
        const botStage = data.lead.srLead?.srBotStage;
        setStep(isActiveBotStage(botStage) ? "botGate" : "summary");
      } else {
        setStep("form");
      }
    } catch {
      setLookupError("Lookup failed — continuing to full form.");
      setStep("form");
    } finally {
      setLooking(false);
    }
  };

  // ── Claim existing lead (bot gate) ───────────────────────────────────────────

  const handleClaim = async () => {
    if (!foundLead) return;
    setClaiming(true);
    try {
      await fetch(`/api/lead/${foundLead.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId: currentUserId }),
      });
      openBookingForLead(foundLead);
    } catch {
      // Still open booking even if claim partially fails
      openBookingForLead(foundLead);
    } finally {
      setClaiming(false);
    }
  };

  const openBookingForLead = (lead: LookupLead) => {
    const addr = lead.address || [lead.streetAddress, lead.city, lead.state].filter(Boolean).join(", ");
    setBookingLeadId(lead.id);
    setBookingLeadName(lead.customerName);
    setBookingAddress(addr);
    setShowBooking(true);
  };

  // ── Address autocomplete callback ─────────────────────────────────────────────

  const handleAddressSelect = (details: PlaceDetails) => {
    setForm((f) => ({
      ...f,
      address: details.formattedAddress,
      streetAddress: details.streetAddress,
      city: details.city,
      state: details.state,
      zip: details.zip,
    }));
    setAddressSelected(true);
  };

  // ── Full lead creation submit ─────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) { setError("Customer name is required."); return; }
    if (!addressSelected || !form.streetAddress.trim()) {
      setError("Please select an address from the autocomplete suggestions.");
      return;
    }
    if (!form.smsConsent) { setError("SMS consent is required."); return; }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          phone,
          email: form.email.trim() || undefined,
          address: form.address,
          streetAddress: form.streetAddress,
          city: form.city,
          state: form.state,
          zip: form.zip,
          source: "manual",
          smsConsentAt: new Date().toISOString(),
          smsConsentText: SMS_CONSENT_TEXT,
          syncGhl: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const lead = await res.json();
      setCreatedLead({ id: lead.id, customerName: lead.customerName });

      if (form.scheduleNow) {
        setBookingLeadId(lead.id);
        setBookingLeadName(lead.customerName);
        setBookingAddress(form.address);
        setShowBooking(true);
      } else {
        setStep("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead.");
    } finally {
      setSaving(false);
    }
  };

  // ── Booking modal callbacks ───────────────────────────────────────────────────

  const handleBookingSuccess = (_appointmentId: string, inspectionId: string) => {
    setShowBooking(false);
    onCreated();
    onClose();
    if (inspectionId) router.push(`/inspection/${inspectionId}`);
  };

  const handleBookingClose = () => {
    setShowBooking(false);
    if (createdLead) { onCreated(); onClose(); }
    else { onCreated(); onClose(); }
  };

  // ── Done state ────────────────────────────────────────────────────────────────

  if (step === "done" && createdLead) {
    return (
      <ModalShell onClose={onClose}>
        <div className="px-6 py-8 space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <span className="text-green-400 text-2xl">✓</span>
          </div>
          <p className="text-[#f0f4ff] font-semibold text-lg">Lead created!</p>
          <p className="text-[#8fa3c8] text-sm">
            Would you like to generate an inspection report for{" "}
            <span className="text-[#f0f4ff]">{createdLead.customerName}</span>?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/inspection/new?leadId=${createdLead.id}`)}
              className="flex-1 bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 text-white font-medium rounded-xl py-3 transition-colors"
            >
              Generate Report
            </button>
            <button
              onClick={() => { onCreated(); onClose(); }}
              className="flex-1 bg-[#2a3a5c] hover:bg-[#2a3a5c]/80 text-[#f0f4ff] font-medium rounded-xl py-3 transition-colors"
            >
              Not Now
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── Booking modal (for existing lead or after creation) ───────────────────────

  if (showBooking && bookingLeadId) {
    return (
      <AppointmentBookingModal
        leadId={bookingLeadId}
        leadName={bookingLeadName}
        address={bookingAddress}
        assignedUserId={currentUserId}
        assignedUserName={currentUserName}
        onClose={handleBookingClose}
        onSuccess={handleBookingSuccess}
      />
    );
  }

  // ── Phone step ────────────────────────────────────────────────────────────────

  if (step === "phone") {
    return (
      <ModalShell onClose={onClose} title="Add Lead" subtitle="Enter homeowner's phone number first">
        <div className="px-6 py-5 space-y-4">
          {lookupError && <ErrorBanner msg={lookupError} />}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#8fa3c8] text-sm font-medium">Phone Number</label>
            <input
              ref={phoneRef}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doLookup(); } }}
              placeholder="(555) 000-0000"
              className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base placeholder:text-[#8fa3c8]/50 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-[#8fa3c8]/60 text-xs">We check for an existing lead before creating a new one.</p>
          </div>
          <button
            type="button"
            disabled={looking || phone.replace(/\D/g, "").length < 7}
            onClick={doLookup}
            className="w-full bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 disabled:opacity-50 text-white font-medium rounded-xl py-3 min-h-[48px] transition-colors"
          >
            {looking ? "Checking…" : "Continue →"}
          </button>
          <button
            type="button"
            onClick={() => setStep("form")}
            className="w-full text-[#8fa3c8] text-sm hover:text-[#f0f4ff] transition-colors py-1"
          >
            Skip — create without phone
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── Bot gate step ─────────────────────────────────────────────────────────────

  if (step === "botGate" && foundLead) {
    const botStage = foundLead.srLead?.srBotStage ?? "booking";
    const bot = botLabel(botStage);
    return (
      <ModalShell onClose={onClose} title="Existing Lead Found" subtitle="Active bot conversation detected">
        <div className="px-6 py-5 space-y-4">
          <LeadSummaryCard lead={foundLead} />
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-1">
            <p className="text-amber-300 text-sm font-semibold">
              {bot} is currently in conversation with this lead. How did it go?
            </p>
            <p className="text-amber-200/60 text-xs">
              If you got them, silence the bot and book directly.
            </p>
          </div>
          <button
            type="button"
            disabled={claiming}
            onClick={handleClaim}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 min-h-[48px] transition-colors"
          >
            {claiming ? "Claiming…" : "I got them — schedule appointment"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full border border-[#2a3a5c] text-[#8fa3c8] hover:text-[#f0f4ff] hover:border-[#3a4a6c] rounded-xl py-3 text-sm font-medium transition-colors"
          >
            Leave it with the bot
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── Summary step (silent bot — lead exists, no active bot) ───────────────────

  if (step === "summary" && foundLead) {
    return (
      <ModalShell onClose={onClose} title="Existing Lead Found">
        <div className="px-6 py-5 space-y-4">
          <LeadSummaryCard lead={foundLead} />
          <button
            type="button"
            onClick={() => openBookingForLead(foundLead)}
            className="w-full bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 text-white font-semibold rounded-xl py-3 min-h-[48px] transition-colors"
          >
            Schedule Appointment
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full border border-[#2a3a5c] text-[#8fa3c8] hover:text-[#f0f4ff] hover:border-[#3a4a6c] rounded-xl py-3 text-sm font-medium transition-colors"
          >
            Leave with bot
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── Full creation form ────────────────────────────────────────────────────────

  return (
    <ModalShell onClose={onClose} title="Add Lead" subtitle="No existing lead — create new">
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
        {error && <ErrorBanner msg={error} />}

        <Field
          label="Customer Name *"
          value={form.customerName}
          onChange={(v) => setForm((f) => ({ ...f, customerName: v }))}
          placeholder="Jane Smith"
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[#8fa3c8] text-sm font-medium">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            className="bg-[#1e2a40] border border-[#2a3a5c] text-[#f0f4ff] rounded-xl min-h-[48px] px-4 text-base placeholder:text-[#8fa3c8]/50 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          placeholder="jane@example.com"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[#8fa3c8] text-sm font-medium">
            Address *
            <span className="ml-1 text-[#8fa3c8]/50 font-normal text-xs">(use autocomplete)</span>
          </label>
          <AddressAutocomplete
            value={form.address}
            onChange={handleAddressSelect}
            placeholder="123 Main St, El Paso, TX 79912"
            required
          />
          {form.city && (
            <p className="text-[#8fa3c8]/60 text-xs mt-0.5">
              {[form.city, form.state, form.zip].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {/* SMS Consent */}
        <div className="bg-[#111827] border border-[#2a3a5c] rounded-xl p-4 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.smsConsent}
              onChange={(e) => setForm((f) => ({ ...f, smsConsent: e.target.checked }))}
              className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer flex-shrink-0"
            />
            <span className="text-[#8fa3c8] text-xs leading-relaxed">{SMS_CONSENT_TEXT}</span>
          </label>
        </div>

        {/* Schedule now toggle */}
        <label className="flex items-center gap-3 cursor-pointer py-1">
          <div
            role="checkbox"
            aria-checked={form.scheduleNow}
            tabIndex={0}
            onClick={() => setForm((f) => ({ ...f, scheduleNow: !f.scheduleNow }))}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") setForm((f) => ({ ...f, scheduleNow: !f.scheduleNow })); }}
            className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${form.scheduleNow ? "bg-blue-600" : "bg-[#2a3a5c]"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.scheduleNow ? "translate-x-4" : "translate-x-0"}`} />
          </div>
          <span className="text-[#8fa3c8] text-sm">Schedule appointment now</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#1B3A7A] hover:bg-[#1B3A7A]/80 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 text-base min-h-[48px] transition-colors"
        >
          {saving ? "Creating…" : form.scheduleNow ? "Create & Book Appointment" : "Create Lead"}
        </button>
      </form>
    </ModalShell>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function ModalShell({
  onClose,
  title,
  subtitle,
  children,
}: {
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#1a2236] border border-[#2a3a5c] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {(title || subtitle) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3a5c]">
            <div>
              {title && <h2 className="text-[#f0f4ff] text-lg font-semibold">{title}</h2>}
              {subtitle && <p className="text-[#8fa3c8] text-xs mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8fa3c8] hover:text-[#f0f4ff] hover:bg-[#2a3a5c] transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
      {msg}
    </div>
  );
}

function LeadSummaryCard({ lead }: { lead: LookupLead }) {
  const displayAddr =
    lead.address || [lead.streetAddress, lead.city, lead.state].filter(Boolean).join(", ");
  const statusCls = STATUS_BADGE[lead.status] || "bg-zinc-500/20 text-zinc-400";
  const botStage = lead.srLead?.srBotStage;
  const daysSince = Math.floor(
    (Date.now() - new Date(lead.updatedAt).getTime()) / 86400000,
  );

  return (
    <div className="bg-[#111827] border border-[#2a3a5c] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[#f0f4ff] font-semibold">{lead.customerName}</p>
          {displayAddr && <p className="text-[#8fa3c8] text-xs mt-0.5 truncate">{displayAddr}</p>}
          {lead.phone && <p className="text-[#8fa3c8] text-xs">{lead.phone}</p>}
        </div>
        <span className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap ${statusCls}`}>
          {lead.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <StatBox label="Inspections" value={lead._count.inspections} />
        <StatBox label="Open Tasks" value={lead._count.tasks} />
        <StatBox label="Days Since" value={daysSince} />
      </div>

      {lead.dispoPrimaryObjection && (
        <div className="flex items-center gap-2 text-xs text-[#8fa3c8]">
          <span className="text-[#8fa3c8]/50">Last dispo:</span>
          <span className="text-[#f0f4ff]">{lead.dispoPrimaryObjection.replace(/_/g, " ")}</span>
        </div>
      )}

      {botStage && (
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              isActiveBotStage(botStage)
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-zinc-500/20 text-zinc-400"
            }`}
          >
            {isActiveBotStage(botStage) ? `${botLabel(botStage)} active` : "Bot silent"}
          </span>
          {lead.botContextSummary && (
            <span className="text-[#8fa3c8]/60 text-xs truncate">{lead.botContextSummary}</span>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#1a2236] rounded-lg py-2 px-1">
      <p className="text-[#f0f4ff] font-semibold text-sm">{value}</p>
      <p className="text-[#8fa3c8]/60 text-[10px]">{label}</p>
    </div>
  );
}
