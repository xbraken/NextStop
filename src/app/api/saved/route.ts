import { NextRequest, NextResponse } from 'next/server'
import type { InArgs } from '@libsql/client'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import { isValidColorKey } from '@/lib/saved-colors'
import { isValidIcon } from '@/lib/saved-icons'

export const runtime = 'nodejs'

export async function GET() {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute({
    sql: 'SELECT * FROM saved_destinations WHERE user_id = ? ORDER BY created_at DESC',
    args: [session.userId],
  })
  return NextResponse.json({ destinations: result.rows })
}

export async function POST(req: NextRequest) {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { kind: kindRaw, label, stop_name, stop_id, lat, lng, from_label, from_id, direction: dirRaw, routes: routesRaw, color: colorRaw, icon: iconRaw } = body ?? {}
  const color: string | null = isValidColorKey(colorRaw) ? colorRaw : null
  const kind: 'destination' | 'stop' | 'route' =
    kindRaw === 'stop' || kindRaw === 'route' ? kindRaw : 'destination'
  const direction: 'inbound' | 'outbound' | null =
    kind === 'stop' && (dirRaw === 'inbound' || dirRaw === 'outbound') ? dirRaw : null
  const icon: string | null = isValidIcon(iconRaw) ? iconRaw : null

  // Normalise the route-filter list: dedup, trim, sort so dedupe key is stable.
  // Empty/absent means "All routes".
  const routes: string | null = (() => {
    if (kind !== 'stop') return null
    if (!Array.isArray(routesRaw)) return null
    const clean = Array.from(
      new Set(
        routesRaw
          .map((r) => (typeof r === 'string' ? r.trim() : ''))
          .filter((r) => r.length > 0)
      )
    ).sort()
    return clean.length > 0 ? clean.join(',') : null
  })()

  if (!label || !stop_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (kind === 'route' && (!from_id || !from_label)) {
    return NextResponse.json({ error: 'Routes need from_id and from_label' }, { status: 400 })
  }

  // Dedup by (kind, identifying fields). Routes dedupe on (from_id, stop_id);
  // stops dedupe on (stop_id, direction) so the same stop can be saved once
  // per direction preference; destinations dedupe on stop_id.
  let dedupSql: string
  let dedupArgs: InArgs
  if (kind === 'route') {
    dedupSql = 'SELECT id FROM saved_destinations WHERE user_id = ? AND kind = ? AND from_id = ? AND stop_id = ?'
    dedupArgs = [session.userId, kind, from_id, stop_id]
  } else if (kind === 'stop') {
    // Same stop can be saved once per (direction, route-filter) combo so users
    // can keep distinct preferences (e.g. "stop X, 3a/3b only" vs "stop X, all").
    dedupSql =
      'SELECT id FROM saved_destinations WHERE user_id = ? AND kind = ? AND stop_id = ? AND (direction IS ? OR direction = ?) AND (routes IS ? OR routes = ?)'
    dedupArgs = [session.userId, kind, stop_id, direction, direction, routes, routes]
  } else {
    dedupSql = 'SELECT id FROM saved_destinations WHERE user_id = ? AND kind = ? AND stop_id = ?'
    dedupArgs = [session.userId, kind, stop_id]
  }

  const existing = await db.execute({ sql: dedupSql, args: dedupArgs })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Already saved' }, { status: 409 })
  }

  const result = await db.execute({
    sql: 'INSERT INTO saved_destinations (user_id, kind, label, stop_name, stop_id, lat, lng, from_label, from_id, direction, routes, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    args: [
      session.userId,
      kind,
      label,
      stop_name ?? label,
      stop_id,
      lat ?? null,
      lng ?? null,
      kind === 'route' ? from_label : null,
      kind === 'route' ? from_id : null,
      direction,
      routes,
      color,
      icon,
    ],
  })
  return NextResponse.json({ destination: result.rows[0] }, { status: 201 })
}
