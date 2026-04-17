import { NextRequest, NextResponse } from 'next/server'
import { searchStops } from '@/lib/translink'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) {
    return NextResponse.json({ stops: [] })
  }

  const data = await searchStops(q)
  return NextResponse.json(data, {
    headers: {
      // Stops change rarely — cache aggressively in the browser, allow CDN
      // revalidation in the background so search-as-you-type stays snappy.
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400',
    },
  })
}
