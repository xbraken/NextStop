import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import { signToken, hashPassword, cookieOptions, COOKIE_NAME } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  await ensureMigrated()

  const body = await req.json().catch(() => null)
  const { username, password } = body ?? {}

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  if (username.length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [username.toLowerCase()],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const result = await db.execute({
    sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id, username',
    args: [username.toLowerCase(), passwordHash],
  })

  const user = result.rows[0]
  const token = await signToken({
    userId: user.id as number,
    username: user.username as string,
  })

  const response = NextResponse.json({ success: true }, { status: 201 })
  response.cookies.set(COOKIE_NAME, token, cookieOptions())
  return response
}
