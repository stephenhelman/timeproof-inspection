// src/lib/packages.js
// Single source of truth for all TIMEPROOF package data.
// Import from here — never hardcode package data in components.

export const PACKAGES = [
  {
    id: 'platinum',
    label: 'Platinum',
    tagline: 'Our most complete protection — backed by a 10-year installation warranty.',
    commissionRate: 0.12,
    recommended: false,

    warranty: {
      truProtectionYears: 50,
      truProtectionDescription:
        'TruProtection covers 100% of product costs, labor costs, and manufacturing defects for 50 years.',
      installationWarranty: "10-year installation warranty — we stand behind our crew's work.",
      afterCoverage: '20% product coverage after year 50.',
    },

    products: [
      { category: 'Ice & Water Barrier',    name: 'Titanium PSU30' },
      { category: 'Synthetic Underlayment', name: 'DeckDefense 2.0' },
      { category: 'Starter Shingle',        name: 'Starter Strip Plus' },
      { category: 'Shingle',                name: 'TruDefinition Duration FLEX A/R' },
      { category: 'Hip & Ridge',            name: 'ImpactRidge' },
    ],

    colors: [
      { name: 'Desert Tan',     hex: '#C8A882' },
      { name: 'Brownwood',      hex: '#6B4A2A' },
      { name: 'Teak',           hex: '#8B6914' },
      { name: 'Driftwood',      hex: '#9E8E7E' },
      { name: 'Antique Silver', hex: '#A8A9AD' },
      { name: 'Estate Gray',    hex: '#6E7E8E' },
      { name: 'Onyx Black',     hex: '#2C2C2C' },
    ],
  },

  {
    id: 'elite',
    label: 'Elite',
    tagline: 'Premium products with 50-year TruProtection coverage.',
    commissionRate: 0.10,
    recommended: false,

    warranty: {
      truProtectionYears: 50,
      truProtectionDescription:
        'TruProtection covers 100% of product costs, labor costs, and manufacturing defects for 50 years.',
      installationWarranty: null,
      afterCoverage: '20% product coverage after year 50.',
    },

    products: [
      { category: 'Ice & Water Barrier',    name: 'Titanium PSU30' },
      { category: 'Synthetic Underlayment', name: 'DeckDefense 2.0' },
      { category: 'Starter Shingle',        name: 'Starter Strip Plus' },
      { category: 'Shingle',                name: 'TruDefinition Duration Design A/R' },
      { category: 'Hip & Ridge',            name: 'DuraRidge' },
    ],

    colors: [
      { name: 'Aged Copper',    hex: '#7C6E5A' },
      { name: 'Black Sable',    hex: '#2A2825' },
      { name: 'Bourbon',        hex: '#7A4B2A' },
      { name: 'Merlot',         hex: '#6B2737' },
      { name: 'Pacific Wave',   hex: '#3D5A6E' },
      { name: 'Sand Dune',      hex: '#C4AA82' },
      { name: 'Sedona Canyon',  hex: '#A0522D' },
      { name: 'Storm Cloud',    hex: '#6B7A8D' },
      { name: 'Summer Harvest', hex: '#C8A43C' },
    ],
  },

  {
    id: 'essential',
    label: 'Essential',
    tagline: 'Reliable protection with 10-year TruProtection coverage.',
    commissionRate: 0.10,
    recommended: false,

    warranty: {
      truProtectionYears: 10,
      truProtectionDescription:
        'TruProtection covers 100% of product costs, labor costs, and manufacturing defects for 10 years.',
      installationWarranty: null,
      afterCoverage:
        '80% product coverage from years 10–40. 20% product coverage after year 40.',
    },

    products: [
      { category: 'Ice & Water Barrier',    name: 'Rhino Roof G' },
      { category: 'Synthetic Underlayment', name: 'ProArmor' },
      { category: 'Starter Shingle',        name: 'Starter Strip Plus' },
      { category: 'Shingle',                name: 'Oakridge' },
      { category: 'Hip & Ridge',            name: 'DecoRidge' },
    ],

    colors: [
      { name: 'Brownwood',   hex: '#6B4A2A' },
      { name: 'Desert Tan',  hex: '#C8A882' },
      { name: 'Driftwood',   hex: '#9E8E7E' },
      { name: 'Estate Gray', hex: '#6E7E8E' },
      { name: 'Onyx Black',  hex: '#2C2C2C' },
      { name: 'Teak',        hex: '#8B6914' },
    ],
  },

  {
    id: 'storm',
    label: 'Storm',
    tagline: 'Insurance replacement — matched to your selected package.',
    commissionRate: 0.10,
    recommended: false,

    warranty: null, // inherits from associated package

    products: [], // inherits from associated package

    // Storm shows all colors from the associated package.
    // Resolve dynamically: getPackageById(associatedPackageId)?.colors ?? []
    colors: [],
  },
]

// ── Helpers ──────────────────────────────────────────────

export const getPackageById = (id) =>
  PACKAGES.find(p => p.id === id) ?? null

export const getColorsForPackage = (packageId) => {
  if (packageId === 'storm') return []
  return getPackageById(packageId)?.colors ?? []
}

export const getWarrantySummary = (packageId) => {
  const pkg = getPackageById(packageId)
  if (!pkg || !pkg.warranty) return null
  const { warranty } = pkg

  const lines = []
  lines.push(
    `TruProtection: ${warranty.truProtectionYears} years — ${warranty.truProtectionDescription}`
  )
  if (warranty.installationWarranty) {
    lines.push(warranty.installationWarranty)
  }
  lines.push(warranty.afterCoverage)
  return lines
}

/**
 * Match a user-entered package name (e.g. "Platinum Package", "elite", "STORM")
 * to a config package ID. Returns null if no match found.
 */
export const detectPackageId = (name) => {
  if (!name) return null
  const lower = name.toLowerCase()
  if (lower.includes('platinum')) return 'platinum'
  if (lower.includes('elite')) return 'elite'
  if (lower.includes('essential')) return 'essential'
  if (lower.includes('storm')) return 'storm'
  return null
}
