import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCommentParams } from '../src/repositories/comments.repository.js'

// Tests replace the repository/pool methods and never connect to a database.
process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1/unused'
process.env.JWT_SECRET = 'test-only-unused-secret'
const { commentsRepository: repository } = await import('../src/repositories/comments.repository.js')
const { commentsService: service } = await import('../src/services/comments.service.js')
const { pool } = await import('../src/db/pool.js')
const user = { id: 'viewer', username: 'viewer' }
const base = {
  id: 'root', netflixTitleId: '201', userId: user.id, username: user.username,
  text: 'A scene', createdAt: '2026-01-01T00:00:00Z', likeCount: 0, disagreeCount: 0,
  parentCommentId: null, videoTimeSeconds: 120, editedAt: null, deletedAt: null,
}

test('reads keep episode IDs separate and restore both personal reactions', async (t) => {
  t.mock.method(repository, 'findByTitleId', async (id: string) => {
    assert.equal(id, '201')
    return [base, { ...base, id: 'reply', parentCommentId: 'root', videoTimeSeconds: null }]
  })
  t.mock.method(repository, 'findReactionCommentIds', async (_id: string, viewer: string, reaction: 'like' | 'disagree') => {
    assert.equal(viewer, user.id)
    return new Set([reaction === 'like' ? 'reply' : 'root'])
  })
  const [root] = await service.getCommentsForTitle('201', user)
  assert.equal(root.disagreedByMe, true)
  assert.equal(root.likedByMe, false)
  assert.equal(root.replies[0].likedByMe, true)
  assert.equal(root.replies[0].disagreedByMe, false)
})

test('guests read threads without personal reaction lookups', async (t) => {
  t.mock.method(repository, 'findByTitleId', async () => [base])
  t.mock.method(repository, 'findReactionCommentIds', async () => { throw Error('unexpected lookup') })
  const [root] = await service.getCommentsForTitle('201', null)
  assert.equal(root.likedByMe, false)
  assert.equal(root.disagreedByMe, false)
})

test('authors can edit; other viewers cannot edit or delete', async (t) => {
  t.mock.method(repository, 'findById', async () => base)
  t.mock.method(repository, 'updateText', async (_id: string, text: string) => ({ ...base, text }))
  assert.equal((await service.updateComment('root', 'New text', user)).text, 'New text')
  const other = { id: 'someone-else', username: 'someone-else' }
  await assert.rejects(service.updateComment('root', 'Changed', other), /only edit your own/)
  await assert.rejects(service.deleteComment('root', other), /only delete your own/)
})

test('replies inherit their parent discussion and cannot cross episodes', async (t) => {
  t.mock.method(repository, 'findById', async () => base)
  t.mock.method(repository, 'create', async (input: CreateCommentParams) => {
    assert.equal(input.netflixTitleId, '201')
    assert.equal(input.parentCommentId, 'root')
    assert.equal(input.videoTimeSeconds, null)
    return { ...base, ...input, id: 'reply' }
  })
  await service.createReply('root', 'Reply', user)
  await assert.rejects(service.createComment({ netflixTitleId: '202', parentCommentId: 'root', text: 'Wrong episode' }, user), /does not belong/)
})

test('deleting a parent preserves its thread and timestamp; deleting a leaf removes it', async (t) => {
  t.mock.method(repository, 'findById', async () => base)
  const hasReplies = t.mock.method(repository, 'hasReplies', async () => true)
  t.mock.method(repository, 'softDelete', async () => ({ ...base, text: '', deletedAt: '2026-01-02' }))
  const hardDelete = t.mock.method(repository, 'hardDelete', async () => {})
  const result = await service.deleteComment('root', user)
  assert.equal(result.softDeleted, true)
  assert.equal(result.comment?.videoTimeSeconds, 120)
  assert.equal(hardDelete.mock.callCount(), 0)
  hasReplies.mock.mockImplementation(async () => false)
  assert.deepEqual(await service.deleteComment('root', user), { softDeleted: false, comment: null })
  assert.equal(hardDelete.mock.callCount(), 1)
})

test('reaction switching and removal serialize on the row and commit both counts', async (t) => {
  let stored: 'like' | 'disagree' | null = 'like'
  const statements: string[] = []
  let releases = 0
  const client = {
    async query(sql: string, params?: unknown[]) {
      statements.push(sql)
      if (sql.startsWith('SELECT *')) return { rows: [{ id: 'root' }] }
      if (sql.startsWith('SELECT reaction')) return { rows: stored ? [{ reaction: stored }] : [] }
      if (sql.startsWith('DELETE')) stored = null
      if (sql.startsWith('INSERT')) stored = params![2] as typeof stored
      if (sql.startsWith('UPDATE')) return { rows: [{ like_count: stored === 'like' ? 1 : 0, disagree_count: stored === 'disagree' ? 1 : 0 }] }
      return { rows: [] }
    },
    release() { releases++ },
  }
  t.mock.method(pool, 'connect', async () => client)
  assert.deepEqual(await repository.toggleReaction('root', user.id, 'disagree'), {
    likeCount: 0, disagreeCount: 1, likedByMe: false, disagreedByMe: true,
  })
  assert.deepEqual(await repository.toggleReaction('root', user.id, 'disagree'), {
    likeCount: 0, disagreeCount: 0, likedByMe: false, disagreedByMe: false,
  })
  assert.match(statements[1], /deleted_at IS NULL FOR UPDATE/)
  assert.equal(statements.filter((sql) => sql === 'COMMIT').length, 2)
  assert.equal(releases, 2)
})

test('missing/deleted comments roll back and release the connection', async (t) => {
  const statements: string[] = []
  let released = false
  t.mock.method(pool, 'connect', async () => ({
    async query(sql: string) { statements.push(sql); return { rows: [] } },
    release() { released = true },
  }))
  assert.equal(await repository.toggleReaction('missing', user.id, 'like'), null)
  assert.equal(statements.at(-1), 'ROLLBACK')
  assert.equal(released, true)
})

test('reaction failures roll back instead of leaving a transaction open', async (t) => {
  const statements: string[] = []
  let released = false
  t.mock.method(pool, 'connect', async () => ({
    async query(sql: string) {
      statements.push(sql)
      if (sql.startsWith('SELECT')) throw Error('database unavailable')
      return { rows: [] }
    },
    release() { released = true },
  }))
  await assert.rejects(repository.toggleReaction('root', user.id, 'like'), /database unavailable/)
  assert.equal(statements.at(-1), 'ROLLBACK')
  assert.equal(released, true)
})
