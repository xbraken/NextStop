'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { RankedItinerary, JourneyLeg } from '@/types/translink'
import type { LiveVehicle } from '@/app/api/translink/vehicles/route'
import { haversineMeters, formatMetres } from '@/lib/geo'
import { formatTime, minutesUntil } from '@/lib/time'
import StopProgress from './StopProgress'

// Maplibre is heavy; lazy-load so the current-step card paints first.
const GoMap = dynamic(() => import('./GoMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-56 rounded-2xl bg-surface-container animate-pulse" />
  ),
})

type Pos = { lat: number; lon: number; accuracy: number | null }
type GeoState =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'ok'; pos: Pos }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }

// Average walking speed in m/s used for rough ETA estimates when we don't
// have a better signal. Close to 4.5 km/h which is Translink's convention.
const WALK_M_PER_S = 1.25

// Distance threshold (metres) that counts as "arrived" at a waypoint.
// Tuned against real GPS noise in built-up areas — tighter than this and
// we miss arrivals on a bad fix, looser and we skip steps too eagerly.
const ARRIVE_METRES = 25

interface Props {
  journey: RankedItinerary
  backHref: string
}

export default function GoMode({ journey, backHref }: Props) {
  const legs = journey.legs
  const [legIdx, setLegIdx] = useState(0)
  const [geo, setGeo] = useState<GeoState>({ kind: 'idle' })
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [vehicles, setVehicles] = useState<LiveVehicle[] | null>(null)

  // Watch position. We request a high-accuracy stream because progress
  // detection breaks with noisy fixes.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeo({ kind: 'error', message: 'Location not supported' })
      return
    }
    setGeo({ kind: 'asking' })
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGeo({
          kind: 'ok',
          pos: { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy },
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeo({ kind: 'denied' })
        else setGeo({ kind: 'error', message: err.message })
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Poll live bus feed while there's still an upcoming bus leg. Pauses once
  // the user is past the last bus leg to save battery.
  const needsBuses = useMemo(
    () => legs.slice(legIdx).some((l) => l.mode !== 'WALK'),
    [legs, legIdx]
  )
  useEffect(() => {
    if (!needsBuses) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/translink/vehicles')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setVehicles(data.vehicles ?? [])
      } catch {
        // network blip — try again on next tick
      }
    }
    load()
    const id = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [needsBuses])

  // Auto-advance when the user reaches the end of the current leg's target.
  // For walk legs the target is the end coordinate; for bus legs it's the
  // boarding stop until boarded (implicitly — we advance when geo says the
  // user is near `leg.to` AFTER the scheduled departure), else the alight stop.
  useEffect(() => {
    if (!autoAdvance) return
    if (geo.kind !== 'ok') return
    const leg = legs[legIdx]
    if (!leg) return
    const target = leg.to
    if (!target.lat && !target.lon) return
    const d = haversineMeters(geo.pos.lat, geo.pos.lon, target.lat, target.lon)
    if (d <= ARRIVE_METRES && legIdx < legs.length - 1) {
      setLegIdx((i) => i + 1)
    }
  }, [geo, legIdx, legs, autoAdvance])

  const currentLeg = legs[legIdx]
  const nextLeg = legs[legIdx + 1]
  const isLast = legIdx >= legs.length - 1

  const pos = geo.kind === 'ok' ? geo.pos : null
  const distToLegStart = pos ? haversineMeters(pos.lat, pos.lon, currentLeg.from.lat, currentLeg.from.lon) : null
  const distToLegEnd = pos ? haversineMeters(pos.lat, pos.lon, currentLeg.to.lat, currentLeg.to.lon) : null

  // Find the bus vehicle for the active bus leg (closest one on the matching
  // service line). Lifted here so both the map and the step card can use it.
  const activeBus = useMemo(() => {
    if (!vehicles || !currentLeg || currentLeg.mode === 'WALK' || !currentLeg.routeId) return null
    const onLine = vehicles.filter(
      (v) => v.line.toLowerCase() === String(currentLeg.routeId).toLowerCase()
    )
    if (onLine.length === 0) return null
    let best: LiveVehicle | null = null
    let bestD = Infinity
    for (const v of onLine) {
      const d = haversineMeters(v.lat, v.lon, currentLeg.from.lat, currentLeg.from.lon)
      if (d < bestD) {
        bestD = d
        best = v
      }
    }
    return best ? { vehicle: best, distance: bestD } : null
  }, [vehicles, currentLeg])

  const progressPct = useMemo(() => {
    const done = legIdx
    const within = (() => {
      if (!pos || !currentLeg) return 0
      const total =
        haversineMeters(
          currentLeg.from.lat, currentLeg.from.lon,
          currentLeg.to.lat, currentLeg.to.lon
        ) || 1
      const remaining = distToLegEnd ?? total
      return Math.max(0, Math.min(1, 1 - remaining / total))
    })()
    return Math.round(((done + within) / legs.length) * 100)
  }, [legIdx, legs.length, pos, currentLeg, distToLegEnd])

  return (
    <div className="min-h-screen bg-surface pb-40">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3 max-w-2xl mx-auto">
        <Link
          href={backHref}
          className="flex items-center gap-1 px-3 py-2 rounded-full bg-surface-container-low text-on-surface active:scale-95 transition-all"
        >
          <Icon name="close" size={18} />
          <span className="text-sm font-bold">Exit</span>
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Arriving
          </p>
          <p className="text-sm font-headline font-extrabold text-on-surface">
            {formatTime(legs[legs.length - 1].endTime) || '—'}
          </p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-5 max-w-2xl mx-auto">
        <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mt-1.5">
          <span>Step {legIdx + 1} of {legs.length}</span>
          <span>{progressPct}%</span>
        </div>
      </div>

      {/* Geo status banner */}
      {(geo.kind === 'denied' || geo.kind === 'error') && (
        <div className="mx-5 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium flex items-start gap-2 max-w-2xl lg:mx-auto">
          <Icon name="location_off" size={16} />
          <div>
            <p className="font-bold">Location unavailable</p>
            <p className="opacity-80">
              Steps won&apos;t auto-advance. Use the button below to move on when ready.
            </p>
          </div>
        </div>
      )}

      {/* Map + current step */}
      <section className="px-5 pt-5 max-w-2xl mx-auto">
        <div className="mb-5">
          <GoMap
            legs={legs}
            legIdx={legIdx}
            userPos={pos ? { lat: pos.lat, lon: pos.lon } : null}
            bus={
              activeBus
                ? {
                    lat: activeBus.vehicle.lat,
                    lon: activeBus.vehicle.lon,
                    bearing: activeBus.vehicle.bearing,
                  }
                : null
            }
          />
        </div>
        <CurrentStep
          leg={currentLeg}
          distToStart={distToLegStart}
          distToEnd={distToLegEnd}
          hasPos={!!pos}
          activeBus={activeBus}
          legIdx={legIdx}
        />

        {nextLeg && <NextUp leg={nextLeg} />}

        {isLast && <ArrivedSoon leg={currentLeg} />}
      </section>

      {/* Bottom action strip — fixed so it doesn't fight any scroll container
          and sits above the map/card regardless of viewport height. */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-4 bg-gradient-to-t from-surface via-surface/95 to-transparent z-40">
        <div className="max-w-2xl mx-auto">
        {isLast ? (
          <Link
            href={backHref}
            className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold py-5 rounded-full shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform text-lg"
          >
            <Icon name="check_circle" filled size={22} className="text-on-primary" />
            Done
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAutoAdvance((a) => !a)}
              className={`px-4 py-5 rounded-full font-bold text-xs flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                autoAdvance
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
              aria-label="Toggle auto-advance"
            >
              <Icon name={autoAdvance ? 'gps_fixed' : 'gps_off'} size={18} />
              <span className="text-[10px] uppercase tracking-wider">
                {autoAdvance ? 'Auto' : 'Manual'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLegIdx((i) => Math.min(i + 1, legs.length - 1))}
              className="flex-1 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold py-5 rounded-full shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform text-lg"
            >
              Next step
              <Icon name="arrow_forward" size={22} className="text-on-primary" />
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

function CurrentStep({
  leg,
  distToStart,
  distToEnd,
  hasPos,
  activeBus,
  legIdx,
}: {
  leg: JourneyLeg
  distToStart: number | null
  distToEnd: number | null
  hasPos: boolean
  activeBus: { vehicle: LiveVehicle; distance: number } | null
  legIdx: number
}) {
  if (leg.mode === 'WALK') {
    const etaMins = distToEnd != null ? Math.max(1, Math.round(distToEnd / WALK_M_PER_S / 60)) : null
    return (
      <section className="rounded-3xl bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 shadow-[0_8px_32px_rgba(26,28,28,0.05)] border border-outline-variant/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
          Now
        </p>
        <div className="flex items-start gap-4 mt-2">
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon name="directions_walk" filled size={26} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-headline font-extrabold leading-tight">
              Walk to {leg.to.name}
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              {leg.distance ? `About ${leg.distance}m` : `${Math.round(leg.duration / 60)} min walk`}
            </p>
          </div>
        </div>

        {hasPos && distToEnd != null && (
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Distance
              </p>
              <p className="text-4xl font-headline font-black text-on-surface leading-none">
                {formatMetres(distToEnd)}
              </p>
            </div>
            {etaMins != null && (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Approx
                </p>
                <p className="text-lg font-headline font-extrabold text-primary">
                  {etaMins} min
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  // Bus / rail leg. Two substates:
  //   1. Not yet at the boarding stop — show walking distance to the stop
  //      and the scheduled departure time.
  //   2. At/past the boarding stop — show ride info (alight stop, duration).
  // We show both blocks; the "heading to stop" block collapses when the user
  // is within 40m of the boarding stop.
  const atStop = distToStart != null && distToStart <= 40
  const minsToDepart = minutesUntil(leg.startTime)

  return (
    <section className="rounded-3xl bg-gradient-to-br from-primary to-primary-container text-on-primary p-6 shadow-[0_12px_40px_rgba(0,101,101,0.25)]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-primary/70">
          {atStop ? 'Board' : `Head to stop ${legIdx + 1}`}
        </p>
        <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold tracking-wide">
          {leg.routeId}
        </span>
      </div>

      <h2 className="text-3xl font-headline font-black leading-tight mt-2">
        {atStop ? `Board ${leg.routeId}` : leg.from.name}
      </h2>
      {leg.headsign && (
        <p className="text-sm text-on-primary/80 mt-1">Toward {leg.headsign}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        {!atStop && distToStart != null && (
          <Stat label="To stop" value={formatMetres(distToStart)} />
        )}
        <Stat
          label="Departs"
          value={formatTime(leg.startTime) || '—'}
          sub={minsToDepart <= 0 ? 'Now' : `in ${minsToDepart} min`}
        />
        {atStop && (
          <Stat label="Get off at" value={leg.to.name || '—'} />
        )}
        {activeBus && (
          <Stat
            label="Bus is"
            value={formatMetres(activeBus.distance) + ' away'}
            sub={
              activeBus.vehicle.delay
                ? `${Math.round(activeBus.vehicle.delay / 60)} min ${
                    activeBus.vehicle.delay > 0 ? 'late' : 'early'
                  }`
                : 'On time'
            }
          />
        )}
      </div>

      {atStop && (leg.intermediateStops?.length ?? 0) > 0 && (
        <StopProgress leg={leg} bus={activeBus} />
      )}
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/10 rounded-2xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-primary/70">
        {label}
      </p>
      <p className="text-lg font-headline font-extrabold truncate">{value}</p>
      {sub && <p className="text-[11px] font-semibold text-on-primary/80 mt-0.5">{sub}</p>}
    </div>
  )
}

function NextUp({ leg }: { leg: JourneyLeg }) {
  const icon =
    leg.mode === 'WALK' ? 'directions_walk' :
    leg.mode === 'RAIL' ? 'directions_railway' :
    'directions_bus'
  const title =
    leg.mode === 'WALK' ? `Walk to ${leg.to.name}` :
    `Take ${leg.routeId} to ${leg.to.name}`
  return (
    <div className="mt-5 flex items-center gap-3 p-4 rounded-2xl bg-surface-container-low">
      <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
        <Icon name={icon} size={20} className="text-on-surface-variant" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Up next
        </p>
        <p className="text-sm font-headline font-bold truncate">{title}</p>
      </div>
    </div>
  )
}

function ArrivedSoon({ leg }: { leg: JourneyLeg }) {
  return (
    <div className="mt-5 p-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-center">
      <Icon name="flag" filled size={22} className="text-primary mb-1" />
      <p className="font-headline font-extrabold text-primary">
        Final stop: {leg.to.name}
      </p>
      <p className="text-xs text-on-surface-variant mt-0.5">
        {formatTime(leg.endTime) || ''}
      </p>
    </div>
  )
}
