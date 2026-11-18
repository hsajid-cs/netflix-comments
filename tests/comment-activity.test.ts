import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Comment } from '../src/shared/types.ts'
import { commentActivity } from '../src/ui/comment-activity.ts'

function stamp(seconds: number | null, deletedAt: string | null = null): Comment {
  return { id: 'c', netflixTitleId: '201', userId: 'u', username: 'viewer', text: 'comment',
    createdAt: '2026-01-01', likeCount: 0, disagreeCount: 0, likedByMe: false, disagreedByMe: false,
    parentCommentId: null, videoTimeSeconds: seconds, editedAt: null, deletedAt, replies: [] }
}

test('activity places real comments in time buckets, including zero and the exact endpoint', () => {
  const result = commentActivity([stamp(0), stamp(19), stamp(11), stamp(30), stamp(100)], 100, 5)
  assert.deepEqual(result, [
    { count: 3, seconds: 0 }, { count: 1, seconds: 30 }, { count: 0, seconds: null },
    { count: 0, seconds: null }, { count: 1, seconds: 100 },
  ])
})

test('untimed, deleted, invalid and out-of-episode comments do not create activity', () => {
  const result = commentActivity([stamp(null), stamp(-1), stamp(NaN), stamp(Infinity), stamp(101), stamp(10, '2026-01-02')], 100, 3)
  assert.deepEqual(result, Array.from({ length: 3 }, () => ({ count: 0, seconds: null })))
})

test('unknown runtimes and invalid bucket counts produce no timeline', () => {
  for (const duration of [0, -1, NaN, Infinity]) assert.deepEqual(commentActivity([stamp(10)], duration), [])
  assert.deepEqual(commentActivity([], 100, 0), [])
  assert.deepEqual(commentActivity([], 100, 2.5), [])
})
