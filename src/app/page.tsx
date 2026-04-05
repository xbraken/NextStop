import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import LocationHeader from '@/components/home/LocationHeader'
import { Suspense } from 'react'
import TranslinkStatusCard from '@/components/home/TranslinkStatusCard'

const SAVED_DESTINATIONS = [
  { href: '/search?toName=Home&to=BEL8270413', icon: 'home', label: 'Home', sub: 'Saved location' },
  { href: '/search?toName=Work&to=BEL9400413', icon: 'work', label: 'Work', sub: 'Saved location' },
  { href: '/search?toName=City+Centre&to=BEL8270413', icon: 'location_city', label: 'City Centre', sub: 'Belfast City Hall' },
]

export default function HomePage() {
  return (
    <>
      {/* Header */}
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
        {/* Location */}
        <Suspense fallback={<div className="h-5 w-32 bg-surface-container rounded animate-pulse" />}>
          <LocationHeader />
        </Suspense>

        {/* Hero Search */}
        <section className="space-y-4">
          <Link
            href="/search"
            className="flex items-center gap-4 h-20 px-6 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] hover:shadow-[0_12px_40px_rgba(0,101,101,0.1)] transition-shadow"
          >
            <Icon name="search" size={24} className="text-primary/50" />
            <span className="text-2xl font-headline font-bold text-outline-variant">
              Where to?
            </span>
          </Link>

          {/* Quick Chips */}
          <div className="flex gap-3">
            <Link
              href="/search?toName=Home&to=BEL8270413"
              className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-low rounded-full hover:bg-surface-container-high transition-colors active:scale-95 text-sm font-semibold"
            >
              <Icon name="home" size={20} className="text-primary" />
              Home
            </Link>
            <Link
              href="/search?toName=Work&to=BEL9400413"
              className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-low rounded-full hover:bg-surface-container-high transition-colors active:scale-95 text-sm font-semibold"
            >
              <Icon name="work" size={20} className="text-primary" />
              Work
            </Link>
          </div>
        </section>

        {/* Saved Destinations (Bento) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">
              Saved Destinations
            </h2>
            <Link href="/saved" className="text-primary text-sm font-bold">
              Edit
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Large card */}
            <Link
              href={SAVED_DESTINATIONS[0].href}
              className="col-span-2 p-8 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="relative z-10">
                <span className="text-primary/40 block mb-1 text-sm font-medium">Favourite</span>
                <h3 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">
                  City Centre
                </h3>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <Icon name="location_city" size={120} />
              </div>
            </Link>

            {/* Small cards */}
            {SAVED_DESTINATIONS.slice(1).map((dest) => (
              <Link
                key={dest.label}
                href={dest.href}
                className="p-6 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow"
              >
                <Icon name={dest.icon} size={28} className="text-primary mb-3 block" />
                <h3 className="text-xl font-headline font-bold text-on-surface">{dest.label}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">{dest.sub}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Status Card */}
        <section>
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
