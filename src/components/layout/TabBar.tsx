'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '@/components/ui/Icon'

const tabs = [
  { href: '/', icon: 'explore', label: 'Explore' },
  { href: '/search', icon: 'route', label: 'Plan' },
  { href: '/live', icon: 'sensors', label: 'Live' },
  { href: '/saved', icon: 'bookmark', label: 'Saved' },
  { href: '/profile', icon: 'person', label: 'Account' },
]

export default function TabBar() {
  const pathname = usePathname()

  // Hidden in "Go" mode (focused live-companion view) so the giant action
  // strip has the full bottom area to breathe.
  if (pathname.endsWith('/go')) return null

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md rounded-full border border-white/20 bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] flex justify-around items-center p-2 z-40">
      {tabs.map((tab) => {
        const active =
          tab.href === '/'
            ? pathname === '/'
            : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center h-12 w-12 rounded-full transition-all active:scale-95 duration-200
              ${active
                ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg scale-110'
                : 'text-outline hover:text-on-surface-variant'
              }`}
          >
            <Icon name={tab.icon} filled={active} size={22} />
            {!active && (
              <span className="font-label text-[10px] font-semibold uppercase tracking-wider leading-none mt-0.5">
                {tab.label}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
