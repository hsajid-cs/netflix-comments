import { useAuth } from '../ui/hooks/useAuth'
import { useUserStats } from '../ui/hooks/useUserStats'
import AuthForm from '../ui/components/AuthForm'
import type { AuthMode } from '../ui/components/AuthForm'
import { ChatIcon, HeartIcon, SparkleIcon } from '../ui/components/icons'
import type { UserStats } from '../shared/types'

/**
 * The extension popup is the home for authentication. Logged out, it shows the
 * login / sign-up form; logged in, it shows the current username, a log-out
 * button, and a "Your activity" card. The in-page comments panel only reflects
 * auth state.
 */
export default function Popup() {
  const { user, status, error, signup, login, logout, dismissError } = useAuth()

  function handleSubmit(mode: AuthMode, username: string, password: string) {
    return mode === 'login' ? login(username, password) : signup(username, password)
  }

  return (
    <div className="nc-popup">
      {(!user || status === 'loading') && <div className="nc-popup-brand">
        <span className="nc-popup-mark">
          <ChatIcon width={15} height={15} />
        </span>
        <div>
          <strong>Netflix Comments</strong>
          <p className="nc-popup-tagline">For the moments worth talking about.</p>
        </div>
      </div>}

      {status === 'loading' && <p className="nc-popup-muted">Loading…</p>}

      {status === 'ready' && user && (
        <>
          <div className="nc-popup-account">
            <div className="nc-popup-profile">
              <span className="nc-popup-avatar" aria-hidden="true">{user.username.slice(0, 2).toUpperCase()}</span>
              <div className="nc-popup-identity">
                <p className="nc-popup-username" title={user.username}>{user.username}</p>
                <p className="nc-popup-account-label">Signed in</p>
              </div>
            </div>
            <button
              type="button"
              className="nc-popup-logout"
              onClick={() => void logout().catch(() => {})}
            >
              Log out
            </button>
            {error && <p className="nc-auth-error" role="alert">{error}</p>}
          </div>

          <StatsCard />
          <div className="nc-popup-footer"><ChatIcon width={12} height={12} />Netflix Comments</div>
        </>
      )}

      {status === 'ready' && !user && (
        <>
          <p className="nc-popup-muted">
            Log in to post, reply, and like. You can read every title's comments without an account.
          </p>
          <AuthForm onSubmit={handleSubmit} error={error} onClearError={dismissError} />
        </>
      )}
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString()

function flourishLine(s: UserStats): string {
  const posts = s.comments + s.replies
  if (posts === 0) return 'Post your first comment to get things rolling.'
  if (s.likesReceived > 0) {
    return `You've sparked ${fmt(s.likesReceived)} like${s.likesReceived === 1 ? '' : 's'} across ${fmt(
      s.titles,
    )} title${s.titles === 1 ? '' : 's'}.`
  }
  return `${fmt(posts)} comment${posts === 1 ? '' : 's'} in — the likes will follow.`
}

function StatsCard() {
  const { stats } = useUserStats(true)
  if (!stats) return null

  return (
    <div className="nc-stats">
      <h2 className="nc-visually-hidden">Your activity</h2>
      <div className="nc-stats-grid">
        <Stat value={stats.comments} label={stats.comments === 1 ? 'Comment' : 'Comments'} />
        <Stat value={stats.likesReceived} label="Likes earned" />
        <Stat value={stats.likesGiven} label="Likes given" />
      </div>
      <h3 className="nc-stats-title">Your impact</h3>
      <p className="nc-stats-flourish">
        <HeartIcon width={13} height={13} filled />
        {flourishLine(stats)}
      </p>
      <h3 className="nc-stats-title">Your conversations</h3>
      <div className="nc-stats-details">
        <div><span>Titles you've talked about</span><b>{fmt(stats.titles)}</b></div>
        <div><span>Replies you've shared</span><b>{fmt(stats.replies)}</b></div>
      </div>
      {stats.comments === 0 && stats.replies === 0 && <p className="nc-popup-muted"><SparkleIcon width={12} height={12} /> Your next watch is a good place to start.</p>}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="nc-stat">
      <b>{fmt(value)}</b>
      <span className="nc-stat-label">{label}</span>
    </div>
  )
}
