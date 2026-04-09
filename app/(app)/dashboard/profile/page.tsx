"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────

interface ProfileData {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  area: string | null;
  profileImageUrl: string | null;
  cardShowPhone: boolean;
  cardShowEmail: boolean;
  cardShowArea: boolean;
  cardShowReportLink: boolean;
  cardShowQr: boolean;
  cardShowProfileImage: boolean;
}

// ── Shared input ──────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-text-secondary text-sm font-semibold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 transition-colors w-full"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer py-2">
      <span className="text-text-secondary text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          checked ? "bg-brand-blue" : "bg-bg-elevated"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

// ── Card Preview ──────────────────────────────────────────

function CardPreview({ profile }: { profile: ProfileData }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const cardUrl = `${appUrl}/card/${profile.id}`;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm w-full">
      {/* Header with logo */}
      <div className="bg-brand-blue flex items-center justify-center py-3">
        <div className="bg-white rounded-lg px-3 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Timeproof USA" style={{ height: "20px", width: "auto" }} />
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4">
        {/* Photo + name — centered, photo above name */}
        <div className="flex flex-col items-center gap-3 pb-1">
          {profile.cardShowProfileImage && profile.profileImageUrl ? (
            <Image
              src={profile.profileImageUrl}
              alt={profile.name ?? ""}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-gray-100 shadow-md"
            />
          ) : profile.cardShowProfileImage ? (
            <div className="w-24 h-24 rounded-full bg-brand-blue flex items-center justify-center text-white text-3xl font-bold shadow-md">
              {(profile.name ?? "?")[0]?.toUpperCase()}
            </div>
          ) : null}
          <div className="text-center">
            <p className="text-gray-900 font-bold text-xl leading-tight">
              {profile.name || "Your Name"}
            </p>
            <p className="text-gray-500 text-sm mt-0.5">Roofing Specialist</p>
          </div>
        </div>

        {/* Contact details */}
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          {profile.cardShowPhone && profile.phone && (
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {profile.phone}
            </div>
          )}
          {profile.cardShowEmail && (
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {profile.email}
            </div>
          )}
          {profile.cardShowArea && profile.area && (
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {profile.area}
            </div>
          )}
        </div>

        {/* Report link placeholder */}
        {profile.cardShowReportLink && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-gray-500 text-sm border border-gray-100">
            View scope report — link appears when shared with a customer
          </div>
        )}

        {/* QR placeholder */}
        {profile.cardShowQr && (
          <div className="flex justify-center pt-2">
            <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-xs text-center leading-tight">
              QR code<br />({cardUrl.replace("http://", "").replace("https://", "")})
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 py-2.5 flex items-center justify-center gap-1.5">
        <span className="text-gray-300 text-xs">Powered by</span>
        <span className="text-gray-400 text-xs font-semibold tracking-wide">TimeproofUSA</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [cardShowPhone, setCardShowPhone] = useState(true);
  const [cardShowEmail, setCardShowEmail] = useState(true);
  const [cardShowArea, setCardShowArea] = useState(true);
  const [cardShowReportLink, setCardShowReportLink] = useState(true);
  const [cardShowQr, setCardShowQr] = useState(true);
  const [cardShowProfileImage, setCardShowProfileImage] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setArea(data.area ?? "");
        setProfileImageUrl(data.profileImageUrl ?? null);
        setCardShowPhone(data.cardShowPhone);
        setCardShowEmail(data.cardShowEmail);
        setCardShowArea(data.cardShowArea);
        setCardShowReportLink(data.cardShowReportLink);
        setCardShowQr(data.cardShowQr);
        setCardShowProfileImage(data.cardShowProfileImage);
      })
      .catch(() => setError("Failed to load profile."));
  }, []);

  // Build a live preview profile object from current form state
  const previewProfile: ProfileData | null = profile
    ? {
        ...profile,
        name,
        phone,
        area,
        profileImageUrl,
        cardShowPhone,
        cardShowEmail,
        cardShowArea,
        cardShowReportLink,
        cardShowQr,
        cardShowProfileImage,
      }
    : null;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/user/profile-photo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      setProfileImageUrl(data.url);
    } catch {
      setError("Photo upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError(""); setSuccess(false);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          area,
          profileImageUrl,
          cardShowPhone,
          cardShowEmail,
          cardShowArea,
          cardShowReportLink,
          cardShowQr,
          cardShowProfileImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); return; }
      setProfile(data.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-text-hint text-sm">Loading…</p>
      </div>
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-3xl font-bold tracking-tight">Business Card</h1>
          <p className="text-text-secondary text-base mt-1">Customize what homeowners see when you share your card.</p>
        </div>
        <a
          href={`${appUrl}/card/${profile.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl text-sm font-medium min-h-11 flex items-center transition-colors"
        >
          Preview live card ↗
        </a>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Left: form ── */}
        <form onSubmit={handleSave} className="flex flex-col gap-6 flex-1 min-w-0">

          {/* Profile info */}
          <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
            <h2 className="text-text-primary text-lg font-semibold">Profile Info</h2>

            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-bg-elevated shrink-0 ring-2 ring-border">
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt="Profile"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-hint text-2xl font-bold">
                    {(name || session?.user?.name || "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Change photo"}
                </button>
                {profileImageUrl && (
                  <button
                    type="button"
                    onClick={() => setProfileImageUrl(null)}
                    className="text-xs text-text-hint hover:text-brand-red transition-colors text-left"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <InputField label="Full Name" value={name} onChange={setName} placeholder="Your full name" />
            <InputField label="Phone" value={phone} onChange={setPhone} placeholder="(555) 555-5555" type="tel" />
            <InputField label="Area / Region" value={area} onChange={setArea} placeholder="e.g. Dallas–Fort Worth" />
          </div>

          {/* Card visibility toggles */}
          <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col gap-1">
            <h2 className="text-text-primary text-lg font-semibold mb-3">Card Visibility</h2>
            <Toggle label="Show profile photo" checked={cardShowProfileImage} onChange={setCardShowProfileImage} />
            <div className="border-t border-border" />
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="text-text-secondary text-sm">Show name</span>
              <span className="text-text-hint text-xs">Always shown</span>
            </div>
            <div className="border-t border-border" />
            <Toggle label="Show phone number" checked={cardShowPhone} onChange={setCardShowPhone} />
            <div className="border-t border-border" />
            <Toggle label="Show email address" checked={cardShowEmail} onChange={setCardShowEmail} />
            <div className="border-t border-border" />
            <Toggle label="Show area / region" checked={cardShowArea} onChange={setCardShowArea} />
            <div className="border-t border-border" />
            <Toggle label="Show scope report link" checked={cardShowReportLink} onChange={setCardShowReportLink} />
            <div className="border-t border-border" />
            <Toggle label="Show QR code" checked={cardShowQr} onChange={setCardShowQr} />
          </div>

          {error && <p className="text-brand-red text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">Saved ✓</p>}

          <button
            type="submit"
            disabled={saving || uploading}
            className="self-start bg-brand-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white font-semibold rounded-xl min-h-11 px-6 text-sm transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        {/* ── Right: live preview ── */}
        <div className="lg:w-80 flex flex-col gap-4">
          <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider">Live Preview</p>
          {previewProfile && <CardPreview profile={previewProfile} />}
        </div>
      </div>
    </div>
  );
}
