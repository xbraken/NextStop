'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { LiveVehicle } from '@/app/api/translink/vehicles/route'
import type { TranslinkStop, Departure } from '@/types/translink'

const POLL_MS = 15_000
const STOP_POLL_MS = 20_000
const STOPS_MIN_ZOOM = 13
const BELFAST: [number, number] = [-5.9301, 54.5968]
const SOURCE_ID = 'vehicles'
const USER_SOURCE_ID = 'user-location'
const STOPS_SOURCE_ID = 'stops'

const INBOUND_RE = /city centre|belfast|donegall|europa|central station|grand central|laganside/i

const OPERATOR_COLORS: Record<string, { out: string; in: string }> = {
  TM:  { out: '#008080', in: '#004a4a' },
  UB:  { out: '#0c6780', in: '#063845' },
  GL:  { out: '#c47a00', in: '#7a4c00' },
  GLE: { out: '#c47a00', in: '#7a4c00' },
  GDR: { out: '#c47a00', in: '#7a4c00' },
  FY:  { out: '#9333ea', in: '#5b21b6' },
  UTS: { out: '#0c6780', in: '#063845' },
}
const DEFAULT_COLOR = { out: '#3e4949', in: '#1a1c1c' }

function colorFor(operator: string, inbound: boolean): string {
  const pal = OPERATOR_COLORS[operator] ?? DEFAULT_COLOR
  return inbound ? pal.in : pal.out
}

export default function LiveMapPage() {
  return (
    <Suspense fallback={null}>
      <LiveMapInner />
    </Suspense>
  )
}

function LiveMapInner() {
  const params = useSearchParams()
  const lineFilter = params.get('line')?.toUpperCase() ?? null
  const destFilter = params.get('dest') ?? null
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [selected, setSelected] = useState<LiveVehicle | null>(null)
  const [selectedStop, setSelectedStop] = useState<TranslinkStop | null>(null)
  const [count, setCount] = useState(0)
  const [error, setError] = useState(false)
  const [followMode, setFollowMode] = useState(false)
  const vehiclesRef = useRef<Map<string, LiveVehicle>>(new Map())
  const hasPannedRef = useRef(false)
  const selectedIdRef = useRef<string | null>(null)
  const followModeRef = useRef(false)

  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null
  }, [selected])

  useEffect(() => {
    followModeRef.current = followMode
  }, [followMode])

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: BELFAST,
      zoom: 11,
    })
    mapRef.current = map

    map.on('error', (e) => {
      console.error('[maplibre]', e.error?.message ?? e)
    })

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // User location source (empty until geolocation resolves)
      map.addSource(USER_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Nearby stops source — populated on moveend when zoomed in
      map.addSource(STOPS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Stops — small dots with outline, hidden at low zoom
      map.addLayer({
        id: 'stops-circle',
        type: 'circle',
        source: STOPS_SOURCE_ID,
        minzoom: STOPS_MIN_ZOOM,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 6, 18, 8],
          'circle-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#3e4949',
        },
      })
      map.addLayer({
        id: 'stops-label',
        type: 'symbol',
        source: STOPS_SOURCE_ID,
        minzoom: 15,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#1a1c1c',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })

      // User location — pulsing blue dot
      map.addLayer({
        id: 'user-halo',
        type: 'circle',
        source: USER_SOURCE_ID,
        paint: {
          'circle-radius': 20,
          'circle-color': '#2563eb',
          'circle-opacity': 0.15,
        },
      })
      map.addLayer({
        id: 'user-dot',
        type: 'circle',
        source: USER_SOURCE_ID,
        paint: {
          'circle-radius': 7,
          'circle-color': '#2563eb',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Vehicle body — colored circle per operator, with inbound tint
      map.addLayer({
        id: 'vehicle-circle',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 14, 18, 20],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Directional arrow on buses that have a bearing
      map.addLayer({
        id: 'vehicle-arrow',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'bearing'],
        layout: {
          'text-field': '▲',
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 14, 18, 18],
          'text-rotate': ['get', 'bearing'],
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, -1.2],
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })

      // Line number label
      map.addLayer({
        id: 'vehicle-label',
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'line'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 14],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })

      // Click handler
      map.on('click', 'vehicle-circle', (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const id = feature.properties?.id as string | undefined
        if (!id) return
        const v = vehiclesRef.current.get(id)
        if (v) setSelected(v)
      })
      map.on('mouseenter', 'vehicle-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'vehicle-circle', () => {
        map.getCanvas().style.cursor = ''
      })

      // Stop click → open stop sheet
      map.on('click', 'stops-circle', (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const stopId = feature.properties?.stopId as string | undefined
        const name = (feature.properties?.name as string | undefined) ?? ''
        if (!stopId) return
        const geom = feature.geometry
        const [lon, lat] =
          geom.type === 'Point' ? (geom.coordinates as [number, number]) : [0, 0]
        setSelected(null)
        setSelectedStop({ stopId, stopName: name, lat, lon })
      })
      map.on('mouseenter', 'stops-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'stops-circle', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    // Geolocation: drop user pin + center (unless we're tracking a specific line)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { longitude, latitude } = pos.coords
          setUserPin(map, [longitude, latitude])
          if (!lineFilter) {
            map.easeTo({ center: [longitude, latitude], zoom: 13 })
          }
        },
        () => {},
        { timeout: 5000, enableHighAccuracy: true }
      )
    }

    // Fetch nearby stops when the user pans/zooms, debounced
    let stopsTimer: ReturnType<typeof setTimeout> | null = null
    let stopsAbort: AbortController | null = null
    const fetchStops = () => {
      if (map.getZoom() < STOPS_MIN_ZOOM) {
        applyStops(map, [])
        return
      }
      const c = map.getCenter()
      stopsAbort?.abort()
      const ctrl = new AbortController()
      stopsAbort = ctrl
      fetch(
        `/api/translink/stops/near?lat=${c.lat.toFixed(5)}&lon=${c.lng.toFixed(5)}&radius=800`,
        { signal: ctrl.signal, cache: 'no-store' }
      )
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: { stops?: TranslinkStop[] }) => {
          applyStops(map, data.stops ?? [])
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') console.error('[stops/near] fetch failed', err)
        })
    }
    const onMoveEnd = () => {
      if (stopsTimer) clearTimeout(stopsTimer)
      stopsTimer = setTimeout(fetchStops, 350)
    }
    map.on('moveend', onMoveEnd)
    map.once('load', fetchStops)

    return () => {
      if (stopsTimer) clearTimeout(stopsTimer)
      stopsAbort?.abort()
      map.off('moveend', onMoveEnd)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Poll vehicles
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/translink/vehicles', { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { vehicles: LiveVehicle[] }
        if (cancelled) return

        const matches = filterVehicles(data.vehicles, lineFilter, destFilter)
        const shown = lineFilter ? matches : data.vehicles
        vehiclesRef.current = new Map(shown.map((v) => [v.id, v]))
        setCount(shown.length)
        setError(false)
        applyToMap(mapRef.current, shown)

        // Pan to first match once
        if (lineFilter && !hasPannedRef.current && matches.length > 0 && mapRef.current) {
          hasPannedRef.current = true
          const first = matches[0]
          mapRef.current.easeTo({ center: [first.lon, first.lat], zoom: 14, duration: 800 })
          setSelected(first)
        }

        // Keep selection fresh + follow-mode panning
        const selId = selectedIdRef.current
        if (selId) {
          const latest = vehiclesRef.current.get(selId)
          if (latest) {
            setSelected(latest)
            if (followModeRef.current && mapRef.current) {
              mapRef.current.easeTo({ center: [latest.lon, latest.lat], duration: 500 })
            }
          }
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [lineFilter, destFilter])

  function filterVehicles(
    all: LiveVehicle[],
    line: string | null,
    dest: string | null
  ): LiveVehicle[] {
    if (!line) return all
    const destLc = dest?.toLowerCase() ?? ''
    const exact = all.filter(
      (v) =>
        v.line.toUpperCase() === line &&
        (!destLc || v.destination.toLowerCase().includes(destLc))
    )
    if (exact.length > 0) return exact
    // Fallback: line only, any direction
    return all.filter((v) => v.line.toUpperCase() === line)
  }

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/live"
            className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors active:scale-95 text-primary"
          >
            <Icon name="arrow_back" size={22} />
          </Link>
          <div className="flex items-center gap-2">
            <Icon name="directions_bus" size={22} className="text-primary" filled />
            <h1 className="font-headline font-bold text-xl text-primary">Live Map</h1>
          </div>
        </div>
        <div className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
          {error ? (
            <>
              <Icon name="error" size={14} className="text-red-600" />
              <span className="text-red-600">offline</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {count} {lineFilter ? 'matching' : 'buses'}
            </>
          )}
        </div>
      </header>

      {lineFilter && (
        <div className="fixed top-16 left-0 right-0 z-40 px-6 pt-3 pointer-events-none flex flex-col items-center gap-2">
          <div className="bg-primary text-on-primary rounded-full px-4 py-2 shadow-lg flex items-center gap-2 w-fit pointer-events-auto">
            <Icon name="filter_alt" size={14} filled />
            <span className="text-xs font-semibold">
              Tracking line {lineFilter}
              {destFilter ? ` → ${destFilter}` : ''}
            </span>
            <Link
              href="/live/map"
              className="ml-1 p-0.5 rounded-full hover:bg-white/10 active:scale-95"
              aria-label="Clear filter"
            >
              <Icon name="close" size={14} />
            </Link>
          </div>
          {!error && count === 0 && (
            <div className="bg-surface-container-lowest/95 backdrop-blur rounded-full px-4 py-2 shadow-lg flex items-center gap-2 w-fit pointer-events-auto">
              <Icon name="info" size={14} className="text-on-surface-variant" />
              <span className="text-xs font-medium text-on-surface-variant">
                No line {lineFilter} buses running right now
              </span>
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: 'calc(100vh - 64px)',
        }}
      />

      {selected && !selectedStop && (
        <VehicleSheet
          v={selected}
          following={followMode}
          onToggleFollow={() => {
            const next = !followMode
            setFollowMode(next)
            if (next && mapRef.current) {
              mapRef.current.easeTo({ center: [selected.lon, selected.lat], zoom: 15, duration: 600 })
            }
          }}
          onClose={() => {
            setSelected(null)
            setFollowMode(false)
          }}
        />
      )}

      {selectedStop && (
        <StopSheet
          stop={selectedStop}
          onClose={() => setSelectedStop(null)}
        />
      )}
    </>
  )
}

function applyToMap(map: maplibregl.Map | null, vehicles: LiveVehicle[]) {
  if (!map) return
  const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!src) {
    // Style not loaded yet — retry once after load
    map.once('load', () => applyToMap(map, vehicles))
    return
  }
  src.setData({
    type: 'FeatureCollection',
    features: vehicles.map((v) => {
      const inbound = INBOUND_RE.test(v.destination)
      const props: Record<string, unknown> = {
        id: v.id,
        operator: v.operator,
        line: v.line,
        color: colorFor(v.operator, inbound),
        inbound,
      }
      if (v.bearing !== null) props.bearing = v.bearing
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
        properties: props,
      }
    }),
  })
}

function setUserPin(map: maplibregl.Map, coords: [number, number]) {
  const apply = () => {
    const src = map.getSource(USER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    src.setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} },
      ],
    })
  }
  if (map.isStyleLoaded()) apply()
  else map.once('load', apply)
}

function applyStops(map: maplibregl.Map, stops: TranslinkStop[]) {
  const src = map.getSource(STOPS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData({
    type: 'FeatureCollection',
    features: stops
      .filter((s) => s.lat && s.lon)
      .map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { stopId: s.stopId, name: s.stopName },
      })),
  })
}

function VehicleSheet({
  v,
  following,
  onToggleFollow,
  onClose,
}: {
  v: LiveVehicle
  following: boolean
  onToggleFollow: () => void
  onClose: () => void
}) {
  const delayMin = Math.round(v.delay / 60)
  const onTime = Math.abs(delayMin) < 2
  const late = delayMin >= 2

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest rounded-t-2xl shadow-[0_-8px_32px_rgba(26,28,28,0.12)] p-6 pb-10 animate-in slide-in-from-bottom duration-200">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="font-headline font-extrabold text-primary text-lg">
            {v.line || '–'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {operatorName(v.operator)}
          </p>
          <p className="font-headline font-extrabold text-lg truncate">
            {v.destination || 'In service'}
          </p>
          <p className="text-xs text-outline mt-0.5">Vehicle {v.vehicleId}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 -mr-2 -mt-1 rounded-full text-on-surface-variant hover:bg-surface-container active:scale-95"
          aria-label="Close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
            onTime
              ? 'bg-emerald-50 text-emerald-700'
              : late
                ? 'bg-amber-50 text-amber-700'
                : 'bg-sky-50 text-sky-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              onTime ? 'bg-emerald-500' : late ? 'bg-amber-500' : 'bg-sky-500'
            }`}
          />
          {onTime ? 'On time' : late ? `${delayMin} min late` : `${Math.abs(delayMin)} min early`}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="schedule" size={12} />
          {formatTime(v.timestamp)}
        </span>
        <button
          type="button"
          onClick={onToggleFollow}
          className={`ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors active:scale-95 ${
            following
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
          aria-pressed={following}
        >
          <Icon name={following ? 'my_location' : 'location_searching'} size={12} filled={following} />
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  )
}

function operatorName(code: string): string {
  switch (code) {
    case 'TM': return 'Metro'
    case 'UB': return 'Ulsterbus'
    case 'GL':
    case 'GLE': return 'Goldline'
    case 'GDR': return 'Goldliner'
    case 'FY': return 'Foyle'
    case 'UTS': return 'Ulsterbus Tours'
    default: return code || 'Translink'
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function StopSheet({ stop, onClose }: { stop: TranslinkStop; onClose: () => void }) {
  const [departures, setDepartures] = useState<Departure[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(
          `/api/translink/departures?stopId=${encodeURIComponent(stop.stopId)}`,
          { cache: 'no-store' }
        )
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (cancelled) return
        setDepartures(data.departures ?? [])
        setError(false)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    setDepartures(null)
    load()
    const id = setInterval(load, STOP_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stop.stopId])

  const upcoming = (departures ?? []).slice(0, 6)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest rounded-t-2xl shadow-[0_-8px_32px_rgba(26,28,28,0.12)] p-6 pb-8 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
          <Icon name="pin_drop" size={22} className="text-on-surface-variant" filled />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Stop</p>
          <p className="font-headline font-extrabold text-lg truncate">{stop.stopName}</p>
          <p className="text-xs text-outline mt-0.5">{stop.stopId}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 -mr-2 -mt-1 rounded-full text-on-surface-variant hover:bg-surface-container active:scale-95"
          aria-label="Close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="mt-4">
        {departures === null && !error && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-surface-container animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 py-4">Couldn’t load departures</div>
        )}

        {departures && upcoming.length === 0 && !error && (
          <div className="text-sm text-on-surface-variant py-4">
            No departures in the next couple of hours
          </div>
        )}

        {upcoming.length > 0 && (
          <ul className="divide-y divide-outline-variant/30">
            {upcoming.map((d, i) => (
              <StopDepartureRow key={`${d.serviceId}-${d.scheduledDeparture}-${i}`} d={d} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StopDepartureRow({ d }: { d: Departure }) {
  const inbound = INBOUND_RE.test(d.destination)
  const mins = minutesUntil(d.expectedDeparture || d.scheduledDeparture)
  const isCancelled = d.status === 'Cancelled'
  const trackable = !!d.serviceId && !isCancelled
  const href = `/live/map?line=${encodeURIComponent(d.serviceId)}&dest=${encodeURIComponent(d.destination)}`

  const content = (
    <>
      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="font-headline font-extrabold text-primary text-sm">
          {d.serviceId || '–'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{d.destination || 'Unknown'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
              inbound ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <Icon name={inbound ? 'south_west' : 'north_east'} size={11} />
            {inbound ? 'Inward' : 'Outward'}
          </span>
          {!d.isLive && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">
              Timetable
            </span>
          )}
          {isCancelled && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">
              Cancelled
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-lg font-headline font-extrabold leading-none">
          {isCancelled ? '—' : mins <= 0 ? 'Now' : mins}
        </div>
        {!isCancelled && mins > 0 && (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-outline">
            min
          </div>
        )}
      </div>
    </>
  )

  if (trackable) {
    return (
      <li>
        <Link
          href={href}
          className="flex items-center gap-3 py-3 active:bg-surface-container-low transition-colors"
        >
          {content}
        </Link>
      </li>
    )
  }
  return <li className="flex items-center gap-3 py-3">{content}</li>
}

function minutesUntil(iso: string): number {
  if (!iso) return 0
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000))
}
