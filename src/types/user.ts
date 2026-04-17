export interface User {
  id: number
  email: string
  created_at: string
}

export type SavedKind = 'destination' | 'stop' | 'route'
export type StopDirection = 'inbound' | 'outbound'

export interface SavedDestination {
  id: number
  user_id: number
  kind: SavedKind
  label: string
  stop_name: string
  stop_id: string
  lat: number | null
  lng: number | null
  from_label: string | null
  from_id: string | null
  direction: StopDirection | null
  routes: string | null
  created_at: string
}

export interface JourneyHistory {
  id: number
  user_id: number
  from_label: string
  to_label: string
  used_at: string
}
