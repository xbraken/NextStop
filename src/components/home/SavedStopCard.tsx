'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { SavedColor } from '@/lib/saved-colors'
import type { SavedDestination } from '@/types/user'
import type { Departure } from '@/types/translink'
import { matchesDirection, isInbound } from '@/lib/direction'
import { variantFor } from '@/lib/departure'
import { minutesUntil } from '@/lib/time'

const POLL_MS = 60_000

type Props = {
  stop: SavedDestination
  href: string
  defaultIcon: string
  subtitle?: string
  color?: SavedColor
}

export default function SavedStopCard({ stop, href, defaultIcon, subtitle, color }: Props) {
  const { next: nextBus, upcoming } = useNextBus(stop)

  const shown = stop.icon ?? defaultIcon
  const fallbackSubtitle = subtitle ?? (stop.direction
    ? `${stop.direction === 'inbound' ? '↓' : '↑'} ${stop.direction}`
    : 'Live arrivals')

  return (
    <div className="relative shrink-0 w-56">
      <Link
        href={href}
        className="group block p-4 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:shadow-md hover:bg-surface-container-low transition-all"
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={color ? { backgroundColor: color.bg } : undefined}
          >
            <span style={color ? { color: color.fg } : undefined} className={color ? '' : 'text-primary'}>
              <Icon name={shown} size={18} filled />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-on-surface truncate">{stop.label}</p>
            {(stop.direction || stop.routes) && (
              <div className="flex items-center gap-1 mt-0.5 min-w-0">
                {stop.direction && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                    <Icon name={stop.direction === 'inbound' ? 'south' : 'north'} size={10} />
                    {stop.direction}
                  </span>
                )}
                {stop.direction && stop.routes && (
                  <span className="shrink-0 text-[9px] text-on-surface-variant/60">·</span>
                )}
                {stop.routes && (
                  <span className="truncate text-[9px] font-bold text-on-surface-variant">
                    {stop.routes.split(',').map((r) => r.trim()).filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {nextBus ? (
          <div className="flex flex-col gap-1.5">
            <DepartureRow
              serviceId={nextBus.serviceId}
              minsAway={nextBus.minsAway}
              variant={nextBus.variant}
              inbound={nextBus.inbound}
              showDirection={!stop.direction}
              primary
            />
            {upcoming.slice(0, 1).map((u, i) => (
              <DepartureRow
                key={i}
                serviceId={u.serviceId}
                minsAway={u.minsAway}
                variant={u.variant}
                inbound={u.inbound}
                showDirection={!stop.direction}
              />
            ))}
            {upcoming.length === 0 && (
              <p className="text-[10px] text-on-surface-variant mt-0.5">No other buses scheduled</p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-on-surface-variant truncate">
            {fallbackSubtitle}
          </p>
        )}
      </Link>
    </div>
  )
}

function DepartureRow({
  serviceId,
  minsAway,
  variant,
  inbound,
  showDirection = false,
  primary = false,
}: {
  serviceId: string | null
  minsAway: number
  variant: ReturnType<typeof variantFor>
  inbound: boolean
  showDirection?: boolean
  primary?: boolean
}) {
  const label = minsAway <= 0 ? 'Now' : `${minsAway} min`
  return (
    <div className="flex items-center gap-2 min-w-0">
      {showDirection && (
        <span
          className={`shrink-0 inline-flex ${inbound ? 'text-primary' : 'text-on-surface-variant'}`}
          aria-label={inbound ? 'inbound' : 'outbound'}
          title={inbound ? 'Inbound' : 'Outbound'}
        >
          <Icon name={inbound ? 'south_west' : 'north_east'} size={12} />
        </span>
      )}
      <span
        className={`shrink-0 rounded font-extrabold leading-none text-center inline-flex items-center justify-center ${
          primary
            ? 'min-w-[2.25rem] h-6 px-1.5 bg-primary/10 text-primary text-xs'
            : 'min-w-[2rem] h-5 px-1 bg-surface-container text-on-surface-variant text-[10px]'
        }`}
      >
        {serviceId || '–'}
      </span>
      <span
        className={`truncate font-bold ${primary ? 'text-sm text-emerald-600' : `text-[11px] ${variant.className}`}`}
      >
        {label}
      </span>
    </div>
  )
}

// Fetches the next matching departure for a saved stop and keeps it fresh.
// Respects the stop's saved direction + routes filter so "inbound on the 8A"
// shows only 8A inbounds. Returns null until the first load resolves so the
// card can fall back to its static subtitle in the meantime.
type NextBus = {
  serviceId: string | null
  minsAway: number
  variant: ReturnType<typeof variantFor>
  inbound: boolean
}

function useNextBus(stop: SavedDestination): {
  next: NextBus | null
  upcoming: Array<{
    serviceId: string | null
    minsAway: number
    variant: ReturnType<typeof variantFor>
    inbound: boolean
  }>
} {
  const [departures, setDepartures] = useState<Departure[] | null>(null)
  // tick forces re-render so minutes-away counts down without a new fetch
  const [, setTick] = useState(0)

  const routesFilter = useMemo(() => {
    if (!stop.routes) return null
    const ids = stop.routes.split(',').map((r) => r.trim()).filter(Boolean)
    return ids.length > 0 ? new Set(ids) : null
  }, [stop.routes])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/translink/departures?stopId=${encodeURIComponent(stop.stop_id)}`)
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (!cancelled) setDepartures(data.departures ?? [])
      } catch {
        if (!cancelled) setDepartures([])
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stop.stop_id])

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!departures) return { next: null, upcoming: [] }

  const now = Date.now()
  const sorted = departures
    .filter((d) => matchesDirection(d.destination, stop.direction))
    .filter((d) => !routesFilter || (d.serviceId && routesFilter.has(d.serviceId)))
    .filter((d) => {
      const t = new Date(d.expectedDeparture || d.scheduledDeparture).getTime()
      return !Number.isNaN(t) && t >= now - 30_000
    })
    .sort((a, b) => {
      const at = new Date(a.expectedDeparture || a.scheduledDeparture).getTime()
      const bt = new Date(b.expectedDeparture || b.scheduledDeparture).getTime()
      return at - bt
    })

  const first = sorted[0]
  if (!first) return { next: null, upcoming: [] }

  return {
    next: {
      serviceId: first.serviceId ?? null,
      minsAway: minutesUntil(first.expectedDeparture || first.scheduledDeparture),
      variant: variantFor(first),
      inbound: isInbound(first.destination),
    },
    upcoming: sorted.slice(1, 4).map((d) => ({
      serviceId: d.serviceId ?? null,
      minsAway: minutesUntil(d.expectedDeparture || d.scheduledDeparture),
      variant: variantFor(d),
      inbound: isInbound(d.destination),
    })),
  }
}

