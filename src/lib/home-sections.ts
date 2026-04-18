// Stable identifiers for reorderable/toggleable sections on the home screen.
// Users can hide a section by omitting it from their saved layout, and change
// the render order by reordering the list. A `null` layout means "use default".

export type HomeSectionId =
  | 'search'
  | 'destinations'
  | 'stops'
  | 'routes'
  | 'status'

export interface HomeSectionMeta {
  id: HomeSectionId
  title: string
  description: string
  icon: string
}

export const HOME_SECTIONS: HomeSectionMeta[] = [
  {
    id: 'search',
    title: 'Search bar',
    description: 'The big "Where to?" box for planning a journey.',
    icon: 'search',
  },
  {
    id: 'destinations',
    title: 'Saved destinations',
    description: 'Your favourite places as big tappable cards.',
    icon: 'bookmark',
  },
  {
    id: 'stops',
    title: 'Saved stops',
    description: 'Quick row of bus stops with live arrivals.',
    icon: 'directions_bus',
  },
  {
    id: 'routes',
    title: 'Saved routes',
    description: 'Pre-planned journeys you take often.',
    icon: 'route',
  },
  {
    id: 'status',
    title: 'Translink status',
    description: 'Live service updates from Translink.',
    icon: 'campaign',
  },
]

const ALL_IDS = new Set<HomeSectionId>(HOME_SECTIONS.map((s) => s.id))

export const DEFAULT_HOME_LAYOUT: HomeSectionId[] = HOME_SECTIONS.map((s) => s.id)

// Parse a stored layout (JSON string) into a deduped, validated order. Unknown
// IDs are dropped; missing IDs are NOT auto-appended so users can keep sections
// hidden even after new ones are added.
export function parseHomeLayout(raw: string | null | undefined): HomeSectionId[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const seen = new Set<HomeSectionId>()
    const out: HomeSectionId[] = []
    for (const id of parsed) {
      if (typeof id === 'string' && ALL_IDS.has(id as HomeSectionId) && !seen.has(id as HomeSectionId)) {
        seen.add(id as HomeSectionId)
        out.push(id as HomeSectionId)
      }
    }
    return out
  } catch {
    return null
  }
}

export function isValidHomeLayout(value: unknown): value is HomeSectionId[] {
  if (!Array.isArray(value)) return false
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id !== 'string' || !ALL_IDS.has(id as HomeSectionId)) return false
    if (seen.has(id)) return false
    seen.add(id)
  }
  return true
}
