'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import ScrollPicker from '@/components/ui/ScrollPicker'
import type { TranslinkStop, Departure } from '@/types/translink'
import type { StopDirection } from '@/types/user'
import { matchesDirection, parseDirection, isInbound } from '@/lib/direction'
import { formatTime, minutesUntil } from '@/lib/time'
import { variantFor } from '@/lib/departure'
import { parseRoutes } from '@/lib/routes'
import RouteFilter from '@/components/live/RouteFilter'
import NearbyStops from '@/components/live/NearbyStops'

const POLL_MS = 15_000
const POLL_MS_FUTURE = 60_000

type SelectedStop = { stopId: string; stopName: string }
type DirFilter = StopDirection | null
// null = "Leave now" (live). A string is an ISO-like local value: the exact
// future moment the user wants to preview.
type TimeMode = { kind: 'now' } | { kind: 'at'; date: string; time: string }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayISODate() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Build the next N days starting from today — used by the day-chip row.
// First two are labelled "Today" / "Tomorrow" because those phrase
// naturally; after that we use the short weekday ("Wed", "Thu").
function nextNDays(n: number) {
  const out: Array<{ iso: string; label: string; day: string }> = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const short = d.toLocaleDateString('en-GB', { weekday: 'short' })
    out.push({
      iso,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : short,
      day: String(d.getDate()),
    })
  }
  return out
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => pad(i * 5))


export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <LivePageInner />
    </Suspense>
  )
}

function LivePageInner() {
  const params = useSearchParams()
  const presetId = params.get('stop')
  const presetName = params.get('name')
  const presetDir = parseDirection(params.get('dir'))
  const presetRoutesRaw = params.get('routes') ?? ''
  const presetRoutes = parseRoutes(presetRoutesRaw)

  const [stop, setStop] = useState<SelectedStop | null>(
    presetId ? { stopId: presetId, stopName: presetName ?? presetId } : null
  )
  const [direction, setDirection] = useState<DirFilter>(presetDir)
  // Selected routes to filter by. Empty array = "All".
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(presetRoutes)
  // Running list of route IDs seen in the current stop's departures, so the
  // chip row keeps offering them even if a poll returns a subset.
  const [knownRoutes, setKnownRoutes] = useState<string[]>(presetRoutes)
  const [timeMode, setTimeMode] = useState<TimeMode>({ kind: 'now' })

  // Keep the stop in sync with the URL — navigating between saved stops on the
  // same /live route reuses this component instance, so we must mirror params
  // back into state rather than relying on useState initialisers.
  useEffect(() => {
    if (!presetId) {
      setStop(null)
      return
    }
    setStop((prev) =>
      prev && prev.stopId === presetId && prev.stopName === (presetName ?? presetId)
        ? prev
        : { stopId: presetId, stopName: presetName ?? presetId }
    )
  }, [presetId, presetName])

  // Reset filters when any of the preset inputs change (stop id, direction, or
  // route filter from the URL). Depending on the serialised routes string
  // avoids an infinite loop from the fresh-array identity each render.
  useEffect(() => {
    setDirection(presetDir)
    setSelectedRoutes(parseRoutes(presetRoutesRaw))
    setKnownRoutes(parseRoutes(presetRoutesRaw))
    setTimeMode({ kind: 'now' })
  }, [presetId, presetDir, presetRoutesRaw])

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-2 min-w-0">
          {stop && (
            <button
              type="button"
              onClick={() => setStop(null)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
              aria-label="Back to stops"
            >
              <Icon name="arrow_back" size={16} />
              Back
            </button>
          )}
          {!stop && (
            <>
              <Icon name="sensors" size={22} className="text-primary" filled />
              <h1 className="font-headline font-bold text-xl text-primary truncate">Live</h1>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {stop && <SaveStopButton stop={stop} direction={direction} routes={selectedRoutes} />}
          <Link
            href="/live/map"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
          >
            <Icon name="map" size={16} filled />
            Map
          </Link>
        </div>
      </header>

      <main className="pt-20 pb-32 px-6 max-w-2xl mx-auto">
        <StopPicker selected={stop} onSelect={setStop} onClear={() => setStop(null)} />
        {stop && (
          <>
            <div className="mt-4">
              <DirectionToggle value={direction} onChange={setDirection} />
            </div>
            <RouteFilter
              known={knownRoutes}
              selected={selectedRoutes}
              onChange={setSelectedRoutes}
            />
            <TimePicker value={timeMode} onChange={setTimeMode} />
            <DepartureBoard
              stop={stop}
              direction={direction}
              routes={selectedRoutes}
              timeMode={timeMode}
              onRoutesSeen={(ids) => {
                setKnownRoutes((prev) => {
                  const merged = new Set(prev)
                  ids.forEach((id) => merged.add(id))
                  return Array.from(merged)
                })
              }}
            />
          </>
        )}
        {!stop && <NearbyStops onSelect={setStop} />}
      </main>
    </>
  )
}

function DirectionToggle({
  value,
  onChange,
}: {
  value: DirFilter
  onChange: (v: DirFilter) => void
}) {
  const opts: { label: string; value: DirFilter }[] = [
    { label: 'All', value: null },
    { label: 'Inbound', value: 'inbound' },
    { label: 'Outbound', value: 'outbound' },
  ]
  return (
    <div className="inline-flex p-1 bg-surface-container-low rounded-full text-xs font-semibold">
      {opts.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-full transition-colors ${
              active
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SaveStopButton({
  stop,
  direction,
  routes,
}: {
  stop: SelectedStop
  direction: DirFilter
  routes: string[]
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'duplicate' | 'error'>('idle')
  const routeSig = [...routes].sort().join(',')

  // Reset when stop, direction, or route filter changes (each combo is its own saved entry)
  useEffect(() => {
    setState('idle')
  }, [stop.stopId, direction, routeSig])

  async function save() {
    setState('saving')
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'stop',
        label: stop.stopName,
        stop_name: stop.stopName,
        stop_id: stop.stopId,
        direction,
        routes,
      }),
    })
    if (res.status === 401) return setState('error')
    if (res.status === 409) return setState('duplicate')
    if (!res.ok) return setState('error')
    setState('saved')
  }

  const { icon, text, disabled } = (() => {
    switch (state) {
      case 'saving': return { icon: 'hourglass_empty', text: 'Saving…', disabled: true }
      case 'saved': return { icon: 'check_circle', text: 'Saved', disabled: true }
      case 'duplicate': return { icon: 'bookmark', text: 'Saved', disabled: true }
      case 'error': return { icon: 'error', text: 'Sign in', disabled: true }
      default: return { icon: 'bookmark_add', text: 'Save', disabled: false }
    }
  })()

  return (
    <button
      type="button"
      onClick={save}
      disabled={disabled}
      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-70"
    >
      <Icon name={icon} size={16} filled={state === 'saved'} />
      {text}
    </button>
  )
}

// ---------------- Time picker ----------------

function TimePicker({
  value,
  onChange,
}: {
  value: TimeMode
  onChange: (m: TimeMode) => void
}) {
  const isFuture = value.kind === 'at'
  const today = todayISODate()

  // Pending day/time — initialised from value or "today + next 5 min mark".
  const initial = (() => {
    if (value.kind === 'at') {
      const [hh = '09', mm = '00'] = value.time.split(':')
      return { date: value.date, hour: parseInt(hh, 10), minute: parseInt(mm, 10) }
    }
    // Default to 06:00 — most future planning is for an early-morning
    // journey, so opening the wheel at midday feels arbitrary.
    return { date: today, hour: 6, minute: 0 }
  })()
  const [pendingDay, setPendingDay] = useState(initial.date)
  const [hour, setHour] = useState(initial.hour)
  const [minute, setMinute] = useState(initial.minute)
  // Time panel is hidden by default so the common "now" flow is a single tap.
  const [timeOpen, setTimeOpen] = useState(value.kind === 'at')

  useEffect(() => {
    if (value.kind === 'at') {
      setPendingDay(value.date)
      const [hh = '09', mm = '00'] = value.time.split(':')
      setHour(parseInt(hh, 10))
      setMinute(parseInt(mm, 10))
    }
  }, [value])

  const days = nextNDays(7)
  // "Today" is selected whenever we're in now-mode OR in at-mode on today.
  const selectedDay = isFuture ? pendingDay : today
  // Whole panel collapses to a small chip by default — departures take focus.
  const [panelOpen, setPanelOpen] = useState(value.kind === 'at')

  function pickDay(iso: string) {
    setPendingDay(iso)
    if (iso === today) {
      // Today = live/now. Tapping it always snaps back to live and hides
      // the time wheel so the UI stays minimal.
      onChange({ kind: 'now' })
      setTimeOpen(false)
    } else {
      onChange({ kind: 'at', date: iso, time: `${pad(hour)}:${pad(minute)}` })
    }
  }

  function apply() {
    onChange({ kind: 'at', date: pendingDay, time: `${pad(hour)}:${pad(minute)}` })
  }

  // Collapsed state: small chip summarising current mode, nothing else.
  if (!panelOpen) {
    const label = value.kind === 'now'
      ? 'Leaving now'
      : `${value.date === today ? 'Today' : (days.find((d) => d.iso === value.date)?.label ?? value.date)} · ${value.time}`
    return (
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-xs font-semibold text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
      >
        <Icon name="schedule" size={14} />
        {label}
        <Icon name="expand_more" size={14} />
      </button>
    )
  }

  return (
    <div className="mt-4 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-[0_8px_32px_rgba(26,28,28,0.06)] space-y-4">
      {/* Day row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Pick a day
          </p>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="text-[11px] font-semibold text-on-surface-variant hover:text-on-surface"
          >
            Done
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
          {days.map((d) => {
            const active = selectedDay === d.iso
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => pickDay(d.iso)}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 min-w-[68px] py-2 px-3 rounded-2xl border-2 transition-all active:scale-95 ${
                  active
                    ? 'bg-primary text-on-primary border-primary shadow-md'
                    : 'bg-surface-container border-transparent text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">{d.label}</span>
                <span className={`text-lg font-headline font-extrabold leading-none ${
                  active ? '' : 'text-on-surface-variant'
                }`}>
                  {d.day}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Time — tucked behind a link so the default UI is just day chips */}
      {!timeOpen ? (
        <button
          type="button"
          onClick={() => setTimeOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-primary hover:bg-primary/5 rounded-xl active:scale-[0.99] transition-all"
        >
          <Icon name="schedule" size={16} />
          Pick a specific time
        </button>
      ) : (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Pick a time
            </p>
            <button
              type="button"
              onClick={() => {
                setTimeOpen(false)
                // Collapsing the time wheel on today = back to live.
                if (pendingDay === today) onChange({ kind: 'now' })
              }}
              className="text-[11px] font-semibold text-on-surface-variant hover:text-on-surface"
            >
              Hide
            </button>
          </div>
          <div className="flex items-center justify-center gap-1 py-1">
            <ScrollPicker items={HOURS} selectedIndex={hour} onChange={setHour} />
            <span className="text-3xl font-headline font-extrabold text-outline-variant pb-0.5">:</span>
            <ScrollPicker
              items={MINUTES_5}
              selectedIndex={Math.round(minute / 5)}
              onChange={(i) => setMinute(i * 5)}
            />
          </div>
          <button
            type="button"
            onClick={apply}
            aria-label={`Show times for ${pad(hour)}:${pad(minute)} on ${days.find((d) => d.iso === pendingDay)?.label ?? pendingDay}`}
            className="group relative w-full flex items-stretch rounded-2xl bg-primary text-on-primary shadow-md active:scale-[0.98] transition-all overflow-hidden"
          >
            <span className="absolute top-1/2 -translate-y-1/2 -left-2 w-4 h-4 rounded-full bg-surface-container-lowest" aria-hidden />
            <span className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 rounded-full bg-surface-container-lowest" aria-hidden />
            <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
              <Icon name="confirmation_number" size={26} filled />
              <div className="text-left min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  Show buses
                </p>
                <p className="font-headline font-extrabold text-base truncate">
                  {days.find((d) => d.iso === pendingDay)?.label ?? pendingDay} · {pad(hour)}:{pad(minute)}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center px-4 border-l-2 border-dashed border-on-primary/30">
              <Icon name="arrow_forward" size={20} />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------- Stop picker ----------------

function StopPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: SelectedStop | null
  onSelect: (s: SelectedStop) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TranslinkStop[]>([])
  const [focused, setFocused] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (selected || query.length < 2) {
      setResults([])
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/translink/stops?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        })
        const data = await res.json()
        setResults((data.stops ?? []).slice(0, 8))
      } catch {
        // ignore
      }
    }, 250)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [query, selected])

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-surface-container-lowest rounded-xl p-4 shadow-[0_8px_32px_rgba(26,28,28,0.04)]">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Icon name="directions_bus" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Stop</p>
          <p className="font-headline font-bold truncate">{selected.stopName}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
          aria-label="Change stop"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl p-4 shadow-[0_8px_32px_rgba(26,28,28,0.04)]">
        <Icon name="search" size={20} className="text-outline" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search a stop…"
          className="flex-1 bg-transparent outline-none font-body placeholder:text-outline"
        />
      </div>

      {focused && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/20 overflow-hidden z-20">
          {results.map((s) => (
            <button
              key={s.stopId}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault()
                onSelect({ stopId: s.stopId, stopName: s.stopName })
                setQuery('')
                setResults([])
                setFocused(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low active:bg-surface-container transition-colors text-left"
            >
              <Icon name="directions_bus" size={18} className="text-primary" />
              <span className="flex-1 truncate font-medium">{s.stopName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------- Departure board ----------------

function DepartureBoard({
  stop,
  direction,
  routes,
  timeMode,
  onRoutesSeen,
}: {
  stop: SelectedStop
  direction: DirFilter
  routes: string[]
  timeMode: TimeMode
  onRoutesSeen: (ids: string[]) => void
}) {
  const [departures, setDepartures] = useState<Departure[] | null>(null)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number>(0)

  const isFuture = timeMode.kind === 'at'
  const futureDate = timeMode.kind === 'at' ? timeMode.date : ''
  const futureTime = timeMode.kind === 'at' ? timeMode.time : ''

  // Keep the callback in a ref so it doesn't retrigger the polling effect.
  const onRoutesSeenRef = useRef(onRoutesSeen)
  useEffect(() => {
    onRoutesSeenRef.current = onRoutesSeen
  }, [onRoutesSeen])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const qs = new URLSearchParams({ stopId: stop.stopId })
        if (isFuture) {
          qs.set('date', futureDate)
          qs.set('time', futureTime)
        }
        const res = await fetch(`/api/translink/departures?${qs.toString()}`)
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (cancelled) return
        const list: Departure[] = data.departures ?? []
        setDepartures(list)
        setUpdatedAt(Date.now())
        setError(false)
        const ids = Array.from(
          new Set(list.map((d) => d.serviceId).filter((id): id is string => !!id))
        )
        if (ids.length > 0) onRoutesSeenRef.current(ids)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    setDepartures(null)
    load()
    const id = setInterval(load, isFuture ? POLL_MS_FUTURE : POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stop.stopId, isFuture, futureDate, futureTime])

  // Re-render every 5s so cards transition to "leaving" the moment their
  // departure time slips into the past.
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (isFuture) return
    const id = setInterval(() => forceTick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [isFuture])

  const routeSet = routes.length > 0 ? new Set(routes) : null
  type Tagged = { d: Departure; key: string; leaving: boolean }
  const tagged: Tagged[] = (departures ?? [])
    .filter((d) => matchesDirection(d.destination, direction))
    .filter((d) => !routeSet || (d.serviceId && routeSet.has(d.serviceId)))
    .map((d, i) => {
      const key = `${d.serviceId}|${d.scheduledDeparture}|${d.destination}|${i}`
      if (isFuture) return { d, key, leaving: false }
      const iso = d.expectedDeparture || d.scheduledDeparture
      if (!iso) return { d, key, leaving: false }
      const t = new Date(iso).getTime()
      if (Number.isNaN(t)) return { d, key, leaving: false }
      // Bus is "gone" 30s past its departure time. The pop-out animation
      // takes ~0.55s; the card stays in the DOM until the next poll prunes it.
      return { d, key, leaving: t <= Date.now() - 30_000 }
    })

  const filteredEmpty = departures !== null && tagged.length === 0
  const totalLoaded = (departures ?? []).length

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline font-extrabold text-lg">
          {isFuture ? 'Scheduled departures' : 'Next departures'}
        </h2>
        <UpdatedIndicator updatedAt={updatedAt} error={error} />
      </div>

      {departures === null && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      )}

      {filteredEmpty && (
        <div className="text-center py-10 text-on-surface-variant">
          {totalLoaded === 0 ? (
            <p className="font-medium">No departures in the next couple of hours</p>
          ) : routes.length > 0 ? (
            <p className="font-medium">
              Nothing on {routes.join(', ')} right now — {totalLoaded} other departure
              {totalLoaded === 1 ? '' : 's'} matching
            </p>
          ) : (
            <p className="font-medium">
              No {direction} departures right now — {totalLoaded} going the other way
            </p>
          )}
        </div>
      )}

      {tagged.length > 0 && (
        <div className="flex flex-col gap-3">
          {tagged.map(({ d, key, leaving }) => (
            <div key={key} className={leaving ? 'animate-pop-out' : ''}>
              <DepartureCard d={d} showAbsolute={isFuture} showDirection={!direction} originStopId={stop.stopId} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function UpdatedIndicator({ updatedAt, error }: { updatedAt: number; error: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (error) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
        <Icon name="error" size={14} />
        Update failed
      </span>
    )
  }
  if (!updatedAt) return null
  const secs = Math.round((now - updatedAt) / 1000)
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-outline">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Updated {secs}s ago
    </span>
  )
}

function DepartureCard({
  d,
  showAbsolute = false,
  showDirection = false,
  originStopId,
}: {
  d: Departure
  showAbsolute?: boolean
  showDirection?: boolean
  originStopId?: string
}) {
  const variant = variantFor(d)
  const iso = d.expectedDeparture || d.scheduledDeparture
  const minsAway = minutesUntil(iso)
  const absoluteTime = formatTime(iso)
  const hasService = !!d.serviceId
  const inbound = isInbound(d.destination)
  const dir = inbound ? 'inbound' : 'outbound'
  // Now links to the trip stop-list view first — tracking is a secondary
  // action on that page, since many buses aren't realtime-tracked.
  const tripHref =
    `/live/trip?line=${encodeURIComponent(d.serviceId)}` +
    `&dir=${dir}` +
    (originStopId ? `&from=${encodeURIComponent(originStopId)}` : '')

  const content = (
    <>
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
        <span className="font-headline font-extrabold text-primary text-lg">
          {d.serviceId || '–'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {showDirection && (
            <span
              className={`shrink-0 inline-flex ${inbound ? 'text-primary' : 'text-on-surface-variant'}`}
              aria-label={inbound ? 'inbound' : 'outbound'}
              title={inbound ? 'Inbound' : 'Outbound'}
            >
              <Icon name={inbound ? 'south_west' : 'north_east'} size={14} />
            </span>
          )}
          <p className="font-headline font-bold truncate">{d.destination || 'Unknown destination'}</p>
        </div>
        <div className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${variant.className}`}>
          <span className={`w-2 h-2 rounded-full ${variant.dot}`} />
          {variant.label}
        </div>
      </div>

      <div className="text-right flex flex-col items-end">
        {showAbsolute ? (
          <>
            <div className="text-2xl font-headline font-extrabold text-on-surface leading-none">
              {absoluteTime || '—'}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-outline mt-1">
              Scheduled
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-headline font-extrabold text-on-surface leading-none tabular-nums">
              {minsAway <= 0
                ? 'Now'
                : minsAway < 60
                  ? minsAway
                  : `${Math.floor(minsAway / 60)}h ${minsAway % 60}m`}
            </div>
            {minsAway > 0 && minsAway < 60 && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-outline mt-1">
                min
              </div>
            )}
            {absoluteTime && (
              <div className="text-xs font-semibold text-on-surface-variant mt-1 tabular-nums">
                {absoluteTime}
              </div>
            )}
          </>
        )}
        {hasService && (
          <div className="mt-2 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Icon name="arrow_forward" size={12} />
            Stops
          </div>
        )}
      </div>
    </>
  )

  const baseClass =
    'bg-surface-container-lowest rounded-xl p-4 shadow-[0_8px_32px_rgba(26,28,28,0.04)] flex items-center gap-4'

  if (hasService && originStopId) {
    return (
      <Link href={tripHref} className={`${baseClass} hover:bg-surface-container-low active:scale-[0.99] transition-all`}>
        {content}
      </Link>
    )
  }
  return <div className={baseClass}>{content}</div>
}


