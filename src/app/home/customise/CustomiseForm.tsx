'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTIONS,
  type HomeSectionId,
} from '@/lib/home-sections'

const META = new Map(HOME_SECTIONS.map((s) => [s.id, s]))

function sameOrder(a: HomeSectionId[], b: HomeSectionId[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export default function CustomiseForm({
  initialLayout,
}: {
  initialLayout: HomeSectionId[]
}) {
  const router = useRouter()
  const [layout, setLayout] = useState<HomeSectionId[]>(initialLayout)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hidden = useMemo(() => {
    const shown = new Set(layout)
    return HOME_SECTIONS.filter((s) => !shown.has(s.id))
  }, [layout])

  const dirty = !sameOrder(layout, initialLayout)

  function move(id: HomeSectionId, dir: -1 | 1) {
    setLayout((prev) => {
      const i = prev.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function hide(id: HomeSectionId) {
    setLayout((prev) => prev.filter((x) => x !== id))
  }

  function show(id: HomeSectionId) {
    setLayout((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  async function save(next: HomeSectionId[] | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeLayout: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
      router.push('/')
      router.refresh()
    } catch {
      setError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-3">
          On your home screen
        </h2>
        {layout.length === 0 ? (
          <p className="p-6 text-center text-sm text-on-surface-variant bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant/40">
            Nothing will show on your home screen. Tap &ldquo;Show&rdquo; below
            to add a section back.
          </p>
        ) : (
          <ul className="space-y-2">
            {layout.map((id, i) => {
              const meta = META.get(id)
              if (!meta) return null
              const atTop = i === 0
              const atBottom = i === layout.length - 1
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon name={meta.icon} size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-on-surface">{meta.title}</p>
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                      {meta.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(id, -1)}
                      disabled={atTop}
                      aria-label={`Move ${meta.title} up`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icon name="arrow_upward" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(id, 1)}
                      disabled={atBottom}
                      aria-label={`Move ${meta.title} down`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icon name="arrow_downward" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => hide(id)}
                      aria-label={`Hide ${meta.title}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error active:scale-90 transition-all"
                    >
                      <Icon name="visibility_off" size={18} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {hidden.length > 0 && (
        <div>
          <h2 className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Hidden
          </h2>
          <ul className="space-y-2">
            {hidden.map((meta) => (
              <li
                key={meta.id}
                className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-xl opacity-70"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                  <Icon name={meta.icon} size={20} className="text-on-surface-variant" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-surface-variant">{meta.title}</p>
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                    {meta.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => show(meta.id)}
                  className="shrink-0 px-4 h-9 rounded-full text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all"
                >
                  Show
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-error bg-error/5 rounded-lg px-4 py-3" role="alert">
          {error}
        </p>
      )}

      <div className="sticky bottom-24 z-10 flex flex-col gap-2 pt-4">
        <button
          type="button"
          onClick={() => save(layout)}
          disabled={!dirty || saving}
          className="w-full h-14 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-extrabold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => {
            setLayout(DEFAULT_HOME_LAYOUT)
          }}
          disabled={saving || sameOrder(layout, DEFAULT_HOME_LAYOUT)}
          className="w-full h-12 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          Reset to default order
        </button>
      </div>
    </div>
  )
}
