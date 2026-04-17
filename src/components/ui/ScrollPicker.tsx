'use client'

import { useLayoutEffect, useRef } from 'react'

const ITEM_H = 44

export default function ScrollPicker({
  items,
  selectedIndex,
  onChange,
}: {
  items: string[]
  selectedIndex: number
  onChange: (index: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null)
  const programmatic = useRef(false)

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedIndex * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (programmatic.current) return
    if (settling.current) clearTimeout(settling.current)
    settling.current = setTimeout(() => {
      if (!ref.current) return
      const idx = Math.max(
        0,
        Math.min(items.length - 1, Math.round(ref.current.scrollTop / ITEM_H))
      )
      onChange(idx)
    }, 100)
  }

  function scrollTo(i: number) {
    if (!ref.current) return
    programmatic.current = true
    ref.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
    onChange(i)
    setTimeout(() => {
      programmatic.current = false
    }, 300)
  }

  return (
    <div className="relative w-16 h-[132px] overflow-hidden select-none">
      <div className="absolute inset-x-0 top-[44px] h-[44px] border-y border-outline-variant/30 pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-surface-container-lowest to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none z-10" />
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <div style={{ height: ITEM_H }} />
        {items.map((item, i) => (
          <div
            key={i}
            style={{ scrollSnapAlign: 'center', height: ITEM_H }}
            className={`flex items-center justify-center text-2xl font-headline font-bold cursor-pointer transition-colors
              ${i === selectedIndex ? 'text-primary' : 'text-on-surface-variant'}`}
            onPointerDown={() => scrollTo(i)}
          >
            {item}
          </div>
        ))}
        <div style={{ height: ITEM_H }} />
      </div>
    </div>
  )
}
