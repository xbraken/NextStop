import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { RankedItinerary, JourneyLeg } from '@/types/translink'
import { planJourney } from '@/lib/translink'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    from?: string
    fromName?: string
    to?: string
    toName?: string
    date?: string
    time?: string
    idx?: string
  }>
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60)
  return `${m} min${m !== 1 ? 's' : ''}`
}

function minutesUntil(iso: string) {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000))
}

function LegRow({ leg }: { leg: JourneyLeg }) {
  if (leg.mode === 'WALK') {
    return (
      <div className="relative flex gap-5 mb-14">
        <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center border-2 border-outline-variant">
          <Icon name="directions_walk" size={22} className="text-outline" />
        </div>
        <div className="pt-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-headline font-bold">Walk to {leg.to.name}</h3>
            <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-xs font-bold uppercase tracking-wider">
              {formatDuration(leg.duration)}
            </span>
          </div>
          {leg.distance && (
            <p className="text-on-surface-variant text-sm">Approx {leg.distance}m walk</p>
          )}
        </div>
      </div>
    )
  }

  const minsAway = minutesUntil(leg.startTime)

  return (
    <div className="relative flex gap-5 mb-14">
      <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
        <Icon
          name={leg.mode === 'RAIL' ? 'directions_railway' : 'directions_bus'}
          filled
          size={22}
          className="text-on-primary"
        />
      </div>
      <div className="pt-1 flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-headline font-bold">Board at {leg.from.name}</h3>
            <div className="flex items-center bg-primary text-on-primary px-3 py-1 rounded-full text-xs font-bold">
              {leg.routeId}
            </div>
          </div>
          <span className="text-primary font-bold text-sm shrink-0">{formatDuration(leg.duration)}</span>
        </div>
        <div className="bg-surface-container-low rounded-xl p-4 flex items-center justify-between border border-outline-variant/10">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60">
              Next Departure
            </span>
            <span className="text-lg font-headline font-extrabold">{formatTime(leg.startTime)}</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-primary">
              {minsAway === 0 ? 'Now' : `in ${minsAway} min${minsAway !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        {leg.headsign && (
          <p className="text-xs text-on-surface-variant mt-2">Direction: {leg.headsign}</p>
        )}
      </div>
    </div>
  )
}

function ArriveRow({ leg }: { leg: JourneyLeg }) {
  return (
    <div className="relative flex gap-5">
      <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-surface-container-lowest border-2 border-outline-variant flex items-center justify-center shadow-sm">
        <Icon name="location_on" filled size={22} className="text-outline" />
      </div>
      <div className="pt-1">
        <h3 className="text-xl font-headline font-bold">Arrive at {leg.to.name}</h3>
        <p className="text-on-surface-variant text-sm mt-1">{formatTime(leg.endTime)}</p>
        <div className="mt-3 flex gap-2">
          <span className="bg-surface-container-high px-3 py-1 rounded-full text-xs font-semibold text-on-surface-variant">
            Step-free access
          </span>
        </div>
      </div>
    </div>
  )
}

export default async function JourneyDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams])

  const from = sp.from ?? 'current'
  const to = sp.to ?? ''
  const date = sp.date ?? new Date().toISOString().split('T')[0]
  const time = sp.time ?? '09:00'
  const idx = parseInt(sp.idx ?? id ?? '0', 10)

  const data = await planJourney({ from, to, date, time })
  const journey: RankedItinerary | undefined = data.itineraries[idx] as RankedItinerary

  if (!journey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-on-surface-variant">Journey not found.</p>
        <Link href="/search" className="mt-4 text-primary font-bold">
          Search again
        </Link>
      </div>
    )
  }

  const lastLeg = journey.legs[journey.legs.length - 1]
  const totalMins = Math.round(journey.duration / 60)
  const firstBusLeg = journey.legs.find((l) => l.mode !== 'WALK')

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/journey?from=${from}&fromName=${encodeURIComponent(sp.fromName ?? '')}&to=${to}&toName=${encodeURIComponent(sp.toName ?? '')}&date=${date}&time=${time}`}
            className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors active:scale-95 text-primary"
          >
            <Icon name="arrow_back" size={22} />
          </Link>
          <h1 className="text-2xl font-headline font-black text-primary tracking-tighter">NextStop</h1>
        </div>
        <button className="p-2 rounded-full hover:bg-surface-container transition-colors text-outline">
          <Icon name="share" size={22} />
        </button>
      </header>

      <main className="pt-24 pb-40 px-6 max-w-2xl mx-auto">
        {/* Hero */}
        <section className="mb-10 animate-fade-in-up">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">
              {lastLeg.to.name}
            </h2>
            <span className="text-lg font-headline font-bold text-primary">{totalMins} mins</span>
          </div>
          <p className="text-on-surface-variant font-medium">
            {firstBusLeg ? `Via ${firstBusLeg.routeId}` : 'Walking route'}
          </p>
        </section>

        {/* Timeline */}
        <div className="relative">
          {/* Progress track */}
          <div className="absolute left-[23px] top-6 bottom-6 w-1 bg-primary/10 rounded-full" />
          {/* Animated fill */}
          <div className="absolute left-[23px] top-6 w-1 bg-primary rounded-full animate-grow-progress" />

          {journey.legs.map((leg, i) => {
            const isLast = i === journey.legs.length - 1
            return (
              <div
                key={i}
                className="animate-fade-in-up animate-stagger"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {isLast ? <ArriveRow leg={leg} /> : <LegRow leg={leg} />}
              </div>
            )
          })}
        </div>
      </main>

      {/* Bottom action */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-surface via-surface/90 to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <button className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold py-5 rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform text-lg">
            <Icon name="play_arrow" filled size={24} className="text-on-primary" />
            Start Journey
          </button>
        </div>
      </div>
    </>
  )
}
