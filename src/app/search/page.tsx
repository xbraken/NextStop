'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { TranslinkStop } from '@/types/translink'
import type { PhotonResult } from '@/lib/photon'
import { Suspense } from 'react'

// Simple in-memory cache so repeated queries don't hit the network
const photonCache = new Map<string, PhotonResult[]>()
const nominatimCache = new Map<string, PhotonResult[]>()

// Location bias centred on Belfast — softer than bbox (doesn't hard-exclude results)
const BELFAST_LAT = 54.5973
const BELFAST_LON = -5.9301

async function fetchPhoton(q: string, signal: AbortSignal): Promise<PhotonResult[]> {
  const cached = photonCache.get(q)
  if (cached) return cached

  // Use location bias instead of strict bbox so residential streets aren't excluded
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en&lat=${BELFAST_LAT}&lon=${BELFAST_LON}&location_bias_scale=0.5`
  const res = await fetch(url, { signal })
  if (!res.ok) return []

  const data = await res.json()
  const results: PhotonResult[] = (data.features ?? []).map((f: {
    geometry: { coordinates: [number, number] }
    properties: { name?: string; street?: string; housenumber?: string; city?: string; county?: string; postcode?: string }
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

  photonCache.set(q, results)
  return results
}

// Nominatim fallback — better UK house number coverage, 1 req/sec limit is fine for typed queries
async function fetchNominatim(q: string, signal: AbortSignal): Promise<PhotonResult[]> {
  const cached = nominatimCache.get(q)
  if (cached) return cached

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Northern Ireland')}&format=json&limit=3&countrycodes=gb&addressdetails=1`
  const res = await fetch(url, {
    signal,
    headers: { 'Accept-Language': 'en', 'User-Agent': 'NextStop/1.0' },
  })
  if (!res.ok) return []

  const data = await res.json()
  const results: PhotonResult[] = (data as Array<{
    lat: string; lon: string; display_name: string
    address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; county?: string }
  }>).map((item) => {
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

  nominatimCache.set(q, results)
  return results
}

async function fetchStops(q: string, signal: AbortSignal): Promise<TranslinkStop[]> {
  const res = await fetch(`/api/translink/stops?q=${encodeURIComponent(q)}`, { signal })
  if (!res.ok) return []
  const data = await res.json()
  return data.stops ?? []
}

// A selected location can be either a Translink stop or an address
type SelectedLocation =
  | { kind: 'stop'; stopId: string; name: string; lat: number; lon: number }
  | { kind: 'address'; name: string; lat: number; lon: number }

interface SearchResults {
  stops: TranslinkStop[]
  places: PhotonResult[]
}

function LocationDropdown({
  results,
  onSelect,
}: {
  results: SearchResults
  onSelect: (loc: SelectedLocation) => void
}) {
  const hasStops = results.stops.length > 0
  const hasPlaces = results.places.length > 0
  if (!hasStops && !hasPlaces) return null

  return (
    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.12)] overflow-hidden border border-outline-variant/20">
      {hasStops && (
        <>
          <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
              Bus &amp; Rail Stops
            </span>
          </div>
          {results.stops.map((stop) => (
            <button
              key={stop.stopId}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
              onPointerDown={(e) => {
                e.preventDefault()
                onSelect({ kind: 'stop', stopId: stop.stopId, name: stop.stopName, lat: stop.lat, lon: stop.lon })
              }}
            >
              <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Icon name="directions_bus" size={15} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-on-surface">{stop.stopName}</span>
            </button>
          ))}
        </>
      )}

      {hasStops && hasPlaces && (
        <div className="mx-4 border-t border-outline-variant/20" />
      )}

      {hasPlaces && (
        <>
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
        </>
      )}
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
  const [results, setResults] = useState<SearchResults>({ stops: [], places: [] })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!focused || value.length < 2 || value === 'Current Location') {
      setResults({ stops: [], places: [] })
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

      fetchStops(value, controller.signal)
        .then((stops) => setResults((prev) => ({ ...prev, stops })))
        .catch(() => {})

      fetchPhoton(streetQuery, controller.signal)
        .then((places) => setResults((prev) => ({ ...prev, places: prependHouseNumber(places) })))
        .catch(() => {})

      fetchNominatim(streetQuery, controller.signal)
        .then((nominatim) => {
          setResults((prev) => {
            const existing = prev.places.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`)
            const novel = prependHouseNumber(
              nominatim.filter((n) => !existing.includes(`${n.lat.toFixed(3)},${n.lon.toFixed(3)}`))
            )
            return { ...prev, places: [...prev.places, ...novel].slice(0, 6) }
          })
        })
        .catch(() => {})
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [value, focused])

  const showDropdown = focused && (results.stops.length > 0 || results.places.length > 0)

  function clear() {
    onChange('')
    setResults({ stops: [], places: [] })
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
            setResults({ stops: [], places: [] })
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
  const [hour, setHour] = useState(today.getHours() % 12 || 12)
  const [minute, setMinute] = useState(Math.floor(today.getMinutes() / 5) * 5)
  const [isPm, setIsPm] = useState(today.getHours() >= 12)
  const [recents, setRecents] = useState<RecentItem[]>([])
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

  // Pre-fill TO from URL params
  useEffect(() => {
    const toId = params.get('to')
    const toName = params.get('toName')
    if (toId && toName) {
      setToLocation({ kind: 'stop', stopId: toId, name: toName, lat: 0, lon: 0 })
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
    const h24 = isPm ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour
    return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  function locationToParams(loc: SelectedLocation | null, fallbackName: string) {
    if (!loc) return { id: 'current', name: fallbackName }
    if (loc.kind === 'stop') return { id: loc.stopId, name: loc.name }
    // For address results pass lat,lon as the ID — real API can resolve these
    return { id: `${loc.lat},${loc.lon}`, name: loc.name }
  }

  async function handleSaveDestination() {
    if (!toLocation) return
    setSaveState('saving')
    const stop_id = toLocation.kind === 'stop' ? toLocation.stopId : `${toLocation.lat},${toLocation.lon}`
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: toLocation.name, stop_name: toLocation.name, stop_id, lat: toLocation.lat, lng: toLocation.lon }),
    })
    if (res.status === 409) { setSaveState('duplicate'); return }
    if (!res.ok) { setSaveState('idle'); return }
    setSaveState('saved')
  }

  function handleSwap() {
    setFromQuery(toQuery)
    setToQuery(fromQuery)
    setFromLocation(toLocation)
    setToLocation(fromLocation)
  }

  function handleFindJourneys() {
    if (!toLocation && !toQuery) return

    const from = locationToParams(fromLocation, 'Current Location')
    const to = locationToParams(toLocation, toQuery)

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
              placeholder="Current location or stop"
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

          {/* Save destination row — appears after a TO is selected */}
          {toLocation && !isSearching && (
            <button
              onClick={handleSaveDestination}
              disabled={saveState === 'saving' || saveState === 'saved' || saveState === 'duplicate'}
              className="w-full flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:bg-surface-container-low transition-colors text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${saveState === 'saved' ? 'bg-primary/20' : 'bg-primary/10'}`}>
                <Icon
                  name={saveState === 'saved' ? 'bookmark' : 'bookmark_add'}
                  filled={saveState === 'saved'}
                  size={20}
                  className="text-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-on-surface">
                  {saveState === 'saved' ? 'Destination saved!' : saveState === 'duplicate' ? 'Already saved' : 'Save this destination'}
                </p>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">{toLocation.name}</p>
              </div>
              {saveState === 'idle' && (
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full shrink-0">Save</span>
              )}
            </button>
          )}
        </section>

        {/* Mode + Date + Time — hidden while a location field is focused */}
        {/* Mode toggle */}
        <section ref={modeSectionRef} className={isSearching ? 'hidden' : ''}>
          <div className="flex bg-surface-container-low p-1 rounded-full">
            {(['leave_now', 'leave_at'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 px-2 rounded-full text-sm font-semibold transition-all
                  ${mode === m ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 font-bold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                {m === 'leave_now' ? 'Leave now' : 'Leave at'}
              </button>
            ))}
          </div>
        </section>

        {/* Date + Time */}
        {!isSearching && mode !== 'leave_now' && (
          <section className="space-y-4">
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
              {dates.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDate(i)}
                  className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl transition-all
                    ${selectedDate === i ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-tighter opacity-80">
                    {i === 0 ? 'Today' : DAY_NAMES[d.getDay()]}
                  </span>
                  <span className="text-xl font-headline font-bold">{d.getDate()}</span>
                </button>
              ))}
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-3xl flex items-center justify-around shadow-[0_4px_32px_rgba(26,28,28,0.02)]">
              <div className="flex items-center gap-4">
                {/* Hours */}
                <div className="flex flex-col items-center">
                  <button onClick={() => setHour((h) => h === 12 ? 1 : h + 1)} className="text-outline p-1">
                    <Icon name="keyboard_arrow_up" size={20} />
                  </button>
                  <span className="text-4xl font-headline font-extrabold text-on-surface tracking-tighter w-16 text-center">
                    {String(hour).padStart(2, '0')}
                  </span>
                  <button onClick={() => setHour((h) => h === 1 ? 12 : h - 1)} className="text-outline p-1">
                    <Icon name="keyboard_arrow_down" size={20} />
                  </button>
                </div>
                <span className="text-4xl font-headline font-extrabold text-outline-variant">:</span>
                {/* Minutes */}
                <div className="flex flex-col items-center">
                  <button onClick={() => setMinute((m) => (m + 5) % 60)} className="text-outline p-1">
                    <Icon name="keyboard_arrow_up" size={20} />
                  </button>
                  <span className="text-4xl font-headline font-extrabold text-on-surface tracking-tighter w-16 text-center">
                    {String(minute).padStart(2, '0')}
                  </span>
                  <button onClick={() => setMinute((m) => (m - 5 + 60) % 60)} className="text-outline p-1">
                    <Icon name="keyboard_arrow_down" size={20} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setIsPm(false)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${!isPm ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                >AM</button>
                <button
                  onClick={() => setIsPm(true)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isPm ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                >PM</button>
              </div>
            </div>
          </section>
        )}

        {/* Recents */}
        {!isSearching && recents.length > 0 && (
          <section className="space-y-4">
            <h3 className="font-headline font-bold text-lg">Recents</h3>
            <div className="grid grid-cols-2 gap-4">
              {recents.slice(0, 4).map((item, i) => {
                const isAddress = item.to_id.includes(',')
                const icon = isAddress ? 'location_on' : 'directions_bus'
                const isWide = i === 0
                return (
                  <button
                    key={item.to_id}
                    className={`${isWide ? 'col-span-2' : ''} bg-surface-container-lowest p-5 rounded-2xl flex ${isWide ? 'flex-row items-center gap-4' : 'flex-col gap-3'} shadow-sm border border-outline-variant/10 text-left hover:bg-surface-container-low transition-all active:scale-[0.99]`}
                    onClick={() => {
                      const loc: SelectedLocation = isAddress
                        ? { kind: 'address', name: item.to_label, lat: parseFloat(item.to_id.split(',')[0]), lon: parseFloat(item.to_id.split(',')[1]) }
                        : { kind: 'stop', stopId: item.to_id, name: item.to_label, lat: 0, lon: 0 }
                      setToLocation(loc)
                      setToQuery(item.to_label)
                    }}
                  >
                    <div className={`${isWide ? 'w-10 h-10' : 'w-8 h-8'} bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0`}>
                      <Icon name={icon} size={isWide ? 20 : 16} />
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
