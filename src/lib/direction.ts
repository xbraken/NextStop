import type { StopDirection } from '@/types/user'

// Headsign keywords that indicate a city-bound (inbound) service in NI.
// Heuristic: Translink doesn't expose a canonical direction flag on every
// departure, so we match the destination text against known city-centre
// terminuses. Works for Belfast — extend as needed for other hubs.
const INBOUND_RE =
  /city centre|belfast|donegall|europa|central station|grand central|laganside/i

export function isInbound(destination: string | null | undefined): boolean {
  if (!destination) return false
  return INBOUND_RE.test(destination)
}

export function matchesDirection(
  destination: string | null | undefined,
  direction: StopDirection | null | undefined
): boolean {
  if (!direction) return true
  return direction === 'inbound' ? isInbound(destination) : !isInbound(destination)
}

export function parseDirection(value: string | null | undefined): StopDirection | null {
  return value === 'inbound' || value === 'outbound' ? value : null
}
