'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { SAVED_ICON_OPTIONS } from '@/lib/saved-icons'
import type { SavedColor } from '@/lib/saved-colors'
import type { SavedDestination } from '@/types/user'
import type { Departure } from '@/types/translink'
import { matchesDirection } from '@/lib/direction'
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
  const [icon, setIcon] = useState<string | null>(stop.icon)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const nextBus = useNextBus(stop)

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
    <div className="relative shrink-0 w-44">
      <Link
        href={href}
        className="group block p-4 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:shadow-md hover:bg-surface-container-low transition-all"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
          style={color ? { backgroundColor: color.bg } : undefined}
        >
          <span style={color ? { color: color.fg } : undefined} className={color ? '' : 'text-primary'}>
            <Icon name={shown} size={18} filled />
          </span>
        </div>
        <p className="font-bold text-sm text-on-surface truncate pr-5">{stop.label}</p>
        {nextBus ? (
          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${nextBus.variant.dot}`} />
            <span className={`text-[11px] font-bold truncate ${nextBus.variant.className}`}>
              {nextBus.minsAway <= 0 ? 'Now' : `${nextBus.minsAway} min`} · {nextBus.short}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
            {fallbackSubtitle}
          </p>
        )}
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label="Change icon"
        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant bg-surface-container/70 backdrop-blur-sm hover:bg-surface-container-high active:scale-90 transition-all opacity-70 hover:opacity-100"
      >
        <Icon name={saving ? 'hourglass_empty' : 'edit'} size={14} />
      </button>

      {open && (
        <IconPickerDialog
          label={stop.label}
          current={shown}
          onPick={pick}
          onClose={() => setOpen(false)}
        />
      )}
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
function useNextBus(stop: SavedDestination): {
  minsAway: number
  variant: ReturnType<typeof variantFor>
  short: string
} | null {
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

  if (!departures) return null

  const now = Date.now()
  const next = departures
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
    })[0]

  if (!next) return null

  return {
    minsAway: minutesUntil(next.expectedDeparture || next.scheduledDeparture),
    variant: variantFor(next),
    short: shortStatus(next),
  }
}

// Condenses variantFor's label ("Live · 2 min late") into the tightest thing
// that still communicates status, since a 176px card can't fit the long form.
function shortStatus(d: Departure): string {
  if (d.status === 'Cancelled') return 'cancelled'
  if (!d.isLive) return 'scheduled'
  const drift = Math.round(
    (new Date(d.expectedDeparture).getTime() - new Date(d.scheduledDeparture).getTime()) / 60_000
  )
  if (drift >= 2) return `${drift} min late`
  if (drift <= -1) return `${Math.abs(drift)} min early`
  return 'on time'
}
