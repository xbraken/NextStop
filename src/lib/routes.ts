export function parseRoutes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)
    )
  )
}

// Sort numerically when both start with a number (so 3, 3a, 10, 10a order naturally)
export function routeSort(a: string, b: string) {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
  return a.localeCompare(b)
}
