'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { JourneyLeg } from '@/types/translink'

// Distinct colors cycled per bus leg so multi-change journeys are legible.
const BUS_COLORS = ['#006565', '#0c6780', '#c47a00', '#9333ea', '#1f7a4a']
const WALK_COLOR = '#60696b'

interface LegGeometry {
  coords: [number, number][]
  color: string
  mode: JourneyLeg['mode']
  routeId?: string
}

function buildGeometry(legs: JourneyLeg[]): LegGeometry[] {
  let busIdx = 0
  return legs.map((leg) => {
    const points: [number, number][] = []
    const push = (lat?: number, lon?: number) => {
      if (typeof lat === 'number' && typeof lon === 'number' && (lat || lon)) {
        points.push([lon, lat])
      }
    }
    push(leg.from.lat, leg.from.lon)
    leg.intermediateStops?.forEach((s) => push(s.lat, s.lon))
    push(leg.to.lat, leg.to.lon)

    const color =
      leg.mode === 'WALK' ? WALK_COLOR : BUS_COLORS[busIdx++ % BUS_COLORS.length]
    return { coords: points, color, mode: leg.mode, routeId: leg.routeId }
  })
}

export default function JourneyMap({ legs }: { legs: JourneyLeg[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const geometry = buildGeometry(legs)
    const allPoints = geometry.flatMap((g) => g.coords)
    if (allPoints.length === 0) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: allPoints[0],
      zoom: 12,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {
      geometry.forEach((g, i) => {
        if (g.coords.length < 2) return
        const sourceId = `leg-${i}`
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: g.coords },
            properties: {},
          },
        })
        map.addLayer({
          id: `${sourceId}-line`,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': g.color,
            'line-width': g.mode === 'WALK' ? 4 : 5,
            'line-dasharray': g.mode === 'WALK' ? [1, 1.6] : [1],
            'line-opacity': 0.95,
          },
        })
      })

      // Transfer markers: start of every leg + final destination
      const markerFeatures: GeoJSON.Feature[] = []
      legs.forEach((leg, i) => {
        if (leg.from.lat || leg.from.lon) {
          markerFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [leg.from.lon, leg.from.lat] },
            properties: { kind: i === 0 ? 'origin' : 'transfer', label: leg.from.name },
          })
        }
      })
      const last = legs[legs.length - 1]
      if (last && (last.to.lat || last.to.lon)) {
        markerFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [last.to.lon, last.to.lat] },
          properties: { kind: 'destination', label: last.to.name },
        })
      }

      map.addSource('stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: markerFeatures },
      })
      map.addLayer({
        id: 'stops-halo',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'transfer', 6, 9],
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

      // Fit bounds with padding so the whole journey is visible.
      const bounds = allPoints.reduce(
        (b, p) => b.extend(p),
        new maplibregl.LngLatBounds(allPoints[0], allPoints[0])
      )
      map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 15 })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [legs])

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-64 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(26,28,28,0.08)]"
      />
      <JourneyLegend legs={legs} />
    </div>
  )
}

function JourneyLegend({ legs }: { legs: JourneyLeg[] }) {
  let busIdx = 0
  const items = legs.map((leg) => {
    if (leg.mode === 'WALK') {
      return { color: WALK_COLOR, label: 'Walk', dashed: true }
    }
    const color = BUS_COLORS[busIdx++ % BUS_COLORS.length]
    return { color, label: leg.routeId || 'Bus', dashed: false }
  })

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((it, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant"
        >
          <span
            className={`inline-block w-3 h-0.5 ${it.dashed ? 'border-t-2 border-dashed' : ''}`}
            style={
              it.dashed
                ? { borderColor: it.color, height: 0 }
                : { backgroundColor: it.color, height: 3 }
            }
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}
