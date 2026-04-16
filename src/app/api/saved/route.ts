import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'

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
  const { kind: kindRaw, label, stop_name, stop_id, lat, lng, from_label, from_id } = body ?? {}
  const kind: 'destination' | 'stop' | 'route' =
    kindRaw === 'stop' || kindRaw === 'route' ? kindRaw : 'destination'

  if (!label || !stop_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (kind === 'route' && (!from_id || !from_label)) {
    return NextResponse.json({ error: 'Routes need from_id and from_label' }, { status: 400 })
  }

  // Dedup by (kind, identifying fields). Destinations/stops dedupe on stop_id;
  // routes on the (from_id, stop_id) pair so the same leg isn't saved twice.
  const dedupSql =
    kind === 'route'
      ? 'SELECT id FROM saved_destinations WHERE user_id = ? AND kind = ? AND from_id = ? AND stop_id = ?'
      : 'SELECT id FROM saved_destinations WHERE user_id = ? AND kind = ? AND stop_id = ?'
  const dedupArgs =
    kind === 'route'
      ? [session.userId, kind, from_id, stop_id]
      : [session.userId, kind, stop_id]

  const existing = await db.execute({ sql: dedupSql, args: dedupArgs })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Already saved' }, { status: 409 })
  }

  const result = await db.execute({
    sql: 'INSERT INTO saved_destinations (user_id, kind, label, stop_name, stop_id, lat, lng, from_label, from_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
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
    ],
  })
  return NextResponse.json({ destination: result.rows[0] }, { status: 201 })
}
