import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Comment } from '../src/shared/types.ts'
import CommentItem from '../src/ui/components/CommentItem.tsx'

const reply: Comment = {
  id: 'reply', netflixTitleId: '201', userId: 'viewer', username: 'viewer', text: 'SECRET_REPLY',
  createdAt: '2026-01-01T00:00:00Z', likeCount: 0, disagreeCount: 0,
  likedByMe: false, disagreedByMe: false, parentCommentId: 'root', videoTimeSeconds: null,
  editedAt: null, deletedAt: null, replies: [],
}
const root: Comment = { ...reply, id: 'root', text: 'SECRET_SCENE', parentCommentId: null, videoTimeSeconds: 120, replies: [reply] }

function render(comment: Comment, playback: number | null, viewer = 'viewer') {
  return renderToStaticMarkup(createElement(CommentItem, {
    comment, currentVideoTime: playback, currentUserId: viewer, isAuthenticated: true,
    newCommentId: null, onToggleLike() {}, onToggleDisagree() {}, onReply() {},
    async onEdit() {}, async onDelete() {},
  }))
}

test('future comment text, reply text and actions are absent from rendered markup', () => {
  const html = render(root, 119.9)
  assert.doesNotMatch(html, /SECRET_SCENE|SECRET_REPLY|Edit|Delete|Disagree/)
  assert.match(html, /show anyway/)
})

test('the thread appears when playback reaches its moment and masks again after a rewind', () => {
  const html = render(root, 120)
  assert.match(html, /SECRET_SCENE/)
  assert.match(html, /SECRET_REPLY/)
  assert.match(html, /Disagree/)
  assert.doesNotMatch(render(root, 40), /SECRET_SCENE|SECRET_REPLY/)
})

test('unknown playback keeps spoilers masked, including replies under a deleted parent', () => {
  assert.doesNotMatch(render(root, null), /SECRET_SCENE|SECRET_REPLY/)
  const tombstone = { ...root, text: '', deletedAt: '2026-01-02' }
  assert.doesNotMatch(render(tombstone, 60), /SECRET_REPLY/)
  assert.match(render(tombstone, 120), /SECRET_REPLY/)
})

test('edit/delete controls are only shown for the author, while reactions remain available', () => {
  const own = render(root, 120)
  assert.match(own, /Edit/)
  assert.match(own, /Delete/)
  const other = render(root, 120, 'someone-else')
  assert.doesNotMatch(other, /Edit|Delete/)
  assert.match(other, /Disagree/)
})

test('disagreement is an accessible icon button with its count and selected state', () => {
  const html = render({ ...root, disagreedByMe: true, disagreeCount: 3 }, 120)
  const button = html.match(/<button[^>]*aria-label="Remove disagreement with comment by viewer"[^>]*>(.*?)<\/button>/)?.[0]
  assert.ok(button)
  assert.match(button, /aria-pressed="true"/)
  assert.match(button, /<svg/)
  assert.match(button, /<\/svg>3<\/button>/)
  assert.doesNotMatch(button, />Disagree/)
})
