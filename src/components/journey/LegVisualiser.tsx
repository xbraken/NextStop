import Icon from '@/components/ui/Icon'
import type { JourneyLeg } from '@/types/translink'

interface LegVisualiserProps {
  legs: JourneyLeg[]
  compact?: boolean
}

function formatMins(seconds: number) {
  return `${Math.round(seconds / 60)}m`
}

export default function LegVisualiser({ legs, compact = false }: LegVisualiserProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
      {legs.map((leg, i) => (
        <div key={i} className="flex items-center gap-2 shrink-0">
          {leg.mode === 'WALK' ? (
            <div className="flex items-center gap-1">
              <Icon name="directions_walk" size={compact ? 16 : 18} className="text-on-surface-variant" />
              <span className="text-xs font-bold text-on-surface-variant">{formatMins(leg.duration)}</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white shrink-0 ${leg.mode === 'RAIL' ? 'bg-secondary' : 'bg-primary'}`}>
              <Icon
                name={leg.mode === 'RAIL' ? 'directions_railway' : 'directions_bus'}
                filled
                size={compact ? 14 : 16}
                className="text-white"
              />
              <span className="text-xs font-bold">{leg.routeId ?? leg.mode}</span>
            </div>
          )}
          {i < legs.length - 1 && (
            <Icon name="arrow_forward" size={12} className="text-outline-variant shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}
