import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import {
  DEFAULT_HOME_LAYOUT,
  isValidHomeLayout,
  parseHomeLayout,
} from '@/lib/home-sections'

export const runtime = 'nodejs'

export async function GET() {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute({
    sql: 'SELECT home_layout FROM users WHERE id = ? LIMIT 1',
    args: [session.userId],
  })
  const raw = (result.rows[0]?.home_layout as string | null | undefined) ?? null
  const homeLayout = parseHomeLayout(raw) ?? DEFAULT_HOME_LAYOUT
  return NextResponse.json({ homeLayout })
}

export async function PATCH(req: NextRequest) {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // homeLayout: array of section IDs (ordered), or null to reset to default.
  if ('homeLayout' in body) {
    const value = body.homeLayout
    if (value === null) {
      await db.execute({
        sql: 'UPDATE users SET home_layout = NULL WHERE id = ?',
        args: [session.userId],
      })
      return NextResponse.json({ homeLayout: DEFAULT_HOME_LAYOUT })
    }
    if (!isValidHomeLayout(value)) {
      return NextResponse.json({ error: 'Invalid homeLayout' }, { status: 400 })
    }
    await db.execute({
      sql: 'UPDATE users SET home_layout = ? WHERE id = ?',
      args: [JSON.stringify(value), session.userId],
    })
    return NextResponse.json({ homeLayout: value })
  }

  return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
}
