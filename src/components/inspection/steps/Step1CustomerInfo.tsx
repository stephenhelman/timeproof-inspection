"use client";

import { useState } from "react";
import Input from "@/src/components/ui/Input";

interface Props {
  data: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  inspectionId: string;
}

const HEARD_OPTIONS = ["Radio Ad", "TV Ad", "Online Ad", "Referral", "Door Knock", "Other"];

export default function Step1CustomerInfo({ data, onChange }: Props) {
  const [heardAboutUs, setHeardAboutUs] = useState((data.heardAboutUs as string) || "");
  const [otherText, setOtherText] = useState((data.heardAboutUsOther as string) || "");

  const handleHeardChange = (val: string) => {
    setHeardAboutUs(val);
    onChange({ heardAboutUs: val === "Other" ? otherText : val });
  };

  const handleOtherChange = (val: string) => {
    setOtherText(val);
    onChange({ heardAboutUs: val });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white text-2xl font-semibold">Customer Info</h2>
        <p className="text-gray-400 text-base mt-1">Enter the homeowner&apos;s contact details.</p>
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

        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">How did you hear about us?</label>
          <select
            value={heardAboutUs}
            onChange={(e) => handleHeardChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl min-h-12 px-4 text-base focus:outline-none focus:border-blue-500"
          >
            <option value="">Select...</option>
            {HEARD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {heardAboutUs === "Other" && (
            <Input
              placeholder="Please specify..."
              value={otherText}
              onChange={(e) => handleOtherChange(e.target.value)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
