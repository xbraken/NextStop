// Great-circle distance in metres. Accurate enough for pedestrian-scale
// progress tracking (under ~50km).
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function formatMetres(m: number): string {
  if (!isFinite(m)) return ''
  if (m < 20) return 'here'
  if (m < 1000) return `${Math.round(m / 5) * 5} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`
}
