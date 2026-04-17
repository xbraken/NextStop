import { NextRequest, NextResponse } from 'next/server'
import { getDepartures } from '@/lib/translink'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get('stopId')
  if (!stopId) {
    return NextResponse.json({ error: 'stopId is required' }, { status: 400 })
  }
  const date = req.nextUrl.searchParams.get('date') ?? undefined
  const time = req.nextUrl.searchParams.get('time') ?? undefined

  const data = await getDepartures(stopId, { date, time })
  // When the user is asking about a future window, the response is essentially
  // a timetable lookup — safe to cache more aggressively. "Now" stays short
  // so we always reflect realtime adjustments.
  const cacheControl = date || time
    ? 'public, max-age=60, stale-while-revalidate=300'
    : 'public, max-age=10, stale-while-revalidate=30'
  return NextResponse.json(data, { headers: { 'Cache-Control': cacheControl } })
}
