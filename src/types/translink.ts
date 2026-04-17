export interface TranslinkStop {
  stopId: string
  stopName: string
  lat: number
  lon: number
  routes?: string[]
}

export interface StopsResponse {
  stops: TranslinkStop[]
}

export interface Departure {
  serviceId: string
  destination: string
  scheduledDeparture: string
  expectedDeparture: string
  platform?: string
  status: 'OnTime' | 'Delayed' | 'Cancelled'
  isLive: boolean
}

export interface DeparturesResponse {
  stopId: string
  departures: Departure[]
}

export interface JourneyLeg {
  mode: 'WALK' | 'BUS' | 'RAIL'
  from: { name: string; stopId?: string; lat: number; lon: number }
  to: { name: string; stopId?: string; lat: number; lon: number }
  startTime: string
  endTime: string
  duration: number // seconds
  distance?: number // metres
  routeId?: string
  headsign?: string
  intermediateStops?: Array<{
    name: string
    stopId: string
    scheduledTime: string
    lat?: number
    lon?: number
  }>
}

export interface Itinerary {
  id: string
  duration: number // seconds total
  transfers: number
  legs: JourneyLeg[]
  departure: string
  arrival: string
}

export interface JourneyPlanResponse {
  itineraries: Itinerary[]
}

export interface RankedItinerary extends Itinerary {
  badge: 'Fastest' | 'Fewer Changes' | 'Alternative'
}
