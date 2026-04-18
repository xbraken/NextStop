'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/ui/Icon'
import { SAVED_COLORS } from '@/lib/saved-colors'

type Props = {
  anchorRef: React.RefObject<HTMLElement | null>
  currentColor: string | null
  onPick: (key: string | null) => void
  onClose: () => void
  saving?: boolean
}

// Portaled so no ancestor's overflow/stacking context can clip or hide the
// popover behind sibling cards.
export default function ColorPickerPopover({ anchorRef, currentColor, onPick, onClose, saving }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = 256
    const estHeight = 160
    // Right-align with anchor, clamp to viewport.
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width))
    // Flip above the anchor if there isn't room below.
    const spaceBelow = window.innerHeight - r.bottom
    const top = spaceBelow < estHeight + 16 && r.top > estHeight + 16
      ? r.top - estHeight - 8
      : r.bottom + 8
    setPos({ top, left })
  }, [anchorRef])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!pos) return null

  return createPortal(
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[100] w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 p-3"
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
              onClick={() => onPick(c.key === 'default' ? null : c.key)}
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
    </div>,
    document.body,
  )
}
