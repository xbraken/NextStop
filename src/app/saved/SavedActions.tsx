'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import ColorPickerPopover from '@/components/saved/ColorPickerPopover'

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
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center">
      <button
        ref={paletteBtnRef}
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
        <ColorPickerPopover
          anchorRef={paletteBtnRef}
          currentColor={currentColor}
          onPick={pickColor}
          onClose={() => setOpen(false)}
          saving={saving}
        />
      )}
    </div>
  )
}
