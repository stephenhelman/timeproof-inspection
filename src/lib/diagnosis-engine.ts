const DIAGNOSIS_MAP = [
  {
    id: 'active-water-intrusion',
    label: 'Active Water Intrusion',
    roofTriggers: ['staining', 'granule-loss', 'exposed-fiberglass', 'missing-shingles'],
    atticTriggers: ['water-staining-rafters', 'dark-wet-decking', 'mold'],
    explanation: 'Water has breached the roofing system. Evidence found on both the exterior and interior indicates active moisture intrusion into the structural components of the home.',
    warningSignKey: 'water-damage',
    severity: 'high' as const,
  },
  {
    id: 'ventilation-failure',
    label: 'Ventilation Failure',
    roofTriggers: ['granule-loss', 'curling', 'fish-lip'],
    atticTriggers: ['amber-deposits', 'blocked-soffits', 'inadequate-ridge-vent'],
    explanation: 'The attic ventilation system is not functioning properly. Trapped heat and moisture are accelerating deterioration of the roofing system from the inside out.',
    warningSignKey: 'ventilation',
    severity: 'high' as const,
  },
  {
    id: 'nail-failure',
    label: 'Nail Failure / Decking Compromise',
    roofTriggers: ['nail-pops', 'curling', 'fish-lip'],
    atticTriggers: ['cat-eyes', 'dark-wet-decking'],
    explanation: 'Moisture-driven nail failure detected. Condensation forming around nails is rotting the surrounding wood, causing nails to lose hold and shingles to lift or blow off.',
    warningSignKey: 'cat-eyes',
    severity: 'high' as const,
  },
  {
    id: 'thermal-degradation',
    label: 'Thermal Degradation',
    roofTriggers: ['curling', 'fish-lip', 'granule-loss', 'exposed-fiberglass'],
    atticTriggers: ['amber-deposits'],
    explanation: 'Prolonged heat exposure has caused the shingles to curl and the structural wood to lose sap integrity. The wood becomes brittle and prone to cracking under load.',
    warningSignKey: 'amber',
    severity: 'medium' as const,
  },
  {
    id: 'system-breach',
    label: 'Full System Breach',
    roofTriggers: ['missing-shingles', 'damaged-flashing'],
    atticTriggers: ['daylight-decking'],
    explanation: 'Critical gaps in the roofing system have been identified. The home is directly exposed to weather events with no protective barrier in the affected areas.',
    warningSignKey: 'missing',
    severity: 'critical' as const,
  },
  {
    id: 'biological-growth',
    label: 'Biological Growth / Chronic Moisture',
    roofTriggers: ['vegetation', 'staining'],
    atticTriggers: ['mold'],
    explanation: 'Organic growth indicates long-term moisture presence. This accelerates material breakdown and can indicate systemic moisture management failure.',
    warningSignKey: 'water-damage',
    severity: 'medium' as const,
  },
]

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 }

export interface DiagnosisFinding {
  id: string
  label: string
  explanation: string
  severity: 'critical' | 'high' | 'medium'
  status: 'confirmed' | 'suspected'
  matchedRoofTags: string[]
  matchedAtticTags: string[]
  warningSignKey: string
  notes?: string
}

export function generateDiagnosis(roofTags: string[], atticTags: string[]): DiagnosisFinding[] {
  const results: DiagnosisFinding[] = []

  for (const def of DIAGNOSIS_MAP) {
    const matchedRoofTags = def.roofTriggers.filter((t) => roofTags.includes(t))
    const matchedAtticTags = def.atticTriggers.filter((t) => atticTags.includes(t))

    const hasRoof = matchedRoofTags.length > 0
    const hasAttic = matchedAtticTags.length > 0

    if (!hasRoof && !hasAttic) continue

    results.push({
      id: def.id,
      label: def.label,
      explanation: def.explanation,
      severity: def.severity,
      status: hasRoof && hasAttic ? 'confirmed' : 'suspected',
      matchedRoofTags,
      matchedAtticTags,
      warningSignKey: def.warningSignKey,
    })
  }

  return results.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )
}
