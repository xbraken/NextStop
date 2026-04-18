'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import ColorPickerPopover from '@/components/saved/ColorPickerPopover'
import { SAVED_ICON_OPTIONS } from '@/lib/saved-icons'

export default function SavedActions({
  destId,
  currentColor,
  currentIcon,
}: {
  destId: number
  currentColor: string | null
  currentIcon: string
}) {
  const router = useRouter()
  const [colorOpen, setColorOpen] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const paletteBtnRef = useRef<HTMLButtonElement | null>(null)

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
    setColorOpen(false)
    router.refresh()
  }

  async function pickIcon(name: string | null) {
    setSaving(true)
    await fetch(`/api/saved/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icon: name }),
    })
    setSaving(false)
    setIconOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center">
      <button
        ref={paletteBtnRef}
        onClick={() => setColorOpen((o) => !o)}
        className="p-2 rounded-full hover:bg-surface-container transition-colors text-outline hover:text-on-surface"
        aria-label="Change colour"
      >
        <Icon name="palette" size={20} />
      </button>
      <button
        onClick={() => setIconOpen(true)}
        className="p-2 rounded-full hover:bg-surface-container transition-colors text-outline hover:text-on-surface"
        aria-label="Change icon"
      >
        <Icon name="edit" size={20} />
      </button>
      <button
        onClick={handleDelete}
        className="p-2 rounded-full hover:bg-error/10 transition-colors text-outline hover:text-error"
        aria-label="Delete destination"
      >
        <Icon name="delete" size={20} />
      </button>

      {colorOpen && (
        <ColorPickerPopover
          anchorRef={paletteBtnRef}
          currentColor={currentColor}
          onPick={pickColor}
          onClose={() => setColorOpen(false)}
          saving={saving}
        />
      )}

      {iconOpen && (
        <IconPickerDialog
          current={currentIcon}
          saving={saving}
          onPick={pickIcon}
          onClose={() => setIconOpen(false)}
        />
      )}
    </div>
  )
}

function IconPickerDialog({
  current,
  saving,
  onPick,
  onClose,
}: {
  current: string
  saving: boolean
  onPick: (name: string | null) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
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
        <div className="flex items-center justify-between mb-5">
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

        <div className="grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
          {SAVED_ICON_OPTIONS.map((opt) => {
            const active = current === opt.name
            return (
              <button
                key={opt.name}
                type="button"
                disabled={saving}
                onClick={() => onPick(opt.name)}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-60 ${
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
          disabled={saving}
          onClick={() => onPick(null)}
          className="mt-5 w-full py-3 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all disabled:opacity-60"
        >
          Use default icon
        </button>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}
