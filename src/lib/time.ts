// UK times are handled server + client side, but server runtimes (Vercel)
// default to UTC. Force Europe/London so BST/GMT always render correctly.
const TZ = 'Europe/London'

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
})

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return timeFmt.format(d)
}

export function minutesUntil(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.round((t - Date.now()) / 60_000))
}
