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
  const { label, stop_name, stop_id, lat, lng } = body ?? {}

  if (!label || !stop_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Prevent duplicates
  const existing = await db.execute({
    sql: 'SELECT id FROM saved_destinations WHERE user_id = ? AND stop_id = ?',
    args: [session.userId, stop_id],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Already saved' }, { status: 409 })
  }

  const result = await db.execute({
    sql: 'INSERT INTO saved_destinations (user_id, label, stop_name, stop_id, lat, lng) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    args: [session.userId, label, stop_name ?? label, stop_id, lat ?? null, lng ?? null],
  })
  return NextResponse.json({ destination: result.rows[0] }, { status: 201 })
}
