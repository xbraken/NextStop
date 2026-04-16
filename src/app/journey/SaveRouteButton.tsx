'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

type Props = {
  fromId: string
  fromLabel: string
  toId: string
  toLabel: string
}

type State = 'idle' | 'saving' | 'saved' | 'duplicate' | 'error'

export default function SaveRouteButton({ fromId, fromLabel, toId, toLabel }: Props) {
  const [state, setState] = useState<State>('idle')

  if (!toId) return null

  async function save() {
    setState('saving')
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'route',
        label: `${fromLabel} → ${toLabel}`,
        stop_name: toLabel,
        stop_id: toId,
        from_id: fromId,
        from_label: fromLabel,
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
      case 'duplicate': return { icon: 'bookmark', text: 'Already saved', disabled: true }
      case 'error': return { icon: 'error', text: 'Sign in to save', disabled: true }
      default: return { icon: 'bookmark_add', text: 'Save this route', disabled: false }
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
