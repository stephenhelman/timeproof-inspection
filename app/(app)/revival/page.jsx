// PRESERVED — not active in Qntum build
// The revival queue page has been commented out for the Qntum Roofing build.
// Original implementation is preserved below for reference.
// To restore: uncomment the content below and re-enable the nav links in app/(app)/layout.tsx

export default function RevivalPage() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="text-center">
        <p className="text-text-secondary text-base">Revival queue is not active in this build.</p>
        <a href="/dashboard" className="text-text-accent text-sm mt-2 inline-block hover:underline">← Back to Dashboard</a>
      </div>
    </div>
  );
}

/*
PRESERVED — not active in Qntum build

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CallScriptModal from "@/src/components/revival/CallScriptModal";

[... original revival page content preserved in git history ...]
*/
