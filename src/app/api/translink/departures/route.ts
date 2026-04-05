import { NextRequest, NextResponse } from 'next/server'
import { getDepartures } from '@/lib/translink'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const stopId = req.nextUrl.searchParams.get('stopId')
  if (!stopId) {
    return NextResponse.json({ error: 'stopId is required' }, { status: 400 })
  }

  const data = await getDepartures(stopId)
  return NextResponse.json(data)
}
