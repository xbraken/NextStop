// Photon by Komoot — free OSM-backed geocoding, no API key needed
// NI bounding box: west=-8.2, south=54.0, east=-5.4, north=55.3

const PHOTON_URL = 'https://photon.komoot.io/api'
const NI_BBOX = '-8.2,54.0,-5.4,55.3'

export interface PhotonResult {
  type: 'address'
  name: string
  street?: string
  city?: string
  postcode?: string
  lat: number
  lon: number
  displayName: string
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    postcode?: string
    county?: string
    type?: string
    osm_value?: string
  }
}

export async function searchPhoton(query: string): Promise<PhotonResult[]> {
  if (query.length < 2) return []

  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=4&lang=en&bbox=${NI_BBOX}`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(3000),
  })

  if (!res.ok) return []

  const data = await res.json()
  const features: PhotonFeature[] = data.features ?? []

  return features.map((f) => {
    const p = f.properties
    const [lon, lat] = f.geometry.coordinates

    // Build a readable display name
    const parts = [
      p.name,
      p.street && p.housenumber ? `${p.housenumber} ${p.street}` : p.street,
      p.city ?? p.county,
    ].filter(Boolean)

    const displayName = parts.join(', ') || p.name || 'Unknown location'

    return {
      type: 'address' as const,
      name: p.name ?? displayName,
      street: p.street,
      city: p.city ?? p.county,
      postcode: p.postcode,
      lat,
      lon,
      displayName,
    }
  })
}
