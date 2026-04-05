'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="space-y-6 py-4">
      {/* Mode toggle */}
      <div className="flex bg-surface-container-low p-1 rounded-full">
        <button
          onClick={() => { setMode('login'); setError('') }}
          className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${mode === 'login' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant'}`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setMode('register'); setError('') }}
          className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${mode === 'register' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant'}`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
            Username
          </label>
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            placeholder="e.g. johndoe"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-error text-sm font-medium bg-error-container/20 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-extrabold text-lg py-4 rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60 mt-2"
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}
