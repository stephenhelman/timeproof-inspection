"use client";

import { useState } from "react";

interface BusinessCardActionsProps {
  name: string;
  vcfContent: string;
  shareUrl: string;
  shareTitle: string;
}

export default function BusinessCardActions({
  name,
  vcfContent,
  shareUrl,
  shareTitle,
}: BusinessCardActionsProps) {
  const [shareLabel, setShareLabel] = useState("Share");
  const [copyLabel, setCopyLabel] = useState("Copy link");

  function downloadVcf() {
    const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        setShareLabel("Shared!");
        setTimeout(() => setShareLabel("Share"), 3000);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy link"), 3000);
    } catch {
      setCopyLabel("Copy failed");
      setTimeout(() => setCopyLabel("Copy link"), 3000);
    }
  }

  return (
    <div className="flex gap-3 pt-2 border-t border-border">
      <button
        onClick={downloadVcf}
        className="flex-1 flex items-center justify-center gap-2 bg-brand-blue hover:bg-accent-blue-hover text-white font-semibold rounded-xl min-h-11 text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Save to contacts
      </button>
      <button
        onClick={handleShare}
        className="flex-1 flex items-center justify-center gap-2 bg-bg-elevated border border-border hover:border-border-hover text-text-secondary hover:text-text-primary font-semibold rounded-xl min-h-11 text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {shareLabel !== "Share" ? shareLabel : copyLabel !== "Copy link" ? copyLabel : "Share"}
      </button>
    </div>
  );
}
