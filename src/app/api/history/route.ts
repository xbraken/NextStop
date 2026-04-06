import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'

export const runtime = 'nodejs'

export async function GET() {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return the 6 most recent unique TO destinations
  const result = await db.execute({
    sql: `SELECT to_label, to_id, from_label, from_id, MAX(used_at) as used_at
          FROM journey_history
          WHERE user_id = ?
          GROUP BY to_id
          ORDER BY used_at DESC
          LIMIT 6`,
    args: [session.userId],
  })
  return NextResponse.json({ history: result.rows })
}

export async function POST(req: NextRequest) {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { from_label, from_id, to_label, to_id } = body ?? {}

  if (!to_label || !to_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await db.execute({
    sql: 'INSERT INTO journey_history (user_id, from_label, from_id, to_label, to_id) VALUES (?, ?, ?, ?, ?)',
    args: [session.userId, from_label ?? 'Current Location', from_id ?? 'current', to_label, to_id],
  })
  return NextResponse.json({ ok: true })
}
