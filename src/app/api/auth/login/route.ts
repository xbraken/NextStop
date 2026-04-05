import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import { signToken, verifyPassword, cookieOptions, COOKIE_NAME } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  await ensureMigrated()

  const body = await req.json().catch(() => null)
  const { username, password } = body ?? {}

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const result = await db.execute({
    sql: 'SELECT id, username, password_hash FROM users WHERE username = ?',
    args: [username.toLowerCase()],
  })

  const user = result.rows[0]
  if (!user) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password_hash as string)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const token = await signToken({
    userId: user.id as number,
    username: user.username as string,
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, token, cookieOptions())
  return response
}
