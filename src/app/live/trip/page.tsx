'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { formatTime } from '@/lib/time'
import type { StopDirection } from '@/types/user'
import type { LiveVehicle } from '@/app/api/translink/vehicles/route'
import { matchesDirection } from '@/lib/direction'

type Stop = {
  name: string
  stopId: string
  time: string
  lat?: number
  lon?: number
}

type TripResp = { line: string; destination: string; stops: Stop[] }

export default function TripPage() {
  return (
    <Suspense fallback={null}>
      <TripInner />
    </Suspense>
  )
}

function TripInner() {
  const router = useRouter()
  const params = useSearchParams()
  const line = params.get('line') ?? ''
  const dir = (params.get('dir') as StopDirection | null) ?? null
  const fromStopId = params.get('from') ?? ''

  const [data, setData] = useState<TripResp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasLive, setHasLive] = useState(false)

  useEffect(() => {
    if (!line || !fromStopId) {
      setError('Missing line or stop')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const qs = new URLSearchParams({ line, stopId: fromStopId })
        if (dir) qs.set('dir', dir)
        const res = await fetch(`/api/translink/line-stops?${qs.toString()}`, { cache: 'no-store' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? String(res.status))
        }
        const body = (await res.json()) as TripResp
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      }
    })()
    return () => { cancelled = true }
  }, [line, dir, fromStopId])

  // Check if any live vehicle exists on this line+dir so we can enable the
  // Track button. Keeps it subdued when the bus isn't realtime-tracked.
  useEffect(() => {
    if (!line) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/translink/vehicles', { cache: 'no-store' })
        if (!res.ok) return
        const body = (await res.json()) as { vehicles: LiveVehicle[] }
        if (cancelled) return
        const match = body.vehicles.some(
          (v) =>
            v.line.toUpperCase() === line.toUpperCase() &&
            (dir ? matchesDirection(v.destination, dir) : true)
        )
        setHasLive(match)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [line, dir])

  const mapHref =
    `/live/map?line=${encodeURIComponent(line)}` +
    (dir ? `&dir=${dir}` : '') +
    (fromStopId ? `&from=${encodeURIComponent(fromStopId)}` : '')

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/live'))}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
        >
          <Icon name="arrow_back" size={16} />
          Back
        </button>
        {hasLive && (
          <Link
            href={mapHref}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-primary text-on-primary hover:opacity-90 active:scale-95 transition-all"
          >
            <Icon name="map" size={16} filled />
            Track on map
          </Link>
        )}
      </header>

      <main className="pt-20 pb-32 px-6 max-w-2xl mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="font-headline font-extrabold text-primary text-lg">{line || '–'}</span>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              {dir === 'inbound' ? 'Inbound' : dir === 'outbound' ? 'Outbound' : 'Route'}
            </p>
            <p className="font-headline font-extrabold text-lg truncate">
              {data ? `To ${data.destination}` : 'Loading…'}
            </p>
            {!hasLive && !error && (
              <p className="text-[11px] text-outline mt-0.5">Not currently tracked live</p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-surface-container text-sm text-on-surface-variant">
            <p className="font-semibold">Could not load stops</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {!error && !data && (
          <div className="mt-6 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-surface-container animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <ol className="relative mt-6">
            {data.stops.map((s, i) => {
              const isFirst = i === 0
              const isLast = i === data.stops.length - 1
              const boarding = s.stopId === fromStopId
              return (
                <li key={`${s.stopId}-${i}`} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  {!isLast && (
                    <span
                      className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-primary/60"
                      aria-hidden
                    />
                  )}
                  <span
                    className={`relative z-10 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      boarding
                        ? 'bg-primary text-on-primary ring-4 ring-primary/20'
                        : isFirst || isLast
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-lowest border-2 border-primary/60'
                    }`}
                  >
                    {boarding ? (
                      <Icon name="directions_bus" size={14} filled />
                    ) : isLast ? (
                      <Icon name="flag" size={12} filled />
                    ) : null}
                  </span>
                  <div className="flex-1 min-w-0 pt-0.5 flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm truncate ${
                          boarding || isLast
                            ? 'font-headline font-extrabold text-on-surface'
                            : 'font-medium text-on-surface'
                        }`}
                      >
                        {s.name}
                      </p>
                      {boarding && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary mt-0.5">
                          Board here
                        </p>
                      )}
                    </div>
                    {s.time && (
                      <span className="text-xs font-semibold text-on-surface-variant tabular-nums shrink-0">
                        {formatTime(s.time)}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </main>
    </>
  )
}
