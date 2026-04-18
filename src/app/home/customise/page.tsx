import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import { DEFAULT_HOME_LAYOUT, parseHomeLayout } from '@/lib/home-sections'
import CustomiseForm from './CustomiseForm'

export const runtime = 'nodejs'

export default async function CustomiseHomePage() {
  await ensureMigrated()
  const session = await getSession()
  if (!session) redirect('/profile')

  const result = await db.execute({
    sql: 'SELECT home_layout FROM users WHERE id = ? LIMIT 1',
    args: [session.userId],
  })
  const raw = (result.rows[0]?.home_layout as string | null | undefined) ?? null
  const layout = parseHomeLayout(raw) ?? DEFAULT_HOME_LAYOUT

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <Link
          href="/"
          aria-label="Back"
          className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors active:scale-95"
        >
          <Icon name="arrow_back" size={24} className="text-primary" />
        </Link>
        <h1 className="text-lg font-headline font-black text-on-surface tracking-tight">
          Customise home
        </h1>
        <div className="w-10" aria-hidden />
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto pb-32">
        <p className="text-sm text-on-surface-variant mb-6">
          Choose which sections show on your home screen and what order they
          appear in. Tap the arrows to move a section up or down, and the eye
          to hide it.
        </p>
        <CustomiseForm initialLayout={layout} />
      </main>
    </>
  )
}
