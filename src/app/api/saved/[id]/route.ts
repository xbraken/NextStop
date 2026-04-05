import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

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
