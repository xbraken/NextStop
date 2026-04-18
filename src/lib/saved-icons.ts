// Curated set of Material Symbols icons that work well as labels for
// saved bus stops. A handful of common personal destinations so users
// can find the right one quickly without scrolling through hundreds.
export const SAVED_ICON_OPTIONS = [
  { name: 'home', label: 'Home' },
  { name: 'work', label: 'Work' },
  { name: 'fitness_center', label: 'Gym' },
  { name: 'school', label: 'School' },
  { name: 'local_hospital', label: 'Hospital' },
  { name: 'local_pharmacy', label: 'Pharmacy' },
  { name: 'shopping_cart', label: 'Shopping' },
  { name: 'local_grocery_store', label: 'Groceries' },
  { name: 'restaurant', label: 'Food' },
  { name: 'local_cafe', label: 'Cafe' },
  { name: 'local_bar', label: 'Pub' },
  { name: 'location_city', label: 'City' },
  { name: 'park', label: 'Park' },
  { name: 'beach_access', label: 'Beach' },
  { name: 'local_library', label: 'Library' },
  { name: 'museum', label: 'Museum' },
  { name: 'stadium', label: 'Stadium' },
  { name: 'movie', label: 'Cinema' },
  { name: 'church', label: 'Church' },
  { name: 'flight', label: 'Airport' },
  { name: 'directions_railway', label: 'Train' },
  { name: 'directions_bus', label: 'Bus' },
  { name: 'favorite', label: 'Favourite' },
  { name: 'star', label: 'Star' },
] as const

export type SavedIconName = (typeof SAVED_ICON_OPTIONS)[number]['name']

const VALID = new Set(SAVED_ICON_OPTIONS.map((o) => o.name))

export function isValidIcon(name: unknown): name is SavedIconName {
  return typeof name === 'string' && VALID.has(name as SavedIconName)
}
