import Icon from '@/components/ui/Icon'
import { getDepartures } from '@/lib/translink'

async function getStatusSummary() {
  try {
    const data = await getDepartures('BEL8270413')
    const departures = data.departures ?? []
    const delayed = departures.filter((d) => d.status === 'Delayed').length
    const cancelled = departures.filter((d) => d.status === 'Cancelled').length

    if (cancelled > 0) return { text: `${cancelled} service${cancelled > 1 ? 's' : ''} cancelled`, level: 'disruption' }
    if (delayed > 1) return { text: 'Some delays on city services', level: 'delay' }
    if (delayed === 1) return { text: 'Minor delays reported', level: 'delay' }
    return { text: 'Services running normally', level: 'ok' }
  } catch {
    return { text: 'Services running normally', level: 'ok' }
  }
}

export default async function TranslinkStatusCard() {
  const status = await getStatusSummary()

  const colours = {
    ok: 'from-primary to-primary-container',
    delay: 'from-[#b45309] to-[#d97706]',
    disruption: 'from-error to-[#dc2626]',
  }

  return (
    <div
      className={`p-6 rounded-xl bg-gradient-to-br ${colours[status.level as keyof typeof colours]} text-on-primary shadow-xl flex items-center gap-5`}
    >
      <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
        <Icon name="directions_bus" filled size={24} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-0.5">
          Translink Status
        </p>
        <p className="text-base font-headline font-bold leading-tight">{status.text}</p>
      </div>
    </div>
  )
}
