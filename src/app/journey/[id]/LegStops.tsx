'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { formatTime } from '@/lib/time'

type Stop = { name: string; stopId: string; scheduledTime: string }

type Props = {
  boardName: string
  alightName: string
  alightTime: string
  stops: Stop[]
}

// Collapsible stop list for a bus leg on the journey overview. Intermediate
// stops come straight from the EFA plan — scheduled times only, which we
// label explicitly so users don't read them as live estimates.
export default function LegStops({ boardName, alightName, alightTime, stops }: Props) {
  const [open, setOpen] = useState(false)
  const count = stops.length

  return (
    <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container transition-colors"
      >
        <Icon name="format_list_bulleted" size={16} className="text-on-surface-variant" />
        <span className="flex-1 text-xs font-bold text-on-surface">
          {count} stop{count === 1 ? '' : 's'} before you get off
        </span>
        <Icon
          name="expand_more"
          size={18}
          className={`text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ol className="relative px-4 pb-3 pt-1">
          {/* vertical rail */}
          <span className="absolute left-[22px] top-2 bottom-2 w-px bg-outline-variant/40" aria-hidden />
          <StopLine name={boardName} time={stops[0]?.scheduledTime} marker="start" />
          {stops.map((s, i) => (
            <StopLine key={`${s.stopId}-${i}`} name={s.name} time={s.scheduledTime} marker="mid" />
          ))}
          <StopLine name={alightName} time={alightTime} marker="end" />
          <p className="mt-2 pl-7 text-[10px] text-on-surface-variant/70">
            Times are scheduled
          </p>
        </ol>
      )}
    </div>
  )
}

function StopLine({
  name,
  time,
  marker,
}: {
  name: string
  time?: string
  marker: 'start' | 'mid' | 'end'
}) {
  return (
    <li className="relative flex items-center gap-3 py-1.5 pl-0">
      <span
        className={`relative z-10 shrink-0 inline-block rounded-full ${
          marker === 'mid'
            ? 'w-2 h-2 bg-outline-variant ring-2 ring-surface-container-low ml-[8px] mr-[4px]'
            : 'w-3 h-3 bg-primary ring-2 ring-surface-container-low ml-[6px] mr-[2px]'
        }`}
      />
      <span
        className={`flex-1 truncate text-xs ${
          marker === 'mid' ? 'text-on-surface-variant' : 'font-bold text-on-surface'
        }`}
      >
        {name}
      </span>
      {time && (
        <span className="shrink-0 text-[10px] font-semibold text-on-surface-variant tabular-nums">
          {formatTime(time)}
        </span>
      )}
    </li>
  )
}
