import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { NetflixTitleState } from '../src/shared/types.ts'
import { discussionId, episodeLabel, hideFutureComment } from '../src/ui/discussion-scope.ts'
import { parseNetflixPath } from '../src/content/detector/parse-location.ts'

const episode: NetflixTitleState = {
  pageType: 'watch', titleId: '100', seriesId: '100', episodeId: '201',
  titleName: 'A series', url: 'https://www.netflix.com/watch/201',
}

test('episode identity shows available details without inventing missing ones', () => {
  assert.equal(episodeLabel({ ...episode, seasonNumber: 2, episodeNumber: 3, episodeName: 'The Arrival' }), 'S2 E3 · The Arrival')
  assert.equal(episodeLabel({ ...episode, episodeNumber: 3 }), 'E3')
  assert.equal(episodeLabel({ ...episode, episodeName: 'Pilot' }), 'Pilot')
  assert.equal(episodeLabel(episode), 'This episode')
})

test('episodes have separate discussions and share the whole-series discussion', () => {
  const next = { ...episode, episodeId: '202' }
  assert.equal(discussionId(episode, 'episode'), '201')
  assert.equal(discussionId(next, 'episode'), '202')
  assert.equal(discussionId(episode, 'series'), discussionId(next, 'series'))
})

test('missing series metadata never redirects a series discussion to the episode', () => {
  assert.equal(discussionId({ ...episode, seriesId: null }, 'series'), null)
  assert.equal(discussionId({ ...episode, episodeId: null }, 'episode'), null)
})

test('title pages connect to the same series thread as playback', () => {
  const detail = { ...episode, pageType: 'title' as const, episodeId: null }
  assert.equal(discussionId(detail, 'series'), discussionId(episode, 'series'))
  assert.equal(discussionId(detail, 'episode'), null)
})

test('playback URL preserves the exact episode ID', () => {
  assert.deepEqual(parseNetflixPath('/watch/201'), { pageType: 'watch', titleId: '201' })
  assert.deepEqual(parseNetflixPath('/title/100'), { pageType: 'title', titleId: '100' })
})

test('future comments remain masked until the exact timestamp, including seeking backward', () => {
  assert.equal(hideFutureComment(120, 119.9), true)
  assert.equal(hideFutureComment(120, 120), false)
  assert.equal(hideFutureComment(120, 180), false)
  assert.equal(hideFutureComment(120, 60), true)
  assert.equal(hideFutureComment(0, 0), false)
})

test('unknown playback guards timestamped comments while untimed discussion remains readable', () => {
  assert.equal(hideFutureComment(120, null), true)
  assert.equal(hideFutureComment(120, NaN), true)
  assert.equal(hideFutureComment(null, null), false)
  assert.equal(hideFutureComment(null, 0), false)
})
