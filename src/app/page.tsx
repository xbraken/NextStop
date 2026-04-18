import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import LocationHeader from '@/components/home/LocationHeader'
import SavedStopCard from '@/components/home/SavedStopCard'
import { Suspense } from 'react'
import TranslinkStatusCard from '@/components/home/TranslinkStatusCard'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import type { SavedDestination } from '@/types/user'
import { getSavedColor } from '@/lib/saved-colors'

export const runtime = 'nodejs'

interface SavedGroups {
  destinations: SavedDestination[]
  stops: SavedDestination[]
  routes: SavedDestination[]
}

async function getSavedGrouped(userId: number): Promise<SavedGroups> {
  // One round trip; cap rows so a power user with 200 saved entries doesn't
  // bloat the homepage payload. Per-section caps applied client-side.
  const result = await db.execute({
    sql: 'SELECT * FROM saved_destinations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    args: [userId],
  })
  const rows = result.rows as unknown as SavedDestination[]
  return {
    destinations: rows.filter((r) => r.kind === 'destination' || r.kind == null).slice(0, 3),
    stops: rows.filter((r) => r.kind === 'stop').slice(0, 6),
    routes: rows.filter((r) => r.kind === 'route').slice(0, 6),
  }
}

// Streamed inside Suspense so the hero search renders without waiting on the
// DB round trip. Both migrate + session checks are parallelised.
async function SavedSection() {
  const [, session] = await Promise.all([ensureMigrated(), getSession()])
  const groups: SavedGroups = session
    ? await getSavedGrouped(session.userId)
    : { destinations: [], stops: [], routes: [] }
  return <SavedSectionView groups={groups} />
}

function stopHref(item: SavedDestination): string {
  let url = `/live?stop=${encodeURIComponent(item.stop_id)}&name=${encodeURIComponent(item.stop_name)}`
  if (item.direction) url += `&dir=${item.direction}`
  if (item.routes) url += `&routes=${encodeURIComponent(item.routes)}`
  return url
}

function routeHref(item: SavedDestination): string {
  return (
    `/journey?from=${encodeURIComponent(item.from_id ?? 'current')}` +
    `&fromName=${encodeURIComponent(item.from_label ?? 'Current Location')}` +
    `&to=${encodeURIComponent(item.stop_id)}` +
    `&toName=${encodeURIComponent(item.stop_name)}`
  )
}

function SavedSectionView({ groups }: { groups: SavedGroups }) {
  const { destinations, stops, routes } = groups
  const hasAnything = destinations.length + stops.length + routes.length > 0

  return (
    <>
      {destinations.length > 0 && (
        <div className="flex gap-3 overflow-x-auto hide-scrollbar">
          {destinations.map((dest, i) => (
            <Link
              key={dest.id}
              href={`/search?to=${encodeURIComponent(dest.stop_id)}&toName=${encodeURIComponent(dest.label)}`}
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              className="animate-fade-in animate-stagger flex items-center gap-2 px-5 py-2.5 bg-surface-container-low rounded-full hover:bg-surface-container-high transition-colors active:scale-95 text-sm font-semibold whitespace-nowrap shrink-0"
            >
              <Icon name={iconForDestination(dest)} size={18} className="text-primary" />
              {dest.label}
            </Link>
          ))}
        </div>
      )}

      <section className="space-y-4 animate-fade-in-up animate-stagger mt-8" style={{ animationDelay: '0.12s' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">
            Saved Destinations
          </h2>
          <Link href="/saved" className="text-primary text-sm font-bold">
            {hasAnything ? 'Edit' : 'Add'}
          </Link>
        </div>

        {destinations.length === 0 ? (
          <Link
            href="/search"
            className="flex flex-col items-center justify-center gap-3 p-10 bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant/40 hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="bookmark_add" size={24} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="font-headline font-bold text-on-surface">No saved destinations yet</p>
              <p className="text-sm text-on-surface-variant mt-0.5">Search for a place and tap &ldquo;Save destination&rdquo;</p>
            </div>
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Link
              href={`/search?to=${encodeURIComponent(destinations[0].stop_id)}&toName=${encodeURIComponent(destinations[0].label)}`}
              className="col-span-2 p-8 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="relative z-10">
                <span className="text-primary/40 block mb-1 text-sm font-medium">Favourite</span>
                <h3 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">
                  {destinations[0].label}
                </h3>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <Icon name={iconForDestination(destinations[0])} size={120} />
              </div>
            </Link>

            {destinations.slice(1).map((dest) => (
              <Link
                key={dest.id}
                href={`/search?to=${encodeURIComponent(dest.stop_id)}&toName=${encodeURIComponent(dest.label)}`}
                className="p-6 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow"
              >
                <Icon name={iconForDestination(dest)} size={28} className="text-primary mb-3 block" />
                <h3 className="text-xl font-headline font-bold text-on-surface truncate">{dest.label}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">{dest.stop_name}</p>
              </Link>
            ))}

            {destinations.length === 2 && (
              <Link
                href="/search"
                className="p-6 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow border-2 border-dashed border-outline-variant/30 hover:border-primary/30 flex flex-col items-center justify-center gap-2"
              >
                <Icon name="add" size={24} className="text-primary/40" />
                <span className="text-xs font-bold text-on-surface-variant">Add more</span>
              </Link>
            )}
          </div>
        )}
      </section>

      {stops.length > 0 && (
        <section className="space-y-3 animate-fade-in-up animate-stagger mt-8" style={{ animationDelay: '0.16s' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">
              Saved Stops
            </h2>
            <Link href="/live" className="text-primary text-sm font-bold">
              Live
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
            {stops.map((stop, i) => {
              const sub = stop.routes
                ? `Routes ${stop.routes.split(',').join(', ')}`
                : stop.direction
                  ? `${stop.direction === 'inbound' ? '↓' : '↑'} ${stop.direction}`
                  : 'Live arrivals'
              return (
                <div
                  key={stop.id}
                  style={{ animationDelay: `${0.18 + i * 0.04}s` }}
                  className="animate-fade-in animate-stagger"
                >
                  <SavedStopCard
                    stop={stop}
                    href={stopHref(stop)}
                    subtitle={sub}
                    defaultIcon="directions_bus"
                    color={getSavedColor(stop.color)}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {routes.length > 0 && (
        <section className="space-y-3 animate-fade-in-up animate-stagger mt-8" style={{ animationDelay: '0.20s' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">
              Saved Routes
            </h2>
            <Link href="/saved" className="text-primary text-sm font-bold">
              All
            </Link>
          </div>
          <div className="space-y-2">
            {routes.map((route, i) => {
              const c = getSavedColor(route.color)
              return (
              <Link
                key={route.id}
                href={routeHref(route)}
                style={{ animationDelay: `${0.22 + i * 0.04}s` }}
                className="animate-fade-in animate-stagger flex items-center gap-3 p-3 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:shadow-md hover:bg-surface-container-low transition-all"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: c.bg }}
                >
                  <span style={{ color: c.fg }}>
                    <Icon name="route" size={18} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-surface truncate">{route.label}</p>
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5 flex items-center gap-1">
                    <span className="truncate">{route.from_label ?? 'Current Location'}</span>
                    <Icon name="arrow_forward" size={11} className="text-outline shrink-0" />
                    <span className="truncate">{route.stop_name}</span>
                  </p>
                </div>
                <Icon name="chevron_right" size={18} className="text-outline shrink-0" />
              </Link>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

function SavedSkeleton() {
  return (
    <section className="space-y-4 mt-8">
      <div className="h-3 w-32 bg-surface-container rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 h-32 rounded-xl bg-surface-container animate-pulse" />
        <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
        <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
      </div>
    </section>
  )
}

// Guess a good icon based on the label or stop type
function iconForDestination(dest: SavedDestination): string {
  const label = dest.label.toLowerCase()
  if (label.includes('home')) return 'home'
  if (label.includes('work') || label.includes('office')) return 'work'
  if (label.includes('school') || label.includes('uni') || label.includes('college')) return 'school'
  if (label.includes('hospital') || label.includes('clinic')) return 'local_hospital'
  if (label.includes('airport')) return 'flight'
  if (label.includes('station') || label.includes('bus')) return 'directions_bus'
  if (label.includes('city') || label.includes('centre') || label.includes('center')) return 'location_city'
  // Address (lat,lon style stop_id) vs Translink stop
  return dest.stop_id.includes(',') ? 'location_on' : 'directions_bus'
}

export default function HomePage() {
  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <h1 className="text-2xl font-headline font-black text-primary tracking-tighter">
          NextStop
        </h1>
        <Link
          href="/profile"
          className="p-2 rounded-full hover:bg-surface-container transition-colors active:scale-95"
        >
          <Icon name="account_circle" size={26} className="text-primary" />
        </Link>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10 pb-32">
        <div className="animate-fade-in">
          <Suspense fallback={<div className="h-5 w-32 bg-surface-container rounded animate-pulse" />}>
            <LocationHeader />
          </Suspense>
        </div>

        <section className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <Link
            href="/search"
            className="flex items-center gap-4 h-20 px-6 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] hover:shadow-[0_12px_40px_rgba(0,101,101,0.1)] hover:scale-[1.005] transition-all duration-200"
          >
            <Icon name="search" size={24} className="text-primary/50" />
            <span className="text-2xl font-headline font-bold text-outline-variant">
              Where to?
            </span>
          </Link>

          <Suspense fallback={<SavedSkeleton />}>
            <SavedSection />
          </Suspense>
        </section>

        <section className="animate-fade-in-up animate-stagger" style={{ animationDelay: '0.2s' }}>
          <Suspense
            fallback={
              <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
            }
          >
            <TranslinkStatusCard />
          </Suspense>
        </section>
      </main>
    </>
  )
}
