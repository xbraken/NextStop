import { NextRequest, NextResponse } from 'next/server'
import { searchStops } from '@/lib/translink'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) {
    return NextResponse.json({ stops: [] })
  }

  const data = await searchStops(q)
  return NextResponse.json(data)
}
