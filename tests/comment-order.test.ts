import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Comment } from '../src/shared/types.ts'
import { containsComment, findCommentAtMoment, sortComments } from '../src/ui/comment-order.ts'

function comment(id: string, createdAt: string, videoTimeSeconds: number | null = null, replies: Comment[] = []): Comment {
  return {
    id, createdAt, videoTimeSeconds, replies,
    netflixTitleId: '123', userId: 'user', username: 'viewer', text: id,
    likeCount: 0, likedByMe: false, disagreeCount: 0, disagreedByMe: false, parentCommentId: null, editedAt: null, deletedAt: null,
  }
}

const early = comment('early', '2026-01-01T00:00:00Z', 10)
const late = comment('late', '2026-01-02T00:00:00Z', 50)
const unstamped = comment('unstamped', '2026-01-03T00:00:00Z')

test('newest sorts roots descending without mutating the input or reply order', () => {
  const replies = [early, late]
  const root = comment('root', '2026-01-04T00:00:00Z', null, replies)
  const input = [early, late, root]
  assert.deepEqual(sortComments(input, 'newest').map((c) => c.id), ['root', 'late', 'early'])
  assert.deepEqual(input.map((c) => c.id), ['early', 'late', 'root'])
  assert.equal(root.replies, replies)
  assert.deepEqual(replies.map((c) => c.id), ['early', 'late'])
})

test('top sorts by likes with newest as the tie breaker and preserves the input tree', () => {
  const popular = { ...early, likeCount: 12 }
  const tied = { ...late, likeCount: 12 }
  const input = [popular, unstamped, tied]
  assert.deepEqual(sortComments(input, 'top').map((c) => c.id), ['late', 'early', 'unstamped'])
  assert.deepEqual(input.map((c) => c.id), ['early', 'unstamped', 'late'])
})

test('moment sorts timestamps first, then unstamped comments chronologically', () => {
  const older = comment('older', '2025-01-01T00:00:00Z')
  assert.deepEqual(sortComments([unstamped, late, older, early], 'moment').map((c) => c.id),
    ['early', 'late', 'older', 'unstamped'])
})

test('equal moments use creation order, including timestamp zero', () => {
  const zero = comment('zero', '2026-01-04T00:00:00Z', 0)
  const same = comment('same', '2026-01-03T00:00:00Z', 10)
  assert.deepEqual(sortComments([same, early, zero], 'moment').map((c) => c.id), ['zero', 'early', 'same'])
})

test('jump picks the next timestamp regardless of input order', () => {
  assert.equal(findCommentAtMoment([late, unstamped, early], 5)?.id, 'early')
  assert.equal(findCommentAtMoment([late, unstamped, early], 10)?.id, 'early')
  assert.equal(findCommentAtMoment([early, unstamped, late], 20)?.id, 'late')
})

test('jump falls back to the last timestamp, or nothing when none exist', () => {
  assert.equal(findCommentAtMoment([late, early, unstamped], 100)?.id, 'late')
  assert.equal(findCommentAtMoment([unstamped], 10), undefined)
  assert.equal(findCommentAtMoment([], 10), undefined)
})

test('target lookup includes nested replies beyond the visible root batch', () => {
  const root = comment('root', early.createdAt, null, [comment('reply', early.createdAt, null, [late])])
  assert.equal(containsComment(root, 'root'), true)
  assert.equal(containsComment(root, 'late'), true)
  assert.equal(containsComment(root, 'missing'), false)
})
