export interface User {
  id: number
  email: string
  created_at: string
}

export interface SavedDestination {
  id: number
  user_id: number
  label: string
  stop_name: string
  stop_id: string
  lat: number | null
  lng: number | null
  created_at: string
}

export interface JourneyHistory {
  id: number
  user_id: number
  from_label: string
  to_label: string
  used_at: string
}
