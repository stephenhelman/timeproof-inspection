// ============================================================
// SCOPE REPORTS — SERVICE ZONE CONFIGURATION
//
// Edit this file when you need to:
//   - Add new ZIP codes to an existing zone
//   - Create a new zone for a new territory
//   - Change which zones can share a day (drive time decisions)
//   - Adjust max inspections per day as team grows
//   - Change how far out the bot can offer appointments
//   - Add a new distance zone (e.g. Roswell, Santa Fe)
//   - Change available appointment times
//   - Adjust slot lock expiry window
//
// After editing: deploy to Vercel. Changes take effect immediately.
// No other files need to be touched.
// ============================================================

/* 
Texas
El Paso
Northeast 04 24 34 30
East Side 25 35
Far East 36 38
Horizon 28
Lower Valley 07 15
Socorro 27
Central 30 03 02
South 05 01
West Side 12 11
Upper Valley 32 22

Canutillo 79835
Anthony 79821

New Mexico
Las Cruces 88011 88012 88005 88001 88007
Alamo '88310' '88311'
Deming '88030' '88031'
Silver City '88061' '88062'
Carlsbad '88220' '88221'
Anthony '88021'
Santa Teresa '88008'
Sunland Park '88063'
Chapparal '88081'
Mesquite '88048'
Vado '88072'

*/

export const SERVICE_ZONES: Record<
  string,
  {
    zips: string[];
    label: string;
    distance_zone: boolean;
    manual_only?: boolean;
  }
> = {
  // Texas Zones
  // El Paso zones
  el_paso_northeast: {
    zips: ["79904", "79924", "79934", "79930"],
    label: "Northeast El Paso",
    distance_zone: false,
  },
  el_paso_east: {
    zips: ["79925", "79935"],
    label: "East El Paso",
    distance_zone: false,
  },
  el_paso_far_east: {
    zips: ["79936", "79938"],
    label: "Far East El Paso",
    distance_zone: false,
  },
  el_paso_horizon_city: {
    zips: ["79928"],
    label: "Horizon City",
    distance_zone: false,
  },
  el_paso_lower_valley: {
    zips: ["79907", "79915"],
    label: "Horizon City",
    distance_zone: false,
  },
  el_paso_socorro: {
    zips: ["79927"],
    label: "Socorro",
    distance_zone: false,
  },
  el_paso_central: {
    zips: ["79930", "79902", "79903"],
    label: "Central El Paso",
    distance_zone: false,
  },
  el_paso_south: {
    zips: ["79901", "79905"],
    label: "South El Paso",
    distance_zone: false,
  },
  el_paso_westside: {
    zips: ["79912", "79911"],
    label: "West El Paso",
    distance_zone: false,
  },
  el_paso_upper_valley: {
    zips: ["79932", "79922"],
    label: "Upper Valley",
    distance_zone: false,
  },

  // Texas Other Zones
  canutillo_texas: {
    zips: ["79835"],
    label: "Canutillo",
    distance_zone: false,
  },
  anthony_texas: {
    zips: ["79821"],
    label: "Anthony, Texas",
    distance_zone: true,
  },

  // New Mexico Zones
  // Las Cruces
  las_cruces: {
    zips: ["88011", "88012", "88005", "88001", "88007"],
    label: "Las Cruces, New Mexico",
    distance_zone: true,
  },
  alamogordo: {
    zips: ["88310", "88311"],
    label: "Alamogordo, New Mexico",
    distance_zone: true,
  },

  //New Mexico Other Zones
  vado_new_mexico: {
    zips: ["88310", "88311"],
    label: "Vado, New Mexico",
    distance_zone: true,
  },
  anthony_new_mexico: {
    zips: ["88021"],
    label: "Anthony, New Mexico",
    distance_zone: true,
  },
  santa_teresa: {
    zips: ["88008"],
    label: "Santa Teresa, New Mexico",
    distance_zone: true,
  },
  chaparral_new_mexico: {
    zips: ["88310", "88311"],
    label: "Chaparal, New Mexico",
    distance_zone: false,
  },
  sunland_park_new_mexico: {
    zips: ["88310", "88311"],
    label: "Sunland Park, New Mexico",
    distance_zone: false,
  },
  mesquite_new_mexico: {
    zips: ["88048"],
    label: "Mesquite, New Mexico",
    distance_zone: true,
  },

  // Long Distance New Mexico Manual Zones
  deming_new_mexico: {
    zips: ["88030", "88031"],
    label: "Deming, New Mexico",
    distance_zone: true,
    manual_only: true,
  },
  silver_city: {
    zips: ["88061", "88062"],
    label: "Silver City, New Mexico",
    distance_zone: true,
    manual_only: true,
  },
  carlsbad_new_mexico: {
    zips: ["88220", "88221"],
    label: "Carlsbad, New Mexico",
    distance_zone: true,
    manual_only: true,
  },
};

export const ZONE_COMPATIBILITY: Record<string, string[]> = {
  "79934": ["79924", "79904", "79911", "79930"],
  "79924": ["79934", "79904", "79930"],
  "79904": ["79924", "79934", "79930"],
  "79930": ["79904", "79924", "79934", "79903", "79902", "79905", "79901"],
  "79903": ["79930", "79905", "79902", "79901", "79925"],
  "79905": ["79901", "79903", "79930", "79925", "79915", "79902"],
  "79915": ["79905", "79925", "79935", "79907"],
  "79925": ["79935", "79936", "79907", "79915", "79905", "79903"],
  "79935": ["79925", "79915", "79936", "79907"],
  "79907": ["79915", "79925", "79935", "79936", "79928", "79927"],
  "79936": ["79935", "79925", "79915", "79927", "79928", "79938"],
  "79927": ["79907", "79936", "79928", "79938"],
  "79928": ["79938", "79927", "79936", "79907"],
  "79938": ["79928", "79936", "79927"],
  "79901": ["79902", "79903", "79905", "79922", "79930"],
  "79902": ["79901", "79903", "79905", "79930", "79922", "79912"],
  "79912": ["79902", "79922", "79932", "79911"],
  "79922": ["79902", "79901", "79912", "79932", "88063", "88008"],
  "79932": ["79835", "79912", "79911", "79922", "88021", "88008"],
  "79911": ["79934", "79821", "79835", "79932", "79912"],
  "79835": ["79821", "79911", "79912", "79932", "88021"],
  "79821": ["79911", "79835", "88021"],
};

export const MAX_INSPECTIONS_PER_DAY_PER_ZONE = 3;
export const INSPECTION_DURATION_HOURS = 2;
export const BOOKING_WINDOW_DAYS = 7;
export const SLOT_LOCK_EXPIRY_MINUTES = 15;
export const DISTANCE_ZONE_MIN_DAYS_AHEAD = 1;

export const AVAILABLE_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

export function getZoneForZip(zip: string): string | null {
  for (const [key, zone] of Object.entries(SERVICE_ZONES)) {
    if (zone.zips.includes(zip)) return key;
  }
  return null;
}

export function getZipTier(
  zip: string,
): "primary" | "secondary" | "out_of_area" {
  for (const zone of Object.values(SERVICE_ZONES)) {
    if (!zone.zips.includes(zip)) continue;
    if (zone.manual_only) return "secondary";
    return "primary";
  }
  return "out_of_area";
}

export function isDistanceZone(zoneKey: string): boolean {
  return SERVICE_ZONES[zoneKey]?.distance_zone ?? false;
}

export function getCompatibleZones(zoneKey: string): string[] {
  return ZONE_COMPATIBILITY[zoneKey] ?? [];
}
