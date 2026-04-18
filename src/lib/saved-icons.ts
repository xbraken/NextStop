// Curated set of Material Symbols icons that work well as labels for
// saved bus stops. Keep the list short — too many choices make picking
// harder, not easier.
export const SAVED_ICON_OPTIONS = [
  { name: 'home', label: 'Home' },
  { name: 'work', label: 'Work' },
  { name: 'fitness_center', label: 'Gym' },
  { name: 'school', label: 'School' },
  { name: 'local_hospital', label: 'Hospital' },
  { name: 'shopping_cart', label: 'Shops' },
  { name: 'restaurant', label: 'Food' },
  { name: 'local_cafe', label: 'Cafe' },
  { name: 'location_city', label: 'City' },
  { name: 'park', label: 'Park' },
  { name: 'flight', label: 'Airport' },
  { name: 'directions_bus', label: 'Bus' },
] as const

export type SavedIconName = (typeof SAVED_ICON_OPTIONS)[number]['name']

const VALID = new Set(SAVED_ICON_OPTIONS.map((o) => o.name))

export function isValidIcon(name: unknown): name is SavedIconName {
  return typeof name === 'string' && VALID.has(name as SavedIconName)
}
