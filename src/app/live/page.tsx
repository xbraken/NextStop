'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import ScrollPicker from '@/components/ui/ScrollPicker'
import type { TranslinkStop, Departure } from '@/types/translink'
import type { StopDirection } from '@/types/user'
import { matchesDirection, parseDirection } from '@/lib/direction'
import { formatTime, minutesUntil } from '@/lib/time'
import { variantFor } from '@/lib/departure'

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

function tomorrowISODate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatTimeMode(mode: TimeMode) {
  if (mode.kind === 'now') return 'Now'
  const label = mode.date === todayISODate()
    ? 'Today'
    : mode.date === tomorrowISODate()
      ? 'Tomorrow'
      : new Date(mode.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${label} · ${mode.time}`
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

  const [stop, setStop] = useState<SelectedStop | null>(
    presetId ? { stopId: presetId, stopName: presetName ?? presetId } : null
  )
  const [direction, setDirection] = useState<DirFilter>(presetDir)
  const [timeMode, setTimeMode] = useState<TimeMode>({ kind: 'now' })

  // Reset the direction filter when the user picks a different stop
  useEffect(() => {
    setDirection(presetDir)
    setTimeMode({ kind: 'now' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop?.stopId])

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Icon name="sensors" size={22} className="text-primary" filled />
          <h1 className="font-headline font-bold text-xl text-primary">Live Departures</h1>
        </div>
        <Link
          href="/live/map"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
        >
          <Icon name="map" size={16} filled />
          Map
        </Link>
      </header>

      <main className="pt-20 pb-32 px-6 max-w-2xl mx-auto">
        <StopPicker selected={stop} onSelect={setStop} onClear={() => setStop(null)} />
        {stop && (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <DirectionToggle value={direction} onChange={setDirection} />
              <SaveStopButton stop={stop} direction={direction} />
            </div>
            <TimePicker value={timeMode} onChange={setTimeMode} />
            <DepartureBoard stop={stop} direction={direction} timeMode={timeMode} />
          </>
        )}
        {!stop && (
          <div className="mt-10 text-center text-on-surface-variant">
            <Icon name="pin_drop" size={48} className="mb-4 opacity-40" />
            <p className="font-headline font-bold">Pick a stop</p>
            <p className="text-sm mt-1">Search for a stop to see live arrivals</p>
          </div>
        )}
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

function SaveStopButton({ stop, direction }: { stop: SelectedStop; direction: DirFilter }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'duplicate' | 'error'>('idle')

  // Reset when the stop OR direction changes (each direction variant is its own saved entry)
  useEffect(() => {
    setState('idle')
  }, [stop.stopId, direction])

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
      }),
    })
    if (res.status === 401) return setState('error')
    if (res.status === 409) return setState('duplicate')
    if (!res.ok) return setState('error')
    setState('saved')
  }

  const defaultText =
    direction === 'inbound' ? 'Save inbound' :
    direction === 'outbound' ? 'Save outbound' :
    'Save this stop'

  const { icon, text, disabled } = (() => {
    switch (state) {
      case 'saving': return { icon: 'hourglass_empty', text: 'Saving…', disabled: true }
      case 'saved': return { icon: 'check_circle', text: 'Saved', disabled: true }
      case 'duplicate': return { icon: 'bookmark', text: 'Already saved', disabled: true }
      case 'error': return { icon: 'error', text: 'Sign in to save', disabled: true }
      default: return { icon: 'bookmark_add', text: defaultText, disabled: false }
    }
  })()

  return (
    <button
      type="button"
      onClick={save}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold active:scale-95 transition-all disabled:opacity-70"
    >
      <Icon name={icon} size={18} filled={state === 'saved'} />
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
  const [open, setOpen] = useState(false)
  const isFuture = value.kind === 'at'

  // The day + time the user has dialled in but not yet committed.
  // Starts from current selection, or today + a sensible default time.
  const initial = (() => {
    if (value.kind === 'at') {
      const [hh = '09', mm = '00'] = value.time.split(':')
      return { date: value.date, hour: parseInt(hh, 10), minute: parseInt(mm, 10) }
    }
    const now = new Date()
    // Round up to the next 5-min mark so the wheel doesn't open in the past.
    const m = (Math.floor(now.getMinutes() / 5) + 1) * 5
    const h = m >= 60 ? (now.getHours() + 1) % 24 : now.getHours()
    return { date: todayISODate(), hour: h, minute: m % 60 }
  })()
  const [pendingDay, setPendingDay] = useState(initial.date)
  const [hour, setHour] = useState(initial.hour)
  const [minute, setMinute] = useState(initial.minute)

  useEffect(() => {
    if (value.kind === 'at') {
      setPendingDay(value.date)
      const [hh = '09', mm = '00'] = value.time.split(':')
      setHour(parseInt(hh, 10))
      setMinute(parseInt(mm, 10))
    }
  }, [value])

  const days = nextNDays(7)

  function apply() {
    onChange({ kind: 'at', date: pendingDay, time: `${pad(hour)}:${pad(minute)}` })
    setOpen(false)
  }

  function reset() {
    onChange({ kind: 'now' })
    setOpen(false)
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3 rounded-xl border transition-colors ${
          isFuture
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface'
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon name={isFuture ? 'schedule' : 'bolt'} size={18} filled={isFuture} />
          <span className="font-headline font-bold text-sm">{formatTimeMode(value)}</span>
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold opacity-80">
          {isFuture && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                reset()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  reset()
                }
              }}
              className="px-2 py-1 rounded-full hover:bg-primary/15 active:scale-95 cursor-pointer"
            >
              Now
            </span>
          )}
          <Icon name={open ? 'expand_less' : 'expand_more'} size={18} />
        </span>
      </button>

      {open && (
        <div className="mt-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-[0_8px_32px_rgba(26,28,28,0.06)] space-y-5">
          {/* Day row */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              1. Pick a day
            </p>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
              <button
                type="button"
                onClick={reset}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 min-w-[68px] py-2 px-3 rounded-2xl border-2 transition-all active:scale-95 ${
                  !isFuture
                    ? 'bg-primary text-on-primary border-primary shadow-md'
                    : 'bg-surface-container border-transparent text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <Icon name="bolt" filled size={18} />
                <span className="text-xs font-bold">Now</span>
              </button>
              {days.map((d) => {
                const active = pendingDay === d.iso && isFuture
                const selected = pendingDay === d.iso
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setPendingDay(d.iso)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 min-w-[68px] py-2 px-3 rounded-2xl border-2 transition-all active:scale-95 ${
                      active
                        ? 'bg-primary text-on-primary border-primary shadow-md'
                        : selected
                          ? 'bg-primary/10 border-primary/40 text-primary'
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

          {/* Time wheel */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              2. Spin to a time
            </p>
            <div className="flex items-center justify-center gap-1 py-1">
              <ScrollPicker
                items={HOURS}
                selectedIndex={hour}
                onChange={setHour}
              />
              <span className="text-3xl font-headline font-extrabold text-outline-variant pb-0.5">:</span>
              <ScrollPicker
                items={MINUTES_5}
                selectedIndex={Math.round(minute / 5)}
                onChange={(i) => setMinute(i * 5)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={apply}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold text-sm shadow-md active:scale-95 transition-all"
          >
            Show times for {pad(hour)}:{pad(minute)}
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
  timeMode,
}: {
  stop: SelectedStop
  direction: DirFilter
  timeMode: TimeMode
}) {
  const [departures, setDepartures] = useState<Departure[] | null>(null)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number>(0)

  const isFuture = timeMode.kind === 'at'
  const futureDate = timeMode.kind === 'at' ? timeMode.date : ''
  const futureTime = timeMode.kind === 'at' ? timeMode.time : ''

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
        setDepartures(data.departures ?? [])
        setUpdatedAt(Date.now())
        setError(false)
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

  type Tagged = { d: Departure; key: string; leaving: boolean }
  const tagged: Tagged[] = (departures ?? [])
    .filter((d) => matchesDirection(d.destination, direction))
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
              <DepartureCard d={d} showAbsolute={isFuture} />
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

function DepartureCard({ d, showAbsolute = false }: { d: Departure; showAbsolute?: boolean }) {
  const variant = variantFor(d)
  const iso = d.expectedDeparture || d.scheduledDeparture
  const minsAway = minutesUntil(iso)
  const absoluteTime = formatTime(iso)
  const trackable = !!d.serviceId
  const mapHref = `/live/map?line=${encodeURIComponent(d.serviceId)}&dest=${encodeURIComponent(d.destination)}`

  const content = (
    <>
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
        <span className="font-headline font-extrabold text-primary text-lg">
          {d.serviceId || '–'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-headline font-bold truncate">{d.destination || 'Unknown destination'}</p>
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
            <div className="text-2xl font-headline font-extrabold text-on-surface leading-none">
              {minsAway <= 0 ? 'Now' : minsAway}
            </div>
            {minsAway > 0 && (
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
        {trackable && (
          <div className="mt-2 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Icon name="map" size={12} />
            Track
          </div>
        )}
      </div>
    </>
  )

  const baseClass =
    'bg-surface-container-lowest rounded-xl p-4 shadow-[0_8px_32px_rgba(26,28,28,0.04)] flex items-center gap-4'

  if (trackable) {
    return (
      <Link href={mapHref} className={`${baseClass} hover:bg-surface-container-low active:scale-[0.99] transition-all`}>
        {content}
      </Link>
    )
  }
  return <div className={baseClass}>{content}</div>
}


