import { useState } from 'react'
import type { FormEvent } from 'react'

export type AuthMode = 'login' | 'signup'

/**
 * Username + password form used by the extension popup for both logging in and
 * signing up. Presentational: the caller owns the actual auth call and passes
 * back an `error` string to display. Mirrors CommentComposer's async-submit
 * shape (disable while submitting, keep fields on failure).
 */
export default function AuthForm({
  onSubmit,
  error,
  onClearError,
}: {
  onSubmit: (mode: AuthMode, username: string, password: string) => Promise<void>
  error: string | null
  onClearError: () => void
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || !username.trim() || !password) return
    setSubmitting(true)
    try {
      await onSubmit(mode, username.trim(), password)
      setPassword('')
    } catch {
      // Surfaced via `error`; keep what was typed so the user can retry.
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    onClearError()
  }

  return (
    <form className="nc-auth" onSubmit={handleSubmit}>
      <div className="nc-auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`nc-auth-tab${mode === 'login' ? ' nc-auth-tab--active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`nc-auth-tab${mode === 'signup' ? ' nc-auth-tab--active' : ''}`}
          onClick={() => switchMode('signup')}
        >
          Sign up
        </button>
      </div>

      <label className="nc-auth-field">
        <span>Username</span>
        <input
          className="nc-auth-input"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={32}
          required
        />
      </label>

      <label className="nc-auth-field">
        <span>Password</span>
        <input
          className="nc-auth-input"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          maxLength={128}
          required
        />
      </label>

      {error && (
        <p className="nc-auth-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="nc-auth-submit"
        disabled={submitting || !username.trim() || !password}
      >
        {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
      </button>

      {mode === 'signup' && (
        <p className="nc-auth-hint">
          3–32 characters, letters/numbers/underscore. Password at least 8 characters. This account is
          only for comments — it is not your Netflix login.
        </p>
      )}
    </form>
  )
}
