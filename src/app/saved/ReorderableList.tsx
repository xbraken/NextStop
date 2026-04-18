'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { getSavedColor } from '@/lib/saved-colors'
import type { SavedDestination } from '@/types/user'
import SavedActions from './SavedActions'

type Entry = {
  item: SavedDestination
  icon: string
  href: string
  subtitle: string
}

type Props = {
  items: Entry[]
}

// Reorderable list of saved items. Up/down chevrons reorder optimistically and
// persist via POST /api/saved/reorder. Preferred over drag-and-drop here since
// it works reliably on touch without a drag library.
export default function ReorderableList({ items }: Props) {
  const router = useRouter()
  const [order, setOrder] = useState(items)
  const [, startTransition] = useTransition()

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = order.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
    startTransition(async () => {
      await fetch('/api/saved/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: next.map((e) => e.item.id) }),
      })
      router.refresh()
    })
  }

  return (
    <>
      {order.map(({ item, icon, href, subtitle }, i) => (
        <div
          key={item.id}
          className="flex items-center gap-2 p-2 pl-3 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex flex-col shrink-0">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
              className="w-7 h-5 flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none"
            >
              <Icon name="keyboard_arrow_up" size={18} />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === order.length - 1}
              aria-label="Move down"
              className="w-7 h-5 flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none"
            >
              <Icon name="keyboard_arrow_down" size={18} />
            </button>
          </div>
          <Link href={href} className="flex items-center gap-3 flex-1 min-w-0 py-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: getSavedColor(item.color).bg }}
            >
              <span style={{ color: getSavedColor(item.color).fg }}>
                <Icon
                  name={icon}
                  filled={item.kind === 'destination'}
                  size={22}
                />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-on-surface truncate">{item.label}</p>
              <p className="text-sm text-on-surface-variant truncate">{subtitle}</p>
            </div>
          </Link>
          <SavedActions destId={item.id} currentColor={item.color} />
        </div>
      ))}
    </>
  )
}
