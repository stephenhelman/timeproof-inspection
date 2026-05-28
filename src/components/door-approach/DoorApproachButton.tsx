"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Presentation } from "lucide-react";
import TypeSelectorModal from "./TypeSelectorModal";
import DoorApproachSlideshow from "./DoorApproachSlideshow";
import { SHINGLE_SLIDES } from "./slides";

interface Props {
  repSlug: string | null;
  mobile?: boolean;
}

export default function DoorApproachButton({ repSlug, mobile = false }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [roofType, setRoofType] = useState<"shingle" | null>(null);
  // Guard: portals require a DOM node — only mount after hydration
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleSelect(type: "shingle") {
    setModalOpen(false);
    setRoofType(type);
  }

  const btnCls = mobile
    ? "flex items-center gap-1.5 shrink-0 text-text-secondary hover:text-text-primary text-sm px-4 py-2.5 transition-colors"
    : "flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors";

  return (
    <>
      <button type="button" onClick={() => setModalOpen(true)} className={btnCls}>
        <Presentation size={mobile ? 14 : 15} strokeWidth={1.75} />
        Door Approach
      </button>

      {/* Portals render at document.body — outside the sticky nav's stacking context */}
      {mounted && modalOpen && createPortal(
        <TypeSelectorModal
          onSelect={handleSelect}
          onClose={() => setModalOpen(false)}
        />,
        document.body,
      )}

      {mounted && roofType === "shingle" && createPortal(
        <DoorApproachSlideshow
          slides={SHINGLE_SLIDES}
          repSlug={repSlug}
          onClose={() => setRoofType(null)}
        />,
        document.body,
      )}
    </>
  );
}
