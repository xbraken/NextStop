import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import { isValidColorKey } from '@/lib/saved-colors'
import { isValidIcon } from '@/lib/saved-icons'

export const runtime = 'nodejs'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.execute({
    sql: 'DELETE FROM saved_destinations WHERE id = ? AND user_id = ?',
    args: [id, session.userId],
  })
  return NextResponse.json({ ok: true })
}

// PATCH — only the color, icon, and label are user-editable for now. Anything
// else in the body is ignored so callers can't mutate identifying fields
// (stop_id etc). `null` for color/icon clears back to the default.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureMigrated()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const updates: string[] = []
  const args: Array<string | number | null> = []

  if ('color' in body) {
    const key = body.color
    if (key !== null && !isValidColorKey(key)) {
      return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
    }
    updates.push('color = ?')
    args.push(key ?? null)
  }

  if ('icon' in body) {
    const key = body.icon
    if (key !== null && !isValidIcon(key)) {
      return NextResponse.json({ error: 'Invalid icon' }, { status: 400 })
    }
    updates.push('icon = ?')
    args.push(key ?? null)
  }

  if ('label' in body) {
    const label = typeof body.label === 'string' ? body.label.trim() : ''
    if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 })
    updates.push('label = ?')
    args.push(label)
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
  }

  args.push(id, session.userId)
  const result = await db.execute({
    sql: `UPDATE saved_destinations SET ${updates.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`,
    args,
  })
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ destination: result.rows[0] })
}
