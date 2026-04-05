import type { StopsResponse, DeparturesResponse, JourneyPlanResponse } from '@/types/translink'
import { mockSearchStops, mockDepartures, mockJourney } from './mocks/translink'

const BASE = 'https://api.opendata.aws/translink'
const isMock = () => process.env.TRANSLINK_MOCK === 'true'

function apiKey() {
  const key = process.env.TRANSLINK_API_KEY
  if (!key && !isMock()) throw new Error('TRANSLINK_API_KEY is not set')
  return key ?? ''
}

export async function searchStops(query: string): Promise<StopsResponse> {
  if (isMock()) {
    return { stops: mockSearchStops(query) }
  }
  const res = await fetch(
    `${BASE}/stops?search=${encodeURIComponent(query)}`,
    {
      headers: { 'x-api-key': apiKey() },
      next: { revalidate: 3600 },
    }
  )
  if (!res.ok) throw new Error(`Translink stops error: ${res.status}`)
  return res.json()
}

export async function getDepartures(stopId: string): Promise<DeparturesResponse> {
  if (isMock()) {
    return mockDepartures(stopId)
  }
  const res = await fetch(
    `${BASE}/departures?stopId=${encodeURIComponent(stopId)}`,
    {
      headers: { 'x-api-key': apiKey() },
      next: { revalidate: 30 },
    }
  )
  if (!res.ok) throw new Error(`Translink departures error: ${res.status}`)
  return res.json()
}

export async function planJourney(params: {
  from: string
  to: string
  date: string
  time: string
  arriveBy?: boolean
}): Promise<JourneyPlanResponse> {
  if (isMock()) {
    return mockJourney(params)
  }
  const res = await fetch(`${BASE}/journey`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Translink journey error: ${res.status}`)
  return res.json()
}
