"use client";

import Input from "@/src/components/ui/Input";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
}

// PRESERVED — not active in Qntum build
// const HEARD_OPTIONS = ["Radio Ad", "TV Ad", "Online Ad", "Referral", "Door Knock", "Other"];

export default function Step1CustomerInfo({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-text-primary text-2xl font-semibold">Customer Info</h2>
        <p className="text-text-secondary text-base mt-1">Enter the homeowner&apos;s contact details.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Full Name"
          placeholder="Jane Smith"
          value={(data.customerName as string) || ""}
          onChange={(e) => onChange({ customerName: e.target.value })}
        />
        <Input
          label="Property Address"
          placeholder="123 Main St, City, ST 12345"
          value={(data.address as string) || ""}
          onChange={(e) => onChange({ address: e.target.value })}
        />
        <Input
          label="Phone Number"
          type="tel"
          placeholder="(555) 000-0000"
          value={(data.phone as string) || ""}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
        <Input
          label="Email Address"
          type="email"
          placeholder="jane@example.com"
          value={(data.email as string) || ""}
          onChange={(e) => onChange({ email: e.target.value })}
        />
        <Input
          label="Rep Name"
          placeholder="Your name"
          value={(data.repName as string) || ""}
          onChange={(e) => onChange({ repName: e.target.value })}
        />
        <Input
          label="Setter Name"
          placeholder="Who set the appointment?"
          value={(data.setterName as string) || ""}
          onChange={(e) => onChange({ setterName: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">Appointment Date & Time</label>
          <input
            type="datetime-local"
            value={(data.appointmentAt as string) || ""}
            onChange={(e) => onChange({ appointmentAt: e.target.value || null })}
            className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors"
          />
        </div>

        {/* Decision makers */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between min-h-12">
            <span className="text-text-secondary text-sm font-medium">All decision makers present?</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!(data.decisionMakers)}
              onClick={() => onChange({ decisionMakers: !data.decisionMakers })}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none cursor-pointer ${
                data.decisionMakers ? "bg-brand-blue" : "bg-border"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  data.decisionMakers ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {!!data.decisionMakers && (
            <Input
              placeholder="Who else is involved?"
              value={(data.decisionMakersWho as string) || ""}
              onChange={(e) => onChange({ decisionMakersWho: e.target.value })}
            />
          )}
        </div>

        {/* PRESERVED — not active in Qntum build */}
        {/* heardAboutUs field removed */}
      </div>
    </div>
  );
}
