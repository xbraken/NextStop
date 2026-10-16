'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import {
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from '@/lib/theme'

const options: { value: ThemePreference; icon: string; label: string }[] = [
  { value: 'system', icon: 'brightness_auto', label: 'System' },
  { value: 'light', icon: 'light_mode', label: 'Light' },
  { value: 'dark', icon: 'dark_mode', label: 'Dark' },
]

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference | null>(null)

  useEffect(() => {
    setPref(readThemePreference())
  }, [])

  function choose(value: ThemePreference) {
    setPref(value)
    applyThemePreference(value)
  }

  return (
    <div className="flex items-center gap-4 p-5 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)]">
      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
        <Icon name="contrast" size={20} className="text-primary" />
      </div>
      <span className="font-semibold text-on-surface flex-1">Appearance</span>
      <div role="radiogroup" aria-label="Theme" className="flex gap-1 p-1 rounded-full bg-surface-container">
        {options.map((o) => {
          const active = pref === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              title={o.label}
              onClick={() => choose(o.value)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                active
                  ? 'bg-primary text-on-primary shadow'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={o.icon} filled={active} size={18} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
