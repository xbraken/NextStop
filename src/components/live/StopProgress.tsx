'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { haversineMeters } from '@/lib/geo'
import { formatTime } from '@/lib/time'

type Stop = {
  name: string
  stopId: string
  time: string
  lat?: number
  lon?: number
}

type Resp = { line: string; destination: string; stops: Stop[] }

export default function StopProgress({
  fromStopId,
  line,
  direction,
  vehicleLat,
  vehicleLon,
}: {
  fromStopId: string | null
  line: string
  direction: 'inbound' | 'outbound' | null
  vehicleLat: number
  vehicleLon: number
}) {
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [originStopId, setOriginStopId] = useState<string | null>(fromStopId)
  const [expanded, setExpanded] = useState(false)

  // If we don't have an origin stop (user tapped a bus directly on the map),
  // fall back to the nearest stop to the vehicle's current position. Looked
  // up once per mount — the trip's stop sequence doesn't change as the bus
  // moves, only the current-stop highlight.
  useEffect(() => {
    if (fromStopId) {
      setOriginStopId(fromStopId)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/translink/stops/near?lat=${vehicleLat.toFixed(5)}&lon=${vehicleLon.toFixed(5)}&radius=400`,
          { cache: 'no-store' }
        )
        if (!res.ok) throw new Error(String(res.status))
        const body = (await res.json()) as { stops?: Array<{ stopId: string; lat: number; lon: number }> }
        const nearest = (body.stops ?? [])
          .filter((s) => s.lat && s.lon)
          .sort(
            (a, b) =>
              haversineMeters(vehicleLat, vehicleLon, a.lat, a.lon) -
              haversineMeters(vehicleLat, vehicleLon, b.lat, b.lon)
          )[0]
        if (!cancelled && nearest) setOriginStopId(nearest.stopId)
        else if (!cancelled) setError('No stops near the bus')
      } catch {
        if (!cancelled) setError('Could not resolve origin stop')
      }
    })()
    return () => { cancelled = true }
  }, [fromStopId, vehicleLat, vehicleLon])

  // Fetch the trip stops once we have an origin.
  useEffect(() => {
    if (!originStopId) return
    let cancelled = false
    setData(null)
    setError(null)
    ;(async () => {
      try {
        const qs = new URLSearchParams({ line, stopId: originStopId })
        if (direction) qs.set('dir', direction)
        const res = await fetch(`/api/translink/line-stops?${qs.toString()}`, { cache: 'no-store' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.warn('[StopProgress]', res.status, body)
          throw new Error((body as { error?: string }).error ?? String(res.status))
        }
        const body = (await res.json()) as Resp
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stops')
      }
    })()
    return () => { cancelled = true }
  }, [originStopId, line, direction])

  if (error) {
    return (
      <div className="mt-4 p-3 rounded-xl bg-surface-container text-xs text-on-surface-variant">
        <p className="font-semibold">Stop progress unavailable</p>
        <p className="mt-0.5">{error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 rounded bg-surface-container animate-pulse" />
        ))}
      </div>
    )
  }

  const currentIdx = nearestIndex(data.stops, vehicleLat, vehicleLon)
  // Compact by default: current + next 2. Tap "Show all" to expand.
  const COMPACT_AHEAD = 2
  const visible = expanded
    ? data.stops.map((s, i) => ({ s, i }))
    : data.stops
        .map((s, i) => ({ s, i }))
        .filter(({ i }) => i >= currentIdx && i <= currentIdx + COMPACT_AHEAD)
  const hiddenBefore = expanded ? 0 : currentIdx
  const hiddenAfter = expanded
    ? 0
    : Math.max(0, data.stops.length - 1 - (currentIdx + COMPACT_AHEAD))

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Stops
        </p>
        <p className="text-[11px] font-semibold text-outline truncate ml-3">
          to {data.destination}
        </p>
      </div>
      {hiddenBefore > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] font-semibold text-primary hover:underline mb-2"
        >
          Show {hiddenBefore} previous stop{hiddenBefore === 1 ? '' : 's'}
        </button>
      )}
      <ol className="relative">
        {visible.map(({ s, i }, vi) => {
          const passed = i < currentIdx
          const current = i === currentIdx
          const isLast = vi === visible.length - 1
          return (
            <li key={`${s.stopId}-${i}`} className="relative flex items-start gap-3 pb-3 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-5 bottom-0 w-0.5 ${
                    passed ? 'bg-primary' : 'bg-outline-variant/60'
                  }`}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-10 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  current
                    ? 'bg-primary text-on-primary ring-4 ring-primary/20'
                    : passed
                      ? 'bg-primary/80 text-on-primary'
                      : 'bg-surface-container border-2 border-outline-variant/60'
                }`}
              >
                {current ? (
                  <Icon name="directions_bus" size={14} filled />
                ) : passed ? (
                  <Icon name="check" size={14} />
                ) : null}
              </span>
              <div className="flex-1 min-w-0 pt-0.5 flex items-baseline justify-between gap-3">
                <p
                  className={`text-sm truncate ${
                    current
                      ? 'font-headline font-extrabold text-on-surface'
                      : passed
                        ? 'text-on-surface-variant line-through decoration-1'
                        : 'font-medium text-on-surface'
                  }`}
                >
                  {s.name}
                </p>
                {s.time && (
                  <span className="text-[11px] font-semibold text-outline tabular-nums shrink-0">
                    {formatTime(s.time)}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {hiddenAfter > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-[11px] font-semibold text-primary hover:underline"
        >
          Show {hiddenAfter} more stop{hiddenAfter === 1 ? '' : 's'}
        </button>
      )}
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 text-[11px] font-semibold text-on-surface-variant hover:underline"
        >
          Collapse
        </button>
      )}
    </div>
  )
}

function nearestIndex(stops: Stop[], lat: number, lon: number): number {
  let best = 0
  let bestD = Infinity
  stops.forEach((s, i) => {
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') return
    const d = haversineMeters(lat, lon, s.lat, s.lon)
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}
