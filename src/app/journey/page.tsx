import { Suspense } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import LegVisualiser from '@/components/journey/LegVisualiser'
import SaveRouteButton from './SaveRouteButton'
import { planJourney, rankItineraries } from '@/lib/translink'
import { formatTime, minutesUntil } from '@/lib/time'
import type { RankedItinerary } from '@/types/translink'

export const runtime = 'nodejs'

interface PageProps {
  searchParams: Promise<{
    from?: string
    fromName?: string
    to?: string
    toName?: string
    date?: string
    time?: string
    mode?: string
  }>
}

function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} mins`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

async function getJourneys(params: {
  from: string
  to: string
  date: string
  time: string
}): Promise<RankedItinerary[]> {
  try {
    const data = await planJourney(params)
    return rankItineraries(data.itineraries)
  } catch (err) {
    console.error('[journey] plan failed', err)
    return []
  }
}

async function JourneyResults({ searchParams }: PageProps) {
  const sp = await searchParams
  const from = sp.from ?? 'current'
  const to = sp.to ?? ''
  const date = sp.date ?? new Date().toISOString().split('T')[0]
  const time = sp.time ?? '09:00'

  const journeys = await getJourneys({ from, to, date, time })

  const badgeColour = {
    Fastest: 'text-primary',
    'Fewer Changes': 'text-secondary',
    Alternative: 'text-outline',
  }

  const badgeIcon = {
    Fastest: 'workspace_premium',
    'Fewer Changes': 'repeat',
    Alternative: 'alt_route',
  }

  return (
    <div className="space-y-5">
      {journeys.map((journey, idx) => {
        const minsAway = minutesUntil(journey.departure)
        const detailHref = `/journey/${journey.id}?from=${from}&fromName=${encodeURIComponent(sp.fromName ?? 'Current Location')}&to=${to}&toName=${encodeURIComponent(sp.toName ?? '')}&date=${date}&time=${time}&idx=${idx}`

        return (
          <Link
            key={journey.id}
            href={detailHref}
            style={{ animationDelay: `${idx * 0.08}s` }}
            className={`animate-fade-in-up animate-stagger block bg-surface-container-lowest rounded-xl p-6 shadow-[0_8px_32px_rgba(26,28,28,0.04)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_12px_40px_rgba(0,101,101,0.10)] active:scale-[0.99]
              ${journey.badge === 'Fastest' ? 'border-l-4 border-primary' : ''}
              ${journey.badge === 'Alternative' ? 'opacity-75' : ''}
            `}
          >
            {/* Badge + duration */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Icon
                  name={badgeIcon[journey.badge as keyof typeof badgeIcon]}
                  filled={journey.badge === 'Fastest'}
                  size={20}
                  className={badgeColour[journey.badge as keyof typeof badgeColour]}
                />
                <span className={`font-headline font-bold text-sm uppercase tracking-widest ${badgeColour[journey.badge as keyof typeof badgeColour]}`}>
                  {journey.badge}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-headline font-extrabold text-on-surface">
                  {formatDuration(journey.duration)}
                </div>
                <div className="text-xs font-semibold text-on-surface-variant mt-0.5">
                  {formatTime(journey.departure)} → {formatTime(journey.arrival)}
                </div>
                <div className="text-[10px] font-semibold text-outline uppercase tracking-tighter mt-0.5">
                  Leaves in {minsAway} min{minsAway !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Leg visualiser */}
            <div className="bg-surface-container-low p-3 rounded-lg mb-4">
              <LegVisualiser legs={journey.legs} />
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                <Icon name="conversion_path" size={14} />
                {journey.transfers === 0 ? 'Direct' : `${journey.transfers} change${journey.transfers > 1 ? 's' : ''}`}
              </span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                On Time
              </span>
            </div>
          </Link>
        )
      })}

      {journeys.length === 0 && (
        <div className="animate-fade-in text-center py-20 text-on-surface-variant">
          <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon name="search_off" size={40} className="opacity-40" />
          </div>
          <p className="font-headline font-bold text-lg text-on-surface">No journeys found</p>
          <p className="text-sm mt-1">Try adjusting your time or date</p>
        </div>
      )}
    </div>
  )
}

export default async function JourneyPage(props: PageProps) {
  const sp = await props.searchParams

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/search"
            className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors active:scale-95 text-primary"
          >
            <Icon name="arrow_back" size={22} />
          </Link>
          <h1 className="font-headline font-bold text-xl text-primary">NextStop</h1>
        </div>
        <Icon name="tune" size={22} className="text-outline" />
      </header>

      <main className="pt-24 pb-32 px-6 max-w-2xl mx-auto">
        {/* Summary */}
        <section className="mb-8">
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">
            {sp.fromName ?? 'Current Location'} → {sp.toName ?? 'Destination'}
          </h2>
          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-2 text-on-surface-variant font-medium">
              <Icon name="schedule" size={14} />
              <span className="font-label tracking-wide uppercase text-xs">
                Departing {sp.time ?? '09:00'}
              </span>
            </div>
            <SaveRouteButton
              fromId={sp.from ?? 'current'}
              fromLabel={sp.fromName ?? 'Current Location'}
              toId={sp.to ?? ''}
              toLabel={sp.toName ?? 'Destination'}
            />
          </div>
        </section>

        <Suspense
          fallback={
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-surface-container animate-pulse overflow-hidden" style={{ animationDelay: `${(i - 1) * 0.1}s` }}>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between">
                      <div className="h-4 w-24 bg-surface-container-high rounded-full" />
                      <div className="h-6 w-16 bg-surface-container-high rounded-full" />
                    </div>
                    <div className="h-10 bg-surface-container-high rounded-lg" />
                    <div className="flex justify-between">
                      <div className="h-3 w-16 bg-surface-container-high rounded-full" />
                      <div className="h-5 w-14 bg-surface-container-high rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        >
          <JourneyResults searchParams={props.searchParams} />
        </Suspense>
      </main>
    </>
  )
}
