'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { JourneyLeg } from '@/types/translink'
import type { LiveVehicle } from '@/app/api/translink/vehicles/route'

const BUS_COLORS = ['#006565', '#0c6780', '#c47a00', '#9333ea', '#1f7a4a']
const WALK_COLOR = '#60696b'
const ACTIVE_COLOR = '#00A6A6'

function legCoords(leg: JourneyLeg): [number, number][] {
  const out: [number, number][] = []
  const push = (lat?: number, lon?: number) => {
    if (typeof lat === 'number' && typeof lon === 'number' && (lat || lon)) out.push([lon, lat])
  }
  push(leg.from.lat, leg.from.lon)
  leg.intermediateStops?.forEach((s) => push(s.lat, s.lon))
  push(leg.to.lat, leg.to.lon)
  return out
}

export default function GoMap({
  legs,
  legIdx,
  userPos,
  bus,
}: {
  legs: JourneyLeg[]
  legIdx: number
  userPos: { lat: number; lon: number } | null
  bus: { lat: number; lon: number; bearing: number | null } | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const busMarkerRef = useRef<maplibregl.Marker | null>(null)
  const hasFlownRef = useRef(false)

  // Init map once. The legs rarely change during a live journey so we build
  // the route geometry on mount and only tweak layer paint later.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const start = legs[0]
    if (!start) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [start.from.lon || 0, start.from.lat || 0],
      zoom: 14,
      attributionControl: false,
      interactive: true,
    })
    mapRef.current = map

    map.on('load', () => {
      loadedRef.current = true
      let busIdx = 0
      legs.forEach((leg, i) => {
        const coords = legCoords(leg)
        if (coords.length < 2) return
        const sourceId = `leg-${i}`
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {},
          },
        })
        const baseColor =
          leg.mode === 'WALK' ? WALK_COLOR : BUS_COLORS[busIdx++ % BUS_COLORS.length]
        map.addLayer({
          id: `${sourceId}-line`,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': baseColor,
            'line-width': leg.mode === 'WALK' ? 4 : 5,
            'line-dasharray': leg.mode === 'WALK' ? [1, 1.6] : [1],
            'line-opacity': 0.65,
          },
        })
      })

      // Endpoint markers
      const markers: GeoJSON.Feature[] = []
      legs.forEach((leg, i) => {
        if (leg.from.lat || leg.from.lon) {
          markers.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [leg.from.lon, leg.from.lat] },
            properties: { kind: i === 0 ? 'origin' : 'transfer' },
          })
        }
      })
      const last = legs[legs.length - 1]
      if (last && (last.to.lat || last.to.lon)) {
        markers.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [last.to.lon, last.to.lat] },
          properties: { kind: 'destination' },
        })
      }
      map.addSource('stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: markers },
      })
      map.addLayer({
        id: 'stops-halo',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'transfer', 5, 8],
          'circle-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-stroke-color': [
            'match',
            ['get', 'kind'],
            'origin', '#006565',
            'destination', '#1a1c1c',
            '#3e4949',
          ],
        },
      })

      // Initial fit to whole journey so the user sees the big picture.
      const all = legs.flatMap(legCoords)
      if (all.length > 0) {
        const bounds = all.reduce(
          (b, p) => b.extend(p),
          new maplibregl.LngLatBounds(all[0], all[0])
        )
        map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 15 })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
  }, [legs])

  // Highlight the active leg by bumping its width/opacity.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    legs.forEach((leg, i) => {
      const layerId = `leg-${i}-line`
      if (!map.getLayer(layerId)) return
      const isActive = i === legIdx
      map.setPaintProperty(layerId, 'line-opacity', isActive ? 1 : 0.35)
      map.setPaintProperty(layerId, 'line-width', isActive ? (leg.mode === 'WALK' ? 6 : 7) : (leg.mode === 'WALK' ? 4 : 5))
    })
  }, [legIdx, legs])

  // User marker — pulsing teal dot. Pan gently to the user once we have a
  // fix (only on the first fix so the map doesn't fight manual zooming).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userPos) return

    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'go-user-marker'
      el.innerHTML = `
        <span class="pulse"></span>
        <span class="dot"></span>
      `
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userPos.lon, userPos.lat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userPos.lon, userPos.lat])
    }

    if (!hasFlownRef.current && loadedRef.current) {
      hasFlownRef.current = true
      map.easeTo({ center: [userPos.lon, userPos.lat], zoom: 15, duration: 800 })
    }
  }, [userPos])

  // Bus marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!bus) {
      busMarkerRef.current?.remove()
      busMarkerRef.current = null
      return
    }
    if (!busMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'go-bus-marker'
      el.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:16px;color:white;">directions_bus</span>
      `
      busMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat([bus.lon, bus.lat])
        .addTo(map)
    } else {
      busMarkerRef.current.setLngLat([bus.lon, bus.lat])
    }
    if (bus.bearing != null) {
      busMarkerRef.current.setRotation(bus.bearing)
    }
  }, [bus])

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-56 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(26,28,28,0.08)]"
      />
      <button
        type="button"
        onClick={() => {
          const map = mapRef.current
          if (!map || !userPos) return
          map.easeTo({ center: [userPos.lon, userPos.lat], zoom: 16, duration: 500 })
        }}
        className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-primary active:scale-95 transition-all"
        aria-label="Centre on me"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: ACTIVE_COLOR }}>
          my_location
        </span>
      </button>

      <style jsx global>{`
        .go-user-marker {
          position: relative;
          width: 22px;
          height: 22px;
        }
        .go-user-marker .dot {
          position: absolute;
          inset: 4px;
          border-radius: 999px;
          background: ${ACTIVE_COLOR};
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0, 101, 101, 0.4);
        }
        .go-user-marker .pulse {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: ${ACTIVE_COLOR};
          opacity: 0.35;
          animation: go-user-pulse 1.8s ease-out infinite;
        }
        @keyframes go-user-pulse {
          0%   { transform: scale(0.6); opacity: 0.5; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .go-bus-marker {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: #1a1c1c;
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
      `}</style>
    </div>
  )
}
