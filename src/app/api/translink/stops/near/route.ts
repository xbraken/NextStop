import { NextResponse } from 'next/server'
import { searchStopsNear } from '@/lib/translink'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const lat = parseFloat(url.searchParams.get('lat') ?? '')
  const lon = parseFloat(url.searchParams.get('lon') ?? '')
  const radiusParam = parseInt(url.searchParams.get('radius') ?? '600', 10)
  const radius = Math.min(Math.max(isFinite(radiusParam) ? radiusParam : 600, 100), 2000)

  if (!isFinite(lat) || !isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  try {
    const data = await searchStopsNear(lat, lon, radius)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/translink/stops/near] failed', err)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
