import type { TranslinkStop, Departure, Itinerary } from '@/types/translink'

export const MOCK_STOPS: TranslinkStop[] = [
  { stopId: 'BEL8270413', stopName: 'City Hall, Belfast', lat: 54.5968, lon: -5.9300, routes: ['1A', '6B', '8A'] },
  { stopId: 'BEL9400413', stopName: 'Europa Bus Centre, Belfast', lat: 54.5939, lon: -5.9363, routes: ['1A', '3A', '10B'] },
  { stopId: 'BEL1230001', stopName: "Queen's University, Belfast", lat: 54.5843, lon: -5.9349, routes: ['8A', '9C'] },
  { stopId: 'LIS0010001', stopName: 'Lisburn Bus Station', lat: 54.5163, lon: -6.0492, routes: ['1A', '2B'] },
  { stopId: 'BEL0020001', stopName: 'Botanic Avenue, Belfast', lat: 54.5861, lon: -5.9313, routes: ['7C', '9C'] },
  { stopId: 'BEL0030001', stopName: 'Great Victoria Street Station', lat: 54.5944, lon: -5.9378, routes: ['GVS'] },
  { stopId: 'BEL0040001', stopName: 'Lanyon Place (Central Station)', lat: 54.5984, lon: -5.9156, routes: ['RAIL'] },
  { stopId: 'NEW0010001', stopName: 'Newtownabbey Bus Centre', lat: 54.6588, lon: -5.9218, routes: ['2A', '5B'] },
]

export function mockSearchStops(query: string): TranslinkStop[] {
  const q = query.toLowerCase()
  return MOCK_STOPS.filter(
    (s) =>
      s.stopName.toLowerCase().includes(q) ||
      s.stopId.toLowerCase().includes(q)
  ).slice(0, 5)
}

export function mockDepartures(stopId: string): { stopId: string; departures: Departure[] } {
  const now = new Date()
  const departures: Departure[] = [
    {
      serviceId: '1A',
      destination: 'Lisburn',
      scheduledDeparture: new Date(now.getTime() + 4 * 60_000).toISOString(),
      expectedDeparture: new Date(now.getTime() + 4 * 60_000).toISOString(),
      platform: '2',
      status: 'OnTime',
      isLive: true,
    },
    {
      serviceId: '6B',
      destination: 'Dundonald',
      scheduledDeparture: new Date(now.getTime() + 8 * 60_000).toISOString(),
      expectedDeparture: new Date(now.getTime() + 11 * 60_000).toISOString(),
      platform: '4',
      status: 'Delayed',
      isLive: true,
    },
    {
      serviceId: '8A',
      destination: "Queen's University",
      scheduledDeparture: new Date(now.getTime() + 15 * 60_000).toISOString(),
      expectedDeparture: new Date(now.getTime() + 15 * 60_000).toISOString(),
      platform: '1',
      status: 'OnTime',
      isLive: false,
    },
  ]
  return { stopId, departures }
}

export function mockJourney(params: {
  from: string
  to: string
  date: string
  time: string
}): { itineraries: Itinerary[] } {
  const base = new Date(`${params.date}T${params.time}:00`)

  const itineraries: Itinerary[] = [
    {
      id: '0',
      duration: 1680, // 28 mins
      transfers: 1,
      departure: new Date(base.getTime() + 4 * 60_000).toISOString(),
      arrival: new Date(base.getTime() + 32 * 60_000).toISOString(),
      legs: [
        {
          mode: 'WALK',
          from: { name: 'Current Location', lat: 54.597, lon: -5.931 },
          to: { name: 'City Hall', stopId: params.from || 'BEL8270413', lat: 54.5968, lon: -5.93 },
          startTime: base.toISOString(),
          endTime: new Date(base.getTime() + 3 * 60_000).toISOString(),
          duration: 180,
          distance: 240,
        },
        {
          mode: 'BUS',
          from: { name: 'City Hall', stopId: params.from || 'BEL8270413', lat: 54.5968, lon: -5.93 },
          to: { name: 'Europa Bus Centre', stopId: 'BEL9400413', lat: 54.5939, lon: -5.9363 },
          startTime: new Date(base.getTime() + 4 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 16 * 60_000).toISOString(),
          duration: 720,
          routeId: '1A',
          headsign: 'Lisburn',
        },
        {
          mode: 'BUS',
          from: { name: 'Europa Bus Centre', stopId: 'BEL9400413', lat: 54.5939, lon: -5.9363 },
          to: { name: params.to || 'Lisburn Bus Station', stopId: params.to || 'LIS0010001', lat: 54.5163, lon: -6.0492 },
          startTime: new Date(base.getTime() + 18 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 29 * 60_000).toISOString(),
          duration: 660,
          routeId: '3A',
          headsign: 'Lisburn',
        },
        {
          mode: 'WALK',
          from: { name: params.to || 'Lisburn Bus Station', stopId: params.to || 'LIS0010001', lat: 54.5163, lon: -6.0492 },
          to: { name: 'Destination', lat: 54.5166, lon: -6.0498 },
          startTime: new Date(base.getTime() + 29 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 32 * 60_000).toISOString(),
          duration: 180,
          distance: 200,
        },
      ],
    },
    {
      id: '1',
      duration: 2040, // 34 mins
      transfers: 0,
      departure: new Date(base.getTime() + 12 * 60_000).toISOString(),
      arrival: new Date(base.getTime() + 46 * 60_000).toISOString(),
      legs: [
        {
          mode: 'WALK',
          from: { name: 'Current Location', lat: 54.597, lon: -5.931 },
          to: { name: 'Great Victoria Street Station', stopId: 'BEL0030001', lat: 54.5944, lon: -5.9378 },
          startTime: base.toISOString(),
          endTime: new Date(base.getTime() + 8 * 60_000).toISOString(),
          duration: 480,
          distance: 620,
        },
        {
          mode: 'BUS',
          from: { name: 'Great Victoria Street Station', stopId: 'BEL0030001', lat: 54.5944, lon: -5.9378 },
          to: { name: params.to || 'Lisburn Bus Station', stopId: params.to || 'LIS0010001', lat: 54.5163, lon: -6.0492 },
          startTime: new Date(base.getTime() + 12 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 44 * 60_000).toISOString(),
          duration: 1920,
          routeId: '10B',
          headsign: 'Lisburn Express',
        },
        {
          mode: 'WALK',
          from: { name: params.to || 'Lisburn Bus Station', stopId: params.to || 'LIS0010001', lat: 54.5163, lon: -6.0492 },
          to: { name: 'Destination', lat: 54.5166, lon: -6.0498 },
          startTime: new Date(base.getTime() + 44 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 46 * 60_000).toISOString(),
          duration: 120,
          distance: 150,
        },
      ],
    },
    {
      id: '2',
      duration: 2460, // 41 mins
      transfers: 1,
      departure: new Date(base.getTime() + 18 * 60_000).toISOString(),
      arrival: new Date(base.getTime() + 59 * 60_000).toISOString(),
      legs: [
        {
          mode: 'WALK',
          from: { name: 'Current Location', lat: 54.597, lon: -5.931 },
          to: { name: 'Botanic Avenue', stopId: 'BEL0020001', lat: 54.5861, lon: -5.9313 },
          startTime: base.toISOString(),
          endTime: new Date(base.getTime() + 5 * 60_000).toISOString(),
          duration: 300,
          distance: 410,
        },
        {
          mode: 'BUS',
          from: { name: 'Botanic Avenue', stopId: 'BEL0020001', lat: 54.5861, lon: -5.9313 },
          to: { name: 'Europa Bus Centre', stopId: 'BEL9400413', lat: 54.5939, lon: -5.9363 },
          startTime: new Date(base.getTime() + 18 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 30 * 60_000).toISOString(),
          duration: 720,
          routeId: '2C',
          headsign: 'City Centre',
        },
        {
          mode: 'BUS',
          from: { name: 'Europa Bus Centre', stopId: 'BEL9400413', lat: 54.5939, lon: -5.9363 },
          to: { name: params.to || 'Lisburn Bus Station', stopId: params.to || 'LIS0010001', lat: 54.5163, lon: -6.0492 },
          startTime: new Date(base.getTime() + 35 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 57 * 60_000).toISOString(),
          duration: 1320,
          routeId: '5A',
          headsign: 'Lisburn via Dunmurry',
        },
        {
          mode: 'WALK',
          from: { name: params.to || 'Lisburn Bus Station', stopId: params.to || 'LIS0010001', lat: 54.5163, lon: -6.0492 },
          to: { name: 'Destination', lat: 54.5166, lon: -6.0498 },
          startTime: new Date(base.getTime() + 57 * 60_000).toISOString(),
          endTime: new Date(base.getTime() + 59 * 60_000).toISOString(),
          duration: 120,
          distance: 150,
        },
      ],
    },
  ]

  return { itineraries }
}
