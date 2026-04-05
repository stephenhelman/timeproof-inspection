"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewInspectionButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const inspection = await res.json();
      router.push(`/inspection/${inspection.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl min-h-12 px-6 text-base transition-colors"
    >
      {loading ? "Creating..." : "+ New Inspection"}
    </button>
  );
}
