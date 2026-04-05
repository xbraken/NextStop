import { NextRequest, NextResponse } from 'next/server'
import { searchStops } from '@/lib/translink'
import { searchPhoton } from '@/lib/photon'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) {
    return NextResponse.json({ stops: [], places: [] })
  }

  // Run both searches in parallel
  const [stopsResult, places] = await Promise.allSettled([
    searchStops(q),
    searchPhoton(q),
  ])

  const stops = stopsResult.status === 'fulfilled' ? stopsResult.value.stops : []
  const placesData = places.status === 'fulfilled' ? places.value : []

  return NextResponse.json({ stops, places: placesData })
}
