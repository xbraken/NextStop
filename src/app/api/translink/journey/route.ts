import { NextRequest, NextResponse } from 'next/server'
import { planJourney } from '@/lib/translink'
import type { RankedItinerary, Itinerary } from '@/types/translink'

export const runtime = 'nodejs'

function rankItineraries(itineraries: Itinerary[]): RankedItinerary[] {
  if (itineraries.length === 0) return []

  const byDuration = [...itineraries].sort((a, b) => a.duration - b.duration)
  const byTransfers = [...itineraries].sort((a, b) => a.transfers - b.transfers)

  const fastest = byDuration[0]
  const fewerChanges = byTransfers[0]
  // Alternative: second fastest, or different from the top two
  const alternative =
    itineraries.find(
      (i) => i.id !== fastest.id && i.id !== fewerChanges.id
    ) ?? byDuration[1] ?? byDuration[0]

  // Deduplicate: if fastest === fewerChanges, use second by transfers for fewerChanges
  const fewerChangesResult =
    fewerChanges.id === fastest.id
      ? (byTransfers[1] ?? byTransfers[0])
      : fewerChanges

  return [
    { ...fastest, badge: 'Fastest' },
    { ...fewerChangesResult, badge: 'Fewer Changes' },
    { ...alternative, badge: 'Alternative' },
  ]
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { from, to, date, time } = body ?? {}

  if (!from || !to || !date || !time) {
    return NextResponse.json({ error: 'from, to, date and time are required' }, { status: 400 })
  }

  const data = await planJourney({ from, to, date, time })
  const ranked = rankItineraries(data.itineraries)

  return NextResponse.json({ journeys: ranked })
}
