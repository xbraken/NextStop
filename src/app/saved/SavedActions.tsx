'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { SAVED_COLORS } from '@/lib/saved-colors'

export default function SavedActions({
  destId,
  currentColor,
}: {
  destId: number
  currentColor: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Close the popover on outside click / escape so it doesn't stay stuck open.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleDelete() {
    await fetch(`/api/saved/${destId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function pickColor(key: string | null) {
    setSaving(true)
    await fetch(`/api/saved/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: key }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-full hover:bg-surface-container transition-colors text-outline hover:text-on-surface"
        aria-label="Change colour"
      >
        <Icon name="palette" size={20} />
      </button>
      <button
        onClick={handleDelete}
        className="p-2 rounded-full hover:bg-error/10 transition-colors text-outline hover:text-error"
        aria-label="Delete destination"
      >
        <Icon name="delete" size={20} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-2 z-30 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 p-3 w-64"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">
            Pastel colour
          </p>
          <div className="grid grid-cols-5 gap-2">
            {SAVED_COLORS.map((c) => {
              const active =
                (currentColor ?? 'default') === c.key ||
                (currentColor === null && c.key === 'default')
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={saving}
                  onClick={() => pickColor(c.key === 'default' ? null : c.key)}
                  aria-label={c.label}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                    active ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest' : ''
                  }`}
                  style={{ backgroundColor: c.bg }}
                >
                  {active && (
                    <span style={{ color: c.fg }}>
                      <Icon name="check" size={18} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
