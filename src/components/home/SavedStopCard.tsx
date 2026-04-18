'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { SAVED_ICON_OPTIONS } from '@/lib/saved-icons'
import { getSavedColor, type SavedColor } from '@/lib/saved-colors'
import ColorPickerPopover from '@/components/saved/ColorPickerPopover'
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

export default function SavedStopCard({ stop, href, defaultIcon, subtitle, color: colorProp }: Props) {
  const [icon, setIcon] = useState<string | null>(stop.icon)
  const [colorKey, setColorKey] = useState<string | null>(stop.color)
  const [open, setOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const paletteBtnRef = useRef<HTMLButtonElement | null>(null)
  const { next: nextBus, upcoming } = useNextBus(stop)

  // Prefer live local state (after user picks a colour) over the prop from SSR.
  const color: SavedColor | undefined = colorKey === stop.color ? colorProp : getSavedColor(colorKey)

  async function pickColor(next: string | null) {
    const previous = colorKey
    setColorKey(next)
    setColorOpen(false)
    try {
      const res = await fetch(`/api/saved/${stop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      setColorKey(previous)
    }
  }

  async function pick(next: string | null) {
    const previous = icon
    setIcon(next)
    setOpen(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/saved/${stop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      setIcon(previous)
    } finally {
      setSaving(false)
    }
  }

  const shown = icon ?? defaultIcon
  const fallbackSubtitle = subtitle ?? (stop.direction
    ? `${stop.direction === 'inbound' ? '↓' : '↑'} ${stop.direction}`
    : 'Live arrivals')

  return (
    <div className="relative shrink-0 w-64">
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
            <p className="font-bold text-sm text-on-surface truncate">{stop.label}</p>
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
            {upcoming.map((u, i) => (
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

      <div className="absolute top-14 right-2 flex gap-1">
        <button
          ref={paletteBtnRef}
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setColorOpen((o) => !o)
          }}
          aria-label="Change colour"
          className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant bg-surface-container/70 backdrop-blur-sm hover:bg-surface-container-high active:scale-90 transition-all opacity-70 hover:opacity-100"
        >
          <Icon name="palette" size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          aria-label="Change icon"
          className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant bg-surface-container/70 backdrop-blur-sm hover:bg-surface-container-high active:scale-90 transition-all opacity-70 hover:opacity-100"
        >
          <Icon name={saving ? 'hourglass_empty' : 'edit'} size={14} />
        </button>
      </div>

      {open && (
        <IconPickerDialog
          label={stop.label}
          current={shown}
          onPick={pick}
          onClose={() => setOpen(false)}
        />
      )}

      {colorOpen && (
        <ColorPickerPopover
          anchorRef={paletteBtnRef}
          currentColor={colorKey}
          onPick={pickColor}
          onClose={() => setColorOpen(false)}
        />
      )}
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
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variant.dot}`} />
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

function IconPickerDialog({
  label,
  current,
  onPick,
  onClose,
}: {
  label: string
  current: string
  onPick: (name: string | null) => void
  onClose: () => void
}) {
  // Render into document.body so no ancestor's overflow/transform can clip us.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Lock body scroll while the sheet is open.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!mounted) return null

  const dialog = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full sm:w-auto sm:max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-8 sm:pb-6 animate-fade-in-up">
        <div className="mx-auto sm:hidden w-10 h-1 rounded-full bg-outline-variant/50 mb-4" />
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-headline font-extrabold text-lg">Pick an icon</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container active:scale-90 transition-all"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <p className="text-sm text-on-surface-variant mb-5 truncate">for {label}</p>

        <div className="grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
          {SAVED_ICON_OPTIONS.map((opt) => {
            const active = current === opt.name
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => onPick(opt.name)}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all active:scale-95 ${
                  active
                    ? 'bg-primary text-on-primary shadow-md'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                <Icon name={opt.name} size={24} filled={active} />
                <span className="text-[10px] font-semibold leading-none">{opt.label}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onPick(null)}
          className="mt-5 w-full py-3 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
        >
          Use default icon
        </button>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
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

