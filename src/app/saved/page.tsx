import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureMigrated } from '@/lib/db-init'
import Icon from '@/components/ui/Icon'
import Link from 'next/link'
import type { SavedDestination } from '@/types/user'
import SavedActions from './SavedActions'

export const runtime = 'nodejs'

export default async function SavedPage() {
  await ensureMigrated()
  const session = await getSession()

  let destinations: SavedDestination[] = []
  if (session) {
    const result = await db.execute({
      sql: 'SELECT * FROM saved_destinations WHERE user_id = ? ORDER BY created_at DESC',
      args: [session.userId],
    })
    destinations = result.rows as unknown as SavedDestination[]
  }

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <h1 className="text-2xl font-headline font-black text-primary tracking-tighter">Saved</h1>
        <Link
          href="/profile"
          className="p-2 rounded-full hover:bg-surface-container transition-colors"
        >
          <Icon name="account_circle" size={26} className="text-primary" />
        </Link>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-6 pb-32">
        <div className="space-y-3">
          {destinations.length === 0 && (
            <div className="text-center py-16 text-on-surface-variant">
              <Icon name="bookmark" size={48} className="mb-4 opacity-30 block mx-auto" />
              <p className="font-headline font-bold text-lg">No saved destinations</p>
              <p className="text-sm mt-1">Search for a stop and save it here</p>
              <Link
                href="/search"
                className="inline-block mt-6 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm"
              >
                Search stops
              </Link>
            </div>
          )}

          {destinations.map((dest) => (
            <div
              key={dest.id}
              className="flex items-center gap-4 p-5 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)]"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Icon name="location_on" filled size={22} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface truncate">{dest.label}</p>
                <p className="text-sm text-on-surface-variant truncate">{dest.stop_name}</p>
              </div>
              <SavedActions destId={dest.id} />
            </div>
          ))}
        </div>

        {session && <AddDestinationForm />}
      </main>
    </>
  )
}

function AddDestinationForm() {
  return (
    <div className="pt-4 pb-8">
      <Link
        href="/search"
        className="flex items-center gap-3 p-5 bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 transition-all"
      >
        <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center">
          <Icon name="add" size={20} className="text-primary" />
        </div>
        <span className="font-semibold text-on-surface-variant">Add a destination</span>
      </Link>
    </div>
  )
}
