'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { SAVED_ICON_OPTIONS } from '@/lib/saved-icons'
import type { SavedColor } from '@/lib/saved-colors'
import type { SavedDestination } from '@/types/user'

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
  const rootRef = useRef<HTMLDivElement>(null)

  // Close the popover when tapping outside so it doesn't stay stuck open.
  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  async function pick(next: string) {
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

  return (
    <div ref={rootRef} className="relative shrink-0 w-44">
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
        <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
          {subtitle ?? (stop.direction
            ? `${stop.direction === 'inbound' ? '↓' : '↑'} ${stop.direction}`
            : 'Live arrivals')}
        </p>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="Change icon"
        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant bg-surface-container/70 backdrop-blur-sm hover:bg-surface-container-high active:scale-90 transition-all ${
          open ? 'opacity-100' : 'opacity-70 hover:opacity-100'
        }`}
      >
        <Icon name={saving ? 'hourglass_empty' : 'edit'} size={14} />
      </button>

      {open && (
        <div className="absolute z-30 top-10 right-0 w-56 p-3 bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(26,28,28,0.14)] border border-outline-variant/20 animate-fade-in-down">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">
            Pick an icon
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {SAVED_ICON_OPTIONS.map((opt) => {
              const active = shown === opt.name
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => pick(opt.name)}
                  title={opt.label}
                  className={`h-11 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                    active
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <Icon name={opt.name} size={18} filled={active} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
