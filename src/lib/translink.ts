import type {
  StopsResponse,
  DeparturesResponse,
  JourneyPlanResponse,
  TranslinkStop,
  Departure,
  Itinerary,
  RankedItinerary,
  JourneyLeg,
} from '@/types/translink'
import { mockSearchStops, mockDepartures, mockJourney } from './mocks/translink'

const BASE = 'https://opendata.translinkniplanner.co.uk/Ext_API'
const isMock = () => process.env.TRANSLINK_MOCK === 'true'

function headers() {
  const token = process.env.TRANSLINK_API_KEY ?? '6u83f0xduHw4GW67'
  return { 'X-API-TOKEN': token }
}

async function efaGet<T = unknown>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}/${path}?${qs}`
  console.log('[efa]', path, qs)
  const res = await fetch(url, { headers: headers(), cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) {
    console.error('[efa] non-ok', path, res.status, text.slice(0, 200))
    throw new Error(`Translink ${path} error: ${res.status}`)
  }
  try {
    return JSON.parse(text) as T
  } catch (e) {
    console.error('[efa] parse fail', path, text.slice(0, 200))
    throw e
  }
}

// ---------- StopFinder ----------

interface EfaLocation {
  id?: string
  name?: string
  disassembledName?: string
  coord?: [number, number] // [lat, lon] in WGS84[DD.DDDDD]
  type?: string
  isBest?: boolean
  matchQuality?: number
  isGlobalId?: boolean
  properties?: { stopId?: string }
  productClasses?: number[]
  parent?: { name?: string }
}

function mapLocation(loc: EfaLocation): TranslinkStop | null {
  const id = loc.properties?.stopId ?? loc.id
  if (!id) return null
  const [lat, lon] = loc.coord ?? [0, 0]
  return {
    stopId: id,
    stopName: loc.disassembledName ?? loc.name ?? id,
    lat,
    lon,
  }
}

export async function searchStops(query: string): Promise<StopsResponse> {
  if (isMock()) return { stops: mockSearchStops(query) }

  const data = await efaGet<{ locations?: EfaLocation[] }>('XML_STOPFINDER_REQUEST', {
    ext_macro: 'sf',
    type_sf: 'any',
    name_sf: query,
  })
  const stops = (data.locations ?? [])
    .map(mapLocation)
    .filter((s): s is TranslinkStop => s !== null)
  return { stops }
}

export async function searchStopsNear(
  lat: number,
  lon: number,
  radius = 600
): Promise<StopsResponse> {
  if (isMock()) return { stops: [] }

  const data = await efaGet<{ locations?: EfaLocation[] }>('XML_COORD_REQUEST', {
    ext_macro: 'coord',
    coord: `${lon}:${lat}:WGS84[DD.DDDDD]`,
    inclFilter: '1',
    type_1: 'STOP',
    radius_1: String(radius),
    max: '80',
  })
  const stops = (data.locations ?? [])
    .map(mapLocation)
    .filter((s): s is TranslinkStop => s !== null)
  return { stops }
}

// ---------- Departure Monitor ----------

interface EfaStopEvent {
  location?: { name?: string; parent?: { name?: string } }
  departureTimePlanned?: string
  departureTimeEstimated?: string
  isRealtimeControlled?: boolean
  isCancelled?: boolean
  transportation?: {
    number?: string
    destination?: { name?: string }
    product?: { class?: number; name?: string }
  }
}

function mapDeparture(ev: EfaStopEvent): Departure {
  const planned = ev.departureTimePlanned ?? ''
  const estimated = ev.departureTimeEstimated ?? planned
  const driftMs = estimated && planned ? new Date(estimated).getTime() - new Date(planned).getTime() : 0
  const status: Departure['status'] = ev.isCancelled
    ? 'Cancelled'
    : Math.abs(driftMs) > 60_000
      ? 'Delayed'
      : 'OnTime'
  return {
    serviceId: ev.transportation?.number ?? '',
    destination: ev.transportation?.destination?.name ?? '',
    scheduledDeparture: planned,
    expectedDeparture: estimated,
    status,
    isLive: !!ev.isRealtimeControlled,
  }
}

export async function getDepartures(stopId: string): Promise<DeparturesResponse> {
  if (isMock()) return mockDepartures(stopId)

  const data = await efaGet<{ stopEvents?: EfaStopEvent[] }>('XML_DM_REQUEST', {
    ext_macro: 'dm',
    type_dm: 'any',
    name_dm: stopId,
    limit: '20',
  })
  return {
    stopId,
    departures: (data.stopEvents ?? []).map(mapDeparture),
  }
}

// ---------- Trip / Journey Planning ----------

interface EfaLeg {
  duration?: number // seconds
  distance?: number // metres
  origin?: {
    name?: string
    id?: string
    coord?: [number, number]
    departureTimePlanned?: string
    departureTimeEstimated?: string
  }
  destination?: {
    name?: string
    id?: string
    coord?: [number, number]
    arrivalTimePlanned?: string
    arrivalTimeEstimated?: string
  }
  transportation?: {
    number?: string
    destination?: { name?: string }
    product?: { class?: number; name?: string }
  }
  stopSequence?: Array<{
    id?: string
    name?: string
    departureTimePlanned?: string
    arrivalTimePlanned?: string
  }>
}

interface EfaJourney {
  interchanges?: number
  legs?: EfaLeg[]
  isAdditional?: boolean
}

function modeFromClass(cls?: number): JourneyLeg['mode'] {
  if (cls === undefined || cls >= 99) return 'WALK'
  if (cls === 0 || cls === 1 || cls === 2 || cls === 3) return 'RAIL'
  return 'BUS'
}

function mapLeg(leg: EfaLeg): JourneyLeg {
  const cls = leg.transportation?.product?.class
  const mode = modeFromClass(cls)
  const start =
    leg.origin?.departureTimeEstimated ?? leg.origin?.departureTimePlanned ?? ''
  const end =
    leg.destination?.arrivalTimeEstimated ?? leg.destination?.arrivalTimePlanned ?? ''
  const [oLat, oLon] = leg.origin?.coord ?? [0, 0]
  const [dLat, dLon] = leg.destination?.coord ?? [0, 0]
  return {
    mode,
    from: { name: leg.origin?.name ?? '', stopId: leg.origin?.id, lat: oLat, lon: oLon },
    to: { name: leg.destination?.name ?? '', stopId: leg.destination?.id, lat: dLat, lon: dLon },
    startTime: start,
    endTime: end,
    duration: leg.duration ?? 0,
    distance: leg.distance,
    routeId: leg.transportation?.number,
    headsign: leg.transportation?.destination?.name,
    intermediateStops: leg.stopSequence
      ?.filter((s) => s.id)
      .map((s) => ({
        name: s.name ?? '',
        stopId: s.id ?? '',
        scheduledTime: s.departureTimePlanned ?? s.arrivalTimePlanned ?? '',
      })),
  }
}

function mapJourney(j: EfaJourney, idx: number): Itinerary {
  const legs = (j.legs ?? []).map(mapLeg)
  const first = legs[0]
  const last = legs[legs.length - 1]
  const duration = legs.reduce((sum, l) => sum + (l.duration || 0), 0)
  return {
    id: `j${idx}`,
    duration,
    transfers: j.interchanges ?? Math.max(0, legs.filter((l) => l.mode !== 'WALK').length - 1),
    legs,
    departure: first?.startTime ?? '',
    arrival: last?.endTime ?? '',
  }
}

function localityParams(value: string, suffix: 'origin' | 'destination') {
  // Coordinate input: "lat,lon" (what the app sends from geolocation).
  // EFA coord format is "<lon>:<lat>:WGS84[DD.DDDDD]".
  const coordMatch = value.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/)
  if (coordMatch) {
    const [, lat, lon] = coordMatch
    return {
      [`type_${suffix}`]: 'coord',
      [`name_${suffix}`]: `${lon}:${lat}:WGS84[DD.DDDDD]`,
    }
  }
  return {
    [`type_${suffix}`]: 'any',
    [`name_${suffix}`]: value,
  }
}

export async function planJourney(params: {
  from: string
  to: string
  date: string // YYYY-MM-DD or YYYYMMDD
  time: string // HH:MM or HHMM
  arriveBy?: boolean
}): Promise<JourneyPlanResponse> {
  if (isMock()) return mockJourney(params)

  const itdDate = params.date.replace(/\D/g, '') // 2026-04-16 -> 20260416
  const itdTime = params.time.replace(/\D/g, '') // 21:05 -> 2105

  const data = await efaGet<{ journeys?: EfaJourney[] }>('XML_TRIP_REQUEST2', {
    ext_macro: 'trip',
    ...localityParams(params.from, 'origin'),
    ...localityParams(params.to, 'destination'),
    itdDate,
    itdTime,
    itdTripDateTimeDepArr: params.arriveBy ? 'arr' : 'dep',
    calcNumberOfTrips: '4',
    ptOptionsActive: '1',
  })
  return { itineraries: (data.journeys ?? []).map(mapJourney) }
}

export function rankItineraries(itineraries: Itinerary[]): RankedItinerary[] {
  if (itineraries.length === 0) return []

  const byDuration = [...itineraries].sort((a, b) => a.duration - b.duration)
  const byTransfers = [...itineraries].sort((a, b) => a.transfers - b.transfers)

  const fastest = byDuration[0]
  const fewerChanges = byTransfers[0]
  const alternative =
    itineraries.find((i) => i.id !== fastest.id && i.id !== fewerChanges.id) ??
    byDuration[1] ??
    byDuration[0]

  const fewerChangesResult =
    fewerChanges.id === fastest.id ? (byTransfers[1] ?? byTransfers[0]) : fewerChanges

  return [
    { ...fastest, badge: 'Fastest' },
    { ...fewerChangesResult, badge: 'Fewer Changes' },
    { ...alternative, badge: 'Alternative' },
  ]
}
