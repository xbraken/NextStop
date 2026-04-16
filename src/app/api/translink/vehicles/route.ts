import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 10

interface VmiVehicle {
  ID: string
  Operator?: string
  JourneyIdentifier?: string
  Delay?: number
  X?: string
  Y?: string
  XPrevious?: string
  YPrevious?: string
  VehicleIdentifier?: string
  LineText?: string
  DirectionText?: string
  CurrentStop?: string
  NextStop?: string
  Timestamp?: string
  RealtimeAvailable?: number
}

export interface LiveVehicle {
  id: string
  lat: number
  lon: number
  bearing: number | null
  operator: string
  line: string
  destination: string
  vehicleId: string
  delay: number
  timestamp: string
}

function bearingDeg(x1: number, y1: number, x2: number, y2: number): number | null {
  if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return null
  if (x1 === x2 && y1 === y2) return null
  const dx = (x2 - x1) * Math.cos((y1 * Math.PI) / 180)
  const dy = y2 - y1
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}

export async function GET() {
  try {
    const res = await fetch('https://vpos.translinkniplanner.co.uk/velocmap/vmi/VMI', {
      next: { revalidate: 10 },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 })
    }
    const raw = (await res.json()) as VmiVehicle[]
    const vehicles: LiveVehicle[] = raw
      .map((v) => {
        const lon = parseFloat(v.X ?? '')
        const lat = parseFloat(v.Y ?? '')
        if (!isFinite(lat) || !isFinite(lon)) return null
        const xp = parseFloat(v.XPrevious ?? '')
        const yp = parseFloat(v.YPrevious ?? '')
        return {
          id: v.ID,
          lat,
          lon,
          bearing: bearingDeg(xp, yp, lon, lat),
          operator: v.Operator ?? '',
          line: v.LineText ?? '',
          destination: v.DirectionText ?? '',
          vehicleId: v.VehicleIdentifier ?? '',
          delay: typeof v.Delay === 'number' ? v.Delay : 0,
          timestamp: v.Timestamp ?? '',
        } satisfies LiveVehicle
      })
      .filter((v): v is LiveVehicle => v !== null)
    return NextResponse.json({ vehicles })
  } catch (err) {
    console.error('[api/translink/vehicles] failed', err)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
