import type { Departure } from '@/types/translink'

export interface DepartureVariant {
  label: string
  className: string
  dot: string
}

// Shared status badge used on /live and on the map's StopSheet so the
// late/early/on-time treatment is identical across the app.
export function variantFor(d: Departure): DepartureVariant {
  if (d.status === 'Cancelled') {
    return { label: 'Cancelled', className: 'text-red-600', dot: 'bg-red-500' }
  }
  if (!d.isLive) {
    return { label: 'Timetable only', className: 'text-outline', dot: 'bg-outline' }
  }
  const driftMin = Math.round(
    (new Date(d.expectedDeparture).getTime() - new Date(d.scheduledDeparture).getTime()) / 60_000
  )
  if (driftMin >= 2) {
    return { label: `Live · ${driftMin} min late`, className: 'text-amber-600', dot: 'bg-amber-500' }
  }
  if (driftMin <= -1) {
    return {
      label: `Live · ${Math.abs(driftMin)} min early`,
      className: 'text-amber-600',
      dot: 'bg-amber-500',
    }
  }
  return { label: 'Live · on time', className: 'text-emerald-600', dot: 'bg-emerald-500' }
}
