'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { routeSort } from '@/lib/routes'

type Props = {
  known: string[]
  selected: string[]
  onChange: (ids: string[]) => void
  // When true, the chip row bleeds edge-to-edge via negative margins (for
  // full-width pages). Set false inside padded containers like bottom sheets.
  edgeBleed?: boolean
}

export default function RouteFilter({ known, selected, onChange, edgeBleed = true }: Props) {
  // Show any currently-selected id even if it isn't in `known` yet (eg. a
  // saved preference for a route not in today's feed) so the user can see
  // and un-toggle it.
  const ids = Array.from(new Set([...known, ...selected])).sort(routeSort)
  const allActive = selected.length === 0
  const selectedSet = new Set(selected)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  function toggle(id: string) {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  function commitDraft() {
    const id = draft.trim()
    setDraft('')
    setAdding(false)
    if (!id) return
    const next = new Set(selectedSet)
    next.add(id)
    onChange(Array.from(next))
  }

  return (
    <div className="mt-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
        Filter by route
      </p>
      <div
        className={`flex gap-2 overflow-x-auto pb-1 scrollbar-none ${
          edgeBleed ? '-mx-6 px-6' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onChange([])}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
            allActive
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          All
        </button>
        {ids.map((id) => {
          const active = selectedSet.has(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                active
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {id}
            </button>
          )
        })}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft()
              else if (e.key === 'Escape') {
                setDraft('')
                setAdding(false)
              }
            }}
            placeholder="e.g. 3d"
            className="flex-shrink-0 w-24 px-4 py-1.5 rounded-full text-xs font-bold bg-surface-container-low text-on-surface outline-none border border-primary/40 placeholder:text-outline"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container-low text-on-surface-variant hover:text-on-surface active:scale-95 transition-all"
            aria-label="Add a route not in the list"
          >
            <Icon name="add" size={14} />
            Add
          </button>
        )}
      </div>
    </div>
  )
}
