'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { applyThemePreference, isDarkTheme } from '@/lib/theme'

// One-tap light/dark switch for the header. The full System/Light/Dark
// choice lives on the Account page.
export default function QuickThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    setDark(isDarkTheme())
    const observer = new MutationObserver(() => setDark(isDarkTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  function toggle() {
    applyThemePreference(isDarkTheme() ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="p-2 rounded-full hover:bg-surface-container transition-colors active:scale-95"
    >
      <Icon name={dark ? 'light_mode' : 'dark_mode'} size={24} className="text-primary" />
    </button>
  )
}
