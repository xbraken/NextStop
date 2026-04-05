'use client'

import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

export default function SavedActions({ destId }: { destId: number }) {
  const router = useRouter()

  async function handleDelete() {
    await fetch(`/api/saved/${destId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      className="p-2 rounded-full hover:bg-error/10 transition-colors text-outline hover:text-error"
      aria-label="Delete destination"
    >
      <Icon name="delete" size={20} />
    </button>
  )
}
