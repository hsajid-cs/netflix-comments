import PanelMessage from './PanelMessage'
import { ChatIcon, SparkleIcon } from './icons'

/**
 * Shown when a title has zero comments. If the viewer can post, the CTA jumps
 * them straight into the composer; otherwise it's purely informational.
 */
export default function EmptyState({ onStart }: { onStart?: () => void }) {
  return (
    <PanelMessage
      icon={<ChatIcon />}
      title="No comments yet"
      action={onStart ? { label: 'Start the conversation', onClick: onStart, icon: <SparkleIcon width={14} height={14} /> } : undefined}
    >
      Be the first to share a thought on this title.
    </PanelMessage>
  )
}
