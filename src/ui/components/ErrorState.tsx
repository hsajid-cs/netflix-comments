import PanelMessage from './PanelMessage'
import { AlertIcon, CompassIcon, PlugIcon } from './icons'

export type ErrorKind = 'offline' | 'server' | 'undetected' | 'generic'

const COPY: Record<ErrorKind, { title: string; body: string; retry: string }> = {
  offline: {
    title: "You're offline",
    body: 'Comments will load again once your connection is back.',
    retry: 'Try again',
  },
  server: {
    title: 'Comments are unavailable',
    body: "We couldn't reach the comments service. It may be down for a moment — your draft is safe.",
    retry: 'Retry',
  },
  undetected: {
    title: "Couldn't identify this title",
    body: 'Open a film or series (its Netflix detail or player page) and the discussion will appear here.',
    retry: 'Check again',
  },
  generic: {
    title: 'Something went wrong',
    body: 'An unexpected error stopped comments from loading.',
    retry: 'Retry',
  },
}

/**
 * Full-body error state. `kind` picks tailored copy and an icon; `message`
 * (when given) replaces the generic body with the backend's own wording.
 */
export default function ErrorState({
  kind = 'generic',
  message,
  onRetry,
  retrying = false,
}: {
  kind?: ErrorKind
  message?: string | null
  onRetry: () => void
  retrying?: boolean
}) {
  const copy = COPY[kind]
  const Icon = kind === 'undetected' ? CompassIcon : kind === 'server' ? PlugIcon : AlertIcon

  return (
    <PanelMessage
      icon={<Icon />}
      tone={kind === 'undetected' ? 'default' : 'danger'}
      title={copy.title}
      action={{
        label: retrying ? 'Retrying…' : copy.retry,
        onClick: onRetry,
        variant: 'ghost',
      }}
    >
      {message && kind !== 'undetected' ? message : copy.body}
    </PanelMessage>
  )
}
