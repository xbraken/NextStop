import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import Icon from '@/components/ui/Icon'
import Link from 'next/link'
import type { SavedDestination, SavedKind } from '@/types/user'
import SavedActions from './SavedActions'

export const runtime = 'nodejs'

function iconFor(kind: SavedKind, label: string, stopId: string): string {
  if (kind === 'route') return 'route'
  if (kind === 'stop') return 'directions_bus'
  const l = label.toLowerCase()
  if (l.includes('home')) return 'home'
  if (l.includes('work') || l.includes('office')) return 'work'
  if (l.includes('school') || l.includes('uni') || l.includes('college')) return 'school'
  if (l.includes('hospital') || l.includes('clinic')) return 'local_hospital'
  if (l.includes('airport')) return 'flight'
  return stopId.includes(',') ? 'location_on' : 'directions_bus'
}

function hrefFor(item: SavedDestination): string {
  switch (item.kind) {
    case 'stop': {
      let url =
        `/live?stop=${encodeURIComponent(item.stop_id)}` +
        `&name=${encodeURIComponent(item.stop_name)}`
      if (item.direction) url += `&dir=${item.direction}`
      if (item.routes) url += `&routes=${encodeURIComponent(item.routes)}`
      return url
    }
    case 'route':
      return (
        `/journey?from=${encodeURIComponent(item.from_id ?? 'current')}` +
        `&fromName=${encodeURIComponent(item.from_label ?? 'Current Location')}` +
        `&to=${encodeURIComponent(item.stop_id)}` +
        `&toName=${encodeURIComponent(item.stop_name)}`
      )
    default:
      return `/search?to=${encodeURIComponent(item.stop_id)}&toName=${encodeURIComponent(item.label)}`
  }
}

function subtitle(item: SavedDestination): string {
  if (item.kind === 'route') {
    return `${item.from_label ?? 'Current Location'} → ${item.stop_name}`
  }
  if (item.kind === 'stop') {
    const parts: string[] = []
    if (item.direction) {
      const arrow = item.direction === 'inbound' ? '↓' : '↑'
      parts.push(`${arrow} ${item.direction}`)
    }
    if (item.routes) parts.push(`routes ${item.routes.split(',').join(', ')}`)
    parts.push(item.stop_name)
    return parts.join(' · ')
  }
  return item.stop_name
}

function Section({
  title,
  items,
  emptyIcon,
  emptyText,
  emptyCta,
}: {
  title: string
  items: SavedDestination[]
  emptyIcon: string
  emptyText: string
  emptyCta: { href: string; label: string }
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">
        {title}
      </h2>

      {items.length === 0 ? (
        <Link
          href={emptyCta.href}
          className="flex items-center gap-3 p-4 bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/40 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center">
            <Icon name={emptyIcon} size={20} className="text-outline" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-on-surface-variant">{emptyText}</p>
            <p className="text-xs text-outline mt-0.5">{emptyCta.label}</p>
          </div>
        </Link>
      ) : (
        items.map((item, i) => (
          <div
            key={item.id}
            style={{ animationDelay: `${i * 0.05}s` }}
            className="animate-fade-in-up animate-stagger flex items-center gap-3 p-4 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow duration-200"
          >
            <Link href={hrefFor(item)} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Icon
                  name={iconFor(item.kind, item.label, item.stop_id)}
                  filled={item.kind === 'destination'}
                  size={22}
                  className="text-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface truncate">{item.label}</p>
                <p className="text-sm text-on-surface-variant truncate">{subtitle(item)}</p>
              </div>
            </Link>
            <SavedActions destId={item.id} />
          </div>
        ))
      )}
    </section>
  )
}

export default async function SavedPage() {
  await ensureMigrated()
  const session = await getSession()

  let items: SavedDestination[] = []
  if (session) {
    const result = await db.execute({
      sql: 'SELECT * FROM saved_destinations WHERE user_id = ? ORDER BY created_at DESC',
      args: [session.userId],
    })
    items = result.rows as unknown as SavedDestination[]
  }

  const stops = items.filter((i) => i.kind === 'stop')
  const routes = items.filter((i) => i.kind === 'route')
  const destinations = items.filter((i) => i.kind === 'destination' || i.kind == null)

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <h1 className="text-2xl font-headline font-black text-primary tracking-tighter">Saved</h1>
        <Link
          href="/profile"
          className="p-2 rounded-full hover:bg-surface-container transition-colors"
        >
          <Icon name="account_circle" size={26} className="text-primary" />
        </Link>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10 pb-32">
        {!session && (
          <div className="animate-fade-in text-center py-20 text-on-surface-variant">
            <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-5">
              <Icon name="bookmark" size={40} className="opacity-30" />
            </div>
            <p className="font-headline font-bold text-lg text-on-surface">Sign in to save places</p>
            <p className="text-sm mt-1">Destinations, stops and routes all live here.</p>
            <Link
              href="/profile"
              className="inline-block mt-6 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm active:scale-95 transition-transform"
            >
              Sign in
            </Link>
          </div>
        )}

        {session && (
          <>
            <Section
              title="Destinations"
              items={destinations}
              emptyIcon="bookmark_add"
              emptyText="No saved destinations"
              emptyCta={{ href: '/search', label: 'Search for a place to save' }}
            />
            <Section
              title="Bus Stops"
              items={stops}
              emptyIcon="directions_bus"
              emptyText="No saved stops"
              emptyCta={{ href: '/live', label: 'Pick a stop on Live and tap save' }}
            />
            <Section
              title="Routes"
              items={routes}
              emptyIcon="route"
              emptyText="No saved routes"
              emptyCta={{ href: '/search', label: 'Plan a journey and tap save' }}
            />
          </>
        )}
      </main>
    </>
  )
}
