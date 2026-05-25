// localStorage source tracking — persists UTM-style source across sessions.
// Call resolveSource() at form submission time to get the full source string.

export function resolveSource(action: "inspection" | "guide"): string {
  if (typeof window === "undefined") return `organic-${action}`;
  const base = localStorage.getItem("qntum_source") ?? "organic";
  // Strip any existing action suffix before appending current action
  const baseClean = base.replace(/-inspection$/, "").replace(/-guide$/, "");
  return `${baseClean}-${action}`;
}

export function resolveRep(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("qntum_rep");
}
