import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { planJourney, rankItineraries } from '@/lib/translink'
import type { RankedItinerary } from '@/types/translink'
import GoMode from './GoMode'

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

export default async function GoPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const from = sp.from ?? 'current'
  const to = sp.to ?? ''
  const date = sp.date ?? new Date().toISOString().split('T')[0]
  const time = sp.time ?? '09:00'
  const idx = parseInt(sp.idx ?? id ?? '0', 10)
  const mode: 'leave_now' | 'leave_at' = sp.mode === 'leave_at' ? 'leave_at' : 'leave_now'
  const backHref = `/journey/${id}?from=${encodeURIComponent(from)}&fromName=${encodeURIComponent(sp.fromName ?? '')}&to=${encodeURIComponent(to)}&toName=${encodeURIComponent(sp.toName ?? '')}&date=${date}&time=${time}&mode=${mode}&idx=${idx}`

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
      journey = rankItineraries(fresh)[idx]
    } catch (err) {
      console.error('[journey/go] plan failed', err)
    }
  }

  if (!journey || journey.legs.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <Icon name="error" size={48} className="text-outline mb-4" />
        <p className="font-headline font-bold">Couldn&apos;t load this journey.</p>
        <Link href={backHref} className="mt-5 text-primary font-bold">
          Back to plan
        </Link>
      </main>
    )
  }

  return <GoMode journey={journey} backHref={backHref} />
}
