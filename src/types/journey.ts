export interface JourneySearchParams {
  from: string
  fromName: string
  to: string
  toName: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  mode: 'leave_at' | 'leave_now' | 'arrive_by'
}
