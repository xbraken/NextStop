import { getSession } from '@/lib/auth'
import Icon from '@/components/ui/Icon'
import Link from 'next/link'
import AuthForm from './AuthForm'
import LogoutButton from './LogoutButton'

export const runtime = 'nodejs'

export default async function ProfilePage() {
  const session = await getSession()

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {session && (
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors active:scale-95 text-primary">
              <Icon name="arrow_back" size={22} />
            </Link>
          )}
          <h1 className="text-2xl font-headline font-black text-primary tracking-tighter">
            {session ? 'Account' : 'Sign in'}
          </h1>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto pb-16">
        {session ? (
          <div className="space-y-6">
            {/* Profile card */}
            <div className="p-8 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.04)]">
              <div className="flex items-center gap-5 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                  <Icon name="person" filled size={32} className="text-on-primary" />
                </div>
                <div>
                  <p className="font-headline font-bold text-xl text-on-surface">{session.username}</p>
                  <p className="text-sm text-on-surface-variant">NextStop member</p>
                </div>
              </div>
              <LogoutButton />
            </div>

            {/* Quick links */}
            <div className="space-y-3">
              {[
                { href: '/saved', icon: 'bookmark', label: 'Saved Destinations' },
                { href: '/search', icon: 'route', label: 'Plan a Journey' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 p-5 bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_rgba(26,28,28,0.04)] hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon name={item.icon} size={20} className="text-primary" />
                  </div>
                  <span className="font-semibold text-on-surface flex-1">{item.label}</span>
                  <Icon name="chevron_right" size={20} className="text-outline" />
                </a>
              ))}
            </div>
          </div>
        ) : (
          <AuthForm />
        )}
      </main>
    </>
  )
}
