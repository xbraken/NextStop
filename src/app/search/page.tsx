'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { PhotonResult } from '@/lib/photon'
import { Suspense } from 'react'

// Simple in-memory cache so repeated queries don't hit the network
const photonCache = new Map<string, PhotonResult[]>()
const nominatimCache = new Map<string, PhotonResult[]>()

// Northern Ireland bounding box — west,south,east,north.
// Used as a hard filter so geocoders never return results from GB or Ireland.
const NI_WEST = -8.2
const NI_SOUTH = 54.0
const NI_EAST = -5.4
const NI_NORTH = 55.3

function inNI(lat: number, lon: number): boolean {
  return lat >= NI_SOUTH && lat <= NI_NORTH && lon >= NI_WEST && lon <= NI_EAST
}

async function fetchPhoton(q: string, signal: AbortSignal): Promise<PhotonResult[]> {
  const cached = photonCache.get(q)
  if (cached) return cached

  // bbox biases Photon's ranking; we still filter client-side since Photon
  // can leak results just outside the box.
  const bbox = `${NI_WEST},${NI_SOUTH},${NI_EAST},${NI_NORTH}`
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=${bbox}`
  const res = await fetch(url, { signal })
  if (!res.ok) return []

  const data = await res.json()
  const results: PhotonResult[] = (data.features ?? [])
    .filter((f: { geometry?: { coordinates?: [number, number] } }) => {
      const c = f.geometry?.coordinates
      return c && inNI(c[1], c[0])
    })
    .map((f: {
      geometry: { coordinates: [number, number] }
      properties: { name?: string; street?: string; housenumber?: string; city?: string; county?: string; postcode?: string; countrycode?: string }
    }) => {
      const p = f.properties
      const [lon, lat] = f.geometry.coordinates
      const parts = [
        p.housenumber && p.street ? `${p.housenumber} ${p.street}` : (p.name ?? p.street),
        p.city ?? p.county,
      ].filter(Boolean)
      const displayName = parts.join(', ') || p.name || 'Unknown'
      return { type: 'address' as const, name: displayName, street: p.street, city: p.city ?? p.county, postcode: p.postcode, lat, lon, displayName }
    })
    .slice(0, 5)

  photonCache.set(q, results)
  return results
}

// Nominatim fallback — better UK house number coverage, 1 req/sec limit is fine for typed queries
async function fetchNominatim(q: string, signal: AbortSignal): Promise<PhotonResult[]> {
  const cached = nominatimCache.get(q)
  if (cached) return cached

  // bounded=1 makes the viewbox a hard limit instead of a hint, so results
  // outside Northern Ireland are excluded.
  const viewbox = `${NI_WEST},${NI_NORTH},${NI_EAST},${NI_SOUTH}`
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Northern Ireland')}&format=json&limit=5&countrycodes=gb&addressdetails=1&viewbox=${viewbox}&bounded=1`
  const res = await fetch(url, {
    signal,
    headers: { 'Accept-Language': 'en', 'User-Agent': 'NextStop/1.0' },
  })
  if (!res.ok) return []

  const data = await res.json()
  const results: PhotonResult[] = (data as Array<{
    lat: string; lon: string; display_name: string
    address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; county?: string }
  }>)
    .map((item) => {
      const addr = item.address ?? {}
      const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? 'Northern Ireland'
      const street = addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : addr.road
      const name = street ? `${street}, ${city}` : item.display_name.split(',').slice(0, 2).join(',').trim()
      return {
        type: 'address' as const,
        name,
        displayName: name,
        street: addr.road,
        city,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }
    })
    .filter((r) => inNI(r.lat, r.lon))

  nominatimCache.set(q, results)
  return results
}

// A selected location is always an address/place — bus stops are handled
// from the live page, not from the journey search.
type SelectedLocation = { kind: 'address'; name: string; lat: number; lon: number }

interface SearchResults {
  places: PhotonResult[]
}

const ITEM_H = 44

function ScrollPicker({
  items,
  selectedIndex,
  onChange,
}: {
  items: string[]
  selectedIndex: number
  onChange: (index: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null)
  const programmatic = useRef(false)

  // Set initial scroll position once on mount — no deps to avoid feedback loop
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedIndex * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (programmatic.current) return
    if (settling.current) clearTimeout(settling.current)
    settling.current = setTimeout(() => {
      if (!ref.current) return
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(ref.current.scrollTop / ITEM_H)))
      onChange(idx)
    }, 100)
  }

  function scrollTo(i: number) {
    if (!ref.current) return
    programmatic.current = true
    ref.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
    onChange(i)
    setTimeout(() => { programmatic.current = false }, 300)
  }

  return (
    <div className="relative w-16 h-[132px] overflow-hidden select-none">
      <div className="absolute inset-x-0 top-[44px] h-[44px] border-y border-outline-variant/30 pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-surface-container-lowest to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none z-10" />
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <div style={{ height: ITEM_H }} />
        {items.map((item, i) => (
          <div
            key={i}
            style={{ scrollSnapAlign: 'center', height: ITEM_H }}
            className={`flex items-center justify-center text-2xl font-headline font-bold cursor-pointer transition-colors
              ${i === selectedIndex ? 'text-primary' : 'text-on-surface-variant'}`}
            onPointerDown={() => scrollTo(i)}
          >
            {item}
          </div>
        ))}
        <div style={{ height: ITEM_H }} />
      </div>
    </div>
  )
}

function LocationDropdown({
  results,
  onSelect,
}: {
  results: SearchResults
  onSelect: (loc: SelectedLocation) => void
}) {
  if (results.places.length === 0) return null

  return (
    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.12)] overflow-hidden border border-outline-variant/20 animate-fade-in-down">
      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
          Places
        </span>
      </div>
      {results.places.map((place, i) => (
        <button
          key={i}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
          onPointerDown={(e) => {
            e.preventDefault()
            onSelect({ kind: 'address', name: place.displayName, lat: place.lat, lon: place.lon })
          }}
        >
          <div className="w-7 h-7 bg-surface-container rounded-lg flex items-center justify-center shrink-0">
            <Icon name="location_on" size={15} className="text-outline" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-on-surface block truncate">{place.name}</span>
            {place.city && (
              <span className="text-xs text-on-surface-variant truncate block">{place.city}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

function LocationField({
  label,
  icon,
  iconBg,
  value,
  onChange,
  onSelect,
  onFocusChange,
  placeholder,
  autoFocus,
}: {
  label: string
  icon: string
  iconBg: string
  value: string
  onChange: (v: string) => void
  onSelect: (loc: SelectedLocation) => void
  onFocusChange?: (focused: boolean) => void
  placeholder: string
  autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [results, setResults] = useState<SearchResults>({ places: [] })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!focused || value.length < 2 || value === 'Current Location') {
      setResults({ places: [] })
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // If query starts with a house number (e.g. "3 Tillysburn Drive"),
      // search the street name alone and prepend the number to each result
      const houseMatch = value.match(/^(\d+[a-z]?)\s+(.+)$/i)
      const houseNumber = houseMatch?.[1] ?? null
      const streetQuery = houseMatch?.[2] ?? value

      function prependHouseNumber(places: PhotonResult[]): PhotonResult[] {
        if (!houseNumber) return places
        return places.map((p) => ({
          ...p,
          name: `${houseNumber} ${p.name}`,
          displayName: `${houseNumber} ${p.displayName}`,
        }))
      }

      fetchPhoton(streetQuery, controller.signal)
        .then((places) => setResults({ places: prependHouseNumber(places) }))
        .catch(() => {})

      fetchNominatim(streetQuery, controller.signal)
        .then((nominatim) => {
          setResults((prev) => {
            const existing = prev.places.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`)
            const novel = prependHouseNumber(
              nominatim.filter((n) => !existing.includes(`${n.lat.toFixed(3)},${n.lon.toFixed(3)}`))
            )
            return { places: [...prev.places, ...novel].slice(0, 6) }
          })
        })
        .catch(() => {})
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [value, focused])

  const showDropdown = focused && results.places.length > 0

  function clear() {
    onChange('')
    setResults({ places: [] })
    abortRef.current?.abort()
  }

  return (
    <div className="relative">
      <div className="relative z-10 flex items-center gap-4 bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_24px_rgba(26,28,28,0.04)]">
        <div className={`flex items-center justify-center w-8 h-8 ${iconBg} rounded-full shrink-0`}>
          <Icon name={icon} filled size={18} className="text-primary" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
            {label}
          </span>
          <input
            className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-on-surface text-base outline-none placeholder:text-outline-variant"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => { setFocused(true); onFocusChange?.(true); if (value === 'Current Location') onChange('') }}
            onBlur={() => { setFocused(false); onFocusChange?.(false) }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        {value.length > 0 && value !== 'Current Location' && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="shrink-0 text-outline hover:text-on-surface-variant"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      {showDropdown && (
        <LocationDropdown
          results={results}
          onSelect={(loc) => {
            onChange(loc.name)
            setFocused(false)
            onFocusChange?.(false)
            setResults({ places: [] })
            abortRef.current?.abort()
            ;(document.activeElement as HTMLElement)?.blur()
            onSelect(loc)
          }}
        />
      )}
    </div>
  )
}

interface RecentItem {
  to_label: string
  to_id: string
  from_label: string
  from_id: string
}

function SearchPageInner() {
  const router = useRouter()
  const params = useSearchParams()

  const today = new Date()
  const [fromQuery, setFromQuery] = useState('Current Location')
  const [toQuery, setToQuery] = useState(params.get('toName') ?? '')
  const [fromLocation, setFromLocation] = useState<SelectedLocation | null>(null)
  const [toLocation, setToLocation] = useState<SelectedLocation | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'duplicate'>('idle')
  const [mode, setMode] = useState<'leave_now' | 'leave_at'>('leave_at')
  const [selectedDate, setSelectedDate] = useState(0)
  const [timeHour, setTimeHour] = useState(today.getHours())
  const [timeMinute, setTimeMinute] = useState(Math.floor(today.getMinutes() / 5) * 5)
  const [recents, setRecents] = useState<RecentItem[]>([])
  const [showTimePicker, setShowTimePicker] = useState(false)
  const modeSectionRef = useRef<HTMLElement>(null)

  // Get device location for real FROM coordinates
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFromLocation({ kind: 'address', name: 'Current Location', lat: coords.latitude, lon: coords.longitude })
      },
      () => {} // permission denied or unavailable — silently fall back
    )
  }, [])

  // Fetch real recents from journey history
  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => setRecents(data.history ?? []))
      .catch(() => {})
  }, [])

  // Pre-fill TO from URL params (used by Saved → search flow). The ID is
  // stored as "lat,lon" for places; older stop-ID values just pre-fill the
  // text and let the user re-pick from search.
  useEffect(() => {
    const toId = params.get('to')
    const toName = params.get('toName')
    if (toId && toName) {
      const coordMatch = toId.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/)
      if (coordMatch) {
        setToLocation({
          kind: 'address',
          name: toName,
          lat: parseFloat(coordMatch[1]),
          lon: parseFloat(coordMatch[2]),
        })
      }
      setToQuery(toName)
    }
  }, [params])

  // Reset save state when destination changes
  useEffect(() => { setSaveState('idle') }, [toLocation])

  // Auto-scroll mode section into view after TO is selected
  useEffect(() => {
    if (toLocation && !isSearching) {
      const id = setTimeout(() => {
        modeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      return () => clearTimeout(id)
    }
  }, [toLocation, isSearching])

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  function getDateString() {
    return dates[selectedDate].toISOString().split('T')[0]
  }

  function getTimeString() {
    return `${String(timeHour).padStart(2, '0')}:${String(timeMinute).padStart(2, '0')}`
  }

  // Build the id/name pair the journey planner needs. Prefer a picked
  // location's lat,lon, fall back to whatever text the user typed (the EFA
  // API can geocode names), and only use the 'current' token when neither
  // exists — that special value signals "use current geolocation".
  function locationToParams(
    loc: SelectedLocation | null,
    typed: string,
    fallbackName: string
  ) {
    if (loc) return { id: `${loc.lat},${loc.lon}`, name: loc.name }
    const trimmed = typed.trim()
    if (trimmed && trimmed !== 'Current Location') {
      return { id: trimmed, name: trimmed }
    }
    return { id: 'current', name: fallbackName }
  }

  async function handleSaveDestination() {
    if (!toLocation) return
    setSaveState('saving')
    const stop_id = `${toLocation.lat},${toLocation.lon}`
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: toLocation.name, stop_name: toLocation.name, stop_id, lat: toLocation.lat, lng: toLocation.lon }),
    })
    if (res.status === 409) { setSaveState('duplicate'); return }
    if (!res.ok) { setSaveState('idle'); return }
    setSaveState('saved')
  }

  function getTimeChipLabel() {
    if (mode === 'leave_now') return 'Leave now'
    const d = dates[selectedDate]
    const dayLabel = selectedDate === 0 ? 'Today' : DAY_NAMES[d.getDay()]
    return `${dayLabel} · ${getTimeString()}`
  }

  function handleSwap() {
    setFromQuery(toQuery)
    setToQuery(fromQuery)
    setFromLocation(toLocation)
    setToLocation(fromLocation)
  }

  // When the user types a query but never picks from the dropdown, geocode
  // it inline so the planner receives a real lat,lon. This matters because
  // the EFA API doesn't reliably resolve free-text place names.
  async function resolveLocation(
    loc: SelectedLocation | null,
    typed: string
  ): Promise<SelectedLocation | null> {
    if (loc) return loc
    const trimmed = typed.trim()
    if (!trimmed || trimmed === 'Current Location') return null
    const controller = new AbortController()
    const [photon, nominatim] = await Promise.all([
      fetchPhoton(trimmed, controller.signal).catch(() => []),
      fetchNominatim(trimmed, controller.signal).catch(() => []),
    ])
    const top = photon[0] ?? nominatim[0]
    if (!top) return null
    return { kind: 'address', name: top.displayName, lat: top.lat, lon: top.lon }
  }

  async function handleFindJourneys() {
    if (!toLocation && toQuery.trim().length < 2) return

    const resolvedTo = await resolveLocation(toLocation, toQuery)
    if (!resolvedTo && !toQuery.trim()) return
    if (resolvedTo && !toLocation) {
      setToLocation(resolvedTo)
      setToQuery(resolvedTo.name)
    }

    const from = locationToParams(fromLocation, fromQuery, 'Current Location')
    const to = locationToParams(resolvedTo ?? toLocation, toQuery, toQuery)

    if (!to.id || to.id === 'current') return

    // Write to journey history (fire-and-forget)
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_label: from.name, from_id: from.id, to_label: to.name, to_id: to.id }),
    }).catch(() => {})

    router.push(
      `/journey?from=${encodeURIComponent(from.id)}&fromName=${encodeURIComponent(from.name)}&to=${encodeURIComponent(to.id)}&toName=${encodeURIComponent(to.name)}&date=${getDateString()}&time=${getTimeString()}&mode=${mode}`
    )
  }

  const canSearch = !!(toLocation || toQuery.length > 1)

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center px-6 gap-4">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors active:scale-95 text-primary">
          <Icon name="arrow_back" size={22} />
        </Link>
        <h1 className="font-headline font-bold text-xl text-primary">Find Journey</h1>
      </header>

      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-8 pb-36">
        {/* FROM / TO */}
        <section className="space-y-3 pt-2">
          <div className="relative flex flex-col gap-3">
            {/* Connector line */}
            <div className="absolute left-8 top-14 bottom-14 w-0.5 bg-outline-variant/30 z-0" />

            <LocationField
              label="From"
              icon="location_on"
              iconBg="bg-primary/10"
              value={fromQuery}
              onChange={(v) => { setFromQuery(v); setFromLocation(null) }}
              onSelect={(loc) => setFromLocation(loc)}
              onFocusChange={setIsSearching}
              placeholder="Current location or address"
            />

            {/* Swap button — sits in the gap between FROM and TO */}
            <div className="flex justify-end relative z-20 -my-1.5 pr-3 pointer-events-none">
              <button
                type="button"
                onClick={handleSwap}
                className="pointer-events-auto w-8 h-8 rounded-full bg-white border border-outline-variant/40 shadow-md flex items-center justify-center text-primary hover:bg-primary/10 active:scale-95 transition-all"
                aria-label="Swap origin and destination"
              >
                <Icon name="swap_vert" size={18} />
              </button>
            </div>

            <LocationField
              label="To"
              icon="radio_button_unchecked"
              iconBg="bg-surface-container-high"
              value={toQuery}
              onChange={(v) => { setToQuery(v); setToLocation(null) }}
              onSelect={(loc) => setToLocation(loc)}
              onFocusChange={setIsSearching}
              placeholder="Where to?"
              autoFocus={!params.get('to')}
            />
          </div>

          {/* Save destination row — smoothly slides in after a TO is selected */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${toLocation && !isSearching ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
          >
            <div className="overflow-hidden">
              <div className="pt-3">
                <button
                  onClick={handleSaveDestination}
                  disabled={saveState === 'saving' || saveState === 'saved' || saveState === 'duplicate'}
                  className="w-full flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:bg-surface-container-low transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${saveState === 'saved' ? 'bg-primary/20' : 'bg-primary/10'}`}>
                    <Icon
                      name={saveState === 'saved' ? 'bookmark' : 'bookmark_add'}
                      filled={saveState === 'saved'}
                      size={20}
                      className="text-primary"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-on-surface transition-all duration-200">
                      {saveState === 'saved' ? 'Destination saved!' : saveState === 'duplicate' ? 'Already saved' : 'Save this destination'}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">{toLocation?.name}</p>
                  </div>
                  <div className={`transition-all duration-200 ${saveState === 'idle' ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full shrink-0">Save</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Time chip + Recents — smoothly collapse when the user is typing */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${isSearching ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-8">
              {/* Time chip — collapsed by default */}
              <section ref={modeSectionRef}>
                <button
                  onClick={() => setShowTimePicker((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest rounded-full shadow-sm border border-outline-variant/20 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-all active:scale-95"
                >
                  <Icon name="schedule" size={16} className="text-primary" />
                  <span>{getTimeChipLabel()}</span>
                  <Icon
                    name={showTimePicker ? 'expand_less' : 'expand_more'}
                    size={16}
                    className="text-outline transition-transform duration-200"
                  />
                </button>

                {/* Time picker panel — smooth expand */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${showTimePicker ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="mt-4 space-y-4">
                      {/* Leave now / Leave at */}
                      <div className="flex gap-2">
                        {(['leave_now', 'leave_at'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => { setMode(m); if (m === 'leave_now') setShowTimePicker(false) }}
                            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200
                              ${mode === m ? 'bg-primary text-on-primary shadow-md shadow-primary/20' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
                          >
                            {m === 'leave_now' ? 'Leave now' : 'Leave at'}
                          </button>
                        ))}
                      </div>

                      {/* Date + time picker — slide in when leave_at */}
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${mode === 'leave_at' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-4">
                            {/* Date chips */}
                            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                              {dates.map((d, i) => (
                                <button
                                  key={i}
                                  onClick={() => setSelectedDate(i)}
                                  className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-2xl transition-all duration-200
                                    ${selectedDate === i ? 'bg-primary text-on-primary shadow-md scale-105' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20'}`}
                                >
                                  <span className="text-[9px] font-bold uppercase tracking-tighter opacity-80">
                                    {i === 0 ? 'Today' : DAY_NAMES[d.getDay()]}
                                  </span>
                                  <span className="text-lg font-headline font-bold">{d.getDate()}</span>
                                </button>
                              ))}
                            </div>

                            {/* Drum roll time picker */}
                            <div className="bg-surface-container-lowest rounded-2xl shadow-sm px-6 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <ScrollPicker
                                  items={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))}
                                  selectedIndex={timeHour}
                                  onChange={setTimeHour}
                                />
                                <span className="text-3xl font-headline font-extrabold text-outline-variant pb-0.5">:</span>
                                <ScrollPicker
                                  items={Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))}
                                  selectedIndex={timeMinute / 5}
                                  onChange={(i) => setTimeMinute(i * 5)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Recents */}
              {recents.length > 0 && (
                <section className="space-y-4">
                  <h3 className="font-headline font-bold text-lg">Recents</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {recents.slice(0, 4).map((item, i) => {
                      const coord = item.to_id.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/)
                      const isWide = i === 0
                      return (
                        <button
                          key={item.to_id}
                          style={{ animationDelay: `${i * 0.06}s` }}
                          className={`animate-fade-in-up animate-stagger ${isWide ? 'col-span-2' : ''} bg-surface-container-lowest p-5 rounded-2xl flex ${isWide ? 'flex-row items-center gap-4' : 'flex-col gap-3'} shadow-sm border border-outline-variant/10 text-left hover:bg-surface-container-low hover:shadow-md transition-all duration-200 active:scale-[0.99]`}
                          onClick={() => {
                            if (coord) {
                              setToLocation({
                                kind: 'address',
                                name: item.to_label,
                                lat: parseFloat(coord[1]),
                                lon: parseFloat(coord[2]),
                              })
                            }
                            setToQuery(item.to_label)
                          }}
                        >
                          <div className={`${isWide ? 'w-10 h-10' : 'w-8 h-8'} bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0`}>
                            <Icon name="location_on" size={isWide ? 20 : 16} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold block text-sm text-on-surface truncate">{item.to_label}</span>
                            <span className="text-[11px] text-on-surface-variant truncate block">from {item.from_label}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating CTA */}
      <div className="fixed bottom-24 left-0 right-0 px-6 z-40 flex justify-center pointer-events-none">
        <button
          onClick={handleFindJourneys}
          disabled={!canSearch}
          className="pointer-events-auto w-full max-w-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-extrabold text-lg py-5 rounded-full shadow-2xl shadow-primary/40 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          Find Journeys
        </button>
      </div>
    </>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  )
}
