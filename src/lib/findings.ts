export const DAMAGE_GROUPS = [
  {
    group: "Shingle Condition",
    items: [
      { key: "missing-shingles", label: "Missing shingles" },
      { key: "granule-loss", label: "Granule loss" },
      { key: "blistering", label: "Blistering/bubbling" },
      { key: "cracking", label: "Cracking/splitting" },
      { key: "curling", label: "Curling/cupping" },
      { key: "moss-algae", label: "Moss/algae growth" },
    ],
  },
  {
    group: "Structural",
    items: [
      { key: "valley-wear", label: "Valley wear" },
      { key: "flashing-damage", label: "Flashing damage" },
      { key: "improper-flashing", label: "Improper flashing" },
      { key: "ridge-deterioration", label: "Ridge deterioration" },
      { key: "nail-pops", label: "Nail pops" },
      { key: "deck-damage", label: "Visible deck damage" },
    ],
  },
  {
    group: "Drainage & Perimeter",
    items: [
      { key: "gutter-clogged", label: "Clogged gutters" },
      { key: "gutter-overflow", label: "Gutter overflow" },
      { key: "fascia-rot", label: "Fascia rot/damage" },
      { key: "soffit-damage", label: "Soffit damage" },
      { key: "ice-dam", label: "Ice dam evidence" },
    ],
  },
  {
    group: "Ventilation",
    items: [
      { key: "turbine-damage", label: "Turbine damage" },
      { key: "box-vent-damage", label: "Box vent damage" },
      { key: "ridge-vent-issues", label: "Ridge vent issues" },
      { key: "poor-ventilation", label: "Poor ventilation balance" },
    ],
  },
  {
    group: "Penetrations",
    items: [
      { key: "chimney-issues", label: "Chimney issues" },
      { key: "pipe-boot-failure", label: "Pipe boot failure" },
      { key: "skylight-concerns", label: "Skylight concerns" },
    ],
  },
  {
    group: "Interior Signs",
    items: [
      { key: "moisture-staining", label: "Moisture staining" },
      { key: "mold-indicators", label: "Mold indicators" },
      { key: "insulation-concerns", label: "Insulation concerns" },
    ],
  },
];

export const ALL_DAMAGE_ITEMS = DAMAGE_GROUPS.flatMap((g) => g.items);

export const getLabelByKey = (key: string): string =>
  ALL_DAMAGE_ITEMS.find((i) => i.key === key)?.label ?? key;

export const generatePhotoDescription = (tags: string[] = []): string => {
  if (tags.length === 0) return "";
  const labels = tags.map(getLabelByKey);
  if (labels.length === 1) return `Photo shows ${labels[0].toLowerCase()}.`;
  const last = labels[labels.length - 1];
  const rest = labels.slice(0, -1);
  return `Photo shows ${rest.map((l) => l.toLowerCase()).join(", ")}, and ${last.toLowerCase()}.`;
};

export const generateRevealStatement = ({
  findings = {},
  address,
  repName,
  mode,
}: {
  findings?: Record<string, boolean>;
  address: string;
  repName: string;
  mode: "presentation" | "report";
}): { opening: string; items: string[]; closing: string | null } => {
  const checkedKeys = Object.entries(findings)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  if (checkedKeys.length === 0) {
    return {
      opening: `Based on our inspection today, your roof at ${address} is in generally good condition.`,
      items: [],
      closing:
        mode === "report"
          ? `We'll discuss your options and what preventive measures can protect your investment going forward.\n\n— ${repName}, TIMEPROOF`
          : null,
    };
  }

  return {
    opening: `Based on our inspection today, we identified ${checkedKeys.length} area${checkedKeys.length > 1 ? "s" : ""} of concern with your roof at ${address}.`,
    items: checkedKeys.map(getLabelByKey),
    closing:
      mode === "report"
        ? `I've documented each of these with photos above. If you have any questions before we talk next, feel free to reach out.\n\n— ${repName}, TIMEPROOF`
        : null,
  };
};
