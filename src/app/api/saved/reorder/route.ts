import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'

export const runtime = 'nodejs'

// POST — accepts { orderedIds: number[] } and assigns sort_order = index to
// each. Only rows belonging to the session user are updated, so a malicious
// caller can't reorder someone else's saved items.
export async function POST(req: NextRequest) {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const ids = body && Array.isArray(body.orderedIds) ? body.orderedIds : null
  if (!ids || !ids.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))) {
    return NextResponse.json({ error: 'orderedIds must be a number[]' }, { status: 400 })
  }

  await db.batch(
    ids.map((id: number, index: number) => ({
      sql: 'UPDATE saved_destinations SET sort_order = ? WHERE id = ? AND user_id = ?',
      args: [index, id, session.userId],
    })),
    'write',
  )

  return NextResponse.json({ ok: true })
}
