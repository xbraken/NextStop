'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import type { TranslinkStop, Departure } from '@/types/translink'
import type { StopDirection } from '@/types/user'
import { matchesDirection, parseDirection } from '@/lib/direction'

const POLL_MS = 15_000

type SelectedStop = { stopId: string; stopName: string }
type DirFilter = StopDirection | null

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

  // Reset the direction filter when the user picks a different stop
  useEffect(() => {
    setDirection(presetDir)
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
            <DepartureBoard stop={stop} direction={direction} />
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

function DepartureBoard({ stop, direction }: { stop: SelectedStop; direction: DirFilter }) {
  const [departures, setDepartures] = useState<Departure[] | null>(null)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number>(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/translink/departures?stopId=${encodeURIComponent(stop.stopId)}`, {
          cache: 'no-store',
        })
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
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stop.stopId])

  const filtered = (departures ?? []).filter((d) => matchesDirection(d.destination, direction))
  const filteredEmpty = departures !== null && filtered.length === 0
  const totalLoaded = (departures ?? []).length

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline font-extrabold text-lg">Next departures</h2>
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

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((d, i) => (
            <DepartureCard key={`${d.serviceId}-${d.scheduledDeparture}-${i}`} d={d} />
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

function DepartureCard({ d }: { d: Departure }) {
  const variant = variantFor(d)
  const minsAway = minutesUntil(d.expectedDeparture || d.scheduledDeparture)
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
        <div className="text-2xl font-headline font-extrabold text-on-surface leading-none">
          {minsAway <= 0 ? 'Now' : minsAway}
        </div>
        {minsAway > 0 && (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-outline mt-1">
            min
          </div>
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

function variantFor(d: Departure) {
  if (d.status === 'Cancelled') {
    return {
      label: 'Cancelled',
      className: 'text-red-600',
      dot: 'bg-red-500',
    }
  }
  if (!d.isLive) {
    return {
      label: 'Timetable only',
      className: 'text-outline',
      dot: 'bg-outline',
    }
  }
  const driftMin = Math.round(
    (new Date(d.expectedDeparture).getTime() - new Date(d.scheduledDeparture).getTime()) / 60_000
  )
  if (driftMin >= 2) {
    return {
      label: `Live · ${driftMin} min late`,
      className: 'text-amber-600',
      dot: 'bg-amber-500',
    }
  }
  if (driftMin <= -1) {
    return {
      label: `Live · ${Math.abs(driftMin)} min early`,
      className: 'text-amber-600',
      dot: 'bg-amber-500',
    }
  }
  return {
    label: 'Live · on time',
    className: 'text-emerald-600',
    dot: 'bg-emerald-500',
  }
}

function minutesUntil(iso: string) {
  if (!iso) return 0
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000))
}
