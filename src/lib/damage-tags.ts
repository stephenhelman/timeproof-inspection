export const ROOF_TAGS = [
  { id: 'staining', label: 'Staining / Discoloration', warningSign: 'staining' },
  { id: 'granule-loss', label: 'Granule Loss', warningSign: 'staining' },
  { id: 'exposed-fiberglass', label: 'Exposed Fiberglass', warningSign: 'staining' },
  { id: 'curling', label: 'Curling Shingles', warningSign: 'curling' },
  { id: 'fish-lip', label: 'Fish Lip Shingles', warningSign: 'curling' },
  { id: 'nail-pops', label: 'Nail Pops', warningSign: 'nail-pops' },
  { id: 'missing-shingles', label: 'Missing Shingles', warningSign: 'missing' },
  { id: 'vegetation', label: 'Vegetation Growth', warningSign: 'staining' },
  { id: 'damaged-flashing', label: 'Damaged Flashing', warningSign: 'missing' },
  { id: 'other-roof', label: 'Other', warningSign: null },
] as const

export const ATTIC_TAGS = [
  { id: 'water-staining-rafters', label: 'Water Staining on Rafters', warningSign: 'water-damage' },
  { id: 'dark-wet-decking', label: 'Dark / Wet Decking', warningSign: 'water-damage' },
  { id: 'amber-deposits', label: 'Amber Deposits', warningSign: 'amber' },
  { id: 'cat-eyes', label: 'Cat Eyes (Nail Rot)', warningSign: 'cat-eyes' },
  { id: 'mold', label: 'Mold / Biological Growth', warningSign: 'water-damage' },
  { id: 'blocked-soffits', label: 'Blocked Soffits', warningSign: 'ventilation' },
  { id: 'inadequate-ridge-vent', label: 'Inadequate Ridge Vent', warningSign: 'ventilation' },
  { id: 'daylight-decking', label: 'Daylight Through Decking', warningSign: 'missing' },
  { id: 'other-attic', label: 'Other', warningSign: null },
] as const

export type RoofTagId = typeof ROOF_TAGS[number]['id']
export type AtticTagId = typeof ATTIC_TAGS[number]['id']
