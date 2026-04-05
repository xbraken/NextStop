'use client'

import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-error font-semibold hover:bg-error/5 px-4 py-2 rounded-full transition-colors"
    >
      <Icon name="logout" size={18} className="text-error" />
      Sign out
    </button>
  )
}
