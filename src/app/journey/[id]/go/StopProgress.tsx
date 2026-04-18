'use client'

import Icon from '@/components/ui/Icon'
import type { JourneyLeg } from '@/types/translink'
import type { LiveVehicle } from '@/app/api/translink/vehicles/route'
import { haversineMeters } from '@/lib/geo'
import { formatTime } from '@/lib/time'

type Props = {
  leg: JourneyLeg
  bus: { vehicle: LiveVehicle } | null
}

type Node = {
  name: string
  time?: string
  lat?: number
  lon?: number
  kind: 'board' | 'mid' | 'alight'
}

// Live "you are here" stop tracker for an in-progress bus leg. Uses the bus's
// live position when available to pick the current/next stop; falls back to
// scheduled time otherwise. Timings are timetable scheduled times — the bus
// may be a minute or two off.
export default function StopProgress({ leg, bus }: Props) {
  const nodes: Node[] = [
    {
      kind: 'board',
      name: leg.from.name,
      time: leg.startTime,
      lat: leg.from.lat,
      lon: leg.from.lon,
    },
    ...(leg.intermediateStops ?? []).map<Node>((s) => ({
      kind: 'mid',
      name: s.name,
      time: s.scheduledTime,
      lat: s.lat,
      lon: s.lon,
    })),
    {
      kind: 'alight',
      name: leg.to.name,
      time: leg.endTime,
      lat: leg.to.lat,
      lon: leg.to.lon,
    },
  ]

  const currentIdx = resolveCurrentIdx(nodes, bus)

  return (
    <div className="mt-5 rounded-2xl bg-white/10 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-primary/80">
          Stops along the way
        </p>
        <p className="text-[10px] text-on-primary/70">
          {Math.max(0, nodes.length - 1 - currentIdx)} to go
        </p>
      </div>

      <ol className="relative mt-3 max-h-56 overflow-y-auto pr-1 scrollbar-none">
        <span className="absolute left-[11px] top-2 bottom-2 w-px bg-white/25" aria-hidden />
        {nodes.map((n, i) => {
          const passed = i < currentIdx
          const current = i === currentIdx
          return (
            <li key={`${n.name}-${i}`} className="relative flex items-center gap-3 py-1.5">
              <Marker kind={n.kind} passed={passed} current={current} />
              <span
                className={`flex-1 truncate text-xs ${
                  current
                    ? 'font-extrabold text-on-primary'
                    : passed
                      ? 'text-on-primary/50 line-through'
                      : n.kind === 'mid'
                        ? 'text-on-primary/80'
                        : 'font-bold text-on-primary'
                }`}
              >
                {n.name}
              </span>
              {n.time && (
                <span
                  className={`shrink-0 text-[10px] font-semibold tabular-nums ${
                    passed ? 'text-on-primary/40' : 'text-on-primary/80'
                  }`}
                >
                  {formatTime(n.time)}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Marker({
  kind,
  passed,
  current,
}: {
  kind: Node['kind']
  passed: boolean
  current: boolean
}) {
  if (current) {
    return (
      <span className="relative z-10 shrink-0 inline-flex items-center justify-center w-6 h-6">
        <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
        <span className="relative w-3 h-3 rounded-full bg-white ring-2 ring-on-primary/60" />
      </span>
    )
  }
  if (passed) {
    return (
      <span className="relative z-10 shrink-0 w-6 h-6 inline-flex items-center justify-center">
        <span className="w-4 h-4 rounded-full bg-white/40 inline-flex items-center justify-center">
          <Icon name="check" size={10} className="text-primary" />
        </span>
      </span>
    )
  }
  const big = kind !== 'mid'
  return (
    <span className="relative z-10 shrink-0 w-6 h-6 inline-flex items-center justify-center">
      <span
        className={`${big ? 'w-3 h-3' : 'w-2 h-2'} rounded-full bg-white/50 ring-2 ring-white/20`}
      />
    </span>
  )
}

// Which node is the bus currently at/heading to?
// 1. If we have bus coords + stop coords: pick the stop the bus is closest to
//    — if it's the last one it's treated as "past", otherwise it's "current".
// 2. Else fall back to scheduled times vs wall clock.
function resolveCurrentIdx(nodes: Node[], bus: Props['bus']): number {
  if (bus && bus.vehicle) {
    const { lat, lon } = bus.vehicle
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (n.lat == null || n.lon == null) continue
      const d = haversineMeters(lat, lon, n.lat, n.lon)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    return bestIdx
  }

  const now = Date.now()
  let idx = 0
  for (let i = 0; i < nodes.length; i++) {
    const t = nodes[i].time ? new Date(nodes[i].time!).getTime() : NaN
    if (!Number.isNaN(t) && t <= now) idx = i
  }
  return idx
}
