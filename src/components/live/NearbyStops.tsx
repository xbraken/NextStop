'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { haversineMeters, formatMetres } from '@/lib/geo'
import type { TranslinkStop } from '@/types/translink'

type State =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'error' }
  | { kind: 'ok'; stops: Array<TranslinkStop & { distance: number }> }

export default function NearbyStops({
  onSelect,
}: {
  onSelect: (s: { stopId: string; stopName: string }) => void
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ kind: 'denied' })
      return
    }
    let cancelled = false
    setState({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return
        const { latitude, longitude } = pos.coords
        setState({ kind: 'loading' })
        try {
          const res = await fetch(
            `/api/translink/stops/near?lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}&radius=800`,
            { cache: 'no-store' }
          )
          if (!res.ok) throw new Error(String(res.status))
          const data = (await res.json()) as { stops?: TranslinkStop[] }
          if (cancelled) return
          const stops = (data.stops ?? [])
            .filter((s) => s.lat && s.lon)
            .map((s) => ({ ...s, distance: haversineMeters(latitude, longitude, s.lat, s.lon) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
          setState({ kind: 'ok', stops })
        } catch {
          if (!cancelled) setState({ kind: 'error' })
        }
      },
      (err) => {
        if (cancelled) return
        setState({ kind: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' })
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'denied' || state.kind === 'error') {
    return (
      <div className="mt-10 text-center text-on-surface-variant">
        <Icon name="pin_drop" size={48} className="mb-4 opacity-40" />
        <p className="font-headline font-bold">Pick a stop</p>
        <p className="text-sm mt-1">
          {state.kind === 'denied'
            ? 'Allow location to see nearby stops'
            : 'Search for a stop to see live arrivals'}
        </p>
      </div>
    )
  }

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="near_me" size={18} className="text-primary" filled />
        <h2 className="font-headline font-extrabold text-base">Nearby stops</h2>
      </div>

      {(state.kind === 'locating' || state.kind === 'loading') && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      )}

      {state.kind === 'ok' && state.stops.length === 0 && (
        <p className="text-sm text-on-surface-variant py-4">No stops within 800 m.</p>
      )}

      {state.kind === 'ok' && state.stops.length > 0 && (
        <ul className="flex flex-col gap-2">
          {state.stops.map((s) => (
            <li key={s.stopId}>
              <button
                type="button"
                onClick={() => onSelect({ stopId: s.stopId, stopName: s.stopName })}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:bg-surface-container-low active:scale-[0.99] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <Icon name="directions_bus" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{s.stopName}</p>
                  {s.routes && (
                    <p className="text-xs text-on-surface-variant truncate">
                      Routes {s.routes}
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold text-on-surface-variant tabular-nums shrink-0">
                  {formatMetres(s.distance)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
