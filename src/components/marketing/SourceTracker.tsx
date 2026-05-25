"use client";

import { useEffect } from "react";

export default function SourceTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const rep = params.get("rep");

    if (source) {
      localStorage.setItem("qntum_source", source);
    }
    if (rep) {
      localStorage.setItem("qntum_rep", rep);
    }

    // Default to organic if nothing set yet
    if (!localStorage.getItem("qntum_source")) {
      localStorage.setItem("qntum_source", "organic");
    }
  }, []);

  return null;
}
