import { NextRequest, NextResponse } from 'next/server'
import { planJourney, rankItineraries } from '@/lib/translink'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { from, to, date, time } = body ?? {}

  if (!from || !to || !date || !time) {
    return NextResponse.json({ error: 'from, to, date and time are required' }, { status: 400 })
  }

  try {
    const data = await planJourney({ from, to, date, time })
    const ranked = rankItineraries(data.itineraries)
    return NextResponse.json({ journeys: ranked })
  } catch (err) {
    console.error('[api/translink/journey] failed', err)
    return NextResponse.json({ error: 'Journey planning failed', detail: String(err) }, { status: 500 })
  }
}
