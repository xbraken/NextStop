import type { Itinerary, JourneyLeg } from '@/types/translink'

// Shared status badge for journeys and their legs. Mirrors the
// green/amber/outline treatment used on live departures so a user sees the
// same signal everywhere.
export interface TimeStatus {
  label: string
  dot: string // tailwind bg-* for the coloured dot
  className: string // tailwind text/bg for the chip wrapper
}

const ON_TIME: TimeStatus = {
  label: 'On time',
  dot: 'bg-emerald-500',
  className: 'text-emerald-700 bg-emerald-500/10',
}

const TIMETABLE: TimeStatus = {
  label: 'Timetable',
  dot: 'bg-outline',
  className: 'text-on-surface-variant bg-surface-container',
}

function delayMin(planned: string | undefined, estimated: string): number | null {
  if (!planned || !estimated) return null
  const p = new Date(planned).getTime()
  const e = new Date(estimated).getTime()
  if (Number.isNaN(p) || Number.isNaN(e)) return null
  return Math.round((e - p) / 60_000)
}

function statusForDelay(d: number): TimeStatus {
  if (d >= 2) {
    return {
      label: `${d} min late`,
      dot: 'bg-amber-500',
      className: 'text-amber-700 bg-amber-500/10',
    }
  }
  if (d <= -1) {
    return {
      label: `${Math.abs(d)} min early`,
      dot: 'bg-amber-500',
      className: 'text-amber-700 bg-amber-500/10',
    }
  }
  return ON_TIME
}

// Per-leg status. Walks return null (no meaningful schedule). Bus/rail legs
// without an estimate fall back to "Timetable".
export function legStatus(leg: JourneyLeg): TimeStatus | null {
  if (leg.mode === 'WALK') return null
  // Treat the two times as equal (= no realtime info) when EFA didn't supply
  // a separate estimate. We detect that by scheduledStart being undefined
  // OR identical to startTime — either way we can't claim "on time" live.
  if (!leg.scheduledStart) return TIMETABLE
  const d = delayMin(leg.scheduledStart, leg.startTime)
  if (d === null) return TIMETABLE
  // If planned and estimated are exactly equal the EFA didn't really push a
  // live update; that's a timetable readout dressed up as one. Still show
  // "on time" though — it's the least-bad signal we have.
  return statusForDelay(d)
}

// Itinerary-level status. Takes the worst (largest absolute) delay across the
// transit legs so a journey with one late bus surfaces as late overall.
export function itineraryStatus(it: { legs: Itinerary['legs'] }): TimeStatus {
  const transit = it.legs.filter((l) => l.mode !== 'WALK')
  if (transit.length === 0) {
    return {
      label: 'Walking',
      dot: 'bg-outline',
      className: 'text-on-surface-variant bg-surface-container',
    }
  }
  let worst = 0
  let anyRealtime = false
  for (const l of transit) {
    if (!l.scheduledStart) continue
    const d = delayMin(l.scheduledStart, l.startTime)
    if (d === null) continue
    anyRealtime = true
    if (Math.abs(d) > Math.abs(worst)) worst = d
  }
  if (!anyRealtime) return TIMETABLE
  return statusForDelay(worst)
}
