import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { RankedItinerary, JourneyLeg } from '@/types/translink'
import { planJourney, rankItineraries } from '@/lib/translink'
import { formatTime, minutesUntil } from '@/lib/time'
import { itineraryStatus, legStatus } from '@/lib/journey-status'
import LegStops from './LegStops'

// Maplibre is ~250KB. Loading it lazily lets the timeline text appear first
// and the map fades in once its chunk arrives.
const JourneyMap = dynamic(() => import('./JourneyMap'), {
  loading: () => (
    <div className="w-full h-64 rounded-2xl bg-surface-container animate-pulse" />
  ),
})

export const runtime = 'nodejs'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    from?: string
    fromName?: string
    to?: string
    toName?: string
    date?: string
    time?: string
    mode?: string
    idx?: string
  }>
}

function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60)
  return `${m} min${m !== 1 ? 's' : ''}`
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
  const status = legStatus(leg)

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
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60">
              Next Departure
            </span>
            <span className="text-lg font-headline font-extrabold">{formatTime(leg.startTime)}</span>
            {status && (
              <span className={`mt-1 self-start text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${status.className}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-primary">
              {minsAway === 0 ? 'Now' : `in ${minsAway} min${minsAway !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
          <Icon name="logout" size={14} className="text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
              Get off at
            </p>
            <p className="text-sm font-headline font-extrabold text-on-surface truncate">
              {leg.to.name}
            </p>
          </div>
          <span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-on-surface-variant">
            {formatTime(leg.endTime)}
          </span>
        </div>
        {leg.headsign && (
          <p className="text-xs text-on-surface-variant mt-2">Direction: {leg.headsign}</p>
        )}
        {leg.intermediateStops && leg.intermediateStops.length > 0 && (
          <div className="mt-3">
            <LegStops
              boardName={leg.from.name}
              alightName={leg.to.name}
              alightTime={leg.endTime}
              stops={leg.intermediateStops}
            />
          </div>
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

// Resolved-content section — runs inside Suspense so the page shell can paint
// before the EFA call returns.
async function JourneyDetail({
  from,
  to,
  date,
  time,
  idx,
  mode,
  toName,
}: {
  from: string
  to: string
  date: string
  time: string
  idx: number
  mode: 'leave_now' | 'leave_at'
  toName: string
}) {
  let journey: RankedItinerary | undefined
  if (to) {
    try {
      const data = await planJourney({ from, to, date, time })
      const cutoff = Date.now() - 60_000
      const fresh = data.itineraries.filter((it) => {
        if (mode === 'leave_at') return true
        if (!it.departure) return true
        const dep = new Date(it.departure).getTime()
        return Number.isNaN(dep) || dep >= cutoff
      })
      const ranked = rankItineraries(fresh)
      journey = ranked[idx]
    } catch (err) {
      console.error('[journey/[id]] plan failed', err)
    }
  }

  if (!journey || !journey.legs || journey.legs.length === 0) {
    return (
      <div className="text-center py-20 text-on-surface-variant">
        <p>Journey not found.</p>
        <Link href="/search" className="mt-4 inline-block text-primary font-bold">
          Search again
        </Link>
      </div>
    )
  }

  const lastLeg = journey.legs[journey.legs.length - 1]
  const totalMins = Math.round(journey.duration / 60)
  const firstBusLeg = journey.legs.find((l) => l.mode !== 'WALK')
  const overallStatus = itineraryStatus(journey)

  return (
    <>
      {/* Hero */}
      <section className="mb-10 animate-fade-in-up">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">
            {lastLeg.to.name || toName}
          </h2>
          <span className="text-lg font-headline font-bold text-primary">{totalMins} mins</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <p className="text-on-surface-variant font-medium">
            {firstBusLeg ? `Via ${firstBusLeg.routeId}` : 'Walking route'}
          </p>
          <span className={`text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5 ${overallStatus.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${overallStatus.dot}`} />
            {overallStatus.label}
          </span>
        </div>
      </section>

      {/* Map */}
      <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <JourneyMap legs={journey.legs} />
      </section>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[23px] top-6 bottom-6 w-1 bg-primary/10 rounded-full" />
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
    </>
  )
}

function JourneyDetailSkeleton({ toName }: { toName: string }) {
  return (
    <>
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">
            {toName || 'Loading…'}
          </h2>
          <div className="h-6 w-16 bg-surface-container rounded animate-pulse" />
        </div>
        <div className="h-4 w-32 bg-surface-container rounded animate-pulse mt-2" />
      </section>
      <div className="h-64 w-full rounded-2xl bg-surface-container animate-pulse mb-10" />
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-5">
            <div className="w-12 h-12 rounded-full bg-surface-container animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 bg-surface-container rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-surface-container rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default async function JourneyDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams])

  const from = sp.from ?? 'current'
  const to = sp.to ?? ''
  const date = sp.date ?? new Date().toISOString().split('T')[0]
  const time = sp.time ?? '09:00'
  const idx = parseInt(sp.idx ?? id ?? '0', 10)
  const toName = sp.toName ?? ''
  const mode: 'leave_now' | 'leave_at' = sp.mode === 'leave_at' ? 'leave_at' : 'leave_now'

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/journey?from=${from}&fromName=${encodeURIComponent(sp.fromName ?? '')}&to=${to}&toName=${encodeURIComponent(toName)}&date=${date}&time=${time}`}
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

      <main className="pt-24 pb-48 px-6 max-w-2xl mx-auto">
        <Suspense fallback={<JourneyDetailSkeleton toName={toName} />}>
          <JourneyDetail
            from={from}
            to={to}
            date={date}
            time={time}
            idx={idx}
            mode={mode}
            toName={toName}
          />
        </Suspense>
      </main>

      {/* Bottom action — sits above the floating tab bar (which is ~88px tall
          with its 24px bottom offset) so they never overlap. */}
      <div className="fixed bottom-24 left-0 w-full px-6 z-50 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <Link
            href={`/journey/${id}/go?from=${encodeURIComponent(from)}&fromName=${encodeURIComponent(sp.fromName ?? '')}&to=${encodeURIComponent(to)}&toName=${encodeURIComponent(toName)}&date=${date}&time=${time}&mode=${mode}&idx=${idx}`}
            className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold py-5 rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform text-lg"
          >
            <Icon name="play_arrow" filled size={24} className="text-on-primary" />
            Start Journey
          </Link>
        </div>
      </div>
    </>
  )
}
