import { NextResponse } from 'next/server'
import { planJourney } from '@/lib/translink'

export const runtime = 'nodejs'

const BASE = 'https://opendata.translinkniplanner.co.uk/Ext_API'

// Resolve a bus line's current trip stop sequence.
//
// Given a line (e.g. "3B"), a direction (:H = outbound, :R = inbound in EFA
// terms) and a stopId the bus is known to serve, we:
//   1. Ask EFA which lines serve that stop (XML_SERVINGLINES_REQUEST)
//   2. Find the line matching our number + direction suffix
//   3. Plan a journey from our stop to the line's terminus using real stop
//      IDs — this returns accurate intermediateStops (lat/lon + name + time)
//
// The result is a clean { stops: [...] } array ready for the UI to render.
export async function GET(req: Request) {
  const token = process.env.TRANSLINK_API_KEY
  if (!token) return NextResponse.json({ error: 'no api key' }, { status: 500 })

  const url = new URL(req.url)
  const line = (url.searchParams.get('line') ?? '').trim()
  const dir = url.searchParams.get('dir') // 'inbound' | 'outbound' | null
  const stopId = url.searchParams.get('stopId')

  if (!line || !stopId) {
    return NextResponse.json({ error: 'line and stopId required' }, { status: 400 })
  }

  try {
    const lines = await servingLines(stopId, token)
    const match = pickLine(lines, line, dir)
    if (!match) {
      return NextResponse.json({ error: 'line not found at stop', lines: lines.map(summarise) }, { status: 404 })
    }

    const destStopId = match.destination?.id
    if (!destStopId) {
      return NextResponse.json({ error: 'no destination id on matched line' }, { status: 500 })
    }

    const now = new Date()
    const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
    const time = `${p(now.getHours())}:${p(now.getMinutes())}`

    const plan = await planJourney({ from: stopId, to: destStopId, date, time })
    const leg = plan.itineraries
      .flatMap((it) => it.legs)
      .find((l) =>
        l.mode === 'BUS' &&
        l.routeId &&
        l.routeId.replace(/\s+/g, '').toUpperCase() === line.replace(/\s+/g, '').toUpperCase()
      )

    if (!leg || !leg.intermediateStops?.length) {
      return NextResponse.json({ error: 'no matching leg', tried: { line, stopId, destStopId } }, { status: 404 })
    }

    // EFA's stopSequence already includes the origin and terminus, so just
    // using it verbatim avoids the duplicate endpoints we were seeing.
    // Fall back to wrapping with leg.from/to only if the sequence is missing
    // either endpoint.
    const mid = leg.intermediateStops.map((s) => ({
      name: s.name,
      stopId: s.stopId,
      time: s.scheduledTime,
      lat: s.lat,
      lon: s.lon,
    }))
    const hasFrom = mid[0]?.stopId === leg.from.stopId
    const hasTo = mid[mid.length - 1]?.stopId === leg.to.stopId
    const stops = [
      ...(hasFrom
        ? []
        : [{ name: leg.from.name, stopId: leg.from.stopId ?? '', time: leg.startTime, lat: leg.from.lat, lon: leg.from.lon }]),
      ...mid,
      ...(hasTo
        ? []
        : [{ name: leg.to.name, stopId: leg.to.stopId ?? '', time: leg.endTime, lat: leg.to.lat, lon: leg.to.lon }]),
    ]

    return NextResponse.json({
      line: match.name,
      destination: match.destination.name,
      stops,
    })
  } catch (err) {
    console.error('[api/translink/line-stops] failed', err)
    return NextResponse.json({ error: 'lookup failed', detail: String(err) }, { status: 500 })
  }
}

function p(n: number) {
  return String(n).padStart(2, '0')
}

interface EfaServingLine {
  id: string
  name: string
  disassembledName?: string
  number?: string
  destination?: { id?: string; name?: string }
}

async function servingLines(stopId: string, token: string): Promise<EfaServingLine[]> {
  const qs = new URLSearchParams({
    mode: 'odv',
    type_sl: 'stop',
    name_sl: stopId,
    outputFormat: 'rapidJSON',
  }).toString()
  const res = await fetch(`${BASE}/XML_SERVINGLINES_REQUEST?${qs}`, {
    headers: { 'X-API-TOKEN': token },
    // Timetable turnover is slow; cache for an hour.
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`serving lines ${res.status}`)
  const data = (await res.json()) as { lines?: EfaServingLine[] }
  return data.lines ?? []
}

function pickLine(
  lines: EfaServingLine[],
  wantedName: string,
  dir: string | null,
): EfaServingLine | null {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const candidates = lines.filter((l) => {
    const names = [l.disassembledName, l.number, l.name].filter(Boolean).map((s) => norm(s!))
    return names.some((n) => n === norm(wantedName))
  })
  if (candidates.length === 0) return null

  // EFA encodes direction in the id's 4th segment: :H: = outbound (Hinweg),
  // :R: = inbound (Rückweg). Prefer the matching one when a dir is given.
  if (dir) {
    const want = dir === 'inbound' ? ':R:' : ':H:'
    const byDir = candidates.find((l) => l.id.includes(want))
    if (byDir) return byDir
  }
  return candidates[0]
}

function summarise(l: EfaServingLine) {
  return { id: l.id, name: l.name, number: l.number, destination: l.destination?.name }
}
